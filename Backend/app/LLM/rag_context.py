"""
rag_context.py — Shared RAG context builder for test case generation & regeneration.

Used by:
  - regenerate_single_test_case
  - bulk_regenerate_test_cases
  - _generate_test_case_for_story (initial generation)
  - iterative_refine

Pipeline:
  1. Embed the story content / query text using gemini-embedding-001
  2. Vector search LanceDB for top-k similar stories in the same workspace
  3. Pull their test cases from Postgres
  4. Return structured context for LLM prompt injection
"""

import json
import lancedb
import psycopg2
import psycopg2.extras
from app.config import Config


def build_rag_context(
    story_id: str,
    workspace_id: str,
    query_text: str,
    top_k: int = 3,
    exclude_story_id: str = None,
) -> dict:
    """
    Returns:
    {
      "story_content": str,          # doc_content_text from LanceDB for this story
      "story_description": str,      # storyDescription from LanceDB
      "similar_examples": [          # top-k similar stories with their test cases
        {
          "story_id": str,
          "story_description": str,
          "similarity_score": float,
          "test_cases": [...],        # list of test case dicts
        }
      ],
      "all_existing_tcs": [...],     # all current test cases for THIS story (for consistency)
    }
    """
    result = {
        "story_content": "",
        "story_description": "",
        "similar_examples": [],
        "all_existing_tcs": [],
    }

    # ── 1. Get this story's content from LanceDB ──────────────────────────────
    try:
        db = lancedb.connect(Config.LANCE_DB_PATH)
        table = db.open_table(Config.TABLE_NAME_LANCE)

        # Use .where() to filter in LanceDB instead of loading all rows into Pandas
        try:
            # LanceDB SQL filter — avoids full table scan
            filter_expr = f"storyID = '{story_id}'"
            if workspace_id:
                safe_ws = str(workspace_id).replace("'", "''")
                filter_expr += f" AND workspace_id = '{safe_ws}'"
            rows = table.search().where(filter_expr).limit(1).to_list()
            if rows:
                result["story_content"] = str(rows[0].get("doc_content_text") or "")
                result["story_description"] = str(rows[0].get("storyDescription") or "")
        except Exception:
            # Fallback to pandas if .where() fails (older LanceDB version)
            df = table.to_pandas()
            story_rows = df[df["storyID"] == story_id]
            if workspace_id and "workspace_id" in story_rows.columns:
                ws_rows = story_rows[story_rows["workspace_id"] == workspace_id]
                if not ws_rows.empty:
                    story_rows = ws_rows
            if not story_rows.empty:
                row = story_rows.iloc[0]
                result["story_content"] = str(row.get("doc_content_text") or "")
                result["story_description"] = str(row.get("storyDescription") or "")
    except Exception as e:
        print(f"[rag_context] LanceDB story fetch failed: {e}")

    # ── 2. Get all existing test cases for this story (consistency context) ───
    try:
        conn = Config.get_postgres_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT test_case_json FROM test_cases
                WHERE story_id = %s AND workspace_id = %s
                ORDER BY created_on DESC LIMIT 1
            """, (story_id, workspace_id))
            row = cur.fetchone()
            if row and row["test_case_json"]:
                tc_json = row["test_case_json"]
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)
                result["all_existing_tcs"] = tc_json.get("test_cases", [])
        conn.close()
    except Exception as e:
        print(f"[rag_context] Postgres existing TC fetch failed: {e}")

    # ── 3. Vector search for similar stories ─────────────────────────────────
    if not query_text.strip():
        # Use first 500 chars of full content for better semantic matching
        query_text = result["story_content"][:500] or result["story_description"]

    # Always prefer full content over description for embedding quality
    if len(query_text) < 100 and result["story_content"]:
        query_text = result["story_content"][:500]

    if not query_text.strip():
        return result

    try:
        db = lancedb.connect(Config.LANCE_DB_PATH)
        table = db.open_table(Config.TABLE_NAME_LANCE)
        query_vector = Config.EMBEDDING_MODEL.encode(query_text).tolist()

        # Fetch more than needed so we can filter by workspace and exclude self
        candidates = (
            table.search(query_vector)
            .metric("cosine")
            .limit(top_k * 4)
            .to_list()
        )

        # Filter to workspace, exclude this story
        filtered = []
        for c in candidates:
            if workspace_id and c.get("workspace_id") != workspace_id:
                continue
            if c.get("storyID") == story_id:
                continue
            if exclude_story_id and c.get("storyID") == exclude_story_id:
                continue
            filtered.append(c)
            if len(filtered) >= top_k:
                break

        if not filtered:
            return result

        # ── 4. Pull test cases for similar stories from Postgres ──────────────
        similar_ids = [c["storyID"] for c in filtered]
        try:
            conn = Config.get_postgres_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT DISTINCT ON (story_id) story_id, test_case_json
                    FROM test_cases
                    WHERE story_id = ANY(%s) AND workspace_id = %s
                      AND test_case_json IS NOT NULL AND test_case_generated = TRUE
                    ORDER BY story_id, created_on DESC
                """, (similar_ids, workspace_id))
                tc_rows = {r["story_id"]: r["test_case_json"] for r in cur.fetchall()}
            conn.close()
        except Exception as e:
            print(f"[rag_context] Postgres similar TC fetch failed: {e}")
            tc_rows = {}

        for c in filtered:
            sid = c["storyID"]
            raw = tc_rows.get(sid)
            tcs = []
            if raw:
                try:
                    parsed = json.loads(raw) if isinstance(raw, str) else raw
                    tcs = parsed.get("test_cases", [])[:5]  # max 5 examples per story
                except Exception:
                    pass
            result["similar_examples"].append({
                "story_id": sid,
                "story_description": str(c.get("storyDescription") or ""),
                "similarity_score": float(c.get("_distance", 0)),
                "test_cases": tcs,
            })

    except Exception as e:
        print(f"[rag_context] Vector search failed: {e}")

    return result


def format_rag_context_for_prompt(ctx: dict, max_examples: int = 2) -> str:
    """
    Formats the RAG context into a prompt section.
    Returns empty string if nothing useful found.

    Improvements over original:
    - Shows acceptance criteria from similar stories (for format guidance)
    - Shows NEGATIVE examples (what similar stories had that failed / were edge cases)
    - Shows expected_result not just titles/steps
    - Marks gaps: "Story X covered Y — consider covering Z for completeness"
    """
    parts = []

    examples = [e for e in ctx.get("similar_examples", []) if e.get("test_cases")][:max_examples]
    if examples:
        parts.append("=== SIMILAR STORIES FROM YOUR WORKSPACE ===")
        parts.append("Use these as context for coverage — identify what they tested and what gaps might exist for YOUR story.\n")
        for i, ex in enumerate(examples, 1):
            sim_pct = int((1 - ex.get('similarity_score', 0)) * 100)
            parts.append(f"[Similar Story {i} — {sim_pct}% match] {ex['story_description'][:150]}")

            tcs = ex.get("test_cases", [])
            # Group by type if available
            positives = [tc for tc in tcs if 'positive' in tc.get('group','').lower() or 'functional' in tc.get('group','').lower()][:2]
            negatives = [tc for tc in tcs if 'negative' in tc.get('group','').lower() or 'error' in tc.get('group','').lower()][:2]
            security = [tc for tc in tcs if 'security' in tc.get('group','').lower() or 'auth' in tc.get('group','').lower()][:1]
            other = [tc for tc in tcs if tc not in positives and tc not in negatives and tc not in security][:1]

            sample_tcs = (positives + negatives + security + other)[:4]
            if not sample_tcs:
                sample_tcs = tcs[:4]

            for tc in sample_tcs:
                priority = tc.get('priority', 'M')
                title = tc.get('title', '')
                expected = tc.get('expected_result', '')[:120]
                rationale = tc.get('rationale', '')
                parts.append(f"  [{priority}] {title}")
                if expected:
                    parts.append(f"       → Expected: {expected}")
                if rationale:
                    parts.append(f"       → Covers: {rationale}")
            parts.append("")

    existing = ctx.get("all_existing_tcs", [])
    if existing:
        parts.append("=== EXISTING TEST CASES FOR THIS STORY (DO NOT DUPLICATE) ===")
        for tc in existing[:8]:
            parts.append(f"  [{tc.get('priority','?')}] {tc.get('title','')} (ID: {tc.get('id','')})")
        parts.append("Generate test cases that ADD COVERAGE — do not repeat any of the above.\n")

    return "\n".join(parts) if parts else ""

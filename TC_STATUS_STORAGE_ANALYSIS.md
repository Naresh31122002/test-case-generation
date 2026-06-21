# `tc_status` Storage Analysis — JSON-Embedded vs. Relational

**Status: Analysis only. No implementation change made or proposed for execution in this document.**

This evaluates the Sprint 1 Phase 2 decision to store `tc_status` (and `status`, `automation_ready`) as fields inside `test_cases.test_case_json.test_cases[]` (one JSONB blob per **story**, containing an array of individual test-case objects), rather than as columns on a per-test-case relational row.

---

## 1. Why JSON was used in Sprint 1 (recap)

`test_cases` is keyed one row **per story** (`PRIMARY KEY run_id`, `UNIQUE(story_id, user_id)`) — not one row per test case. Individual test cases have never had their own table row; they are, and always have been, elements of the `test_case_json.test_cases` JSON array. Adding a relational `tc_status` *column* was therefore not possible without first giving test cases their own table — so Phase 2 added the field inside the existing JSON structure, consistent with how `status` (Approved/Pending/Rejected) and `automation_ready` already lived there pre-sprint. This was the minimal-surface-area, purely additive option, and it's also why Phase 3's filters (`get_story_testcases`) have to load the whole JSON blob per story and filter the array **in Python**, not in SQL.

## 2. Option A — JSON-embedded status (current)

**How it works today:** `UPDATE test_cases SET test_case_json = %s WHERE run_id = %s` rewrites the *entire* JSON blob (all test cases for that story) every time a single test case's status changes. Reads (`get_story_testcases`, the drawer, the Kanban board) load the entire blob, `json.loads()` it in the app process, then filter/iterate in Python.

| Dimension | Assessment |
|---|---|
| **Write cost per status change** | O(size of the whole story's test-case array), not O(1). A story with 200 test cases rewrites a ~hundreds-of-KB JSONB value to flip one boolean-equivalent field. Two concurrent status changes on different test cases in the *same* story race on a last-write-wins basis at the row level (no per-test-case row lock) — a real correctness risk under concurrent Kanban use, not just a performance one. |
| **Read cost for Kanban board** | The Test Case Kanban view ([TestCaseKanban.tsx](new%20frontend/src/components/TestCaseKanban.tsx)) is scoped to **one story at a time** (`selectedStoryId`) by design, so today's read cost is bounded to one JSON blob — acceptable at current scale. |
| **Filtering** | `get_story_testcases` ([stories.py:512-540](Backend/app/routes/stories.py#L512-L540)) filters the JSON array **in the Flask process**, after fetching the full blob. This already works only because it's scoped to a single story. It **cannot** filter/sort/paginate *across* stories without loading every story's full JSON blob into memory first — there is no way to ask Postgres "give me page 3 of test cases with status=Done across this workspace, sorted by updated_at" without a full table scan + in-app materialization of every blob. |
| **Reporting/analytics** | Aggregate queries (e.g. "count of Done test cases per workspace this week," "average time-in-status," "test cases stuck in In Progress > 7 days") require either `jsonb_array_elements()` unnests across every row (expensive, no targeted index) or pulling every blob into the app and aggregating manually. There is no `updated_at` per test case today, so "time in status" isn't even derivable yet, JSON or relational. |
| **Indexing** | A GIN index on `test_case_json` can accelerate *containment* queries (`@>`) but cannot efficiently support `ORDER BY` on a JSON field, `GROUP BY` a JSON field at scale, or composite filters across multiple JSON fields the way a B-tree composite index on real columns can. The one precedent already in this codebase — the priority `EXISTS (SELECT 1 FROM jsonb_array_elements(...))` subquery in `get_stories` ([stories.py:120](Backend/app/routes/stories.py#L120)) — answers "does this story contain ≥1 matching test case," which is a much cheaper question than "give me the matching test cases themselves, paginated."|
| **Concurrency** | Two users editing different test cases within the same story serialize on the same row's `UPDATE ... SET test_case_json`. No row-level granularity below "one story." |
| **Migration cost (if changed later)** | Low *now* (sprint is small, adoption is fresh) — would grow with data volume and with how much downstream code (filters, drawer, Kanban, exports) comes to depend on the JSON shape. |

## 3. Option B — Relational status (one row per test case)

This would mean introducing a real table, e.g. `test_case_status(workspace_id, story_id, test_case_id, status, tc_status, automation_ready, updated_at, updated_by)`, keyed `(workspace_id, test_case_id)`, additive and populated lazily (default `tc_status='todo'` when absent) — analogous to how `test_case_assignees`/`test_case_activity`/`test_case_comments` were already added this sprint as separate relational tables keyed by `test_case_id`, specifically *because* the JSON blob couldn't hold relational collaboration data sanely.

| Dimension | Assessment |
|---|---|
| **Write cost per status change** | O(1) — a single-row `UPDATE`/`UPSERT` keyed by `test_case_id`, independent of how many other test cases share the parent story. No read-modify-write race on an unrelated test case in the same story. |
| **Read cost for Kanban board** | Same or better — `SELECT ... WHERE workspace_id = %s AND story_id = %s` with an index is at least as fast as today's single-blob fetch, and scales to a workspace-wide board (`SELECT ... WHERE workspace_id = %s`) that today's design cannot do at all without loading every story. |
| **Filtering** | Native SQL `WHERE tc_status = 'done' AND priority = 'High'`, with standard B-tree/composite indexes, `ORDER BY`, `LIMIT/OFFSET` or keyset pagination — all for free, and correct *across stories*, not just within one. |
| **Reporting/analytics** | Trivial `GROUP BY tc_status`, time-in-status via `updated_at` deltas, per-assignee/per-workspace dashboards, joins against `test_case_assignees`/`test_case_activity` (already relational) — all straightforward with indexes. This is the natural shape for any future "Test Case Analytics" or workspace-wide Kanban-across-all-stories feature. |
| **Indexing** | Standard composite indexes (`(workspace_id, tc_status)`, `(workspace_id, story_id)`) — well understood cost/behavior, no JSONB GIN tuning required. |
| **Concurrency** | Row-level locking is naturally scoped to the single test case being changed — no contention between two test cases in the same story. |
| **Migration cost** | Requires a backfill step (one-time job to read every `test_case_json.test_cases[]` and insert/seed the new table), plus updating every read path (`get_story_testcases`, Kanban load, drawer, exports, the priority/impact filters in `get_stories`) to read from the new table instead of (or in addition to) the JSON. This is the real cost: it touches more surface area than Phase 2 did, including code outside this sprint's diff (e.g. the Excel export at `download_test_cases`, [stories.py:382](Backend/app/routes/stories.py#L382)). It also reintroduces a "two sources of truth" risk during any transition window (JSON `status`/`automation_ready` vs. the new table) unless the JSON fields are deprecated cleanly. |
| **Schema correctness** | More correct long-term: status is intrinsically a property of a single test case, not of "the story's whole JSON document." A dedicated row also gives a natural home for `updated_at`/`updated_by`, which the JSON approach lacks today and which any real activity/reporting feature will need. |

## 4. Where the JSON approach actually breaks down

Concretely, today's design **already cannot do** the following without a redesign:

1. **A workspace-wide Test Case Kanban** (all test cases across all stories in one board) — `TestCaseKanban.tsx` is hard-scoped to one story at a time specifically because loading/filtering across stories would mean materializing every story's full JSON blob in the Flask process.
2. **Server-side pagination of test cases independent of story** — there's no way to say "page 2 of 50 test cases matching X" across stories; only "all test cases in this one story, filtered in-process."
3. **Any cross-story status aggregation/reporting** (e.g. "% of test cases Done this sprint," "test cases idle in In Progress > N days") — would require a full scan + JSON unnest of every `test_cases` row in the workspace, with no usable index, every time the report runs.
4. **Concurrent status edits to different test cases in the same story** — correctness risk (last-write-wins on the whole blob), not just a performance concern.

None of these are needed by anything *currently shipped* in Sprint 1 — Phase 2/3 were deliberately scoped to "one story at a time," which is why JSON was adequate for this sprint's actual requirements. The limitations are forward-looking, not present-tense bugs.

## 5. Recommendation

**Short term (no action needed now):** Keep `tc_status` in JSON for this sprint. It is correct for the current scope (single-story Kanban, single-story filtering, additive, zero migration risk) and changing it now would be scope creep relative to what Sprint 1 asked for.

**Before this becomes a bigger liability, plan a relational migration if/when any of these becomes a real requirement:**
- A workspace-wide or cross-story Test Case Kanban view.
- Test-case-level analytics/reporting (status funnels, time-in-status, SLA tracking).
- Test-case counts at meaningful scale (hundreds–thousands of test cases per story, or tens of thousands per workspace) where per-update full-blob rewrites and in-process filtering start showing up in latency.
- Any feature requiring server-side pagination of test cases independent of which story they belong to.

**Recommended target shape**, when that time comes: a `test_case_status` (or similarly named) table keyed `(workspace_id, story_id, test_case_id)` — additive, populated via a one-time backfill from existing `test_case_json`, written alongside (not instead of) the JSON during a transition window, with read paths migrated one at a time (Kanban first, then filters, then exports) to avoid a single big-bang cutover. This mirrors exactly the pattern already proven safe in this sprint for `test_case_assignees`/`test_case_activity`/`test_case_comments`.

**No code changes are proposed or made as part of this analysis.**

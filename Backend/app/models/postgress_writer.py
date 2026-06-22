import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os
import uuid
import datetime
import json
from app.config import Config

load_dotenv()


def get_test_case_json_by_story_id(story_id, user_id=None, project_id=None):
    """Get latest generated test_case_json for a story_id, scoped to user when provided."""
    conn = None
    try:
        conn = Config.get_postgres_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            query = """
                SELECT test_case_json
                FROM test_cases
                WHERE story_id = %s
                AND test_case_json IS NOT NULL
                AND test_case_generated = TRUE
            """
            params = [story_id]
            if user_id:
                query += " AND user_id = %s"
                params.append(user_id)
            if project_id:
                query += " AND project_id = %s"
                params.append(project_id)
            query += """
                ORDER BY created_on DESC NULLS LAST
                LIMIT 1
            """
            cur.execute(query, tuple(params))
            result = cur.fetchone()
            return result["test_case_json"] if result else None
    except Exception as e:
        print(f"❌ Error fetching test case for {story_id}: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_all_generated_story_ids(user_id=None):
    """Fetch list of story_ids that already have test cases generated. Pass user_id to scope to a user."""
    conn = None
    try:
        conn = Config.get_postgres_connection()
        with conn.cursor() as cur:
            if user_id:
                cur.execute("""
                    SELECT DISTINCT story_id FROM test_cases
                    WHERE test_case_generated = TRUE AND user_id = %s
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT DISTINCT story_id FROM test_cases
                    WHERE test_case_generated = TRUE
                """)
            return [row[0] for row in cur.fetchall()]
    except Exception as e:
        print(f"❌ Error fetching generated story IDs: {e}")
        return []
    finally:
        if conn:
            conn.close()

def insert_test_case(story_id, story_description, test_case_json, project_id=None, source='backend', inputs=None, user_id=None, workspace_id=None):
    """Insert or update generated test case JSON into PostgreSQL.

    Tenancy: when workspace_id is provided, the existence check is scoped to the
    workspace (the (story_id, workspace_id) unique constraint), and the row stores
    workspace_id. Falls back to user-scoping for legacy callers.
    """
    conn = None
    try:
        conn = Config.get_postgres_connection()
        with conn.cursor() as cur:
            # Check if a record exists for this story_id (scoped to workspace when provided)
            if workspace_id:
                cur.execute("SELECT run_id FROM test_cases WHERE story_id = %s AND workspace_id = %s", (story_id, workspace_id))
            elif user_id:
                cur.execute("SELECT run_id FROM test_cases WHERE story_id = %s AND user_id = %s", (story_id, user_id))
            else:
                cur.execute("SELECT run_id FROM test_cases WHERE story_id = %s AND user_id IS NULL", (story_id,))
            existing = cur.fetchone()

            run_id = existing[0] if existing else str(uuid.uuid4())
            created_on = datetime.datetime.now()
            total_test_cases = len(test_case_json.get("test_cases", []))

            query = """
                INSERT INTO test_cases (
                    project_id,
                    run_id,
                    story_id,
                    story_description,
                    created_on,
                    test_case_json,
                    total_test_cases,
                    test_case_generated,
                    source,
                    inputs,
                    user_id,
                    workspace_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s, %s, %s)
                ON CONFLICT (run_id)
                DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    story_description = EXCLUDED.story_description,
                    created_on = EXCLUDED.created_on,
                    test_case_json = EXCLUDED.test_case_json,
                    total_test_cases = EXCLUDED.total_test_cases,
                    test_case_generated = TRUE,
                    source = EXCLUDED.source,
                    inputs = EXCLUDED.inputs,
                    user_id = EXCLUDED.user_id,
                    workspace_id = EXCLUDED.workspace_id
            """

            cur.execute(query, (
                project_id,
                run_id,
                story_id,
                story_description,
                created_on,
                json.dumps(test_case_json),
                total_test_cases,
                source,
                json.dumps(inputs) if inputs else None,
                user_id,
                workspace_id,
            ))

            # Record a story version snapshot so version history works
            try:
                story_content = (inputs or {}).get('content') or (inputs or {}).get('file_content') or ''
                # Only write version snapshot when we have user_id (required by uq_story_version constraint)
                if user_id and workspace_id:
                    cur.execute("""
                        SELECT COALESCE(MAX(version_number), 0) + 1
                        FROM story_versions
                        WHERE story_id = %s AND workspace_id = %s
                    """, (story_id, workspace_id))
                    next_version = (cur.fetchone() or [1])[0]
                    cur.execute("""
                        INSERT INTO story_versions
                            (story_id, workspace_id, user_id, version_number, description, content)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (story_id, user_id, version_number) DO NOTHING
                    """, (story_id, workspace_id, user_id, next_version, story_description[:500], story_content[:10000]))
            except Exception as ver_err:
                print(f"[insert_test_case] story_versions insert failed (non-fatal): {ver_err}")

            conn.commit()
    except Exception as e:
        print(f"❌ Failed to insert test case for {story_id}: {e}")
    finally:
        if conn:
            conn.close()

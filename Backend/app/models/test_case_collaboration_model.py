"""
test_case_collaboration_model.py

Per-test-case collaboration: assignees + activity timeline + comments
(Sprint 1 Phase 1). Mirrors story_collaboration_model.py.

Individual test cases live inside test_cases.test_case_json (one row per story),
so collaboration is keyed by the test case's JSON id (test_case_id, e.g.
"TC-101-01"). Every table is additive and workspace-scoped; every query filters
by workspace_id so no cross-tenant visibility is possible.
"""

from app.config import Config


class TestCaseAssigneesModel:
    @staticmethod
    def get_assignees(workspace_id: str, test_case_id: str) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT ta.user_id, u.email, ta.assigned_by, ab.email AS assigned_by_email,
                       ta.assigned_at
                FROM test_case_assignees ta
                JOIN users u ON u.user_id = ta.user_id
                LEFT JOIN users ab ON ab.user_id = ta.assigned_by
                WHERE ta.workspace_id = %s AND ta.test_case_id = %s
                ORDER BY ta.assigned_at ASC
                """,
                (workspace_id, test_case_id),
            )
            return [
                {
                    "user_id": str(r[0]),
                    "email": r[1],
                    "assigned_by": str(r[2]) if r[2] else None,
                    "assigned_by_email": r[3],
                    "assigned_at": str(r[4]),
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def assign(workspace_id: str, story_id: str, test_case_id: str, user_id: str, assigned_by: str) -> dict | None:
        """Assign a workspace member to a test case. Returns None if user_id is not
        a member of this workspace (caller enforces tenant isolation before the DB)."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM workspace_members WHERE workspace_id = %s AND user_id = %s",
                (workspace_id, user_id),
            )
            if not cursor.fetchone():
                return None

            cursor.execute(
                """
                INSERT INTO test_case_assignees (test_case_id, story_id, workspace_id, user_id, assigned_by)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (workspace_id, test_case_id, user_id) DO NOTHING
                RETURNING id, test_case_id, user_id, assigned_by, assigned_at
                """,
                (test_case_id, story_id, workspace_id, user_id, assigned_by),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "test_case_id": row[1],
                "user_id": str(row[2]),
                "assigned_by": str(row[3]) if row[3] else None,
                "assigned_at": str(row[4]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def remove(workspace_id: str, test_case_id: str, user_id: str) -> bool:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM test_case_assignees
                WHERE workspace_id = %s AND test_case_id = %s AND user_id = %s
                RETURNING id
                """,
                (workspace_id, test_case_id, user_id),
            )
            deleted = cursor.fetchone() is not None
            conn.commit()
            return deleted
        finally:
            cursor.close()
            conn.close()


class TestCaseActivityModel:
    @staticmethod
    def log(workspace_id: str, story_id: str, test_case_id: str, actor_user_id: str | None,
            event_type: str, details: dict | None = None) -> None:
        """Append-only activity log write. Never raises into the caller's request
        path — a logging failure must not break the action it's recording."""
        import json
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO test_case_activity (test_case_id, story_id, workspace_id, actor_user_id, event_type, details)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (test_case_id, story_id, workspace_id, actor_user_id, event_type, json.dumps(details or {})),
            )
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_timeline(workspace_id: str, test_case_id: str, limit: int = 100) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT ta.id, ta.event_type, ta.details, ta.created_at,
                       ta.actor_user_id, u.email AS actor_email
                FROM test_case_activity ta
                LEFT JOIN users u ON u.user_id = ta.actor_user_id
                WHERE ta.workspace_id = %s AND ta.test_case_id = %s
                ORDER BY ta.created_at DESC
                LIMIT %s
                """,
                (workspace_id, test_case_id, limit),
            )
            return [
                {
                    "id": str(r[0]),
                    "event_type": r[1],
                    "details": r[2],
                    "created_at": str(r[3]),
                    "actor_user_id": str(r[4]) if r[4] else None,
                    "actor_email": r[5],
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()


class TestCaseCommentsModel:
    @staticmethod
    def list_comments(workspace_id: str, test_case_id: str) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT tc.id, tc.test_case_id, tc.user_id, u.email, tc.body,
                       tc.created_at, tc.updated_at
                FROM test_case_comments tc
                JOIN users u ON u.user_id = tc.user_id
                WHERE tc.workspace_id = %s AND tc.test_case_id = %s
                ORDER BY tc.created_at ASC
                """,
                (workspace_id, test_case_id),
            )
            return [
                {
                    "id": str(r[0]),
                    "test_case_id": r[1],
                    "user_id": str(r[2]),
                    "user_email": r[3],
                    "body": r[4],
                    "created_at": str(r[5]),
                    "updated_at": str(r[6]),
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def add_comment(workspace_id: str, story_id: str, test_case_id: str, user_id: str, body: str) -> dict:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO test_case_comments (test_case_id, story_id, workspace_id, user_id, body)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, test_case_id, user_id, body, created_at, updated_at
                """,
                (test_case_id, story_id, workspace_id, user_id, body),
            )
            row = cursor.fetchone()
            conn.commit()
            return {
                "id": str(row[0]),
                "test_case_id": row[1],
                "user_id": str(row[2]),
                "body": row[3],
                "created_at": str(row[4]),
                "updated_at": str(row[5]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def edit_comment(workspace_id: str, test_case_id: str, comment_id: str, user_id: str, body: str) -> dict | None:
        """Only the comment's author may edit it. Returns None if not found,
        not owned by user_id, or not in this workspace/test case."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE test_case_comments
                SET body = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND workspace_id = %s AND test_case_id = %s AND user_id = %s
                RETURNING id, test_case_id, user_id, body, created_at, updated_at
                """,
                (body, comment_id, workspace_id, test_case_id, user_id),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "test_case_id": row[1],
                "user_id": str(row[2]),
                "body": row[3],
                "created_at": str(row[4]),
                "updated_at": str(row[5]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def delete_comment(workspace_id: str, test_case_id: str, comment_id: str, user_id: str) -> bool:
        """Only the comment's author may delete it."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM test_case_comments
                WHERE id = %s AND workspace_id = %s AND test_case_id = %s AND user_id = %s
                RETURNING id
                """,
                (comment_id, workspace_id, test_case_id, user_id),
            )
            deleted = cursor.fetchone() is not None
            conn.commit()
            return deleted
        finally:
            cursor.close()
            conn.close()

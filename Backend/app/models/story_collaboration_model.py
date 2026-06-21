"""
story_collaboration_model.py

Kanban collaboration: story assignees + activity timeline (Phase 2),
story comments (Phase 3A). All tables are additive and workspace-scoped;
every query filters by workspace_id so no cross-tenant visibility is possible.
"""

from app.config import Config


class StoryAssigneesModel:
    @staticmethod
    def get_assignees(workspace_id: str, story_id: str) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT sa.user_id, u.email, sa.assigned_by, ab.email AS assigned_by_email,
                       sa.assigned_at
                FROM story_assignees sa
                JOIN users u ON u.user_id = sa.user_id
                LEFT JOIN users ab ON ab.user_id = sa.assigned_by
                WHERE sa.workspace_id = %s AND sa.story_id = %s
                ORDER BY sa.assigned_at ASC
                """,
                (workspace_id, story_id),
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
    def get_assignee_counts(workspace_id: str, story_ids: list) -> dict:
        """story_id -> assignee count, for Kanban card badges. Single batched query."""
        if not story_ids:
            return {}
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT story_id, COUNT(*) AS cnt
                FROM story_assignees
                WHERE workspace_id = %s AND story_id = ANY(%s)
                GROUP BY story_id
                """,
                (workspace_id, story_ids),
            )
            return {r[0]: r[1] for r in cursor.fetchall()}
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_assignee_previews(workspace_id: str, story_ids: list, limit_per_story: int = 3) -> dict:
        """story_id -> list of up to `limit_per_story` {user_id, email} for avatar stacks."""
        if not story_ids:
            return {}
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT story_id, user_id, email FROM (
                    SELECT sa.story_id, sa.user_id, u.email,
                           ROW_NUMBER() OVER (PARTITION BY sa.story_id ORDER BY sa.assigned_at ASC) AS rn
                    FROM story_assignees sa
                    JOIN users u ON u.user_id = sa.user_id
                    WHERE sa.workspace_id = %s AND sa.story_id = ANY(%s)
                ) ranked
                WHERE rn <= %s
                ORDER BY story_id, rn
                """,
                (workspace_id, story_ids, limit_per_story),
            )
            previews: dict = {}
            for story_id, user_id, email in cursor.fetchall():
                previews.setdefault(story_id, []).append({"user_id": str(user_id), "email": email})
            return previews
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def assign(workspace_id: str, story_id: str, user_id: str, assigned_by: str) -> dict | None:
        """Assign a workspace member to a story. Returns None if user_id is not a member
        of this workspace (caller enforces tenant isolation before hitting the DB)."""
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
                INSERT INTO story_assignees (story_id, workspace_id, user_id, assigned_by)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (workspace_id, story_id, user_id) DO NOTHING
                RETURNING id, story_id, user_id, assigned_by, assigned_at
                """,
                (story_id, workspace_id, user_id, assigned_by),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "story_id": row[1],
                "user_id": str(row[2]),
                "assigned_by": str(row[3]) if row[3] else None,
                "assigned_at": str(row[4]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def remove(workspace_id: str, story_id: str, user_id: str) -> bool:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM story_assignees
                WHERE workspace_id = %s AND story_id = %s AND user_id = %s
                RETURNING id
                """,
                (workspace_id, story_id, user_id),
            )
            deleted = cursor.fetchone() is not None
            conn.commit()
            return deleted
        finally:
            cursor.close()
            conn.close()


class StoryActivityModel:
    @staticmethod
    def log(workspace_id: str, story_id: str, actor_user_id: str | None, event_type: str, details: dict | None = None) -> None:
        """Append-only activity log write. Never raises into the caller's request
        path — a logging failure must not break the action it's recording."""
        import json
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO story_activity (story_id, workspace_id, actor_user_id, event_type, details)
                VALUES (%s, %s, %s, %s, %s::jsonb)
                """,
                (story_id, workspace_id, actor_user_id, event_type, json.dumps(details or {})),
            )
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_timeline(workspace_id: str, story_id: str, limit: int = 100) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT sa.id, sa.event_type, sa.details, sa.created_at,
                       sa.actor_user_id, u.email AS actor_email
                FROM story_activity sa
                LEFT JOIN users u ON u.user_id = sa.actor_user_id
                WHERE sa.workspace_id = %s AND sa.story_id = %s
                ORDER BY sa.created_at DESC
                LIMIT %s
                """,
                (workspace_id, story_id, limit),
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


class StoryCommentsModel:
    @staticmethod
    def list_comments(workspace_id: str, story_id: str) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT sc.id, sc.story_id, sc.user_id, u.email, sc.body,
                       sc.created_at, sc.updated_at
                FROM story_comments sc
                JOIN users u ON u.user_id = sc.user_id
                WHERE sc.workspace_id = %s AND sc.story_id = %s
                ORDER BY sc.created_at ASC
                """,
                (workspace_id, story_id),
            )
            return [
                {
                    "id": str(r[0]),
                    "story_id": r[1],
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
    def add_comment(workspace_id: str, story_id: str, user_id: str, body: str) -> dict:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO story_comments (story_id, workspace_id, user_id, body)
                VALUES (%s, %s, %s, %s)
                RETURNING id, story_id, user_id, body, created_at, updated_at
                """,
                (story_id, workspace_id, user_id, body),
            )
            row = cursor.fetchone()
            conn.commit()
            return {
                "id": str(row[0]),
                "story_id": row[1],
                "user_id": str(row[2]),
                "body": row[3],
                "created_at": str(row[4]),
                "updated_at": str(row[5]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def edit_comment(workspace_id: str, story_id: str, comment_id: str, user_id: str, body: str) -> dict | None:
        """Only the comment's author may edit it. Returns None if not found,
        not owned by user_id, or not in this workspace/story."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE story_comments
                SET body = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND workspace_id = %s AND story_id = %s AND user_id = %s
                RETURNING id, story_id, user_id, body, created_at, updated_at
                """,
                (body, comment_id, workspace_id, story_id, user_id),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "story_id": row[1],
                "user_id": str(row[2]),
                "body": row[3],
                "created_at": str(row[4]),
                "updated_at": str(row[5]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def delete_comment(workspace_id: str, story_id: str, comment_id: str, user_id: str) -> bool:
        """Only the comment's author may delete it."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM story_comments
                WHERE id = %s AND workspace_id = %s AND story_id = %s AND user_id = %s
                RETURNING id
                """,
                (comment_id, workspace_id, story_id, user_id),
            )
            deleted = cursor.fetchone() is not None
            conn.commit()
            return deleted
        finally:
            cursor.close()
            conn.close()

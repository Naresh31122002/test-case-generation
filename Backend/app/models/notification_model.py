"""
Notification model — create, read, and mark notifications.
Handles both in-app and email-sent tracking.
"""
import uuid
import psycopg2
import psycopg2.extras
from datetime import datetime
from app.config import Config


class NotificationModel:

    # ── Event type constants ──────────────────────────────────────────────────
    STORY_UPLOADED = "story_uploaded"
    STORY_DELETED = "story_deleted"
    TESTS_GENERATED = "tests_generated"
    TEST_CASE_EDITED = "test_case_edited"
    MEMBER_INVITED = "member_invited"
    MEMBER_JOINED = "member_joined"
    MEMBER_REMOVED = "member_removed"
    ROLE_CHANGED = "role_changed"
    KANBAN_ASSIGNED = "kanban_assigned"
    TEST_PASSED = "test_passed"
    TEST_FAILED = "test_failed"
    IMPACT_DETECTED = "impact_detected"
    WORKSPACE_RENAMED = "workspace_renamed"

    @classmethod
    def create(cls, workspace_id: str, user_id: str, event_type: str,
               title: str, body: str = None, link: str = None,
               actor_id: str = None, entity_id: str = None, entity_type: str = None) -> dict:
        """Create an in-app notification for a single user."""
        notif_id = str(uuid.uuid4())
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    INSERT INTO workspace_notifications
                        (id, workspace_id, user_id, event_type, title, body, link, actor_id, entity_id, entity_type)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (notif_id, workspace_id, user_id, event_type, title, body, link, actor_id, entity_id, entity_type))
                row = dict(cur.fetchone())
                conn.commit()
                return row

    @classmethod
    def broadcast_to_workspace(cls, workspace_id: str, event_type: str,
                                title: str, body: str = None, link: str = None,
                                actor_id: str = None, entity_id: str = None, entity_type: str = None,
                                exclude_user_id: str = None) -> int:
        """Create notification for ALL members of a workspace (except actor)."""
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                # Get all workspace members
                cur.execute("""
                    SELECT user_id FROM workspace_members
                    WHERE workspace_id = %s
                    AND (%s IS NULL OR user_id != %s::uuid)
                """, (workspace_id, exclude_user_id, exclude_user_id))
                members = [row[0] for row in cur.fetchall()]

                if not members:
                    return 0

                # Bulk insert
                values = [
                    (str(uuid.uuid4()), workspace_id, str(uid), event_type, title, body, link, actor_id, entity_id, entity_type)
                    for uid in members
                ]
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO workspace_notifications
                        (id, workspace_id, user_id, event_type, title, body, link, actor_id, entity_id, entity_type)
                    VALUES %s
                """, values)
                conn.commit()
                return len(members)

    @classmethod
    def get_for_user(cls, user_id: str, workspace_id: str = None,
                     unread_only: bool = False, limit: int = 30) -> list:
        """Get notifications for a user, optionally scoped to workspace."""
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                q = """
                    SELECT n.*, u.display_name as actor_name, u.avatar_url as actor_avatar
                    FROM workspace_notifications n
                    LEFT JOIN users u ON n.actor_id = u.user_id
                    WHERE n.user_id = %s
                """
                params = [user_id]
                if workspace_id:
                    q += " AND n.workspace_id = %s"
                    params.append(workspace_id)
                if unread_only:
                    q += " AND n.read = FALSE"
                q += " ORDER BY n.created_at DESC LIMIT %s"
                params.append(limit)
                cur.execute(q, params)
                rows = cur.fetchall()
                result = []
                for row in rows:
                    d = dict(row)
                    if d.get('created_at'):
                        d['created_at'] = d['created_at'].isoformat()
                    result.append(d)
                return result

    @classmethod
    def mark_read(cls, user_id: str, notification_ids: list = None, workspace_id: str = None):
        """Mark notifications as read. Pass ids to mark specific ones, workspace_id to mark all."""
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                if notification_ids:
                    cur.execute("""
                        UPDATE workspace_notifications SET read = TRUE
                        WHERE user_id = %s AND id = ANY(%s::uuid[])
                    """, (user_id, notification_ids))
                elif workspace_id:
                    cur.execute("""
                        UPDATE workspace_notifications SET read = TRUE
                        WHERE user_id = %s AND workspace_id = %s AND read = FALSE
                    """, (user_id, workspace_id))
                conn.commit()

    @classmethod
    def get_unread_count(cls, user_id: str, workspace_id: str = None) -> int:
        """Get count of unread notifications."""
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                if workspace_id:
                    cur.execute("""
                        SELECT COUNT(*) FROM workspace_notifications
                        WHERE user_id = %s AND workspace_id = %s AND read = FALSE
                    """, (user_id, workspace_id))
                else:
                    cur.execute("""
                        SELECT COUNT(*) FROM workspace_notifications
                        WHERE user_id = %s AND read = FALSE
                    """, (user_id,))
                return cur.fetchone()[0]

    @classmethod
    def get_member_emails_for_event(cls, workspace_id: str, event_type: str,
                                     exclude_user_id: str = None) -> list:
        """Get emails of members who have enabled email for a given event_type."""
        pref_col = {
            cls.STORY_UPLOADED: 'email_on_story_generated',
            cls.TESTS_GENERATED: 'email_on_test_generated',
            cls.KANBAN_ASSIGNED: 'email_on_assigned',
            cls.MEMBER_INVITED: 'email_on_invite',
            cls.IMPACT_DETECTED: 'email_on_story_generated',
        }.get(event_type, 'in_app_all')

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(f"""
                    SELECT u.email, u.display_name, u.full_name
                    FROM workspace_members wm
                    JOIN users u ON wm.user_id = u.user_id
                    LEFT JOIN notification_preferences np
                        ON np.user_id = wm.user_id AND np.workspace_id = wm.workspace_id
                    WHERE wm.workspace_id = %s
                    AND (%s IS NULL OR wm.user_id != %s::uuid)
                    AND (np.{pref_col} IS NULL OR np.{pref_col} = TRUE)
                """, (workspace_id, exclude_user_id, exclude_user_id))
                return [dict(r) for r in cur.fetchall()]

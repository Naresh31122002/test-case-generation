"""Activity feed endpoints — workspace-scoped events for the notification bell."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.workspace import workspace_required, get_current_user_id, get_current_workspace_id
from app.config import Config
import psycopg2.extras

activity_bp = Blueprint('activity', __name__)


def log_activity(workspace_id: str, user_id: str, event_type: str, title: str, body: str = None, story_id: str = None):
    """Fire-and-forget activity event logger. Call from any route after a significant event."""
    try:
        conn = Config.get_postgres_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO activity_events (workspace_id, user_id, event_type, title, body, story_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (workspace_id, user_id, event_type, title, body, story_id))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[activity] log failed: {e}")


@activity_bp.route('/', methods=['GET'])
@workspace_required
def list_activity():
    """Return recent activity events for the current workspace."""
    workspace_id = get_current_workspace_id()
    user_id = get_current_user_id()
    limit = min(int(request.args.get('limit', 20)), 50)
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT id, event_type, title, body, story_id, created_at,
                           (%s = ANY(read_by)) as is_read
                    FROM activity_events
                    WHERE workspace_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (str(user_id), workspace_id, limit))
                events = [dict(r) for r in cur.fetchall()]
                # Unread count
                cur.execute("""
                    SELECT COUNT(*) FROM activity_events
                    WHERE workspace_id = %s AND NOT (%s = ANY(read_by))
                """, (workspace_id, str(user_id)))
                unread = cur.fetchone()[0]
        return jsonify({"events": events, "unread": unread}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@activity_bp.route('/mark-read', methods=["POST"])
@workspace_required
def mark_read():
    """Mark specific events (or all) as read for the current user."""
    workspace_id = get_current_workspace_id()
    user_id = str(get_current_user_id())
    data = request.get_json(silent=True) or {}
    event_ids = data.get('ids')  # None = mark all
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                if event_ids:
                    cur.execute("""
                        UPDATE activity_events
                        SET read_by = array_append(read_by, %s::uuid)
                        WHERE id = ANY(%s::uuid[]) AND workspace_id = %s
                          AND NOT (%s = ANY(read_by))
                    """, (user_id, event_ids, workspace_id, user_id))
                else:
                    cur.execute("""
                        UPDATE activity_events
                        SET read_by = array_append(read_by, %s::uuid)
                        WHERE workspace_id = %s AND NOT (%s = ANY(read_by))
                    """, (user_id, workspace_id, user_id))
                conn.commit()
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

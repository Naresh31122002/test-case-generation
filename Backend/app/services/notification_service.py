"""
notification_service.py

Sprint 1 Phase 5 — collaboration email notifications.

Thin dispatch layer over the existing Celery email tasks (app/tasks/email_tasks.py)
and AWS SES infrastructure. Every public function:
  - is workspace-scoped: recipients are looked up within the workspace only, so a
    notification can never reach a non-member;
  - never raises into the caller's request path: a notification failure must not
    break the action (assignment / comment) that triggered it;
  - skips self-notifications (you don't get emailed about your own action).

Email is enqueued via Celery `.delay(...)`; if the broker is unavailable the
failure is swallowed and logged, never propagated.
"""

import os
import re

from app.config import Config
from app.models.workspace_model import WorkspaceModel

FRONTEND_URL = os.environ.get("APP_URL") or os.environ.get("FRONTEND_URL") or "http://localhost:3000"


def _workspace_name(workspace_id: str) -> str:
    try:
        ws = WorkspaceModel.get_by_id(workspace_id)
        if ws and ws.get("name"):
            return ws["name"]
    except Exception:
        pass
    return "your workspace"


def _member_email(workspace_id: str, user_id: str) -> str | None:
    """Return the email of `user_id` ONLY if they are a member of `workspace_id`.
    This is the tenant-isolation gate for all notifications."""
    conn = Config.get_postgres_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.email
            FROM workspace_members m
            JOIN users u ON u.user_id = m.user_id
            WHERE m.workspace_id = %s AND m.user_id = %s
            """,
            (workspace_id, user_id),
        )
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        return None
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass


def _actor_name(workspace_id: str, actor_user_id: str | None) -> str:
    if not actor_user_id:
        return "Someone"
    email = _member_email(workspace_id, actor_user_id)
    if not email:
        return "A teammate"
    # Prefer full_name when available.
    conn = Config.get_postgres_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT full_name FROM users WHERE user_id = %s", (actor_user_id,))
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass
    return email.split("@")[0]


def _members_index(workspace_id: str) -> dict:
    """email-lowercased + name-lowercased -> user_id, for @mention resolution.
    Only workspace members are indexed, so a mention can never resolve outside
    the tenant."""
    index: dict = {}
    try:
        for m in WorkspaceModel.get_members(workspace_id):
            uid = m.get("user_id")
            email = (m.get("email") or "").lower()
            if email:
                index[email] = uid
                index[email.split("@")[0]] = uid
    except Exception:
        pass
    return index


def notify_story_assigned(workspace_id, story_id, story_title, target_user_id, actor_user_id):
    try:
        if target_user_id == actor_user_id:
            return
        to_email = _member_email(workspace_id, target_user_id)
        if not to_email:
            return
        from app.tasks.email_tasks import task_send_story_assigned
        link = f"{FRONTEND_URL}/stories/{story_id}"
        task_send_story_assigned.delay(
            to_email, _actor_name(workspace_id, actor_user_id), _workspace_name(workspace_id),
            story_id, story_title or story_id, link,
        )
    except Exception as e:
        print(f"[notify_story_assigned] skipped: {e}")


def notify_test_case_assigned(workspace_id, story_id, test_case_id, test_case_title, target_user_id, actor_user_id):
    try:
        if target_user_id == actor_user_id:
            return
        to_email = _member_email(workspace_id, target_user_id)
        if not to_email:
            return
        from app.tasks.email_tasks import task_send_test_case_assigned
        link = f"{FRONTEND_URL}/stories/{story_id}?tc={test_case_id}"
        task_send_test_case_assigned.delay(
            to_email, _actor_name(workspace_id, actor_user_id), _workspace_name(workspace_id),
            test_case_id, test_case_title or test_case_id, link,
        )
    except Exception as e:
        print(f"[notify_test_case_assigned] skipped: {e}")


def notify_comment(workspace_id, actor_user_id, target_label, target_id, comment_body, link_url, recipient_user_ids):
    """Email a comment notification to a set of recipients (e.g. story/test-case
    assignees). Recipients are filtered to workspace members; the actor and any
    mentioned users (handled separately) are excluded by the caller."""
    try:
        from app.tasks.email_tasks import task_send_comment_added
        actor = _actor_name(workspace_id, actor_user_id)
        ws_name = _workspace_name(workspace_id)
        seen = set()
        for uid in recipient_user_ids:
            if not uid or uid == actor_user_id or uid in seen:
                continue
            seen.add(uid)
            to_email = _member_email(workspace_id, uid)
            if not to_email:
                continue
            task_send_comment_added.delay(
                to_email, actor, ws_name, target_label, target_id, comment_body, link_url,
            )
    except Exception as e:
        print(f"[notify_comment] skipped: {e}")


def notify_mentions(workspace_id, actor_user_id, target_id, comment_body, link_url):
    """Parse @mentions from a comment body and email any mentioned workspace
    member. Returns the set of mentioned user_ids so the caller can avoid
    double-emailing them via the generic comment notification."""
    mentioned: set = set()
    try:
        tokens = set(re.findall(r"@([A-Za-z0-9._%+\-]+(?:@[A-Za-z0-9.\-]+)?)", comment_body or ""))
        if not tokens:
            return mentioned
        index = _members_index(workspace_id)
        actor = _actor_name(workspace_id, actor_user_id)
        ws_name = _workspace_name(workspace_id)
        from app.tasks.email_tasks import task_send_mention
        for tok in tokens:
            uid = index.get(tok.lower())
            if not uid or uid == actor_user_id or uid in mentioned:
                continue
            mentioned.add(uid)
            to_email = _member_email(workspace_id, uid)
            if not to_email:
                continue
            task_send_mention.delay(to_email, actor, ws_name, target_id, comment_body, link_url)
    except Exception as e:
        print(f"[notify_mentions] skipped: {e}")
    return mentioned

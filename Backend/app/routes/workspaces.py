"""
routes/workspaces.py

Workspace management API.

  GET  /api/workspaces          → list the current user's workspaces
  POST /api/workspaces          → create a new workspace (caller becomes owner)
  GET  /api/workspaces/current  → the workspace resolved for this request
  POST /api/workspaces/switch   → switch active workspace; re-issues the access
                                  cookie with the new workspace_id claim so the
                                  JWT claim and X-Workspace-Id header stay aligned
"""

import os

from flask import Blueprint, jsonify, request, make_response
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    create_access_token,
    set_access_cookies,
)

from app.models.workspace_model import WorkspaceModel
from app.models.workspace_invites_model import WorkspaceInvitesModel
from app.models.credits_model import CreditsModel
from app.utils.workspace import (
    workspace_required,
    get_current_user_id,
    get_current_workspace_id,
    _is_bypass,
    _resolve_user_id,
    require_workspace_role,
    get_current_role,
)

workspaces_bp = Blueprint("workspaces", __name__)


@workspaces_bp.route("", methods=["GET"])
@workspaces_bp.route("/", methods=["GET"])
@workspace_required
def list_workspaces():
    user_id = get_current_user_id()
    return jsonify({"workspaces": WorkspaceModel.get_for_user(user_id)}), 200


@workspaces_bp.route("", methods=["POST"])
@workspaces_bp.route("/", methods=["POST"])
@workspace_required
def create_workspace():
    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    plan = data.get("plan", "free")
    if not name:
        return jsonify({"error": "Workspace name is required"}), 400
    if plan not in ("free", "pro", "enterprise"):
        return jsonify({"error": "Invalid plan"}), 400
    ws = WorkspaceModel.create(name=name, owner_id=user_id, plan=plan)
    return jsonify({"workspace": ws}), 201


@workspaces_bp.route("/current", methods=["GET"])
@workspace_required
def current_workspace():
    from app.config import Config
    import psycopg2.extras, json as _json
    ws_id = get_current_workspace_id()
    ws = WorkspaceModel.get_by_id(ws_id) if ws_id else None
    if not ws:
        return jsonify({"error": "No active workspace"}), 404
    # Attach workspace config (timezone, analysis_types) if stored
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT config FROM workspace_integrations
                    WHERE workspace_id = %s AND integration_type = 'workspace_config'
                """, (ws_id,))
                row = cur.fetchone()
                if row:
                    cfg = row['config']
                    ws['config'] = cfg if isinstance(cfg, dict) else _json.loads(cfg)
    except Exception:
        pass
    return jsonify({"workspace": ws}), 200


@workspaces_bp.route("/current", methods=["PATCH"])
@workspace_required
@require_workspace_role(["owner", "admin"])
def update_current_workspace():
    """Update workspace name and/or config (timezone, analysis_types)."""
    ws_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    config = data.get("config")  # optional dict

    if not name and config is None:
        return jsonify({"error": "Nothing to update"}), 400

    try:
        user_id = get_current_user_id()
        updated = WorkspaceModel.update(ws_id, name=name or None, config=config, user_id=user_id)
        if not updated:
            return jsonify({"error": "Workspace not found"}), 404
        return jsonify({"workspace": updated}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@workspaces_bp.route("/current", methods=["DELETE"])
@workspace_required
@require_workspace_role(["owner"])
def delete_current_workspace():
    """Permanently delete the current workspace and all its data.
    Only the workspace owner can perform this action."""
    ws_id = get_current_workspace_id()
    user_id = get_current_user_id()
    if not ws_id:
        return jsonify({"error": "No active workspace"}), 404
    try:
        WorkspaceModel.delete_workspace(ws_id, user_id)
        return jsonify({"message": "Workspace deleted"}), 200
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@workspaces_bp.route("/integrations", methods=["GET"])
@workspace_required
def list_integrations():
    """Return all workspace_integrations rows for this workspace."""
    from app.config import Config
    import psycopg2.extras
    ws_id = get_current_workspace_id()
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT integration_type, config, created_at
                    FROM workspace_integrations
                    WHERE workspace_id = %s
                """, (ws_id,))
                rows = [dict(r) for r in cur.fetchall()]
                for r in rows:
                    if r.get('created_at'):
                        r['created_at'] = r['created_at'].isoformat()
                    # Never expose secrets — they're in a separate column (secret_enc)
        return jsonify({"integrations": rows}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@workspaces_bp.route("/integrations/<integration_type>", methods=["DELETE"])
@workspace_required
@require_workspace_role(["owner", "admin"])
def delete_integration(integration_type):
    """Disconnect an integration."""
    from app.config import Config
    ws_id = get_current_workspace_id()
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM workspace_integrations
                    WHERE workspace_id = %s AND integration_type = %s
                """, (ws_id, integration_type))
                conn.commit()
        return jsonify({"deleted": integration_type}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@workspaces_bp.route("/current/credits", methods=["GET"])
@workspace_required
def current_workspace_credits():
    ws_id = get_current_workspace_id()
    try:
        # get_credit_usage already ensures the workspace_credits row exists
        # (backfill for workspaces created before this feature) internally.
        usage = CreditsModel.get_credit_usage(ws_id)
        return jsonify({"credits": usage}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@workspaces_bp.route("/switch", methods=["POST"])
@workspace_required
def switch_workspace():
    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}
    target = (data.get("workspace_id") or "").strip()
    if not target:
        return jsonify({"error": "workspace_id is required"}), 400

    # Source of truth: membership. A user can only switch into a workspace they belong to.
    if not WorkspaceModel.is_member(target, user_id):
        return jsonify({"error": "Forbidden: not a member of this workspace"}), 403

    ws = WorkspaceModel.get_by_id(target)
    response = make_response(jsonify({"workspace": ws}), 200)

    # Re-issue the access cookie carrying the new workspace claim (skip in bypass
    # mode where there is no JWT).
    if not _is_bypass():
        access_token = create_access_token(
            identity=user_id, additional_claims={"workspace_id": target}
        )
        set_access_cookies(response, access_token)
    return response

@workspaces_bp.route('/contact', methods=['POST'])
@workspace_required
def submit_contact():
    """Send feature request or bug report to admin email."""
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json() or {}
    contact_type = data.get('type', 'bug_report')  # 'feature_request' or 'bug_report'
    subject = data.get('subject', '').strip()
    description = data.get('description', '').strip()

    if not subject or not description:
        return jsonify({'error': 'Subject and description are required'}), 400

    try:
        from app.models.user_model import UserModel
        user = UserModel.get_user_by_id(user_id) or {}
        user_email = user.get('email', 'Unknown user')
        workspace_name = ''
        from app.models.workspace_model import WorkspaceModel
        ws = WorkspaceModel.get_by_id(workspace_id)
        if ws:
            workspace_name = ws.get('name', workspace_id)

        from app.utils.mailer import send_email, smtp_configured
        if smtp_configured():
            type_label = 'Feature Request' if contact_type == 'feature_request' else 'Bug Report'
            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#0F172A;">{type_label} from TestSurge</h2>
              <p><strong>From:</strong> {user_email}</p>
              <p><strong>Workspace:</strong> {workspace_name}</p>
              <p><strong>Subject:</strong> {subject}</p>
              <hr style="border:1px solid #e2e8f0;margin:16px 0;">
              <p><strong>Description:</strong></p>
              <p style="background:#f8fafc;padding:12px;border-radius:8px;white-space:pre-wrap;">{description}</p>
            </div>
            """
            send_email('admin@kynetropo.com', f'[TestSurge {type_label}] {subject}', description, html)

        return jsonify({'message': 'Submitted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@workspaces_bp.route('/my-role', methods=['GET'])
@workspace_required
def get_my_role():
    """Return the current user's role and permissions in the active workspace."""
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    try:
        from app.models.workspace_model import WorkspaceModel
        perms = WorkspaceModel.get_member_permissions(workspace_id, user_id)
        return jsonify({
            'role': perms.get('role', 'viewer'),
            'permissions': perms,
            'workspace_id': workspace_id,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Members ---

@workspaces_bp.route("/members", methods=["GET"])
@workspace_required
def list_members():
    ws_id = get_current_workspace_id()
    members = WorkspaceModel.get_members(ws_id)
    return jsonify({"members": members}), 200

@workspaces_bp.route("/members/<user_id>", methods=["PUT"])
@workspace_required
@require_workspace_role(["owner"])
def update_member_role(user_id):
    ws_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in ("admin", "editor", "viewer"):
        return jsonify({"error": "Invalid role"}), 400
    
    if user_id == get_current_user_id():
        return jsonify({"error": "Cannot change your own role"}), 400
        
    updated = WorkspaceModel.update_member_role(ws_id, user_id, role)
    if not updated:
        return jsonify({"error": "Member not found"}), 404
        
    return jsonify({"message": "Role updated successfully"}), 200

@workspaces_bp.route("/members/<user_id>", methods=["DELETE"])
@workspace_required
@require_workspace_role(["owner"])
def remove_member(user_id):
    ws_id = get_current_workspace_id()
    if user_id == get_current_user_id():
        return jsonify({"error": "Cannot remove yourself"}), 400
        
    deleted = WorkspaceModel.remove_member(ws_id, user_id)
    if not deleted:
        return jsonify({"error": "Member not found"}), 404
        
    return jsonify({"message": "Member removed successfully"}), 200

# --- Notifications ---

@workspaces_bp.route('/notifications', methods=['GET'])
@workspace_required
def get_notifications():
    """Get notifications for current user in current workspace."""
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    try:
        from app.models.notification_model import NotificationModel
        notifs = NotificationModel.get_for_user(user_id, workspace_id, unread_only=unread_only)
        count = NotificationModel.get_unread_count(user_id, workspace_id)
        return jsonify({'notifications': notifs, 'unread_count': count}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@workspaces_bp.route('/notifications/read', methods=['POST'])
@workspace_required
def mark_notifications_read():
    """Mark notifications as read."""
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json() or {}
    ids = data.get('ids')  # optional list of specific IDs
    try:
        from app.models.notification_model import NotificationModel
        NotificationModel.mark_read(user_id, notification_ids=ids, workspace_id=workspace_id if not ids else None)
        return jsonify({'ok': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Invites ---

@workspaces_bp.route("/invites", methods=["GET"])
@workspace_required
@require_workspace_role(["owner", "admin"])
def list_invites():
    ws_id = get_current_workspace_id()
    invites = WorkspaceInvitesModel.get_invites_for_workspace(ws_id)
    return jsonify({"invites": invites}), 200

@workspaces_bp.route("/invites", methods=["POST"])
@workspace_required
@require_workspace_role(["owner", "admin"])
def create_invite():
    ws_id = get_current_workspace_id()
    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    role = data.get("role")
    
    if not email or not role:
        return jsonify({"error": "Email and role are required"}), 400
        
    if role not in ("admin", "editor", "viewer"):
        return jsonify({"error": "Invalid role"}), 400
        
    current_role = get_current_role()
    if current_role == "admin" and role == "admin":
        return jsonify({"error": "Admins cannot invite other admins"}), 403
        
    # Check if user is already a member
    try:
        import psycopg2
        from app.config import Config
        with Config.get_postgres_connection() as _conn:
            with _conn.cursor() as _cur:
                _cur.execute(
                    "SELECT user_id FROM users WHERE email = %s", (email.lower().strip(),)
                )
                _existing_user = _cur.fetchone()
                if _existing_user:
                    _cur.execute(
                        "SELECT role FROM workspace_members WHERE workspace_id = %s AND user_id = %s",
                        (ws_id, _existing_user[0])
                    )
                    if _cur.fetchone():
                        return jsonify({"error": f"{email} is already a member of this workspace"}), 409
    except Exception:
        pass

    try:
        invite = WorkspaceInvitesModel.create_invite(ws_id, email, role, user_id)
    except Exception as e:
        err_str = str(e).lower()
        if "unique" in err_str or "duplicate" in err_str or "uq_ws_invite" in err_str:
            return jsonify({"error": f"An invitation for {email} is already pending. Check your pending invites."}), 409
        return jsonify({"error": str(e)}), 500
    # Send invite email
    try:
        from app.utils.mailer import send_workspace_invite_email
        from app.models.user_model import UserModel
        workspace = WorkspaceModel.get_by_id(ws_id) or {}
        inviter = UserModel.get_user_by_id(user_id) or {}
        inviter_name = inviter.get('display_name') or inviter.get('full_name') or inviter.get('email', 'A teammate')
        ws_name = workspace.get('name', 'a workspace')
        frontend_base = os.environ.get('PUBLIC_APP_URL', os.environ.get('FRONTEND_URL', 'https://testsurge.kynetropo.com/app')).rstrip('/')
        invite_link = f"{frontend_base}/invite/accept?token={invite['token']}"
        send_workspace_invite_email(
            to_email=email,
            inviter_name=inviter_name,
            workspace_name=ws_name,
            role=role,
            invite_link=invite_link,
        )
    except Exception as email_err:
        print(f"[invite] Email send failed (non-fatal): {email_err}")
    return jsonify({"invite": invite, "message": "Invite created successfully"}), 201

@workspaces_bp.route("/invites/<invite_id>", methods=["DELETE"])
@workspace_required
@require_workspace_role(["owner", "admin"])
def revoke_invite(invite_id):
    ws_id = get_current_workspace_id()
    deleted = WorkspaceInvitesModel.delete_invite(invite_id, ws_id)
    if not deleted:
        return jsonify({"error": "Invite not found"}), 404
    return jsonify({"message": "Invite revoked successfully"}), 200

@workspaces_bp.route("/invites/accept", methods=["POST"])
@jwt_required()
def accept_invite():
    user_id = _resolve_user_id()
    if not user_id and not _is_bypass():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "Token is required"}), 400

    invite = WorkspaceInvitesModel.get_invite_by_token(token)
    if not invite:
        return jsonify({"error": "Invalid or expired token"}), 400

    # Security: verify the caller's email matches the invite target.
    # Prevents token-theft attacks where an authenticated user accepts
    # an invite meant for a different email address.
    if not _is_bypass():
        from app.models.user_model import UserModel
        caller = UserModel.get_user_by_id(user_id)
        if not caller or caller.get("email", "").lower() != invite["email"].lower():
            return jsonify({"error": "This invite was sent to a different email address"}), 403

    WorkspaceModel.add_member(invite["workspace_id"], user_id, invite["role"])

    # Stamp accepted_at for audit trail before deleting the invite row
    try:
        import psycopg2
        from app.config import Config
        conn = Config.get_postgres_connection()
        try:
            with conn.cursor() as _cur:
                _cur.execute(
                    "UPDATE workspace_invites SET accepted_at = NOW() WHERE id = %s",
                    (invite["id"],)
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as stamp_err:
        print(f"[invite] accepted_at stamp failed (non-fatal): {stamp_err}")

    WorkspaceInvitesModel.delete_invite(invite["id"], invite["workspace_id"])

    workspace = WorkspaceModel.get_by_id(invite["workspace_id"])

    # Notify workspace members that someone joined
    accepting_user_id = user_id
    try:
        from app.models.notification_model import NotificationModel
        from app.models.user_model import UserModel as _UserModel
        accepting_user = _UserModel.get_user_by_id(accepting_user_id) or {}
        joining_name = accepting_user.get('display_name') or accepting_user.get('email', 'A new member')
        ws_name = (workspace or {}).get('name', '')
        NotificationModel.broadcast_to_workspace(
            workspace_id=invite.get('workspace_id'),
            event_type=NotificationModel.MEMBER_JOINED,
            title=f"{joining_name} joined the workspace",
            body=f"{joining_name} accepted an invitation and joined {ws_name}",
            actor_id=accepting_user_id,
            exclude_user_id=accepting_user_id,
        )
    except Exception as ne:
        print(f"[invite] Notification failed (non-fatal): {ne}")

    return jsonify({"workspace": workspace, "role": invite["role"], "switch_workspace": True}), 200


@workspaces_bp.route("/invites/pending", methods=["GET"])
@jwt_required()
def get_pending_invites_for_user():
    """Get all pending workspace invites for the current user's email."""
    import psycopg2.extras
    from app.config import Config
    from app.models.user_model import UserModel
    user_id = get_jwt_identity()
    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({"invites": []}), 200
    user_email = user.get("email", "").lower().strip()
    try:
        conn = Config.get_postgres_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.token,
                           wi.invited_by, wi.expires_at, wi.created_at,
                           w.name as workspace_name, w.slug as workspace_slug,
                           u.email as inviter_email, u.display_name as inviter_name
                    FROM workspace_invites wi
                    JOIN workspaces w ON w.id = wi.workspace_id
                    LEFT JOIN users u ON u.user_id = wi.invited_by
                    WHERE LOWER(wi.email) = %s
                      AND wi.accepted_at IS NULL
                      AND wi.expires_at > CURRENT_TIMESTAMP
                    ORDER BY wi.created_at DESC
                """, (user_email,))
                rows = cur.fetchall()
        finally:
            conn.close()
        invites = []
        for r in rows:
            invites.append({
                "id": str(r["id"]),
                "workspace_id": str(r["workspace_id"]),
                "workspace_name": r["workspace_name"],
                "workspace_slug": r["workspace_slug"],
                "role": r["role"],
                "token": r["token"],
                "inviter_email": r["inviter_email"] or "",
                "inviter_name": r["inviter_name"] or r["inviter_email"] or "Teammate",
                "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            })
        return jsonify({"invites": invites}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

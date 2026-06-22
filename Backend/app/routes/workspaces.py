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
        
    invite = WorkspaceInvitesModel.create_invite(ws_id, email, role, user_id)
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
    WorkspaceInvitesModel.delete_invite(invite["id"], invite["workspace_id"])

    return jsonify({"message": "Invite accepted successfully", "workspace_id": invite["workspace_id"]}), 200

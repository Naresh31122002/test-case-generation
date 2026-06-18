from flask import Blueprint, jsonify, request, make_response
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
    get_jwt,
)
from datetime import timedelta
from app.models.user_model import UserModel
from app.models.workspace_model import WorkspaceModel
from app.models.token_model import TokenModel, EMAIL_VERIFY, PASSWORD_RESET
from app.utils.mailer import send_verification_email, send_password_reset_email
from app.utils.limiter import limiter
from app.utils.validators import is_strong_password
from app.utils.audit import log_audit_event

auth_bp = Blueprint("auth", __name__)


def _issue_access_token(user_id: str):
    """Create an access token whose additional claims carry the user's default
    workspace, so the very first request after login is already workspace-scoped."""
    ws = WorkspaceModel.get_default_for_user(user_id)
    claims = {"workspace_id": ws["id"]} if ws else {}
    return create_access_token(identity=user_id, additional_claims=claims), ws


def _send_verification(user_id: str, email: str) -> None:
    """Issue a verification token and email it (best-effort)."""
    try:
        token = TokenModel.issue(user_id, EMAIL_VERIFY)
        send_verification_email(email, token)
    except Exception as e:  # never block signup on email issues
        print(f"[auth] verification email failed for {email}: {e}")


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if not is_strong_password(password):
        return jsonify({"error": "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character"}), 400

    try:
        user = UserModel.create_user(email, password)
    except ValueError as e:
        return jsonify({"error": str(e)}), 409

    # Every new user gets a personal workspace (they are its owner).
    WorkspaceModel.ensure_personal_workspace(user["user_id"], user["email"])
    # Soft email-verification gate: email the link, but log the user in immediately
    # so the journey can proceed to onboarding. A banner prompts them to verify.
    _send_verification(user["user_id"], user["email"])
    UserModel.update_last_login(user["user_id"])
    access_token, current_workspace = _issue_access_token(user["user_id"])
    refresh_token = create_refresh_token(identity=user["user_id"])

    log_audit_event(user["user_id"], "USER_REGISTER", {"email": user["email"]}, request.remote_addr)

    response = make_response(jsonify({
        "message": "Account created",
        "user": {"user_id": user["user_id"], "email": user["email"], "email_verified": False},
        "current_workspace": current_workspace,
    }), 201)
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = UserModel.get_user_by_email(email)
    if not user or not UserModel.verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    UserModel.update_last_login(user["user_id"])
    # Safety net: guarantee the user has a workspace even if they predate this feature.
    WorkspaceModel.ensure_personal_workspace(user["user_id"], user["email"])
    access_token, current_workspace = _issue_access_token(user["user_id"])
    refresh_token = create_refresh_token(identity=user["user_id"])

    log_audit_event(user["user_id"], "USER_LOGIN", {"email": user["email"]}, request.remote_addr)

    response = make_response(jsonify({
        "user": {"user_id": user["user_id"], "email": user["email"], "email_verified": user.get("email_verified", False)},
        "current_workspace": current_workspace,
    }), 200)
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    user_id = get_jwt_identity()
    from app.utils.jwt_blocklist import jwt_redis_blocklist
    # Blacklist the token for 15 minutes (match access token expiration)
    jwt_redis_blocklist.set(jti, "", ex=timedelta(minutes=15))
    
    log_audit_event(user_id, "USER_LOGOUT", {}, request.remote_addr)
    
    response = make_response(jsonify({"message": "Logged out"}), 200)
    unset_jwt_cookies(response)
    return response


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    workspaces = WorkspaceModel.get_for_user(user_id)
    current_workspace = WorkspaceModel.get_default_for_user(user_id)
    return jsonify({
        "user": user,  # includes email_verified
        "workspaces": workspaces,
        "current_workspace": current_workspace,
    }), 200


# ── Email verification ────────────────────────────────────────────────────────

@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """Confirm an email-verification token (single-use, 24h)."""
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "Token is required"}), 400

    user_id = TokenModel.consume(token, EMAIL_VERIFY)
    if not user_id:
        return jsonify({"error": "Invalid or expired verification link"}), 400

    UserModel.set_email_verified(user_id)
    return jsonify({"message": "Email verified"}), 200


@auth_bp.route("/resend-verification", methods=["POST"])
@jwt_required()
def resend_verification():
    """Re-send the verification email to the logged-in user."""
    user_id = get_jwt_identity()
    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("email_verified"):
        return jsonify({"message": "Email already verified"}), 200
    _send_verification(user_id, user["email"])
    return jsonify({"message": "Verification email sent"}), 200


# ── Password reset ────────────────────────────────────────────────────────────

@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per minute")
def forgot_password():
    """Begin a password reset. Always returns 200 (no account enumeration)."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    generic = jsonify({"message": "If that email exists, a reset link has been sent"})

    if not email:
        return generic, 200
    user = UserModel.get_user_by_email(email)
    if user:
        try:
            token = TokenModel.issue(user["user_id"], PASSWORD_RESET)
            send_password_reset_email(user["email"], token)
        except Exception as e:
            print(f"[auth] reset email failed for {email}: {e}")
    return generic, 200


@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("5 per minute")
def reset_password():
    """Complete a password reset with a valid token (single-use, 1h)."""
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new_password = data.get("password") or ""

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400
    if not is_strong_password(new_password):
        return jsonify({"error": "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character"}), 400

    user_id = TokenModel.consume(token, PASSWORD_RESET)
    if not user_id:
        return jsonify({"error": "Invalid or expired reset link"}), 400

    UserModel.update_password(user_id, new_password)
    log_audit_event(user_id, "PASSWORD_RESET", {}, request.remote_addr)
    return jsonify({"message": "Password updated"}), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    # Re-issue with the workspace claim so refreshed sessions stay scoped.
    access_token, _ = _issue_access_token(user_id)
    response = make_response(jsonify({"message": "Token refreshed"}), 200)
    set_access_cookies(response, access_token)
    return response

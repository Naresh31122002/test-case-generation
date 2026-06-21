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
from app.utils.mailer import (
    send_verification_email, send_password_reset_email,
    smtp_configured, verification_link,
)
from app.utils.limiter import limiter
from app.utils.validators import is_strong_password
from app.utils.audit import log_audit_event
from app.config import Config

auth_bp = Blueprint("auth", __name__)


def _issue_access_token(user_id: str):
    """Create an access token whose additional claims carry the user's default
    workspace, so the very first request after login is already workspace-scoped."""
    ws = WorkspaceModel.get_default_for_user(user_id)
    claims = {"workspace_id": ws["id"]} if ws else {}
    return create_access_token(identity=user_id, additional_claims=claims), ws


def _send_verification(user_id: str, email: str) -> str | None:
    """Issue a verification token and email it (best-effort). Returns the raw
    link only when SMTP isn't configured, so local dev (no mail server) can
    surface it in the API response instead of requiring a console search."""
    try:
        token = TokenModel.issue(user_id, EMAIL_VERIFY)
        send_verification_email(email, token)
        return None if smtp_configured() else verification_link(token)
    except Exception as e:  # never block signup on email issues
        print(f"[auth] verification email failed for {email}: {e}")
        return None


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
    # Hard email-verification gate: a brand-new password account cannot use the
    # app until the emailed link is clicked. No session is issued here —
    # /verify-email issues it once the address is confirmed.
    dev_link = _send_verification(user["user_id"], user["email"])

    log_audit_event(user["user_id"], "USER_REGISTER", {"email": user["email"]}, request.remote_addr)

    payload = {
        "message": "Account created. Check your email to verify your address before signing in.",
        "email": user["email"],
    }
    if dev_link:
        # SMTP isn't configured (local dev) — surface the link directly
        # instead of requiring a console search.
        payload["dev_verification_link"] = dev_link
    return jsonify(payload), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = UserModel.get_user_by_email(email)
    if not user or not user["password_hash"] or not UserModel.verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    # Hard gate: a password account must verify its email before its first
    # successful login. Google accounts are pre-verified by Google and skip this.
    if user.get("auth_provider", "password") == "password" and not user.get("email_verified"):
        return jsonify({"error": "Please verify your email before signing in", "code": "EMAIL_NOT_VERIFIED"}), 403

    UserModel.update_last_login(user["user_id"])
    # Safety net: guarantee the user has a workspace even if they predate this feature.
    WorkspaceModel.ensure_personal_workspace(user["user_id"], user["email"])
    access_token, current_workspace = _issue_access_token(user["user_id"])
    refresh_token = create_refresh_token(identity=user["user_id"])

    log_audit_event(user["user_id"], "USER_LOGIN", {"email": user["email"]}, request.remote_addr)

    response = make_response(jsonify({
        "user": {
            "user_id": user["user_id"], "email": user["email"],
            "email_verified": user.get("email_verified", False),
            "onboarding_completed": user.get("onboarding_completed", False),
        },
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
    from app.utils.jwt_blocklist import jwt_redis_blocklist, _redis_available
    if _redis_available and jwt_redis_blocklist:
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
        "user": user,
        "workspaces": workspaces,
        "current_workspace": current_workspace,
    }), 200


@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    """Update the current user's profile (display_name, avatar_url)."""
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    allowed = {k: v for k, v in data.items() if k in ('display_name', 'avatar_url')}
    if not allowed:
        return jsonify({"error": "No valid fields to update"}), 400
    try:
        from app.config import Config
        import psycopg2.extras
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                sets = ', '.join(f"{k} = %s" for k in allowed)
                cur.execute(
                    f"UPDATE users SET {sets} WHERE user_id = %s RETURNING user_id, email, display_name, avatar_url, email_verified",
                    list(allowed.values()) + [user_id]
                )
                row = dict(cur.fetchone())
        return jsonify({"user": row}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── First-login onboarding survey ───────────────────────────────────────────────

@auth_bp.route("/onboarding", methods=["POST"])
@jwt_required()
def complete_onboarding():
    """Save the (optional, skippable) first-login survey and mark it done so
    the modal never shows again for this user."""
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    UserModel.complete_onboarding(
        user_id,
        (data.get("org_name") or "").strip() or None,
        (data.get("job_title") or "").strip() or None,
        (data.get("referral_source") or "").strip() or None,
    )
    return jsonify({"message": "Onboarding saved"}), 200


@auth_bp.route("/me/notifications", methods=["GET"])
@jwt_required()
def get_notification_prefs():
    user_id = get_jwt_identity()
    try:
        from app.config import Config
        import psycopg2.extras, json as _json
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("SELECT notification_prefs FROM users WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
                prefs = row['notification_prefs'] if row else {}
                if isinstance(prefs, str): prefs = _json.loads(prefs)
        return jsonify({"prefs": prefs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/me/notifications", methods=["PUT"])
@jwt_required()
def update_notification_prefs():
    user_id = get_jwt_identity()
    prefs = request.get_json(silent=True) or {}
    try:
        from app.config import Config
        import json as _json
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET notification_prefs = %s WHERE user_id = %s",
                    (_json.dumps(prefs), user_id)
                )
        return jsonify({"prefs": prefs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── API Keys ──────────────────────────────────────────────────────────────────

@auth_bp.route("/api-keys", methods=["GET"])
@jwt_required()
def list_api_keys():
    user_id = get_jwt_identity()
    try:
        from app.config import Config
        import psycopg2.extras
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT id, name, key_prefix, created_at, last_used_at
                    FROM api_keys WHERE user_id = %s AND revoked_at IS NULL
                    ORDER BY created_at DESC
                """, (user_id,))
                keys = [dict(r) for r in cur.fetchall()]
        return jsonify({"keys": keys}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api-keys", methods=["POST"])
@jwt_required()
def create_api_key():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip() or "My API Key"
    try:
        import secrets, hashlib
        from app.config import Config
        from app.utils.workspace import get_current_workspace_id
        workspace_id = None
        try: workspace_id = get_current_workspace_id()
        except: pass
        raw_key = "ts_" + secrets.token_hex(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:10] + "…"
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO api_keys (user_id, workspace_id, name, key_hash, key_prefix)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                """, (user_id, workspace_id, name, key_hash, key_prefix))
                key_id = cur.fetchone()[0]
        return jsonify({"id": str(key_id), "key": raw_key, "prefix": key_prefix, "name": name}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api-keys/<key_id>", methods=["DELETE"])
@jwt_required()
def revoke_api_key(key_id):
    user_id = get_jwt_identity()
    try:
        from app.config import Config
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE api_keys SET revoked_at = NOW()
                    WHERE id = %s AND user_id = %s AND revoked_at IS NULL
                """, (key_id, user_id))
                if cur.rowcount == 0:
                    return jsonify({"error": "Key not found"}), 404
        return jsonify({"revoked": key_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """Confirm an email-verification token (single-use, 24h). This is the
    hard-gated account's first successful entry, so it issues the session
    cookies directly — no separate login step needed after clicking the link."""
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "Token is required"}), 400

    user_id = TokenModel.consume(token, EMAIL_VERIFY)
    if not user_id:
        return jsonify({"error": "Invalid or expired verification link"}), 400

    UserModel.set_email_verified(user_id)
    user = UserModel.get_user_by_id(user_id)

    WorkspaceModel.ensure_personal_workspace(user_id, user["email"])
    UserModel.update_last_login(user_id)
    access_token, current_workspace = _issue_access_token(user_id)
    refresh_token = create_refresh_token(identity=user_id)

    log_audit_event(user_id, "USER_EMAIL_VERIFIED", {"email": user["email"]}, request.remote_addr)

    response = make_response(jsonify({
        "message": "Email verified",
        "user": {
            "user_id": user["user_id"], "email": user["email"],
            "email_verified": True,
            "onboarding_completed": user.get("onboarding_completed", False),
        },
        "current_workspace": current_workspace,
    }), 200)
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/resend-verification", methods=["POST"])
@limiter.limit("5 per minute")
def resend_verification():
    """Re-send the verification email. Works from email alone (no session
    yet, since an unverified account can't log in) — always returns 200 to
    avoid leaking which emails are registered."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    message = "If that account exists and isn't verified, a new email has been sent"

    if not email:
        return jsonify({"message": message}), 200
    user = UserModel.get_user_by_email(email)
    dev_link = None
    if user and not user.get("email_verified"):
        dev_link = _send_verification(user["user_id"], user["email"])

    payload = {"message": message}
    if dev_link:
        # SMTP isn't configured (local dev only) — surfacing this technically
        # confirms the email is registered, which is acceptable in dev.
        payload["dev_verification_link"] = dev_link
    return jsonify(payload), 200


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


# ── Sign in with Google ────────────────────────────────────────────────────────

@auth_bp.route("/google", methods=["POST"])
@limiter.limit("10 per minute")
def google_signin():
    """Sign in (or sign up) using a Google ID token from Google Identity
    Services (frontend renders the official button and posts the credential
    here — no server-side redirect dance needed)."""
    if not Config.GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google sign-in is not configured"}), 503

    data = request.get_json(silent=True) or {}
    credential = (data.get("credential") or "").strip()
    if not credential:
        return jsonify({"error": "Missing Google credential"}), 400

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        claims = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), Config.GOOGLE_CLIENT_ID
        )
    except Exception:
        return jsonify({"error": "Invalid Google credential"}), 401

    google_id = claims.get("sub")
    email = (claims.get("email") or "").strip()
    if not google_id or not email or not claims.get("email_verified"):
        return jsonify({"error": "Google account email is not verified"}), 401

    user = UserModel.get_user_by_google_id(google_id)
    is_new = False
    if not user:
        # No account linked to this Google subject yet — check for an existing
        # password account with the same email and link it, otherwise create new.
        existing = UserModel.get_user_by_email(email)
        if existing:
            UserModel.link_google_id(existing["user_id"], google_id)
            user = existing
        else:
            created = UserModel.create_google_user(email, google_id)
            user = UserModel.get_user_by_id(created["user_id"])
            is_new = True

    WorkspaceModel.ensure_personal_workspace(user["user_id"], user["email"])
    UserModel.update_last_login(user["user_id"])
    access_token, current_workspace = _issue_access_token(user["user_id"])
    refresh_token = create_refresh_token(identity=user["user_id"])

    log_audit_event(user["user_id"], "USER_GOOGLE_LOGIN" if not is_new else "USER_GOOGLE_REGISTER", {"email": email}, request.remote_addr)

    response = make_response(jsonify({
        "user": {
            "user_id": user["user_id"], "email": user["email"],
            "email_verified": user.get("email_verified", True),
            "onboarding_completed": user.get("onboarding_completed", False),
        },
        "current_workspace": current_workspace,
    }), 200)
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    # Re-issue with the workspace claim so refreshed sessions stay scoped.
    access_token, _ = _issue_access_token(user_id)
    response = make_response(jsonify({"message": "Token refreshed"}), 200)
    set_access_cookies(response, access_token)
    return response

"""
utils/workspace.py

Request-scoped workspace resolution and authorization for multi-tenancy.

The current workspace is resolved on every protected request from, in order:
  1. the `X-Workspace-Id` request header (what the frontend sends), else
  2. the `workspace_id` additional claim baked into the access JWT, else
  3. the user's default (personal) workspace.

Whichever candidate is chosen, it is ALWAYS verified against workspace_members —
a header alone can never grant access. On success, `g.user_id` and
`g.workspace_id` are set for the duration of the request.

This module also centralizes the dev-auth bypass that previously lived inline in
routes/stories.py, so all routes share one scoping helper.
"""

import os
import functools
from flask import g, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.models.workspace_model import WorkspaceModel

# Fixed identity used when DEV_BYPASS_AUTH=1 (mirrors routes/stories.py).
_DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

WORKSPACE_HEADER = "X-Workspace-Id"


def _is_bypass() -> bool:
    return os.getenv("DEV_BYPASS_AUTH", "0") == "1"


def _resolve_user_id() -> str | None:
    """user_id from the JWT, or the fixed dev user when bypassing auth."""
    if _is_bypass():
        return _DEV_USER_ID
    return get_jwt_identity()


def _claim_workspace_id() -> str | None:
    """workspace_id additional claim from the access token, if present."""
    if _is_bypass():
        return None
    try:
        return get_jwt().get("workspace_id")
    except Exception:
        return None


def _ensure_dev_workspace(user_id: str) -> str | None:
    """In bypass mode the dev user may not exist in the DB. Resolve or create a
    personal workspace so local development still has a valid tenant context."""
    ws = WorkspaceModel.get_default_for_user(user_id)
    if ws:
        return ws["id"]
    try:
        ws = WorkspaceModel.ensure_personal_workspace(user_id, "dev@local")
        return ws["id"]
    except Exception:
        # Dev user row may not exist (FK). Fall back to no workspace; queries
        # that require one will simply return empty rather than crash.
        return None


def resolve_workspace():
    """Populate g.user_id / g.workspace_id, or return a Flask error response.

    Returns None on success, or a (json, status) tuple the decorator surfaces.
    """
    user_id = _resolve_user_id()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401

    candidate = request.headers.get(WORKSPACE_HEADER) or _claim_workspace_id()

    if candidate:
        if not WorkspaceModel.is_member(candidate, user_id):
            # In bypass mode, fall through to the dev workspace instead of 403
            # so a stale header from another tenant doesn't block local dev.
            if _is_bypass():
                candidate = None
            else:
                return jsonify({"error": "Forbidden: not a member of this workspace"}), 403

    if not candidate:
        if _is_bypass():
            candidate = _ensure_dev_workspace(user_id)
        else:
            default = WorkspaceModel.get_default_for_user(user_id)
            candidate = default["id"] if default else None

    if not candidate:
        return jsonify({"error": "No workspace available for this user"}), 403

    role = WorkspaceModel.get_role(candidate, user_id)
    if _is_bypass() and role is None:
        role = "owner"  # Fallback for dev mode
        
    g.user_id = user_id
    g.workspace_id = candidate
    g.workspace_role = role
    return None


def workspace_required(fn):
    """Drop-in replacement for @jwt_required() that also resolves + authorizes the
    current workspace. Honors DEV_BYPASS_AUTH. Sets g.user_id and g.workspace_id."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if _is_bypass():
            err = resolve_workspace()
            if err is not None:
                return err
            return fn(*args, **kwargs)

        @jwt_required()
        def _inner(*a, **kw):
            err = resolve_workspace()
            if err is not None:
                return err
            return fn(*a, **kw)

        return _inner(*args, **kwargs)

    return wrapper


def get_current_user_id() -> str | None:
    """user_id for the current request (set by workspace_required)."""
    return getattr(g, "user_id", None) or _resolve_user_id()


def get_current_workspace_id() -> str | None:
    """workspace_id for the current request (set by workspace_required)."""
    return getattr(g, "workspace_id", None)

def get_current_role() -> str | None:
    """workspace role for the current request (set by workspace_required)."""
    return getattr(g, "workspace_role", None)

def require_workspace_role(roles: list[str]):
    """Decorator to enforce workspace roles. Must be used AFTER @workspace_required."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            role = get_current_role()
            if not role or role not in roles:
                return jsonify({"error": f"Forbidden: requires one of {roles}"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

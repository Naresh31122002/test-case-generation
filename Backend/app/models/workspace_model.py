"""
workspace_model.py

Workspace = the multi-tenancy boundary. Every business entity belongs to a
workspace, and a user accesses data only through workspaces they are a member of.

A user gets one personal workspace on registration (owner role). Users may belong
to multiple workspaces via the workspace_members table.

Mirrors the static-method + Config.get_postgres_connection() style of UserModel.
"""

import re
import uuid
from app.config import Config


def _slugify(value: str) -> str:
    """Lowercase, hyphenated, url-safe slug base (uniqueness handled by caller)."""
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "workspace"


class WorkspaceModel:

    # ── Creation ──────────────────────────────────────────────────────────────
    @staticmethod
    def create(name: str, owner_id: str, plan: str = "free") -> dict:
        """Create a workspace with a unique slug and an 'owner' membership row."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            base = _slugify(name)
            slug = base
            # Ensure slug uniqueness with a short random suffix on collision.
            cursor.execute("SELECT 1 FROM workspaces WHERE slug = %s", (slug,))
            if cursor.fetchone():
                slug = f"{base}-{uuid.uuid4().hex[:6]}"

            cursor.execute(
                """
                INSERT INTO workspaces (name, slug, owner_id, plan)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, slug, owner_id, plan, created_at
                """,
                (name, slug, owner_id, plan),
            )
            row = cursor.fetchone()
            workspace_id = str(row[0])

            cursor.execute(
                """
                INSERT INTO workspace_members (workspace_id, user_id, role)
                VALUES (%s, %s, 'owner')
                ON CONFLICT (workspace_id, user_id) DO NOTHING
                """,
                (workspace_id, owner_id),
            )

            # Auto-provision credits row for the new workspace
            from datetime import datetime, timedelta
            reset_date = datetime.utcnow() + timedelta(days=30)
            cursor.execute(
                """
                INSERT INTO workspace_credits (workspace_id, monthly_limit, credits_used, reset_date)
                VALUES (%s, 200, 0, %s)
                ON CONFLICT (workspace_id) DO NOTHING
                """,
                (workspace_id, reset_date),
            )

            conn.commit()
            return {
                "id": workspace_id,
                "name": row[1],
                "slug": row[2],
                "owner_id": str(row[3]),
                "plan": row[4],
                "created_at": str(row[5]),
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def ensure_personal_workspace(user_id: str, email: str) -> dict:
        """Idempotently return the user's personal (owned) workspace, creating it
        if none exists. Used at register and as a login safety net so every user
        always has a resolvable default workspace."""
        existing = WorkspaceModel.get_default_for_user(user_id)
        if existing:
            return existing
        name = f"{email.split('@')[0]}'s workspace" if email else "My workspace"
        return WorkspaceModel.create(name=name, owner_id=user_id)

    # ── Lookups ───────────────────────────────────────────────────────────────
    @staticmethod
    def get_for_user(user_id: str) -> list:
        """All workspaces the user is a member of, with their role."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT w.id, w.name, w.slug, w.owner_id, w.plan, w.created_at, m.role
                FROM workspaces w
                JOIN workspace_members m ON m.workspace_id = w.id
                WHERE m.user_id = %s
                ORDER BY w.created_at ASC
                """,
                (user_id,),
            )
            return [
                {
                    "id": str(r[0]),
                    "name": r[1],
                    "slug": r[2],
                    "owner_id": str(r[3]),
                    "plan": r[4],
                    "created_at": str(r[5]),
                    "role": r[6],
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_by_id(workspace_id: str) -> dict | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, slug, owner_id, plan, created_at FROM workspaces WHERE id = %s",
                (workspace_id,),
            )
            r = cursor.fetchone()
            if not r:
                return None
            return {
                "id": str(r[0]),
                "name": r[1],
                "slug": r[2],
                "owner_id": str(r[3]),
                "plan": r[4],
                "created_at": str(r[5]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_default_for_user(user_id: str) -> dict | None:
        """The user's primary workspace: prefer one they own, else earliest joined."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT w.id, w.name, w.slug, w.owner_id, w.plan, w.created_at
                FROM workspaces w
                JOIN workspace_members m ON m.workspace_id = w.id
                WHERE m.user_id = %s
                ORDER BY (w.owner_id = %s) DESC, w.created_at ASC
                LIMIT 1
                """,
                (user_id, user_id),
            )
            r = cursor.fetchone()
            if not r:
                return None
            return {
                "id": str(r[0]),
                "name": r[1],
                "slug": r[2],
                "owner_id": str(r[3]),
                "plan": r[4],
                "created_at": str(r[5]),
            }
        finally:
            cursor.close()
            conn.close()

    # ── Membership / authorization ────────────────────────────────────────────
    @staticmethod
    def is_member(workspace_id: str, user_id: str) -> bool:
        if not workspace_id or not user_id:
            return False
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM workspace_members WHERE workspace_id = %s AND user_id = %s",
                (workspace_id, user_id),
            )
            return cursor.fetchone() is not None
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_role(workspace_id: str, user_id: str) -> str | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT role FROM workspace_members WHERE workspace_id = %s AND user_id = %s",
                (workspace_id, user_id),
            )
            r = cursor.fetchone()
            return r[0] if r else None
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def add_member(workspace_id: str, user_id: str, role: str = "editor") -> None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO workspace_members (workspace_id, user_id, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
                """,
                (workspace_id, user_id, role),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_members(workspace_id: str) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT u.user_id, u.email, m.role, m.created_at
                FROM workspace_members m
                JOIN users u ON u.user_id = m.user_id
                WHERE m.workspace_id = %s
                ORDER BY m.created_at ASC
                """,
                (workspace_id,),
            )
            return [
                {
                    "user_id": str(r[0]),
                    "email": r[1],
                    "role": r[2],
                    "joined_at": str(r[3]),
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def remove_member(workspace_id: str, user_id: str) -> bool:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM workspace_members WHERE workspace_id = %s AND user_id = %s RETURNING user_id",
                (workspace_id, user_id)
            )
            deleted = cursor.fetchone() is not None
            conn.commit()
            return deleted
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_member_role(workspace_id: str, user_id: str, new_role: str) -> bool:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE workspace_members SET role = %s WHERE workspace_id = %s AND user_id = %s RETURNING user_id",
                (new_role, workspace_id, user_id)
            )
            updated = cursor.fetchone() is not None
            conn.commit()
            return updated
        finally:
            cursor.close()
            conn.close()

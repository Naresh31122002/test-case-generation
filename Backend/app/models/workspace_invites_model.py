import uuid
from datetime import datetime, timedelta
from app.config import Config
import secrets

class WorkspaceInvitesModel:
    @staticmethod
    def create_invite(workspace_id: str, email: str, role: str, invited_by: str) -> dict:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(days=7)
            
            cursor.execute(
                """
                INSERT INTO workspace_invites (workspace_id, email, role, token, invited_by, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, workspace_id, email, role, token, invited_by, expires_at, created_at
                """,
                (workspace_id, email, role, token, invited_by, expires_at)
            )
            row = cursor.fetchone()
            conn.commit()
            return {
                "id": str(row[0]),
                "workspace_id": str(row[1]),
                "email": row[2],
                "role": row[3],
                "token": row[4],
                "invited_by": str(row[5]),
                "expires_at": str(row[6]),
                "created_at": str(row[7]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_invites_for_workspace(workspace_id: str) -> list:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, workspace_id, email, role, token, invited_by, expires_at, created_at
                FROM workspace_invites
                WHERE workspace_id = %s AND expires_at > CURRENT_TIMESTAMP
                ORDER BY created_at DESC
                """,
                (workspace_id,)
            )
            return [
                {
                    "id": str(r[0]),
                    "workspace_id": str(r[1]),
                    "email": r[2],
                    "role": r[3],
                    "token": r[4],
                    "invited_by": str(r[5]),
                    "expires_at": str(r[6]),
                    "created_at": str(r[7]),
                } for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_invite_by_token(token: str) -> dict | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, workspace_id, email, role, token, invited_by, expires_at, created_at
                FROM workspace_invites
                WHERE token = %s AND expires_at > CURRENT_TIMESTAMP
                """,
                (token,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": str(row[0]),
                "workspace_id": str(row[1]),
                "email": row[2],
                "role": row[3],
                "token": row[4],
                "invited_by": str(row[5]),
                "expires_at": str(row[6]),
                "created_at": str(row[7]),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def delete_invite(invite_id: str, workspace_id: str) -> bool:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM workspace_invites WHERE id = %s AND workspace_id = %s RETURNING id",
                (invite_id, workspace_id)
            )
            deleted = cursor.fetchone() is not None
            conn.commit()
            return deleted
        finally:
            cursor.close()
            conn.close()

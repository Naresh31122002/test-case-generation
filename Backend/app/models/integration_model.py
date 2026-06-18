"""
integration_model.py

Per-workspace third-party integration credentials (e.g. Jira). Replaces the old
single global env-var configuration so each tenant connects its own Jira account.

Secrets (api tokens) are encrypted at rest with Fernet using INTEGRATION_SECRET_KEY.
If that key is unset (local dev), secrets are stored in plaintext with a warning —
never do this in production.
"""

import os
import json
import logging
from app.config import Config

logger = logging.getLogger(__name__)


def _fernet():
    """Return a Fernet cipher from INTEGRATION_SECRET_KEY, or None if unavailable."""
    key = os.getenv("INTEGRATION_SECRET_KEY")
    if not key:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:  # missing dependency or bad key
        logger.warning(f"Integration secret encryption unavailable: {e}")
        return None


def encrypt_secret(plaintext: str) -> str:
    if plaintext is None:
        return None
    f = _fernet()
    if not f:
        logger.warning("INTEGRATION_SECRET_KEY not set — storing integration secret in plaintext.")
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt_secret(stored: str) -> str:
    if stored is None:
        return None
    f = _fernet()
    if not f:
        return stored  # assume plaintext
    try:
        return f.decrypt(stored.encode()).decode()
    except Exception:
        # Value was stored before a key existed (plaintext) — return as-is.
        return stored


class IntegrationModel:

    @staticmethod
    def upsert(workspace_id: str, integration_type: str, config: dict, secret: str = None) -> dict:
        """Create or update a workspace's integration config. `secret` is encrypted."""
        conn = Config.get_postgres_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO workspace_integrations (workspace_id, integration_type, config, secret_enc)
                VALUES (%s, %s, %s::jsonb, %s)
                ON CONFLICT (workspace_id, integration_type)
                DO UPDATE SET config = EXCLUDED.config, secret_enc = EXCLUDED.secret_enc
                RETURNING id
                """,
                (workspace_id, integration_type, json.dumps(config or {}), encrypt_secret(secret)),
            )
            row = cur.fetchone()
            conn.commit()
            return {"id": str(row[0]), "workspace_id": workspace_id, "integration_type": integration_type}
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get(workspace_id: str, integration_type: str) -> dict | None:
        """Return {config, secret} for a workspace integration, secret decrypted."""
        conn = Config.get_postgres_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT config, secret_enc FROM workspace_integrations
                WHERE workspace_id = %s AND integration_type = %s
                """,
                (workspace_id, integration_type),
            )
            row = cur.fetchone()
            if not row:
                return None
            config = row[0] if isinstance(row[0], dict) else (json.loads(row[0]) if row[0] else {})
            return {"config": config, "secret": decrypt_secret(row[1])}
        finally:
            cur.close()
            conn.close()

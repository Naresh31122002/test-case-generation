"""
token_model.py

Single-use, expiring auth tokens for email verification and password reset.

Security: only a SHA-256 *hash* of the token is stored. The raw token is returned
once (to email to the user) and never persisted, so a DB leak cannot be replayed.
Tokens are consumed atomically (used_at set) to prevent reuse.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from app.config import Config

EMAIL_VERIFY = "email_verify"
PASSWORD_RESET = "password_reset"

# Token lifetimes
_TTL = {
    EMAIL_VERIFY: timedelta(hours=24),
    PASSWORD_RESET: timedelta(hours=1),
}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class TokenModel:

    @staticmethod
    def issue(user_id: str, purpose: str) -> str:
        """Create a token for a user+purpose, invalidating any prior unused ones.
        Returns the RAW token (store/send this; only its hash is persisted)."""
        if purpose not in _TTL:
            raise ValueError(f"Unknown token purpose: {purpose}")
        raw = secrets.token_urlsafe(32)
        token_hash = _hash(raw)
        expires_at = datetime.utcnow() + _TTL[purpose]

        conn = Config.get_postgres_connection()
        try:
            cur = conn.cursor()
            # Invalidate older unused tokens of the same purpose for this user.
            cur.execute(
                "DELETE FROM auth_tokens WHERE user_id = %s AND purpose = %s AND used_at IS NULL",
                (user_id, purpose),
            )
            cur.execute(
                """
                INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
                VALUES (%s, %s, %s, %s)
                """,
                (token_hash, user_id, purpose, expires_at),
            )
            conn.commit()
            return raw
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def consume(token: str, purpose: str) -> str | None:
        """Validate and atomically consume a token. Returns the user_id on success,
        or None if the token is unknown, wrong purpose, expired, or already used."""
        if not token:
            return None
        token_hash = _hash(token)
        conn = Config.get_postgres_connection()
        try:
            cur = conn.cursor()
            # Mark used only if currently valid; RETURNING tells us if it matched.
            cur.execute(
                """
                UPDATE auth_tokens
                SET used_at = CURRENT_TIMESTAMP
                WHERE token_hash = %s
                  AND purpose = %s
                  AND used_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP
                RETURNING user_id
                """,
                (token_hash, purpose),
            )
            row = cur.fetchone()
            conn.commit()
            return str(row[0]) if row else None
        finally:
            cur.close()
            conn.close()

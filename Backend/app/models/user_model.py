import bcrypt
from app.config import Config


class UserModel:

    @staticmethod
    def create_user(email: str, password: str) -> dict:
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING user_id, email, created_on
                """,
                (email.lower().strip(), password_hash),
            )
            row = cursor.fetchone()
            conn.commit()
            return {"user_id": str(row[0]), "email": row[1], "created_on": str(row[2])}
        except Exception as e:
            conn.rollback()
            if "unique" in str(e).lower():
                raise ValueError(f"Email already registered: {email}")
            raise
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_user_by_email(email: str) -> dict | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT user_id, email, password_hash, email_verified, auth_provider, onboarding_completed_at, full_name FROM users WHERE email = %s",
                (email.lower().strip(),),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "user_id": str(row[0]), "email": row[1], "password_hash": row[2],
                "email_verified": bool(row[3]), "auth_provider": row[4],
                "onboarding_completed": row[5] is not None,
                "full_name": row[6],
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_user_by_id(user_id: str) -> dict | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT user_id, email, email_verified, auth_provider, onboarding_completed_at, full_name FROM users WHERE user_id = %s",
                (user_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "user_id": str(row[0]), "email": row[1],
                "email_verified": bool(row[2]), "auth_provider": row[3],
                "onboarding_completed": row[4] is not None,
                "full_name": row[5],
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_user_by_google_id(google_id: str) -> dict | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT user_id, email, email_verified, auth_provider, onboarding_completed_at FROM users WHERE google_id = %s",
                (google_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "user_id": str(row[0]), "email": row[1],
                "email_verified": bool(row[2]), "auth_provider": row[3],
                "onboarding_completed": row[4] is not None,
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def complete_onboarding(user_id: str, org_name: str | None, job_title: str | None, referral_source: str | None) -> None:
        """Persist the first-login survey answers (any field may be skipped/None)
        and mark onboarding done so the modal never shows again."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE users
                SET onboarding_completed_at = NOW(),
                    org_name = COALESCE(%s, org_name),
                    job_title = COALESCE(%s, job_title),
                    referral_source = COALESCE(%s, referral_source)
                WHERE user_id = %s
                """,
                (org_name, job_title, referral_source, user_id),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_profile(user_id: str, full_name: str | None) -> dict | None:
        """Set the user's display name (Sprint 1 Phase 6). Returns the updated user."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET full_name = COALESCE(%s, full_name) WHERE user_id = %s RETURNING user_id",
                (full_name, user_id),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                return None
            return UserModel.get_user_by_id(user_id)
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def create_google_user(email: str, google_id: str) -> dict:
        """New account from a verified Google ID token. No password — email is
        already verified by Google, so email_verified starts TRUE."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO users (email, password_hash, google_id, auth_provider, email_verified)
                VALUES (%s, NULL, %s, 'google', TRUE)
                RETURNING user_id, email, created_on
                """,
                (email.lower().strip(), google_id),
            )
            row = cursor.fetchone()
            conn.commit()
            return {"user_id": str(row[0]), "email": row[1], "created_on": str(row[2])}
        except Exception as e:
            conn.rollback()
            if "unique" in str(e).lower():
                raise ValueError(f"Email already registered: {email}")
            raise
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def link_google_id(user_id: str, google_id: str) -> None:
        """Link a Google account to an existing password-based account that
        shares the same (already-verified-by-Google) email address."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET google_id = %s WHERE user_id = %s",
                (google_id, user_id),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def set_email_verified(user_id: str) -> None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET email_verified = TRUE WHERE user_id = %s",
                (user_id,),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_password(user_id: str, new_password: str) -> None:
        password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE user_id = %s",
                (password_hash, user_id),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def verify_password(plain_password: str, stored_hash: str) -> bool:
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))

    @staticmethod
    def update_last_login(user_id: str) -> None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET last_login = NOW() WHERE user_id = %s",
                (user_id,),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

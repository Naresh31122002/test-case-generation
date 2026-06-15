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
                "SELECT user_id, email, password_hash FROM users WHERE email = %s",
                (email.lower().strip(),),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {"user_id": str(row[0]), "email": row[1], "password_hash": row[2]}
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_user_by_id(user_id: str) -> dict | None:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT user_id, email FROM users WHERE user_id = %s",
                (user_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {"user_id": str(row[0]), "email": row[1]}
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

import uuid
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.config import Config

PLAN_LIMITS = {
    'free': 50,
    'starter': 500,
    'pro': 2000,
    'team': 10000
}

class OutOfCreditsException(Exception):
    pass

class CreditsModel:
    @staticmethod
    def _ensure_credits_row(cursor, workspace_id: str) -> None:
        """Ensure a workspace_credits row exists for the workspace."""
        cursor.execute("SELECT plan FROM workspaces WHERE id = %s", (workspace_id,))
        ws = cursor.fetchone()
        if not ws:
            raise Exception("Workspace not found")
        plan = ws[0]
        limit = PLAN_LIMITS.get(plan, 50)
        
        # Insert if not exists
        cursor.execute(
            """
            INSERT INTO workspace_credits (workspace_id, monthly_limit, credits_used, reset_date)
            VALUES (%s, %s, 0, %s)
            ON CONFLICT (workspace_id) DO NOTHING
            """,
            (workspace_id, limit, datetime.utcnow() + relativedelta(months=1))
        )

    @staticmethod
    def _lazy_reset_credits(cursor, workspace_id: str) -> None:
        """Reset credits if the reset_date has passed."""
        now = datetime.utcnow()
        cursor.execute(
            """
            UPDATE workspace_credits
            SET credits_used = 0, reset_date = %s, updated_at = %s
            WHERE workspace_id = %s AND reset_date <= %s
            """,
            (now + relativedelta(months=1), now, workspace_id, now)
        )

    @staticmethod
    def check_and_deduct_credit(workspace_id: str, user_id: str, action: str, amount: int = 1, story_id: str = None) -> bool:
        """
        Atomically checks and deducts credits.
        Raises OutOfCreditsException if limit reached.
        """
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            
            # 1. Ensure row exists
            CreditsModel._ensure_credits_row(cursor, workspace_id)
            
            # 2. Check and perform lazy reset if necessary
            CreditsModel._lazy_reset_credits(cursor, workspace_id)
            
            # 3. Deduct credit (race condition safe)
            cursor.execute(
                """
                UPDATE workspace_credits
                SET credits_used = credits_used + %s, updated_at = CURRENT_TIMESTAMP
                WHERE workspace_id = %s AND (credits_used + %s) <= monthly_limit
                RETURNING credits_used
                """,
                (amount, workspace_id, amount)
            )
            
            row = cursor.fetchone()
            if not row:
                raise OutOfCreditsException("Workspace has reached its credit limit.")
                
            # 4. Log transaction
            cursor.execute(
                """
                INSERT INTO credit_transactions (workspace_id, user_id, amount, action, story_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (workspace_id, user_id, amount, action, story_id)
            )
            
            conn.commit()
            return True
        except OutOfCreditsException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_credit_usage(workspace_id: str) -> dict:
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            CreditsModel._ensure_credits_row(cursor, workspace_id)
            CreditsModel._lazy_reset_credits(cursor, workspace_id)
            conn.commit() # commit the ensure/reset inserts/updates
            
            cursor.execute(
                """
                SELECT monthly_limit, credits_used, reset_date 
                FROM workspace_credits 
                WHERE workspace_id = %s
                """,
                (workspace_id,)
            )
            row = cursor.fetchone()
            
            if not row:
                return {
                    "limit": 50,
                    "used": 0,
                    "remaining": 50,
                    "status": "ok",
                    "percent_used": 0
                }
                
            limit = row[0]
            used = row[1]
            remaining = limit - used
            percent_used = (used / limit) * 100 if limit > 0 else 100
            
            status = "ok"
            if percent_used >= 100:
                status = "blocked"
            elif percent_used >= 80:
                status = "warning"
                
            return {
                "limit": limit,
                "used": used,
                "remaining": remaining,
                "status": status,
                "percent_used": percent_used,
                "reset_date": str(row[2])
            }
        finally:
            cursor.close()
            conn.close()

import psycopg2
import json
from flask import current_app

def log_audit_event(user_id: str, action: str, details: dict, ip_address: str):
    db_service = current_app.config.get('DB_SERVICE')
    if not db_service:
        return
    
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO audit_logs (user_id, action, details, ip_address)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, action, json.dumps(details), ip_address))
    except Exception as e:
        print(f"[Audit] Failed to log event for user {user_id}: {e}")

def log_admin_audit_event(admin_email: str, action: str, details: dict, ip_address: str):
    db_service = current_app.config.get('DB_SERVICE')
    if not db_service:
        return
    
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO admin_audit_logs (admin_email, action, details, ip_address)
                    VALUES (%s, %s, %s, %s)
                """, (admin_email, action, json.dumps(details), ip_address))
    except Exception as e:
        print(f"[Audit] Failed to log admin event for {admin_email}: {e}")

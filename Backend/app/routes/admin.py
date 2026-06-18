from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt
from app.config import Config
from functools import wraps
import psycopg2
from psycopg2.extras import DictCursor
from app.utils.audit import log_admin_audit_event

admin_bp = Blueprint('admin', __name__)

def admin_required():
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") != "superadmin":
                return jsonify({"error": "Admin privileges required"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    if email == Config.ADMIN_EMAIL and password == Config.ADMIN_PASSWORD:
        access_token = create_access_token(
            identity="admin",
            additional_claims={"role": "superadmin"}
        )
        
        log_admin_audit_event(email, "ADMIN_LOGIN", {}, request.remote_addr)
        
        return jsonify({
            "access_token": access_token,
            "message": "Admin login successful"
        }), 200

    return jsonify({"error": "Invalid admin credentials"}), 401

@admin_bp.route('/metrics', methods=['GET'])
@admin_required()
def get_metrics():
    db_service = current_app.config['DB_SERVICE']
    
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                # Active users (total users for now)
                cur.execute("SELECT COUNT(user_id) FROM users")
                active_users = cur.fetchone()[0]
                
                # Churn (Canceled subscriptions)
                cur.execute("SELECT COUNT(id) FROM workspaces WHERE subscription_status = 'canceled'")
                churn = cur.fetchone()[0]
                
                # MRR / ARR based on plans
                cur.execute("""
                    SELECT plan, COUNT(id) as count 
                    FROM workspaces 
                    WHERE plan != 'free' AND (subscription_status = 'active' OR subscription_status IS NULL)
                    GROUP BY plan
                """)
                plans = cur.fetchall()
                
                plan_prices = {
                    "starter": 15,
                    "pro": 49,
                    "team": 199,
                    "enterprise": 499
                }
                
                mrr = 0
                for row in plans:
                    mrr += plan_prices.get(row['plan'], 0) * row['count']
                
                arr = mrr * 12
                
                # Credits Consumed
                cur.execute("SELECT SUM(credits_used) FROM workspace_credits")
                credits_result = cur.fetchone()[0]
                credits_consumed = credits_result if credits_result else 0
                
        return jsonify({
            "mrr": mrr,
            "arr": arr,
            "churn": churn,
            "active_users": active_users,
            "credits_consumed": credits_consumed
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/users', methods=['GET'])
@admin_required()
def get_users():
    db_service = current_app.config['DB_SERVICE']
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT user_id, email, created_on, last_login, email_verified 
                    FROM users 
                    ORDER BY created_on DESC
                """)
                users = [dict(row) for row in cur.fetchall()]
        return jsonify({"users": users}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/workspaces', methods=['GET'])
@admin_required()
def get_workspaces():
    db_service = current_app.config['DB_SERVICE']
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT w.id, w.name, w.plan, w.subscription_status, w.created_at, u.email as owner_email
                    FROM workspaces w
                    JOIN users u ON w.owner_id = u.user_id
                    ORDER BY w.created_at DESC
                """)
                workspaces = [dict(row) for row in cur.fetchall()]
        return jsonify({"workspaces": workspaces}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api_usage', methods=['GET'])
@admin_required()
def get_api_usage():
    db_service = current_app.config['DB_SERVICE']
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT created_on, project_id, test_case_generated, source 
                    FROM test_cases 
                    ORDER BY created_on DESC 
                    LIMIT 100
                """)
                usage = [dict(row) for row in cur.fetchall()]
        return jsonify({"usage": usage}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/errors', methods=['GET'])
@admin_required()
def get_errors():
    # Mock endpoint since there is no error logging table yet
    mock_errors = [
        {"id": 1, "message": "Failed to sync Jira project", "timestamp": "2026-06-18T12:00:00Z", "severity": "high"},
        {"id": 2, "message": "Rate limit exceeded on Groq API", "timestamp": "2026-06-18T14:30:00Z", "severity": "medium"},
        {"id": 3, "message": "Invalid stripe webhook signature", "timestamp": "2026-06-18T16:45:00Z", "severity": "high"}
    ]
    return jsonify({"errors": mock_errors}), 200

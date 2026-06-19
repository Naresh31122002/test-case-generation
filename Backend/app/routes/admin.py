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
                    SELECT user_id, email, created_on, last_login, email_verified,
                           org_name, job_title, referral_source,
                           (onboarding_completed_at IS NOT NULL) AS onboarding_completed
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


@admin_bp.route('/token-usage', methods=['GET'])
@admin_required()
def get_token_usage():
    db_service = current_app.config['DB_SERVICE']
    user_id_filter = request.args.get('user_id')
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:

                # All users (from users table, not token_usage) for the selector
                cur.execute("""
                    SELECT u.user_id, u.email,
                           COALESCE(SUM(tu.input_tokens), 0)  AS total_input,
                           COALESCE(SUM(tu.output_tokens), 0) AS total_output,
                           COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) AS total_tokens,
                           COALESCE(COUNT(tu.id), 0) AS call_count,
                           MAX(tu.created_at) AS last_used
                    FROM users u
                    LEFT JOIN token_usage tu ON tu.user_id = u.user_id
                    GROUP BY u.user_id, u.email
                    ORDER BY total_tokens DESC, u.email
                """)
                per_user = [dict(r) for r in cur.fetchall()]

                # If a specific user is selected, get their per-action breakdown and timeline
                per_action = []
                timeline = []
                if user_id_filter:
                    cur.execute("""
                        SELECT action, model, provider,
                               SUM(input_tokens)  AS total_input,
                               SUM(output_tokens) AS total_output,
                               COUNT(*) AS call_count
                        FROM token_usage
                        WHERE user_id = %s
                        GROUP BY action, model, provider
                        ORDER BY total_output DESC
                    """, (user_id_filter,))
                    per_action = [dict(r) for r in cur.fetchall()]

                    cur.execute("""
                        SELECT action, model, input_tokens, output_tokens,
                               story_id, created_at
                        FROM token_usage
                        WHERE user_id = %s
                        ORDER BY created_at DESC
                        LIMIT 50
                    """, (user_id_filter,))
                    timeline = [dict(r) for r in cur.fetchall()]
                else:
                    # No user selected — global per-action summary
                    cur.execute("""
                        SELECT action,
                               SUM(input_tokens)  AS total_input,
                               SUM(output_tokens) AS total_output,
                               COUNT(*) AS call_count
                        FROM token_usage
                        GROUP BY action
                        ORDER BY total_output DESC
                    """)
                    per_action = [dict(r) for r in cur.fetchall()]

                # Overall totals (scoped to user if selected)
                if user_id_filter:
                    cur.execute("""
                        SELECT SUM(input_tokens) AS total_input,
                               SUM(output_tokens) AS total_output,
                               COUNT(*) AS total_calls
                        FROM token_usage WHERE user_id = %s
                    """, (user_id_filter,))
                else:
                    cur.execute("""
                        SELECT SUM(input_tokens) AS total_input,
                               SUM(output_tokens) AS total_output,
                               COUNT(*) AS total_calls
                        FROM token_usage
                    """)
                totals = dict(cur.fetchone())

        return jsonify({
            "per_user": per_user,
            "per_action": per_action,
            "timeline": timeline,
            "totals": totals,
            "filtered_user_id": user_id_filter,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_required()
def get_subscriptions():
    db_service = current_app.config['DB_SERVICE']
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT
                        w.id, w.name, w.plan, w.subscription_status,
                        w.stripe_subscription_id, w.current_period_end,
                        w.created_at, u.email as owner_email
                    FROM workspaces w
                    JOIN users u ON w.owner_id = u.user_id
                    ORDER BY w.created_at DESC
                """)
                subs = [dict(row) for row in cur.fetchall()]

                plan_prices = {"starter": 15, "pro": 49, "team": 199, "enterprise": 499}
                cur.execute("""
                    SELECT plan, COUNT(*) as count
                    FROM workspaces
                    GROUP BY plan
                """)
                breakdown = {row['plan']: row['count'] for row in cur.fetchall()}

        revenue_breakdown = [
            {"plan": p, "count": breakdown.get(p, 0), "monthly_revenue": plan_prices.get(p, 0) * breakdown.get(p, 0)}
            for p in ["free", "starter", "pro", "team", "enterprise"]
        ]

        return jsonify({"subscriptions": subs, "revenue_breakdown": revenue_breakdown}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/credits', methods=['GET'])
@admin_required()
def get_credits():
    db_service = current_app.config['DB_SERVICE']
    try:
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute("""
                    SELECT
                        wc.workspace_id, w.name as workspace_name, w.plan,
                        wc.credits_used, wc.monthly_limit,
                        ROUND(wc.credits_used::numeric / NULLIF(wc.monthly_limit, 0) * 100, 1) as usage_pct,
                        wc.reset_date
                    FROM workspace_credits wc
                    JOIN workspaces w ON wc.workspace_id = w.id
                    ORDER BY wc.credits_used DESC
                """)
                credits = [dict(row) for row in cur.fetchall()]

                cur.execute("SELECT SUM(credits_used) as total, SUM(monthly_limit) as total_limit FROM workspace_credits")
                totals = dict(cur.fetchone())

        return jsonify({"credits": credits, "totals": totals}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

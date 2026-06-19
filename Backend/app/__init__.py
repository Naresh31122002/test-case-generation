from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import sys
from datetime import timedelta
import sentry_sdk
from flask_talisman import Talisman
from app.models.db_service import DatabaseService, get_db_service
from app.config import Config

# Load environment variables — use explicit path so it works regardless of cwd
_here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_here, '.env'), override=True)

def create_app():
    app = Flask(__name__)

    is_production = os.getenv("FLASK_ENV") == "production"
    is_dev_bypass = os.getenv("DEV_BYPASS_AUTH") == "1"

    # Guard: prevent DEV_BYPASS_AUTH in production
    if is_production and is_dev_bypass:
        print("FATAL: DEV_BYPASS_AUTH=1 is not allowed in production. Aborting.", file=sys.stderr)
        sys.exit(1)

    # Guard: require a strong JWT secret in production
    jwt_secret = os.environ.get("JWT_SECRET_KEY", "")
    if is_production and (not jwt_secret or jwt_secret == "dev-secret-change-in-production"):
        print("FATAL: JWT_SECRET_KEY must be set to a strong random value in production. Aborting.", file=sys.stderr)
        sys.exit(1)

    # CORS
    if not is_production or is_dev_bypass:
        import re
        allowed_origins_re = [r"http://localhost:\d+", r"http://127\.0\.0\.1:\d+"]
        CORS(app, resources={
            r"/api/*": {
                "origins": allowed_origins_re,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Workspace-Id"],
                "supports_credentials": True,
            }
        })
    else:
        allowed_origins = []
        frontend_url = os.getenv("FRONTEND_URL")
        if frontend_url:
            allowed_origins.append(frontend_url)
            if "kynetropo.com" in frontend_url:
                allowed_origins.append("https://www.kynetropo.com")
        vercel_url = os.getenv("VERCEL_URL")
        if vercel_url:
            allowed_origins.append(f"https://{vercel_url}")
        CORS(app, resources={
            r"/api/*": {
                "origins": allowed_origins,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Workspace-Id"],
                "supports_credentials": True,
            }
        })

    # Security headers for every response
    csp = {
        'default-src': [
            '\'self\'',
            '\'unsafe-inline\'',
            '*.stripe.com',
            '*.kynetropo.com'
        ]
    }
    Talisman(app, 
             force_https=is_production, 
             content_security_policy=csp,
             session_cookie_secure=is_production,
             strict_transport_security=is_production)

    # Configure app
    app.config.from_object(Config)
    
    # Initialize Sentry
    if app.config.get("SENTRY_DSN"):
        sentry_sdk.init(
            dsn=app.config["SENTRY_DSN"],
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            environment=os.getenv("FLASK_ENV", "development")
        )

    # Rate Limiting
    from app.utils.limiter import limiter
    limiter.init_app(app)

    # JWT configuration
    app.config["JWT_SECRET_KEY"] = jwt_secret or "dev-secret-change-in-production"
    app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
    app.config["JWT_COOKIE_HTTPONLY"] = True
    # Dev: 8h access token so sessions don't expire mid-work. Prod: 15min.
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15) if is_production else timedelta(hours=8)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
    app.config["JWT_COOKIE_SECURE"] = is_production
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False  # off in dev; set to is_production when deploying
    app.config["JWT_COOKIE_DOMAIN"] = None

    jwt = JWTManager(app)

    # Configure Redis blocklist for session revocation
    from app.utils.jwt_blocklist import check_if_token_is_revoked
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
        return check_if_token_is_revoked(jwt_header, jwt_payload)

    # Initialize database service
    db_service = get_db_service()
    app.config['DB_SERVICE'] = db_service

    # Run idempotent schema migrations on every startup so new columns/tables
    # (email_verified, auth_tokens, workspaces, workspace_members, etc.) are
    # always present without a separate manual migration step.
    try:
        from app.models.create_dbs import create_postgres_db
        create_postgres_db()
    except Exception as _schema_err:
        import sys
        print(f"WARNING: schema migration failed: {_schema_err}", file=sys.stderr)

    # Register blueprints
    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    from app.routes.stories import stories_bp
    app.register_blueprint(stories_bp, url_prefix='/api/stories')

    from app.routes.workspaces import workspaces_bp
    app.register_blueprint(workspaces_bp, url_prefix='/api/workspaces')

    from app.routes.stripe_routes import stripe_bp
    app.register_blueprint(stripe_bp, url_prefix='/api/stripe')
    
    from app.routes.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    @app.route('/health', methods=['GET'])
    def health_check():
        status = {"status": "ok", "db": "unknown", "lancedb": "unknown"}
        try:
            # Check Postgres
            import psycopg2
            with psycopg2.connect(**db_service.postgres_config) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            status["db"] = "ok"
        except Exception:
            status["db"] = "error"
            status["status"] = "error"
            
        try:
            # Check LanceDB
            db_service.lance_db.open_table(db_service.TABLE_NAME_LANCE)
            status["lancedb"] = "ok"
        except Exception:
            status["lancedb"] = "error"
            status["status"] = "error"

        return status, 200 if status["status"] == "ok" else 503

    return app


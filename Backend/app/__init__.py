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

# Load environment variables — use explicit path so it works regardless of cwd.
# override=False (the default): real process environment variables set by the
# deployment platform always win over a .env file. If a stray .env (e.g.
# FLASK_ENV=development, DEV_BYPASS_AUTH=1) ever ends up on a production host —
# copied during a build step, leftover from local testing — it must not be able
# to silently overrule the platform's real production configuration.
_here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_here, '.env'))

def create_app():
    app = Flask(__name__)

    # FLASK_ENV != "production" is treated as the production signal whenever it is
    # unset/missing too — defaults must fail toward the safer (production-locked) state,
    # never toward the bypass-permissive one. A deploy that forgets to set FLASK_ENV
    # must not silently re-enable DEV_BYPASS_AUTH.
    is_production = os.getenv("FLASK_ENV", "production") == "production"
    is_dev_bypass = os.getenv("DEV_BYPASS_AUTH") == "1"
    force_https = os.getenv("FORCE_HTTPS", "1" if is_production else "0").lower() in ("1", "true", "yes")

    # Guard: prevent DEV_BYPASS_AUTH in production. This is intentionally redundant
    # with the independent check in app/utils/workspace.py's _is_bypass() — that
    # second check is what actually gates every request, so the bypass stays dead
    # even if some other entrypoint constructs the app without calling create_app(),
    # or if this process's exit code is ignored by a supervisor that just restarts it.
    if is_production and is_dev_bypass:
        print("FATAL: DEV_BYPASS_AUTH=1 is not allowed in production. Aborting.", file=sys.stderr)
        sys.exit(1)

    # Guard: require a strong JWT secret in production
    jwt_secret = os.environ.get("JWT_SECRET_KEY", "")
    if is_production and (not jwt_secret or jwt_secret == "dev-secret-change-in-production"):
        print("FATAL: JWT_SECRET_KEY must be set to a strong random value in production. Aborting.", file=sys.stderr)
        sys.exit(1)

    # Guard: admin dashboard credentials are required in every environment —
    # there is no safe hardcoded fallback for a superadmin login. config.py no
    # longer supplies one, so a missing ADMIN_EMAIL/ADMIN_PASSWORD must stop the
    # app from starting rather than booting with the route silently unusable
    # (or, before this fix, silently usable with credentials checked into git).
    if not Config.ADMIN_EMAIL or not Config.ADMIN_PASSWORD:
        print(
            "FATAL: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required "
            "(no default admin account exists). Aborting.",
            file=sys.stderr,
        )
        sys.exit(1)
    if is_production and len(Config.ADMIN_PASSWORD) < 12:
        print(
            "FATAL: ADMIN_PASSWORD must be at least 12 characters in production. Aborting.",
            file=sys.stderr,
        )
        sys.exit(1)

    # CORS — gated on is_production alone. DEV_BYPASS_AUTH must never widen CORS;
    # if it could, a bypass that somehow survived the abort above would also open
    # the API to any localhost-origin request.
    if not is_production:
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
             force_https=force_https,
             force_https_permanent=False,
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

    # Run idempotent schema migrations on every startup
    try:
        from app.models.create_dbs import create_postgres_db
        create_postgres_db()
    except Exception as _schema_err:
        print(f"WARNING: schema migration failed: {_schema_err}", file=sys.stderr)

    # Ensure LanceDB table exists and has all required columns
    try:
        from app.models.create_dbs import create_LanceDB
        import lancedb as _lancedb
        from app.config import Config as _Cfg
        _db = _lancedb.connect(_Cfg.LANCE_DB_PATH)
        if _Cfg.TABLE_NAME_LANCE not in _db.table_names():
            create_LanceDB()
            print("✅ LanceDB table created with full schema.")
        else:
            _t = _db.open_table(_Cfg.TABLE_NAME_LANCE)
            _cols = _t.schema.names
            _required = {'workspace_id': '', 'user_id': ''}
            _missing = {k: v for k, v in _required.items() if k not in _cols}
            if _missing:
                import pandas as _pd
                _df = _t.to_pandas()
                for col, default in _missing.items():
                    _df[col] = default
                _db.drop_table(_Cfg.TABLE_NAME_LANCE)
                _db.create_table(_Cfg.TABLE_NAME_LANCE, _df)
                print(f"✅ LanceDB migrated: added columns {list(_missing.keys())}")
    except Exception as _lance_err:
        print(f"WARNING: LanceDB migration failed: {_lance_err}")

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
    @app.route('/api/health', methods=['GET'])
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


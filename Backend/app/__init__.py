from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import sys
from datetime import timedelta
from app.models.db_service import DatabaseService, get_db_service
from app.config import Config

# Load environment variables
load_dotenv()

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
                "allow_headers": ["Content-Type", "Authorization"],
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
                "allow_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
            }
        })

    # Security headers for every response
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Configure app
    app.config.from_object(Config)

    # JWT configuration
    app.config["JWT_SECRET_KEY"] = jwt_secret or "dev-secret-change-in-production"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_HTTPONLY"] = True
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
    app.config["JWT_COOKIE_SECURE"] = is_production
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False  # SameSite=Lax + explicit origins mitigates CSRF

    JWTManager(app)

    # Initialize database service
    db_service = get_db_service()
    app.config['DB_SERVICE'] = db_service

    # Register blueprints
    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    from app.routes.stories import stories_bp
    app.register_blueprint(stories_bp, url_prefix='/api/stories')

    return app


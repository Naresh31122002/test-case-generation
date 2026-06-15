from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
from datetime import timedelta
from app.models.db_service import DatabaseService, get_db_service
from app.config import Config

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)

    # Build allowed origins from env so production domains are configurable
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Add production frontend URL if set (e.g. https://testforge.kynetropo.com)
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        allowed_origins.append(frontend_url)
        # Also allow www variant and Vercel preview URLs
        if "kynetropo.com" in frontend_url:
            allowed_origins.append("https://www.kynetropo.com")
    # Allow all Vercel preview deploy URLs for this project
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

    # Configure app — Config is already a singleton instance, not a class
    app.config.from_object(Config)

    # JWT configuration
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)
    app.config["JWT_COOKIE_SECURE"] = os.getenv("FLASK_ENV") == "production"
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False

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


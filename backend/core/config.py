"""App settings loaded from environment variables / .env file."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name: str = "UAE CSP-ERP API"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Use SQLite for easy local dev — switch to PostgreSQL in production
    # Render.com provides DATABASE_URL with postgres:// prefix; SQLAlchemy 2.0+ requires postgresql://
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./csp_erp.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production-min-32-chars!")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24h

    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r2_bucket: str = os.getenv("R2_BUCKET", "")
    r2_endpoint: str = os.getenv("R2_ENDPOINT", "")


settings = Settings()

# Fail fast: warn if using default JWT secret in production
_DEFAULT_JWT = "dev-secret-change-in-production-min-32-chars!"
if not settings.debug and settings.jwt_secret == _DEFAULT_JWT:
    import warnings
    warnings.warn(
        "⚠️  SECURITY: JWT_SECRET is using the default dev value! "
        "Set a unique JWT_SECRET environment variable before deploying to production.",
        stacklevel=1,
    )

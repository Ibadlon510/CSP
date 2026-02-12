"""App settings loaded from environment variables / .env file."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name: str = "UAE CSP-ERP API"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Use SQLite for easy local dev — switch to PostgreSQL in production
    database_url: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./csp_erp.db",
    )

    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production-min-32-chars!")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24h

    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r2_bucket: str = os.getenv("R2_BUCKET", "")
    r2_endpoint: str = os.getenv("R2_ENDPOINT", "")


settings = Settings()

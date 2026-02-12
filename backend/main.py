"""
UAE CSP-ERP API — FastAPI entrypoint.
Run: uvicorn main:app --reload
"""
import logging
import sys
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings as _cfg

# ── Structured logging ──
_log_level = logging.DEBUG if _cfg.debug else logging.INFO
_log_format = (
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    if _cfg.debug
    else '{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'
)
logging.basicConfig(
    level=_log_level,
    format=_log_format,
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger("csp-erp")

from core.database import engine, Base

# Import models so they register with Base.metadata
import models  # noqa: F401

from api.auth import router as auth_router
from api.users import router as users_router
from api.contacts import router as contacts_router
from api.wallets import router as wallets_router
from api.projects import router as projects_router
from api.crm import router as crm_router
from api.quotations import router as quotations_router
from api.orders import router as orders_router
from api.invoices import router as invoices_router
from api.products import router as products_router
from api.settings import router as settings_router
from api.documents import router as documents_router
from api.compliance import router as compliance_router
from api.notifications import router as notifications_router
from api.project_details import router as project_details_router
from api.approvals import router as approvals_router
from api.activities import router as activities_router
from api.commission_attributes import router as commission_attributes_router
from api.saved_searches import router as saved_searches_router
from api.audit_logs import router as audit_logs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev convenience; use Alembic in production)."""
    Base.metadata.create_all(bind=engine)

    # Run idempotent migrations (add missing columns to existing tables)
    try:
        logger.info("Running idempotent migrations...")
        import importlib, pathlib
        _mig_dir = pathlib.Path(__file__).parent / "migrations"
        for mig_file in sorted(_mig_dir.glob("*.py")):
            if mig_file.name.startswith("_"):
                continue
            mod = importlib.import_module(f"migrations.{mig_file.stem}")
            if hasattr(mod, "run"):
                mod.run()
        logger.info("Migrations completed.")
    except Exception as e:
        import traceback
        logger.error("Migrations FAILED: %s\n%s", e, traceback.format_exc())

    # Auto-seed demo data only in debug/dev mode (idempotent — safe to re-run)
    from core.config import settings
    if settings.debug:
        try:
            logger.info("DEBUG=true — running consolidated seed (idempotent)...")
            from scripts.seed_all import run as seed_all
            seed_all()
            logger.info("Demo seed completed successfully.")
        except Exception as e:
            import traceback
            logger.error("Demo seed FAILED: %s\n%s", e, traceback.format_exc())

    # Start background scheduler (expiry alerts, retention checks)
    from tasks.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="UAE CSP-ERP API",
    description="Multi-tenant SaaS for Corporate Service Providers",
    version="0.1.0",
    docs_url="/docs",
    lifespan=lifespan,
)

_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(contacts_router, tags=["Contacts"])
app.include_router(wallets_router, tags=["Wallets"])
app.include_router(projects_router, tags=["Projects"])
app.include_router(crm_router)
app.include_router(quotations_router)
app.include_router(orders_router)
app.include_router(invoices_router)
app.include_router(products_router)
app.include_router(settings_router)
app.include_router(documents_router)
app.include_router(compliance_router)
app.include_router(notifications_router)
app.include_router(project_details_router)
app.include_router(approvals_router)
app.include_router(activities_router)
app.include_router(commission_attributes_router)
app.include_router(saved_searches_router)
app.include_router(audit_logs_router)


@app.get("/health")
def health():
    """Simple liveness check."""
    return {"status": "ok", "service": "csp-erp-api", "version": "0.1.0"}


@app.get("/health/detailed")
def health_detailed():
    """Detailed health: API, database, and optional services."""
    from core.database import SessionLocal
    from sqlalchemy import text

    result = {"status": "ok", "service": "csp-erp-api", "version": "0.1.0", "checks": {}}

    # Database check
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        result["checks"]["database"] = "ok"
    except Exception as e:
        result["checks"]["database"] = f"fail: {str(e)}"
        result["status"] = "degraded"

    return result

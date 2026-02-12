"""
Background task scheduler using APScheduler.
Runs periodic jobs for expiry alerts, document retention checks, etc.
Falls back gracefully if APScheduler is not installed.
"""
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

_scheduler = None


def _get_db_session():
    """Get a fresh database session for background tasks."""
    from core.database import SessionLocal
    return SessionLocal()


@contextmanager
def _session_scope():
    """Provide a transactional scope around a series of operations."""
    session = _get_db_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _run_expiry_alerts():
    """Scheduled job: check for expiring documents/licenses."""
    logger.info("Running scheduled expiry alerts check...")
    try:
        with _session_scope() as db:
            from tasks.expiry_alerts import run_expiry_check
            count = run_expiry_check(db)
            logger.info(f"Expiry alerts: {count} notifications created")
    except Exception as e:
        logger.error(f"Expiry alerts job failed: {e}")


def _run_retention_check():
    """Scheduled job: check for documents past retention date."""
    logger.info("Running scheduled retention check...")
    try:
        with _session_scope() as db:
            from tasks.retention_check import run_retention_check
            count = run_retention_check(db)
            logger.info(f"Retention check: {count} notifications created")
    except Exception as e:
        logger.error(f"Retention check job failed: {e}")


def start_scheduler():
    """Start the background scheduler. Requires apscheduler package."""
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning(
            "APScheduler not installed. Background tasks disabled. "
            "Install with: pip install apscheduler"
        )
        return

    _scheduler = BackgroundScheduler()

    # Expiry alerts: daily at 08:00 UAE time (UTC+4 = 04:00 UTC)
    _scheduler.add_job(
        _run_expiry_alerts,
        CronTrigger(hour=4, minute=0),  # 08:00 UAE
        id="expiry_alerts",
        name="Daily expiry alerts check",
        replace_existing=True,
    )

    # Document retention check: daily at 09:00 UAE time (05:00 UTC)
    _scheduler.add_job(
        _run_retention_check,
        CronTrigger(hour=5, minute=0),  # 09:00 UAE
        id="retention_check",
        name="Daily document retention check",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Background scheduler started with %d jobs", len(_scheduler.get_jobs()))


def stop_scheduler():
    """Stop the background scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")
        _scheduler = None

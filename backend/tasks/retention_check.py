"""
Document retention check job: flags documents past retention_until date
and creates notifications for admin review.
"""
import logging
from datetime import date

from sqlalchemy.orm import Session

from models.document import Document, DocumentStatus
from models.notification import Notification
from models.organization import Organization

logger = logging.getLogger(__name__)


def run_retention_check(db: Session) -> int:
    """
    Check all orgs for documents past their retention_until date.
    Creates notifications for admin review.
    Returns total notifications created.
    """
    today = date.today()
    created_count = 0

    orgs = db.query(Organization).all()
    for org in orgs:
        expired_docs = (
            db.query(Document)
            .filter(
                Document.org_id == org.id,
                Document.status == DocumentStatus.ACTIVE,
                Document.retention_until.isnot(None),
                Document.retention_until <= today,
            )
            .all()
        )

        for doc in expired_docs:
            title = f"Document retention expired: {doc.file_name}"
            existing = db.query(Notification).filter(
                Notification.org_id == org.id,
                Notification.title == title,
                Notification.is_read == False,
            ).first()
            if existing:
                continue

            n = Notification(
                org_id=org.id,
                user_id=None,
                title=title,
                message=f"Document '{doc.file_name}' (category: {doc.category}) has passed its retention date ({doc.retention_until}). Review and archive or delete.",
                category="retention",
                resource_type="document",
                resource_id=doc.id,
            )
            db.add(n)
            created_count += 1

    db.commit()
    logger.info(f"Retention check completed: {created_count} notifications created")
    return created_count

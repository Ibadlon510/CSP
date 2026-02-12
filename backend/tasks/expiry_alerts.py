"""
Expiry alert job: checks contacts for license/visa/passport/emirates_id expiring
within T-90, T-60, T-30, T-7 days and creates in-app notifications.
"""
import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.contact import Contact
from models.notification import Notification
from models.organization import Organization

logger = logging.getLogger(__name__)

ALERT_THRESHOLDS = [90, 60, 30, 7]

EXPIRY_FIELDS = [
    ("license_expiry_date", "Trade License"),
    ("visa_expiry_date", "Visa"),
    ("passport_expiry", "Passport"),
    ("emirates_id_expiry", "Emirates ID"),
    ("establishment_card_expiry", "Establishment Card"),
]


def run_expiry_check(db: Session) -> int:
    """
    Check all orgs for contacts with upcoming expiry dates.
    Creates one notification per org per expiring field within the nearest threshold.
    Returns total notifications created.
    """
    today = date.today()
    created_count = 0

    orgs = db.query(Organization).all()
    for org in orgs:
        contacts = db.query(Contact).filter(Contact.org_id == org.id).all()
        for contact in contacts:
            for field_name, label in EXPIRY_FIELDS:
                expiry = getattr(contact, field_name, None)
                if not expiry:
                    continue
                days_until = (expiry - today).days
                if days_until < 0:
                    # Already expired
                    _create_notification_if_new(
                        db, org.id, contact,
                        f"{label} EXPIRED for {contact.name}",
                        f"{label} expired on {expiry}. Immediate renewal required.",
                        "expiry",
                    )
                    created_count += 1
                else:
                    for threshold in ALERT_THRESHOLDS:
                        if days_until <= threshold:
                            _create_notification_if_new(
                                db, org.id, contact,
                                f"{label} expiring in {days_until} days for {contact.name}",
                                f"{label} expires on {expiry} ({days_until} days remaining).",
                                "expiry",
                            )
                            created_count += 1
                            break  # Only one notification per field per run

    db.commit()
    logger.info(f"Expiry check completed: {created_count} notifications created")
    return created_count


def _create_notification_if_new(
    db: Session, org_id: str, contact: Contact,
    title: str, message: str, category: str,
) -> None:
    """Create a notification only if one with the same title doesn't already exist (unread)."""
    existing = db.query(Notification).filter(
        Notification.org_id == org_id,
        Notification.title == title,
        Notification.is_read == False,
    ).first()
    if existing:
        return
    n = Notification(
        org_id=org_id,
        user_id=None,  # Org-wide notification
        title=title,
        message=message,
        category=category,
        resource_type="contact",
        resource_id=contact.id,
    )
    db.add(n)

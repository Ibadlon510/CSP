"""
KYC status derivation: checks required documents per contact type and expiry dates.
Individual: passport (or emirates_id doc)
Company: trade_license
Returns: complete | incomplete | expiry_warning
"""
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models.contact import Contact, ContactType
from models.document import Document


KYC_STATUS_COMPLETE = "complete"
KYC_STATUS_INCOMPLETE = "incomplete"
KYC_STATUS_EXPIRY_WARNING = "expiry_warning"

EXPIRY_WARNING_DAYS = 30

# Required document categories per contact type
INDIVIDUAL_REQUIRED_CATEGORIES = {"passport", "emirates_id"}
COMPANY_REQUIRED_CATEGORIES = {"trade_license"}


def _has_document_category(db: Session, contact_id: str, category: str) -> bool:
    """Check if a contact has at least one active document with the given category."""
    return (
        db.query(Document.id)
        .filter(
            Document.contact_id == contact_id,
            Document.category == category,
            Document.status == "active",
        )
        .first()
        is not None
    )


def _check_field_expiry(expiry_date: Optional[date]) -> Optional[str]:
    """Return 'expired' or 'warning' if expiry_date is past or within warning window, else None."""
    if not expiry_date:
        return None
    today = date.today()
    if expiry_date < today:
        return "expired"
    if expiry_date <= today + timedelta(days=EXPIRY_WARNING_DAYS):
        return "warning"
    return None


def get_kyc_status(db: Session, org_id: str, contact_id: str) -> dict:
    """
    Derive KYC status for a contact. Returns:
    - status: complete | incomplete | expiry_warning
    - missing_documents: list of missing required category names
    - expiry_warnings: list of { field, date, state } for fields expiring soon or expired
    """
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == org_id,
    ).first()
    if not contact:
        return {
            "status": KYC_STATUS_INCOMPLETE,
            "missing_documents": [],
            "expiry_warnings": [],
        }

    missing = []
    expiry_warnings = []

    if contact.contact_type == ContactType.INDIVIDUAL:
        # Check passport doc or passport_no field
        has_passport = bool(contact.passport_no) or _has_document_category(db, contact_id, "passport")
        if not has_passport:
            missing.append("passport")

        # Check emirates_id doc or emirates_id field
        has_eid = bool(contact.emirates_id) or _has_document_category(db, contact_id, "emirates_id")
        if not has_eid:
            missing.append("emirates_id")

        # Check expiry dates on contact fields
        for field, expiry in [
            ("passport_expiry", contact.passport_expiry),
            ("emirates_id_expiry", contact.emirates_id_expiry),
            ("visa_expiry_date", contact.visa_expiry_date),
        ]:
            state = _check_field_expiry(expiry)
            if state:
                expiry_warnings.append({"field": field, "date": str(expiry), "state": state})

    elif contact.contact_type == ContactType.COMPANY:
        # Check trade license doc or trade_license_no field
        has_tl = bool(contact.trade_license_no) or _has_document_category(db, contact_id, "trade_license")
        if not has_tl:
            missing.append("trade_license")

        # Check expiry dates
        for field, expiry in [
            ("license_expiry_date", contact.license_expiry_date),
            ("establishment_card_expiry", contact.establishment_card_expiry),
            ("visa_expiry_date", contact.visa_expiry_date),
        ]:
            state = _check_field_expiry(expiry)
            if state:
                expiry_warnings.append({"field": field, "date": str(expiry), "state": state})

    # Derive overall status
    has_expired = any(w["state"] == "expired" for w in expiry_warnings)
    if missing or has_expired:
        status = KYC_STATUS_INCOMPLETE
    elif expiry_warnings:
        status = KYC_STATUS_EXPIRY_WARNING
    else:
        status = KYC_STATUS_COMPLETE

    return {
        "status": status,
        "missing_documents": missing,
        "expiry_warnings": expiry_warnings,
    }

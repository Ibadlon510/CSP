"""Number sequence helpers for QUO, ORD, INV. Uses org settings when available."""
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.org_settings import OrganizationSettings


def _get_prefix_and_padding(db: Session, org_id: str, default_prefix: str, default_padding: int = 3) -> tuple[str, int]:
    """Get prefix and padding from org settings, or use defaults."""
    s = db.query(OrganizationSettings).filter(OrganizationSettings.org_id == org_id).first()
    if s is None:
        return default_prefix, default_padding
    prefix_map = {"QUO": s.quotation_prefix, "ORD": s.order_prefix, "INV": s.invoice_prefix}
    prefix = (prefix_map.get(default_prefix) or default_prefix) or default_prefix
    try:
        pad = int(s.number_padding) if s.number_padding else default_padding
    except (ValueError, TypeError):
        pad = default_padding
    return str(prefix), max(1, min(pad, 6))


def next_quotation_number(db: Session, org_id: str, table_class) -> str:
    year = date.today().year
    prefix, padding = _get_prefix_and_padding(db, org_id, "QUO")
    pattern = f"{prefix}-{year}-%"
    count = db.query(func.count(table_class.id)).filter(
        table_class.org_id == org_id,
        table_class.number.like(pattern),
    ).scalar() or 0
    return f"{prefix}-{year}-{count + 1:0{padding}d}"


def next_order_number(db: Session, org_id: str, table_class) -> str:
    year = date.today().year
    prefix, padding = _get_prefix_and_padding(db, org_id, "ORD")
    pattern = f"{prefix}-{year}-%"
    count = db.query(func.count(table_class.id)).filter(
        table_class.org_id == org_id,
        table_class.number.like(pattern),
    ).scalar() or 0
    return f"{prefix}-{year}-{count + 1:0{padding}d}"


def next_invoice_number(db: Session, org_id: str, table_class) -> str:
    year = date.today().year
    prefix, padding = _get_prefix_and_padding(db, org_id, "INV")
    pattern = f"{prefix}-{year}-%"
    count = db.query(func.count(table_class.id)).filter(
        table_class.org_id == org_id,
        table_class.number.like(pattern),
    ).scalar() or 0
    return f"{prefix}-{year}-{count + 1:0{padding}d}"

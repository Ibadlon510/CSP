"""Audit logging service — records all important actions."""
import json
from sqlalchemy.orm import Session
from models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id: str | None = None,
    user_email: str | None = None,
    org_id: str | None = None,
    resource: str | None = None,
    resource_id: str | None = None,
    detail: dict | str | None = None,
    ip_address: str | None = None,
):
    """Write an immutable audit log entry."""
    entry = AuditLog(
        action=action,
        user_id=user_id,
        user_email=user_email,
        org_id=org_id,
        resource=resource,
        resource_id=resource_id,
        detail=json.dumps(detail) if isinstance(detail, dict) else detail,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    return entry

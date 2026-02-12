"""Audit log viewer API — admin-only access to the immutable audit trail."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user, require_admin
from models.audit_log import AuditLog
from models.user import User

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@router.get("/")
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = None,
    resource: str | None = None,
    user_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List audit log entries for the current organization. Admin only."""
    q = db.query(AuditLog).filter(AuditLog.org_id == current_user.org_id)

    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if resource:
        q = q.filter(AuditLog.resource == resource)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)

    total = q.count()
    entries = (
        q.order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Resolve user names in bulk
    user_ids = list({e.user_id for e in entries if e.user_id})
    user_map: dict[str, str] = {}
    if user_ids:
        users = db.query(User.id, User.full_name).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u.full_name for u in users}

    items = []
    for e in entries:
        items.append({
            "id": e.id,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "user_id": e.user_id,
            "user_name": user_map.get(e.user_id, e.user_email) if e.user_id else e.user_email,
            "action": e.action,
            "resource": e.resource,
            "resource_id": e.resource_id,
            "detail": e.detail,
            "ip_address": e.ip_address,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}

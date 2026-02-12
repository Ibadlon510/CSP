"""Notifications API — in-app notifications for alerts, expiry warnings, etc."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.notification import Notification

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: str
    org_id: str
    user_id: Optional[str]
    title: str
    message: str
    category: str
    is_read: bool
    resource_type: Optional[str]
    resource_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List notifications for the current user (or org-wide)."""
    q = db.query(Notification).filter(
        Notification.org_id == current_user.org_id,
    ).filter(
        (Notification.user_id == current_user.id) | (Notification.user_id.is_(None))
    )
    if unread_only:
        q = q.filter(Notification.is_read == False)
    notifications = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get count of unread notifications."""
    count = db.query(Notification).filter(
        Notification.org_id == current_user.org_id,
        (Notification.user_id == current_user.id) | (Notification.user_id.is_(None)),
        Notification.is_read == False,
    ).count()
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.org_id == current_user.org_id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.post("/mark-all-read")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    count = db.query(Notification).filter(
        Notification.org_id == current_user.org_id,
        (Notification.user_id == current_user.id) | (Notification.user_id.is_(None)),
        Notification.is_read == False,
    ).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"marked_count": count}

"""Audit log — immutable record of who did what."""
from sqlalchemy import Column, String, Text, DateTime

from core.database import Base
from models.base import generate_uuid, utcnow


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=utcnow, nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    org_id = Column(String, nullable=True, index=True)
    action = Column(String(100), nullable=False)       # e.g. "user.login", "wallet.credit"
    resource = Column(String(100), nullable=True)       # e.g. "entity", "wallet"
    resource_id = Column(String, nullable=True)
    detail = Column(Text, nullable=True)                # JSON or free text
    ip_address = Column(String(50), nullable=True)

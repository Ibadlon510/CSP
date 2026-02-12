"""Approval process models — reusable engine for approval workflows."""
from sqlalchemy import Column, String, ForeignKey, Text, Boolean, DateTime
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin, utcnow


class ApprovalRequest(TimestampMixin, Base):
    """Generic approval request. First use case: non-billable product approval."""
    __tablename__ = "approval_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    request_type = Column(String(50), nullable=False)  # non_billable_product, etc.
    resource_type = Column(String(50), nullable=False)  # project_product, etc.
    resource_id = Column(String, nullable=False, index=True)

    requested_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    approver_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    requested_at = Column(DateTime, default=utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    comment = Column(Text, nullable=True)  # approver's reason

    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approver_id])

    def __repr__(self):
        return f"<ApprovalRequest {self.request_type} {self.resource_type}:{self.resource_id} status={self.status}>"


class ApprovalProcessSetting(TimestampMixin, Base):
    """Per-org approval process configuration."""
    __tablename__ = "approval_process_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    approval_type = Column(String(50), nullable=False)  # non_billable_product, etc.
    is_enabled = Column(Boolean, nullable=False, default=True)
    fallback_approver_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    fallback_approver = relationship("User", foreign_keys=[fallback_approver_id])

    def __repr__(self):
        return f"<ApprovalProcessSetting {self.approval_type} enabled={self.is_enabled}>"

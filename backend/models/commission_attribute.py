"""Commission Attribute model — org-level configurable dropdown options."""
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class CommissionAttribute(TimestampMixin, Base):
    """Per-org commission attribute options for SOV Breakdown."""
    __tablename__ = "commission_attributes"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(100), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<CommissionAttribute {self.label}>"

"""CRM Lead model - prospects before conversion to contact."""
from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class LeadStatus:
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    LOST = "lost"
    ALL = [NEW, CONTACTED, QUALIFIED, LOST]


class Lead(TimestampMixin, Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    source = Column(String(100), nullable=True)  # Referral, Website, Walk-in, etc.
    status = Column(String(50), default=LeadStatus.NEW, nullable=False)
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    opportunities = relationship("Opportunity", back_populates="lead", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Lead {self.name}>"

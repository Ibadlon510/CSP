"""CRM Opportunity model - deals in the pipeline."""
from sqlalchemy import Column, String, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class OpportunityStage:
    LEAD = "lead"
    QUOTE_SENT = "quote_sent"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"
    ALL = [LEAD, QUOTE_SENT, NEGOTIATION, WON, LOST]


class Opportunity(TimestampMixin, Base):
    __tablename__ = "opportunities"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True, index=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 2), nullable=True)
    stage = Column(String(50), default=OpportunityStage.LEAD, nullable=False)
    probability = Column(Numeric(5, 2), nullable=True)  # 0-100
    expected_close_date = Column(Date, nullable=True)
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True, index=True)

    lead = relationship("Lead", back_populates="opportunities")

    def __repr__(self):
        return f"<Opportunity {self.name}>"

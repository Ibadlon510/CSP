"""Sales Quotation and QuotationLine models."""
from sqlalchemy import Column, String, ForeignKey, Numeric, Date, UniqueConstraint
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class QuotationStatus:
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    ALL = [DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED]


class Quotation(TimestampMixin, Base):
    __tablename__ = "quotations"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    number = Column(String(50), nullable=False, index=True)  # QUO-2026-001

    __table_args__ = (UniqueConstraint('org_id', 'number', name='uq_quotations_org_number'),)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True, index=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)

    status = Column(String(50), default=QuotationStatus.DRAFT, nullable=False)
    valid_until = Column(Date, nullable=True)
    total = Column(Numeric(15, 2), nullable=False, default=0)
    vat_amount = Column(Numeric(15, 2), nullable=False, default=0)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

    lines = relationship("QuotationLine", back_populates="quotation", cascade="all, delete-orphan")
    contact = relationship("Contact", foreign_keys=[contact_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Quotation {self.number}>"


class QuotationLine(TimestampMixin, Base):
    __tablename__ = "quotation_lines"

    id = Column(String, primary_key=True, default=generate_uuid)
    quotation_id = Column(String, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price = Column(Numeric(15, 2), nullable=False)
    vat_rate = Column(Numeric(5, 2), nullable=False, default=0)  # 0 or 5
    amount = Column(Numeric(15, 2), nullable=False)

    quotation = relationship("Quotation", back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")

    def __repr__(self):
        return f"<QuotationLine {self.description}>"

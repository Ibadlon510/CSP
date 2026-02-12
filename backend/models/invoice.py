"""Sales Invoice and InvoiceLine models."""
from sqlalchemy import Column, String, ForeignKey, Numeric, Date, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class InvoiceStatus:
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    ALL = [DRAFT, SENT, PAID, OVERDUE, CANCELLED]


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    number = Column(String(50), nullable=False, index=True)  # INV-2026-001

    __table_args__ = (UniqueConstraint('org_id', 'number', name='uq_invoices_org_number'),)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True, index=True)
    sales_order_id = Column(String, ForeignKey("sales_orders.id"), nullable=True, index=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

    status = Column(String(50), default=InvoiceStatus.DRAFT, nullable=False)
    due_date = Column(Date, nullable=True)
    total = Column(Numeric(15, 2), nullable=False, default=0)
    vat_amount = Column(Numeric(15, 2), nullable=False, default=0)
    paid_at = Column(DateTime, nullable=True)

    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    contact = relationship("Contact", foreign_keys=[contact_id])
    sales_order = relationship("SalesOrder", foreign_keys=[sales_order_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Invoice {self.number}>"


class InvoiceLine(TimestampMixin, Base):
    __tablename__ = "invoice_lines"

    id = Column(String, primary_key=True, default=generate_uuid)
    invoice_id = Column(String, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price = Column(Numeric(15, 2), nullable=False)
    vat_rate = Column(Numeric(5, 2), nullable=False, default=0)  # 0 or 5
    amount = Column(Numeric(15, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")

    def __repr__(self):
        return f"<InvoiceLine {self.description}>"

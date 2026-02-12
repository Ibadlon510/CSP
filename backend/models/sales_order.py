"""Sales Order and SalesOrderLine models."""
from sqlalchemy import Column, String, ForeignKey, Numeric, DateTime, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class SalesOrderStatus:
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    ALL = [PENDING, CONFIRMED, IN_PROGRESS, DELIVERED, CANCELLED]


class SalesOrder(TimestampMixin, Base):
    __tablename__ = "sales_orders"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    number = Column(String(50), nullable=False, index=True)  # ORD-2026-001

    __table_args__ = (UniqueConstraint('org_id', 'number', name='uq_sales_orders_org_number'),)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True, index=True)
    quotation_id = Column(String, ForeignKey("quotations.id"), nullable=True, index=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

    status = Column(String(50), default=SalesOrderStatus.PENDING, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)

    # Order-level discount (toggle: 'amount' or 'percent' mode)
    discount_mode = Column(String(10), default="amount", nullable=False)  # 'amount' or 'percent'
    order_discount_amount = Column(Numeric(15, 2), default=0, nullable=False)
    order_discount_percent = Column(Numeric(5, 2), default=0, nullable=False)

    lines = relationship("SalesOrderLine", back_populates="sales_order", cascade="all, delete-orphan")
    contact = relationship("Contact", foreign_keys=[contact_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    quotation = relationship("Quotation", foreign_keys=[quotation_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<SalesOrder {self.number}>"


class SalesOrderLine(TimestampMixin, Base):
    __tablename__ = "sales_order_lines"

    id = Column(String, primary_key=True, default=generate_uuid)
    sales_order_id = Column(String, ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price = Column(Numeric(15, 2), nullable=False)
    vat_rate = Column(Numeric(5, 2), nullable=False, default=0)  # 0 or 5
    amount = Column(Numeric(15, 2), nullable=False)

    # SOV Breakdown fields
    unit_cost = Column(Numeric(15, 2), default=0, nullable=False)
    commission_attrib = Column(String(100), nullable=True)

    sales_order = relationship("SalesOrder", back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")

    def __repr__(self):
        return f"<SalesOrderLine {self.description}>"

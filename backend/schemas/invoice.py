"""Pydantic schemas for Invoices."""
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional, List


class InvoiceLineCreate(BaseModel):
    description: str
    quantity: Decimal = 1
    unit_price: Decimal
    vat_rate: Decimal = Decimal("0")
    product_id: Optional[str] = None


class InvoiceLineResponse(BaseModel):
    id: str
    invoice_id: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Decimal = Decimal("0")
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    contact_id: str
    sales_order_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    due_date: Optional[date] = None
    lines: List[InvoiceLineCreate] = []


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    due_date: Optional[date] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None


class InvoicePaymentRequest(BaseModel):
    """Record invoice payment and credit wallet."""
    amount: Decimal


class InvoiceResponse(BaseModel):
    id: str
    org_id: str
    number: str
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    sales_order_id: Optional[str] = None
    sales_order_number: Optional[str] = None
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    opportunity_id: Optional[str] = None
    opportunity_name: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    status: str
    due_date: Optional[date]
    total: Decimal
    vat_amount: Decimal
    paid_at: Optional[datetime]
    created_at: datetime
    lines: List[InvoiceLineResponse] = []

    class Config:
        from_attributes = True

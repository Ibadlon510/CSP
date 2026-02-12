"""Pydantic schemas for Quotations."""
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional, List


class QuotationLineCreate(BaseModel):
    description: str
    quantity: Decimal = 1
    unit_price: Decimal
    vat_rate: Decimal = 0
    product_id: Optional[str] = None


class QuotationLineResponse(BaseModel):
    id: str
    quotation_id: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Decimal
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class QuotationCreate(BaseModel):
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    valid_until: Optional[date] = None
    lines: List[QuotationLineCreate]


class QuotationUpdate(BaseModel):
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    status: Optional[str] = None
    valid_until: Optional[date] = None
    lines: Optional[List[QuotationLineCreate]] = None


class QuotationResponse(BaseModel):
    id: str
    org_id: str
    number: str
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    opportunity_id: Optional[str] = None
    opportunity_name: Optional[str] = None
    status: str
    valid_until: Optional[date]
    total: Decimal
    vat_amount: Decimal
    created_by: Optional[str]
    created_by_name: Optional[str] = None
    created_at: datetime
    lines: List[QuotationLineResponse] = []

    class Config:
        from_attributes = True

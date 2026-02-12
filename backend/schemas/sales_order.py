"""Pydantic schemas for Sales Orders."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional, List


class SalesOrderLineCreate(BaseModel):
    description: str
    quantity: Decimal = 1
    unit_price: Decimal
    vat_rate: Decimal = Decimal("0")
    product_id: Optional[str] = None


class SalesOrderLineResponse(BaseModel):
    id: str
    sales_order_id: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Decimal = Decimal("0")
    amount: Decimal
    unit_cost: Decimal = Decimal("0")
    commission_attrib: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    contact_id: str
    quotation_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    lines: List[SalesOrderLineCreate] = []


class SalesOrderLineAchievementUpdate(BaseModel):
    line_id: str
    unit_cost: Optional[Decimal] = None
    commission_attrib: Optional[str] = None


class SalesOrderUpdate(BaseModel):
    status: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    discount_mode: Optional[str] = None
    order_discount_amount: Optional[Decimal] = None
    order_discount_percent: Optional[Decimal] = None
    line_updates: Optional[List[SalesOrderLineAchievementUpdate]] = None


class SalesOrderResponse(BaseModel):
    id: str
    org_id: str
    number: str
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    quotation_id: Optional[str] = None
    quotation_number: Optional[str] = None
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    opportunity_id: Optional[str] = None
    opportunity_name: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    status: str
    confirmed_at: Optional[datetime] = None
    discount_mode: str = "amount"
    order_discount_amount: Decimal = Decimal("0")
    order_discount_percent: Decimal = Decimal("0")
    created_at: datetime
    lines: List[SalesOrderLineResponse] = []
    project_id: Optional[str] = None
    invoice_id: Optional[str] = None

    class Config:
        from_attributes = True


# Commission attribute schemas
class CommissionAttributeCreate(BaseModel):
    label: str
    sort_order: int = 0
    is_active: bool = True


class CommissionAttributeUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CommissionAttributeResponse(BaseModel):
    id: str
    org_id: str
    label: str
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True

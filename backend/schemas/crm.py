"""Pydantic schemas for CRM (leads, opportunities, crm_contacts)."""
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = "new"
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    org_id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    source: Optional[str]
    status: str
    assigned_to: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CrmContactCreate(BaseModel):
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class CrmContactUpdate(BaseModel):
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class CrmContactResponse(BaseModel):
    id: str
    org_id: str
    contact_id: Optional[str]
    lead_id: Optional[str]
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OpportunityCreate(BaseModel):
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    name: str
    amount: Optional[Decimal] = None
    stage: Optional[str] = "lead"
    probability: Optional[Decimal] = None
    expected_close_date: Optional[date] = None
    assigned_to: Optional[str] = None


class OpportunityUpdate(BaseModel):
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    stage: Optional[str] = None
    probability: Optional[Decimal] = None
    expected_close_date: Optional[date] = None
    assigned_to: Optional[str] = None


class OpportunityResponse(BaseModel):
    id: str
    org_id: str
    contact_id: Optional[str]
    lead_id: Optional[str]
    name: str
    amount: Optional[Decimal]
    stage: str
    probability: Optional[Decimal]
    expected_close_date: Optional[date]
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

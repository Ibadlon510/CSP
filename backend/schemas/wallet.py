"""Pydantic schemas for wallet operations"""
from pydantic import BaseModel, Field, condecimal
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ============= ClientWallet Schemas =============

class ClientWalletCreate(BaseModel):
    """Schema for creating a wallet (contact required)"""
    contact_id: str
    currency: Optional[str] = None  # Default from org settings
    minimum_balance: Optional[condecimal(max_digits=15, decimal_places=2)] = None  # Default from org settings  # type: ignore
    notes: Optional[str] = None


class ClientWalletUpdate(BaseModel):
    """Schema for updating a wallet"""
    minimum_balance: Optional[condecimal(max_digits=15, decimal_places=2)] = None  # type: ignore
    status: Optional[str] = None
    is_locked: Optional[bool] = None
    notes: Optional[str] = None


class ClientWalletResponse(BaseModel):
    """Schema for wallet response"""
    id: str
    contact_id: Optional[str] = None
    org_id: str
    balance: Decimal
    currency: str
    minimum_balance: Decimal
    status: str
    is_locked: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    # Optional nested contact info
    contact_name: Optional[str] = None
    
    # Alert status
    has_active_alerts: Optional[bool] = False
    is_below_threshold: Optional[bool] = False

    class Config:
        from_attributes = True


# ============= Transaction Schemas =============

class TransactionCreate(BaseModel):
    """Schema for creating a transaction"""
    wallet_id: str
    type: str  # top_up, fee_charge, refund, adjustment
    amount: condecimal(max_digits=15, decimal_places=2)  # type: ignore
    description: str = Field(..., max_length=500)
    reference_id: Optional[str] = Field(None, max_length=100)


class TransactionResponse(BaseModel):
    """Schema for transaction response"""
    id: str
    wallet_id: str
    org_id: str
    type: str
    amount: Decimal
    currency: str
    balance_before: Decimal
    balance_after: Decimal
    status: str
    description: str
    reference_id: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    # VAT (Sprint 5)
    amount_exclusive: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    amount_total: Optional[Decimal] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None

    class Config:
        from_attributes = True


class FeeChargeRequest(BaseModel):
    """Schema for recording a fee charge (debit) with optional VAT and project link"""
    amount: condecimal(max_digits=15, decimal_places=2, gt=0)  # type: ignore  # Amount (exclusive if apply_vat)
    description: str = Field(..., max_length=500)
    reference_id: Optional[str] = Field(None, max_length=100)
    apply_vat: bool = False  # True = 5% VAT (service fee); False = 0% (government fee)
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    red_alert_override: bool = False  # Manager override when balance < amount


# ============= WalletAlert Schemas =============

class WalletAlertResponse(BaseModel):
    """Schema for wallet alert response"""
    id: str
    wallet_id: str
    org_id: str
    level: str
    title: str
    message: str
    is_resolved: bool
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    balance_at_alert: Optional[Decimal]
    threshold_at_alert: Optional[Decimal]
    created_at: datetime

    class Config:
        from_attributes = True


class WalletAlertResolve(BaseModel):
    """Schema for resolving an alert"""
    notes: Optional[str] = None


# ============= Top-up Request Schema =============

class TopUpRequest(BaseModel):
    """Schema for wallet top-up request"""
    amount: condecimal(max_digits=15, decimal_places=2, gt=0)  # type: ignore
    description: str = Field(default="Wallet top-up", max_length=500)
    reference_id: Optional[str] = Field(None, max_length=100)


# ============= Summary Schema =============

class WalletSummary(BaseModel):
    """Summary of wallet status for dashboard"""
    total_wallets: int
    active_wallets: int
    total_balance: Decimal
    wallets_below_threshold: int
    critical_alerts: int

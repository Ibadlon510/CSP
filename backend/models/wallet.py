"""
Wallet models for trust-based financial management
"""
from sqlalchemy import Column, String, Numeric, ForeignKey, Enum as SQLEnum, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import TimestampMixin, generate_uuid, utcnow
import enum


class WalletStatus(str, enum.Enum):
    """Wallet status enum"""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"


class TransactionType(str, enum.Enum):
    """Transaction type enum"""
    TOP_UP = "top_up"           # Client adds funds
    FEE_CHARGE = "fee_charge"   # CSP charges a service fee
    REFUND = "refund"           # Return funds to client
    ADJUSTMENT = "adjustment"   # Manual adjustment by admin


class TransactionStatus(str, enum.Enum):
    """Transaction status enum"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AlertLevel(str, enum.Enum):
    """Alert level for wallet warnings"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"  # Red Alert


class ClientWallet(Base, TimestampMixin):
    """
    Client wallet for holding trust funds
    Each contact gets one wallet
    """
    __tablename__ = "client_wallets"

    id = Column(String, primary_key=True, default=generate_uuid)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, unique=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Financial fields
    balance = Column(Numeric(15, 2), nullable=False, default=0.00)  # Current balance
    currency = Column(String(3), nullable=False, default="AED")
    
    # Thresholds for Red Alert
    minimum_balance = Column(Numeric(15, 2), nullable=False, default=1000.00)  # Red alert threshold
    
    # Status
    status = Column(SQLEnum(WalletStatus), nullable=False, default=WalletStatus.ACTIVE)
    is_locked = Column(Boolean, nullable=False, default=False)  # Lock wallet from transactions
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    contact = relationship("Contact", back_populates="wallet")
    transactions = relationship("Transaction", back_populates="wallet", cascade="all, delete-orphan")
    alerts = relationship("WalletAlert", back_populates="wallet", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ClientWallet(id={self.id}, contact_id={self.contact_id}, balance={self.balance})>"


class Transaction(Base, TimestampMixin):
    """
    Transaction record for wallet activity
    """
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    wallet_id = Column(String, ForeignKey("client_wallets.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Transaction details
    type = Column(SQLEnum(TransactionType), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)  # Positive for credits, negative for debits (total)
    currency = Column(String(3), nullable=False, default="AED")
    
    # VAT (Sprint 5): for service fees only
    amount_exclusive = Column(Numeric(15, 2), nullable=True)  # Amount before VAT
    vat_amount = Column(Numeric(15, 2), nullable=True)       # 5% VAT
    amount_total = Column(Numeric(15, 2), nullable=True)     # amount_exclusive + vat_amount (same as amount for debits)
    
    # Link to project/task (for fee_charge)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    
    # Balance tracking
    balance_before = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    
    # Status and metadata
    status = Column(SQLEnum(TransactionStatus), nullable=False, default=TransactionStatus.COMPLETED)
    description = Column(String(500), nullable=False)
    reference_id = Column(String(100), nullable=True)  # External reference (invoice, receipt, etc.)
    
    # User who initiated
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Manager override for Red Alert (audit)
    red_alert_override = Column(Boolean, nullable=False, default=False)
    red_alert_override_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    wallet = relationship("ClientWallet", back_populates="transactions")

    def __repr__(self):
        return f"<Transaction(id={self.id}, type={self.type}, amount={self.amount}, status={self.status})>"


class WalletAlert(Base, TimestampMixin):
    """
    Wallet alerts for low balance (Red Alert system)
    """
    __tablename__ = "wallet_alerts"

    id = Column(String, primary_key=True, default=generate_uuid)
    wallet_id = Column(String, ForeignKey("client_wallets.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Alert details
    level = Column(SQLEnum(AlertLevel), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # Alert state
    is_resolved = Column(Boolean, nullable=False, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Metadata
    balance_at_alert = Column(Numeric(15, 2), nullable=True)
    threshold_at_alert = Column(Numeric(15, 2), nullable=True)
    
    # Relationships
    wallet = relationship("ClientWallet", back_populates="alerts")

    def __repr__(self):
        return f"<WalletAlert(id={self.id}, level={self.level}, is_resolved={self.is_resolved})>"

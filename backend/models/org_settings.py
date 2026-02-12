"""Organization-level settings: defaults, module visibility."""
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class OrganizationSettings(TimestampMixin, Base):
    """Org-wide defaults: wallet min, VAT, currency, sequences, expiry alerts."""
    __tablename__ = "organization_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Defaults
    default_wallet_min_balance = Column(Numeric(15, 2), nullable=True, default=1000.00)
    default_vat_rate = Column(Numeric(5, 2), nullable=True, default=5.00)  # 5%
    default_currency = Column(String(3), nullable=True, default="AED")
    quotation_prefix = Column(String(20), nullable=True, default="QUO")
    order_prefix = Column(String(20), nullable=True, default="ORD")
    invoice_prefix = Column(String(20), nullable=True, default="INV")
    number_padding = Column(String(5), nullable=True, default="3")  # e.g. 3 -> 001
    expiry_alert_days = Column(Text, nullable=True)  # JSON array: [90, 60, 30]

    # Relationships
    organization = relationship("Organization", back_populates="settings", uselist=False)


# Module IDs for settings
class ModuleId:
    CONTACTS = "contacts"
    CRM = "crm"
    QUOTATIONS = "quotations"
    ORDERS = "orders"
    INVOICES = "invoices"
    DOCUMENTS = "documents"
    WALLETS = "wallets"
    PROJECTS = "projects"
    USERS = "users"
    COMPLIANCE = "compliance"
    CALENDAR = "calendar"

    ALL = [CONTACTS, CRM, QUOTATIONS, ORDERS, INVOICES, DOCUMENTS, WALLETS, PROJECTS, USERS, COMPLIANCE, CALENDAR]


class OrgModuleSetting(TimestampMixin, Base):
    """Per-org module visibility (enabled/disabled)."""
    __tablename__ = "org_module_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(String(50), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<OrgModuleSetting org={self.org_id} module={self.module_id} enabled={self.enabled}>"

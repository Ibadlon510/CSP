"""Contact (replaces Entity) and ContactAddress (many per contact) models.
Note: ContactDocument is DEPRECATED — use the unified Document model (models/document.py) instead."""
from sqlalchemy import Column, String, Date, ForeignKey, Text, Enum as SQLEnum, Boolean, Integer
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin
import enum


class ContactType(str, enum.Enum):
    COMPANY = "company"
    INDIVIDUAL = "individual"


class ContactStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    UNDER_RENEWAL = "under_renewal"
    CANCELLED = "cancelled"


class AddressType(str, enum.Enum):
    REGISTERED_OFFICE = "registered_office"
    MAILING = "mailing"
    BRANCH = "branch"
    BILLING = "billing"
    RESIDENTIAL = "residential"
    OTHER = "other"


class Contact(TimestampMixin, Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    contact_type = Column(SQLEnum(ContactType), nullable=False)

    # Common
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone_primary = Column(String(50), nullable=True)
    phone_mobile = Column(String(50), nullable=True)
    phone_office = Column(String(50), nullable=True)
    status = Column(SQLEnum(ContactStatus), default=ContactStatus.ACTIVE, nullable=False)
    assigned_manager_id = Column(String, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    country = Column(String(100), nullable=True)

    # Company-only
    trade_license_no = Column(String(100), nullable=True)
    jurisdiction = Column(String(100), nullable=True)
    legal_form = Column(String(100), nullable=True)
    license_issue_date = Column(Date, nullable=True)
    license_expiry_date = Column(Date, nullable=True, index=True)
    establishment_card_expiry = Column(Date, nullable=True)
    visa_expiry_date = Column(Date, nullable=True)
    tax_registration_no = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    activity_license_activities = Column(Text, nullable=True)

    # Tax (VAT – company-only in use)
    vat_registered = Column(Boolean, nullable=True, default=False)
    vat_period_type = Column(String(50), nullable=True)  # e.g. monthly, quarterly
    vat_period_end_day = Column(Integer, nullable=True)  # day of month when period ends
    vat_first_period_end_date = Column(Date, nullable=True)  # first period end for deriving current period
    vat_return_due_days = Column(Integer, nullable=True)  # days after period end when return is due (e.g. 28)
    vat_notes = Column(Text, nullable=True)

    # Tax (CT – company-only in use)
    ct_registered = Column(Boolean, nullable=True, default=False)
    ct_registration_no = Column(String(100), nullable=True)
    ct_period_type = Column(String(50), nullable=True)  # e.g. calendar_year, fiscal_year
    ct_financial_year_start_month = Column(Integer, nullable=True)  # 1-12
    ct_financial_year_start_day = Column(Integer, nullable=True)  # 1-31
    ct_filing_due_months = Column(Integer, nullable=True)  # months after period end when CT return is due (e.g. 9)
    ct_notes = Column(Text, nullable=True)

    # Individual-only
    first_name = Column(String(100), nullable=True)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    place_of_birth = Column(String(100), nullable=True)
    passport_no = Column(String(100), nullable=True)
    passport_expiry = Column(Date, nullable=True)
    nationality = Column(String(100), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    visa_type = Column(String(100), nullable=True)
    emirates_id = Column(String(100), nullable=True)
    emirates_id_expiry = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    designation_title = Column(String(100), nullable=True)

    # UBO / compliance (company): fallback senior manager, declaration dates
    senior_manager_contact_id = Column(String, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    ubo_declaration_date = Column(Date, nullable=True)
    ubo_last_updated_at = Column(Date, nullable=True)

    addresses = relationship("ContactAddress", back_populates="contact", cascade="all, delete-orphan")
    wallet = relationship("ClientWallet", back_populates="contact", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contact {self.name}>"


class ContactAddress(TimestampMixin, Base):
    __tablename__ = "contact_addresses"

    id = Column(String, primary_key=True, default=generate_uuid)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    address_type = Column(SQLEnum(AddressType), nullable=False)

    address_line_1 = Column(String(255), nullable=False)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state_emirate = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    is_primary = Column(Boolean, nullable=True, default=False)
    notes = Column(Text, nullable=True)

    contact = relationship("Contact", back_populates="addresses")

    def __repr__(self):
        return f"<ContactAddress {self.address_type} {self.address_line_1}>"


# DEPRECATED: ContactDocument replaced by unified Document model (models/document.py).
# Table "contact_documents" still exists in DB for backward compat; do not use in new code.

"""Contact, ContactAddress, and ContactDocument request/response schemas."""
from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional, List


# ----- ContactDocument -----
class ContactDocumentResponse(BaseModel):
    id: str
    category: str
    file_name: str
    file_path: str
    file_size: str | None

    class Config:
        from_attributes = True


# ----- ContactAddress -----
class ContactAddressCreate(BaseModel):
    address_type: str  # registered_office, mailing, branch, billing, residential, other
    address_line_1: str
    address_line_2: str | None = None
    city: str | None = None
    state_emirate: str | None = None
    postal_code: str | None = None
    country: str | None = None
    is_primary: bool | None = False
    notes: str | None = None


class ContactAddressUpdate(BaseModel):
    address_type: str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state_emirate: str | None = None
    postal_code: str | None = None
    country: str | None = None
    is_primary: bool | None = None
    notes: str | None = None


class ContactAddressResponse(BaseModel):
    id: str
    contact_id: str
    address_type: str
    address_line_1: str
    address_line_2: str | None
    city: str | None
    state_emirate: str | None
    postal_code: str | None
    country: str | None
    is_primary: bool | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Contact -----
class ContactCreate(BaseModel):
    contact_type: str  # company | individual
    name: str
    email: str | None = None
    phone_primary: str | None = None
    phone_mobile: str | None = None
    phone_office: str | None = None
    status: str | None = "active"
    assigned_manager_id: str | None = None
    notes: str | None = None
    country: str | None = None
    # Company
    trade_license_no: str | None = None
    jurisdiction: str | None = None
    legal_form: str | None = None
    license_issue_date: date | None = None
    license_expiry_date: date | None = None
    establishment_card_expiry: date | None = None
    visa_expiry_date: date | None = None
    tax_registration_no: str | None = None
    website: str | None = None
    activity_license_activities: str | None = None
    # Tax (VAT)
    vat_registered: bool | None = None
    vat_period_type: str | None = None
    vat_period_end_day: int | None = None
    vat_first_period_end_date: date | None = None
    vat_return_due_days: int | None = None
    vat_notes: str | None = None
    # Tax (CT)
    ct_registered: bool | None = None
    ct_registration_no: str | None = None
    ct_period_type: str | None = None
    ct_financial_year_start_month: int | None = None
    ct_financial_year_start_day: int | None = None
    ct_filing_due_months: int | None = None
    ct_notes: str | None = None
    # Individual
    first_name: str | None = None
    last_name: str | None = None
    passport_no: str | None = None
    passport_expiry: date | None = None
    nationality: str | None = None
    date_of_birth: date | None = None
    visa_type: str | None = None
    emirates_id: str | None = None
    emirates_id_expiry: date | None = None
    gender: str | None = None
    designation_title: str | None = None
    # Addresses (optional on create)
    addresses: List[ContactAddressCreate] = []


class ContactUpdate(BaseModel):
    contact_type: str | None = None
    name: str | None = None
    email: str | None = None
    phone_primary: str | None = None
    phone_mobile: str | None = None
    phone_office: str | None = None
    status: str | None = None
    assigned_manager_id: str | None = None
    notes: str | None = None
    country: str | None = None
    trade_license_no: str | None = None
    jurisdiction: str | None = None
    legal_form: str | None = None
    license_issue_date: date | None = None
    license_expiry_date: date | None = None
    establishment_card_expiry: date | None = None
    visa_expiry_date: date | None = None
    tax_registration_no: str | None = None
    website: str | None = None
    activity_license_activities: str | None = None
    vat_registered: bool | None = None
    vat_period_type: str | None = None
    vat_period_end_day: int | None = None
    vat_first_period_end_date: date | None = None
    vat_return_due_days: int | None = None
    vat_notes: str | None = None
    ct_registered: bool | None = None
    ct_registration_no: str | None = None
    ct_period_type: str | None = None
    ct_financial_year_start_month: int | None = None
    ct_financial_year_start_day: int | None = None
    ct_filing_due_months: int | None = None
    ct_notes: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    passport_no: str | None = None
    passport_expiry: date | None = None
    nationality: str | None = None
    date_of_birth: date | None = None
    visa_type: str | None = None
    emirates_id: str | None = None
    emirates_id_expiry: date | None = None
    gender: str | None = None
    designation_title: str | None = None


class ContactResponse(BaseModel):
    id: str
    org_id: str
    contact_type: str
    name: str
    email: str | None
    phone_primary: str | None
    phone_mobile: str | None
    phone_office: str | None
    status: str
    assigned_manager_id: str | None
    notes: str | None
    country: str | None
    trade_license_no: str | None
    jurisdiction: str | None
    legal_form: str | None
    license_issue_date: date | None
    license_expiry_date: date | None
    establishment_card_expiry: date | None
    visa_expiry_date: date | None
    tax_registration_no: str | None
    website: str | None
    activity_license_activities: str | None
    vat_registered: bool | None
    vat_period_type: str | None
    vat_period_end_day: int | None
    vat_first_period_end_date: date | None
    vat_return_due_days: int | None
    vat_notes: str | None
    ct_registered: bool | None
    ct_registration_no: str | None
    ct_period_type: str | None
    ct_financial_year_start_month: int | None
    ct_financial_year_start_day: int | None
    ct_filing_due_months: int | None
    ct_notes: str | None
    first_name: str | None
    last_name: str | None
    passport_no: str | None
    passport_expiry: date | None
    nationality: str | None
    date_of_birth: date | None
    visa_type: str | None
    emirates_id: str | None
    emirates_id_expiry: date | None
    gender: str | None
    designation_title: str | None
    addresses: List[ContactAddressResponse] = []
    documents: List[ContactDocumentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

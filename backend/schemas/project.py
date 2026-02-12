"""Pydantic schemas for project and task management"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal


# ============= Project Schemas =============

class ProjectCreate(BaseModel):
    """Schema for creating a project"""
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    contact_id: Optional[str] = None
    estimated_govt_fee: Optional[Decimal] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    owner_id: Optional[str] = None
    priority: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    contact_id: Optional[str] = None
    estimated_govt_fee: Optional[Decimal] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    owner_id: Optional[str] = None
    priority: Optional[str] = None


class ProjectResponse(BaseModel):
    """Schema for project response"""
    id: str
    org_id: str
    contact_id: Optional[str] = None
    invoice_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    estimated_govt_fee: Optional[Decimal] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    owner_id: Optional[str] = None
    priority: Optional[str] = None
    project_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Optional enriched fields
    contact_name: Optional[str] = None
    owner_name: Optional[str] = None
    sales_order_ids: Optional[List[str]] = None
    task_count: Optional[int] = 0
    completed_task_count: Optional[int] = 0
    category_progress: Optional[Dict[str, Any]] = None  # {category: {total, completed}}

    class Config:
        from_attributes = True


# ============= Task Schemas =============

class TaskAssigneeInfo(BaseModel):
    user_id: str
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    """Schema for creating a task"""
    project_id: str
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    priority: str = "medium"
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    assignee_ids: Optional[List[str]] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class TaskUpdate(BaseModel):
    """Schema for updating a task"""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    assignee_ids: Optional[List[str]] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class TaskResponse(BaseModel):
    """Schema for task response"""
    id: str
    project_id: str
    org_id: str
    parent_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    category: Optional[str] = None
    date_assigned: Optional[datetime] = None
    sort_order: Optional[int] = None

    # Optional enriched fields
    project_title: Optional[str] = None
    comment_count: Optional[int] = None
    assignee_name: Optional[str] = None
    assignees: Optional[List[TaskAssigneeInfo]] = None
    subtasks: Optional[List["TaskResponse"]] = None
    subtask_count: Optional[int] = None
    progress_pct: Optional[float] = None

    class Config:
        from_attributes = True


# ============= Handover Schemas =============

class ProjectHandoverUpsert(BaseModel):
    # Contact-mapped fields (bidirectional sync)
    contact_type: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone_mobile: Optional[str] = None
    phone_primary: Optional[str] = None
    trade_license_no: Optional[str] = None
    jurisdiction: Optional[str] = None
    legal_form: Optional[str] = None
    license_issue_date: Optional[date] = None
    license_expiry_date: Optional[date] = None
    activity_license_activities: Optional[str] = None
    vat_registered: Optional[bool] = None
    vat_period_type: Optional[str] = None
    vat_period_end_day: Optional[int] = None
    vat_first_period_end_date: Optional[date] = None
    vat_return_due_days: Optional[int] = None
    vat_notes: Optional[str] = None
    ct_registered: Optional[bool] = None
    ct_registration_no: Optional[str] = None
    ct_period_type: Optional[str] = None
    ct_financial_year_start_month: Optional[int] = None
    ct_financial_year_start_day: Optional[int] = None
    ct_filing_due_months: Optional[int] = None
    ct_notes: Optional[str] = None
    # Individual-specific contact fields
    gender: Optional[str] = None
    nationality: Optional[str] = None
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = None
    passport_no: Optional[str] = None
    passport_expiry: Optional[date] = None
    visa_type: Optional[str] = None
    emirates_id: Optional[str] = None
    emirates_id_expiry: Optional[date] = None
    designation_title: Optional[str] = None
    # Handover-only fields
    is_visa_application: Optional[bool] = None
    channel_partner_plan: Optional[str] = None
    initial_company_formation: Optional[bool] = None
    price_per_share: Optional[Decimal] = None
    total_number_of_shares: Optional[Decimal] = None
    shareholding_total: Optional[Decimal] = None
    total_share_value: Optional[Decimal] = None
    license_authority: Optional[str] = None
    legal_entity_type_detailed: Optional[str] = None
    applied_years: Optional[str] = None
    top_5_countries: Optional[str] = None
    visa_eligibility: Optional[int] = None
    preferred_mobile_country: Optional[str] = None


class ProjectHandoverResponse(ProjectHandoverUpsert):
    id: Optional[str] = None
    project_id: str
    contact_id: Optional[str] = None
    proposed_names: List["ProjectProposedNameResponse"] = []
    license_activities: List["ProjectLicenseActivityResponse"] = []
    visa_applications: List["ProjectVisaApplicationResponse"] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============= Proposed Names =============

class ProjectProposedNameCreate(BaseModel):
    name: str = Field(..., max_length=255)
    priority: int = Field(..., ge=1, le=3)


class ProjectProposedNameResponse(BaseModel):
    id: str
    project_id: str
    name: str
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============= License Activities =============

class ProjectLicenseActivityCreate(BaseModel):
    activity_name: str = Field(..., max_length=255)
    activity_code: Optional[str] = Field(None, max_length=100)


class ProjectLicenseActivityResponse(BaseModel):
    id: str
    project_id: str
    activity_name: str
    activity_code: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Visa Applications =============

class ProjectVisaApplicationCreate(BaseModel):
    contact_id: str
    visa_type: Optional[str] = None
    designation: Optional[str] = None
    salary: Optional[Decimal] = None
    notes: Optional[str] = None


class ProjectVisaApplicationUpdate(BaseModel):
    visa_type: Optional[str] = None
    designation: Optional[str] = None
    salary: Optional[Decimal] = None
    status: Optional[str] = None
    entry_permit_no: Optional[str] = None
    entry_permit_date: Optional[date] = None
    medical_date: Optional[date] = None
    emirates_id_application_date: Optional[date] = None
    visa_stamping_date: Optional[date] = None
    notes: Optional[str] = None


class ProjectVisaApplicationResponse(BaseModel):
    id: str
    project_id: str
    contact_id: str
    visa_type: Optional[str] = None
    designation: Optional[str] = None
    salary: Optional[Decimal] = None
    status: Optional[str] = None
    entry_permit_no: Optional[str] = None
    entry_permit_date: Optional[date] = None
    medical_date: Optional[date] = None
    emirates_id_application_date: Optional[date] = None
    visa_stamping_date: Optional[date] = None
    notes: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============= Document Checklist =============

class ProjectDocumentChecklistCreate(BaseModel):
    requirement_name: str = Field(..., max_length=255)
    document_category: Optional[str] = None
    sort_order: int = 0


class ProjectDocumentChecklistUpdate(BaseModel):
    document_id: Optional[str] = None
    is_verified: Optional[bool] = None


class ProjectDocumentChecklistResponse(BaseModel):
    id: str
    project_id: str
    requirement_name: str
    document_category: Optional[str] = None
    document_id: Optional[str] = None
    is_verified: bool = False
    sort_order: int = 0
    # enriched
    document_file_name: Optional[str] = None
    document_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============= Project Products =============

class ProjectProductCreate(BaseModel):
    product_id: str
    quantity: Decimal = Decimal("1")
    unit_price: Optional[Decimal] = None
    is_billable: bool = True


class ProjectProductResponse(BaseModel):
    id: str
    project_id: str
    product_id: str
    quantity: Decimal
    unit_price: Optional[Decimal] = None
    source: str
    status: str
    is_billable: bool
    sales_order_id: Optional[str] = None
    added_by: Optional[str] = None
    # enriched
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    sales_order_number: Optional[str] = None
    added_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============= Related Fields =============

class ProjectRelatedFieldCreate(BaseModel):
    field_name: str = Field(..., max_length=255)
    field_value: Optional[str] = None
    field_type: str = "text"  # text, date, number, link


class ProjectRelatedFieldUpdate(BaseModel):
    field_name: Optional[str] = Field(None, max_length=255)
    field_value: Optional[str] = None
    field_type: Optional[str] = None


class ProjectRelatedFieldResponse(BaseModel):
    id: str
    project_id: str
    field_name: str
    field_value: Optional[str] = None
    field_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============= Task Comments =============

class TaskCommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None


class ReactionCreate(BaseModel):
    emoji: str  # e.g. "thumbsup", "heart", "rocket", "eyes", "fire"


class ReactionResponse(BaseModel):
    emoji: str
    count: int
    user_ids: List[str] = []


class TaskCommentResponse(BaseModel):
    id: str
    task_id: str
    user_id: Optional[str] = None
    content: str
    user_name: Optional[str] = None
    parent_id: Optional[str] = None
    reactions: List[ReactionResponse] = []
    reply_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

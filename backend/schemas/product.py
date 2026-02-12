"""Pydantic schemas for Products and ProductTaskTemplates."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field


class ProductTaskTemplateCreate(BaseModel):
    task_name: str = Field(..., max_length=255)
    sort_order: int = 0
    subtask_names: Optional[List[str]] = None


class ProductTaskTemplateUpdate(BaseModel):
    task_name: Optional[str] = Field(None, max_length=255)
    sort_order: Optional[int] = None
    subtask_names: Optional[List[str]] = None


class ProductTaskTemplateResponse(BaseModel):
    id: str
    org_id: str
    product_id: str
    task_name: str
    sort_order: int
    subtask_names: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    default_unit_price: Optional[Decimal] = None
    is_active: bool = True
    creates_project: bool = False
    code: Optional[str] = Field(None, max_length=20)
    task_templates: List[ProductTaskTemplateCreate] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    default_unit_price: Optional[Decimal] = None
    is_active: Optional[bool] = None
    creates_project: Optional[bool] = None
    code: Optional[str] = Field(None, max_length=20)


class ProductResponse(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    default_unit_price: Optional[Decimal] = None
    is_active: bool
    creates_project: bool
    code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    task_templates: List[ProductTaskTemplateResponse] = []
    document_requirements: List["ProductDocumentRequirementResponse"] = []

    class Config:
        from_attributes = True


# ============= Product Document Requirements =============

class ProductDocumentRequirementCreate(BaseModel):
    document_name: str = Field(..., max_length=255)
    document_category: Optional[str] = Field(None, max_length=100)
    document_type: str = "required"  # "required" | "deliverable"
    sort_order: int = 0


class ProductDocumentRequirementResponse(BaseModel):
    id: str
    product_id: str
    org_id: str
    document_name: str
    document_category: Optional[str] = None
    document_type: str = "required"
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

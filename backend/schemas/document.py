"""Pydantic schemas for Documents."""
from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional, List


class DocumentCreate(BaseModel):
    """Schema for document metadata on upload."""
    contact_id: Optional[str] = None
    task_id: Optional[str] = None
    category: str
    folder: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None


class DocumentUpdate(BaseModel):
    """Schema for updating document metadata."""
    category: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    retention_until: Optional[date] = None


class DocumentResponse(BaseModel):
    id: str
    org_id: str
    contact_id: Optional[str]
    task_id: Optional[str]
    project_id: Optional[str] = None
    purpose: Optional[str] = None
    category: str
    folder: Optional[str]
    tags: Optional[List[str]]
    description: Optional[str]
    file_name: str
    file_path: str
    file_size: Optional[int]
    mime_type: Optional[str]
    checksum: Optional[str] = None
    status: str
    archived_at: Optional[datetime]
    retention_until: Optional[date]
    uploaded_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BulkArchiveRequest(BaseModel):
    document_ids: List[str]


class BulkTagRequest(BaseModel):
    document_ids: List[str]
    tags: List[str]


class BulkMoveRequest(BaseModel):
    document_ids: List[str]
    folder: str


class BulkOperationResponse(BaseModel):
    updated_count: int


class DocumentCategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    parent_id: Optional[str] = None


class DocumentCategoryResponse(BaseModel):
    id: str
    org_id: str
    name: str
    slug: str
    parent_id: Optional[str]
    is_system: Optional[str]

    class Config:
        from_attributes = True


class DocumentTypeItem(BaseModel):
    """Single document type for dropdowns: slug + display name; id only for DB-backed custom categories."""
    slug: str
    name: str
    id: Optional[str] = None


class RetentionReportItem(BaseModel):
    id: str
    file_name: str
    category: str
    retention_until: date
    days_overdue: int
    contact_id: Optional[str] = None
    task_id: Optional[str] = None
    project_id: Optional[str] = None

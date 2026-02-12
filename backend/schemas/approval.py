"""Pydantic schemas for the approval process module."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ApprovalActionPayload(BaseModel):
    comment: Optional[str] = None


class ApprovalRequestResponse(BaseModel):
    id: str
    org_id: str
    request_type: str
    resource_type: str
    resource_id: str
    requested_by: Optional[str] = None
    approver_id: Optional[str] = None
    status: str
    requested_at: datetime
    resolved_at: Optional[datetime] = None
    comment: Optional[str] = None
    # enriched
    requester_name: Optional[str] = None
    approver_name: Optional[str] = None
    resource_label: Optional[str] = None  # human-readable description of the resource
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApprovalProcessSettingResponse(BaseModel):
    id: str
    org_id: str
    approval_type: str
    is_enabled: bool
    fallback_approver_id: Optional[str] = None
    fallback_approver_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApprovalProcessSettingUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    fallback_approver_id: Optional[str] = None

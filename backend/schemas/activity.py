"""Pydantic schemas for activities (calendar events)."""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ActivityCreate(BaseModel):
    """Schema for creating an activity."""
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    activity_type: str = "other"  # call, meeting, follow_up, visit, other
    contact_id: Optional[str] = None
    assigned_to: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    location: Optional[str] = Field(None, max_length=255)
    reminder: str = "none"  # none, 15min, 30min, 1hr, 1day
    recurrence: str = "none"  # none, daily, weekly, monthly


class ActivityUpdate(BaseModel):
    """Schema for updating an activity."""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    activity_type: Optional[str] = None
    contact_id: Optional[str] = None
    assigned_to: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = None  # pending, completed
    reminder: Optional[str] = None
    recurrence: Optional[str] = None
    completion_notes: Optional[str] = None


class ActivityResponse(BaseModel):
    """Schema for activity response."""
    id: str
    org_id: str
    project_id: str
    contact_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    activity_type: str
    location: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    reminder: str
    recurrence: str
    status: str
    completion_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Enriched fields
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None
    project_title: Optional[str] = None
    contact_name: Optional[str] = None
    is_overdue: bool = False

    class Config:
        from_attributes = True

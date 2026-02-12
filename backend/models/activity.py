"""Activity model — lightweight scheduled events linked to projects."""
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum, DateTime, Boolean
from sqlalchemy.orm import relationship
from core.database import Base
from models.base import TimestampMixin, generate_uuid
import enum


class ActivityType(str, enum.Enum):
    """Activity type enum"""
    CALL = "call"
    MEETING = "meeting"
    FOLLOW_UP = "follow_up"
    VISIT = "visit"
    OTHER = "other"


class ActivityStatus(str, enum.Enum):
    """Activity status enum"""
    PENDING = "pending"
    COMPLETED = "completed"


class ActivityReminder(str, enum.Enum):
    """Reminder lead-time enum"""
    NONE = "none"
    MIN_15 = "15min"
    MIN_30 = "30min"
    HOUR_1 = "1hr"
    DAY_1 = "1day"


class ActivityRecurrence(str, enum.Enum):
    """Recurrence pattern enum"""
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class Activity(Base, TimestampMixin):
    """
    Lightweight scheduled event linked to a project.
    Appears in the project Tasks tab and on the Calendar page.
    """
    __tablename__ = "activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Core fields
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    activity_type = Column(SQLEnum(ActivityType), nullable=False, default=ActivityType.OTHER)
    location = Column(String(255), nullable=True)

    # Scheduling
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    reminder = Column(SQLEnum(ActivityReminder), nullable=False, default=ActivityReminder.NONE)
    recurrence = Column(SQLEnum(ActivityRecurrence), nullable=False, default=ActivityRecurrence.NONE)

    # Status
    status = Column(SQLEnum(ActivityStatus), nullable=False, default=ActivityStatus.PENDING)
    completion_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Assignment
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", backref="activities")
    contact = relationship("Contact")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Activity(id={self.id}, title={self.title}, type={self.activity_type})>"

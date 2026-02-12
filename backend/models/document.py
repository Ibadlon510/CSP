"""Unified Document model - filing, storage, archiving, viewing."""
from sqlalchemy import Column, String, ForeignKey, Text, BigInteger, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class DocumentStatus:
    ACTIVE = "active"
    ARCHIVED = "archived"
    PURGED = "purged"
    ALL = [ACTIVE, ARCHIVED, PURGED]


class Document(TimestampMixin, Base):
    """Unified document with polymorphic linking to entity, contact, task, employee."""
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)

    # Polymorphic link (one of these set)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    employee_id = Column(String, nullable=True, index=True)  # Future: FK to employees

    # Purpose classification for project documents
    purpose = Column(String(50), nullable=True)  # "required" or "deliverable"

    # Filing
    category = Column(String(100), nullable=False)  # trade_license, moa, passport, contract, receipt, etc.
    folder = Column(String(255), nullable=True)  # optional folder path
    tags = Column(JSON, nullable=True)  # ["tag1", "tag2"] - JSON array for SQLite
    description = Column(Text, nullable=True)

    # Storage
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # org_id/documents/uuid.ext
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    checksum = Column(String(64), nullable=True)  # SHA-256 for integrity

    # Archiving
    status = Column(String(20), default=DocumentStatus.ACTIVE, nullable=False)
    archived_at = Column(DateTime, nullable=True)
    retention_until = Column(Date, nullable=True)

    # Audit
    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    contact = relationship("Contact", foreign_keys=[contact_id])
    task = relationship("Task", foreign_keys=[task_id])

    def __repr__(self):
        return f"<Document {self.file_name}>"


class DocumentCategory(Base, TimestampMixin):
    """Org-level document categories for filing taxonomy."""
    __tablename__ = "document_categories"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    parent_id = Column(String, ForeignKey("document_categories.id", ondelete="CASCADE"), nullable=True, index=True)

    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, index=True)
    is_system = Column(String(5), default="false", nullable=True)  # "true" for system categories

    parent = relationship("DocumentCategory", remote_side="DocumentCategory.id")

    def __repr__(self):
        return f"<DocumentCategory {self.slug}>"

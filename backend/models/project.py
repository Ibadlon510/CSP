"""
Project and Task Management models
"""
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum, DateTime, Boolean, Numeric, Integer, Date, Float
from sqlalchemy.orm import relationship, backref
from core.database import Base
from models.base import TimestampMixin, generate_uuid
import enum


class ProjectStatus(str, enum.Enum):
    """Project status enum"""
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskStatus(str, enum.Enum):
    """Task status enum"""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    REVIEW = "review"
    DONE = "done"


class TaskPriority(str, enum.Enum):
    """Task priority enum"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Project(Base, TimestampMixin):
    """
    Project for organizing tasks related to client entities
    """
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True)  # Optional link to contact
    invoice_id = Column(String, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_order_id = Column(String, ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)

    # Project details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(ProjectStatus), nullable=False, default=ProjectStatus.PLANNING)
    estimated_govt_fee = Column(Numeric(15, 2), nullable=True)  # For Red Alert gate when assigning tasks
    
    # Dates
    start_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Assignment
    owner_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # New fields
    priority = Column(String(20), nullable=True)  # low, medium, high, urgent
    project_number = Column(String(500), nullable=True)  # auto-generated: SO# - YYMM - ProductCode - CustomerName

    # Relationships
    contact = relationship("Contact", backref="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    handover = relationship("ProjectHandover", back_populates="project", uselist=False, cascade="all, delete-orphan")
    proposed_names = relationship("ProjectProposedName", back_populates="project", cascade="all, delete-orphan")
    license_activities = relationship("ProjectLicenseActivity", back_populates="project", cascade="all, delete-orphan")
    visa_applications = relationship("ProjectVisaApplication", back_populates="project", cascade="all, delete-orphan")
    document_checklist = relationship("ProjectDocumentChecklist", back_populates="project", cascade="all, delete-orphan")
    project_products = relationship("ProjectProduct", back_populates="project", cascade="all, delete-orphan")
    related_fields = relationship("ProjectRelatedField", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, title={self.title}, status={self.status})>"


class Task(Base, TimestampMixin):
    """
    Individual task within a project
    """
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)

    # Task details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(TaskStatus), nullable=False, default=TaskStatus.TODO)
    priority = Column(SQLEnum(TaskPriority), nullable=False, default=TaskPriority.MEDIUM)
    
    # New fields
    category = Column(String(100), nullable=True)  # Sales, Operations, Compliance, Authority, etc.
    date_assigned = Column(DateTime, nullable=True)  # when task was assigned (distinct from created_at)

    # Dates
    start_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Ordering (for Kanban drag-and-drop)
    sort_order = Column(Integer, nullable=True, default=0)
    
    # Assignment
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    parent = relationship("Task", remote_side="Task.id", backref="subtasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan", order_by="TaskComment.created_at")
    assignees = relationship("TaskAssignee", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Task(id={self.id}, title={self.title}, status={self.status})>"


class TaskDependency(TimestampMixin, Base):
    """Dependency link between tasks (predecessor → successor)."""
    __tablename__ = "task_dependencies"

    id = Column(String, primary_key=True, default=generate_uuid)
    predecessor_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    successor_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    dependency_type = Column(String(20), nullable=False, default="finish_to_start")  # finish_to_start, start_to_start, etc.

    predecessor = relationship("Task", foreign_keys=[predecessor_id])
    successor = relationship("Task", foreign_keys=[successor_id])

    def __repr__(self):
        return f"<TaskDependency {self.predecessor_id} → {self.successor_id}>"


class TaskAssignee(TimestampMixin, Base):
    """Many-to-many: a task can have multiple assignees."""
    __tablename__ = "task_assignees"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    task = relationship("Task", back_populates="assignees")

    def __repr__(self):
        return f"<TaskAssignee(task_id={self.task_id}, user_id={self.user_id})>"


# ---------------------------------------------------------------------------
# Project sub-models
# ---------------------------------------------------------------------------


class ProjectHandover(TimestampMixin, Base):
    """Handover-only fields (one-to-one with Project). Contact-mapped fields live on Contact."""
    __tablename__ = "project_handovers"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    is_visa_application = Column(Boolean, nullable=True, default=False)
    channel_partner_plan = Column(String(255), nullable=True)
    initial_company_formation = Column(Boolean, nullable=True, default=False)
    price_per_share = Column(Numeric(15, 2), nullable=True)
    total_number_of_shares = Column(Numeric(15, 2), nullable=True)
    shareholding_total = Column(Numeric(15, 2), nullable=True)
    total_share_value = Column(Numeric(15, 2), nullable=True)
    license_authority = Column(String(255), nullable=True)
    legal_entity_type_detailed = Column(String(255), nullable=True)
    applied_years = Column(String(50), nullable=True)
    top_5_countries = Column(Text, nullable=True)
    visa_eligibility = Column(Integer, nullable=True)  # max visa slots
    preferred_mobile_country = Column(String(10), nullable=True)

    project = relationship("Project", back_populates="handover")

    def __repr__(self):
        return f"<ProjectHandover project_id={self.project_id}>"


class ProjectProposedName(TimestampMixin, Base):
    """Proposed company names for initial company formation (max 3 per project)."""
    __tablename__ = "project_proposed_names"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    priority = Column(Integer, nullable=False, default=1)  # 1, 2, or 3

    project = relationship("Project", back_populates="proposed_names")

    def __repr__(self):
        return f"<ProjectProposedName {self.name} priority={self.priority}>"


class ProjectLicenseActivity(TimestampMixin, Base):
    """License activities for a project."""
    __tablename__ = "project_license_activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    activity_name = Column(String(255), nullable=False)
    activity_code = Column(String(100), nullable=True)

    project = relationship("Project", back_populates="license_activities")

    def __repr__(self):
        return f"<ProjectLicenseActivity {self.activity_name}>"


class ProjectVisaApplication(TimestampMixin, Base):
    """Visa application for an individual contact within a project."""
    __tablename__ = "project_visa_applications"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)

    visa_type = Column(String(50), nullable=True)  # employment, investor, partner, dependent, golden, tourist
    designation = Column(String(255), nullable=True)
    salary = Column(Numeric(15, 2), nullable=True)
    status = Column(String(50), nullable=True, default="not_started")
    entry_permit_no = Column(String(100), nullable=True)
    entry_permit_date = Column(Date, nullable=True)
    medical_date = Column(Date, nullable=True)
    emirates_id_application_date = Column(Date, nullable=True)
    visa_stamping_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="visa_applications")
    contact = relationship("Contact")

    def __repr__(self):
        return f"<ProjectVisaApplication project={self.project_id} contact={self.contact_id}>"


class ProjectDocumentChecklist(TimestampMixin, Base):
    """Per-project required document checklist (auto-populated from product templates)."""
    __tablename__ = "project_document_checklist"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    requirement_name = Column(String(255), nullable=False)
    document_category = Column(String(100), nullable=True)
    document_type = Column(String(20), nullable=False, default="required")  # "required" | "deliverable"
    document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)

    project = relationship("Project", back_populates="document_checklist")
    document = relationship("Document")

    def __repr__(self):
        return f"<ProjectDocumentChecklist {self.requirement_name}>"


class ProjectProduct(TimestampMixin, Base):
    """Products/services included in a project (original from SO or added later)."""
    __tablename__ = "project_products"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric(15, 2), nullable=False, default=1)
    unit_price = Column(Numeric(15, 2), nullable=True)
    source = Column(String(20), nullable=False, default="original")  # original | added
    status = Column(String(30), nullable=False, default="active")  # active | pending_approval | rejected
    is_billable = Column(Boolean, nullable=False, default=True)
    sales_order_id = Column(String, ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True)
    added_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    project = relationship("Project", back_populates="project_products")
    product = relationship("Product")
    sales_order = relationship("SalesOrder")

    def __repr__(self):
        return f"<ProjectProduct project={self.project_id} product={self.product_id}>"


class ProjectRelatedField(TimestampMixin, Base):
    """Custom key-value metadata for a project."""
    __tablename__ = "project_related_fields"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(255), nullable=False)
    field_value = Column(Text, nullable=True)
    field_type = Column(String(20), nullable=False, default="text")  # text, date, number, link

    project = relationship("Project", back_populates="related_fields")

    def __repr__(self):
        return f"<ProjectRelatedField {self.field_name}={self.field_value}>"


class UserFavorite(TimestampMixin, Base):
    """User-pinned / favourite projects."""
    __tablename__ = "user_favorites"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, default=0)

    project = relationship("Project")

    def __repr__(self):
        return f"<UserFavorite user={self.user_id} project={self.project_id}>"


class TaskComment(TimestampMixin, Base):
    """Comments on tasks with optional threading."""
    __tablename__ = "task_comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    parent_id = Column(String, ForeignKey("task_comments.id", ondelete="CASCADE"), nullable=True, index=True)

    task = relationship("Task", back_populates="comments")
    replies = relationship("TaskComment", foreign_keys=[parent_id], cascade="all, delete-orphan", lazy="select")

    def __repr__(self):
        return f"<TaskComment task={self.task_id}>"


class TaskAttachment(TimestampMixin, Base):
    """File attachments on tasks."""
    __tablename__ = "task_attachments"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, default=0)
    mime_type = Column(String(100), nullable=True)

    task = relationship("Task")

    def __repr__(self):
        return f"<TaskAttachment {self.filename} task={self.task_id}>"


class CommentReaction(TimestampMixin, Base):
    """Emoji reactions on task comments."""
    __tablename__ = "comment_reactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    comment_id = Column(String, ForeignKey("task_comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(8), nullable=False)  # e.g. "thumbsup", "heart", "rocket"

    def __repr__(self):
        return f"<CommentReaction {self.emoji} by={self.user_id}>"

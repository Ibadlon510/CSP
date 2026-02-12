"""Product and ProductTaskTemplate models for workflow (project/task creation from sales)."""
from sqlalchemy import Column, String, ForeignKey, Numeric, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    default_unit_price = Column(Numeric(15, 2), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    creates_project = Column(Boolean, default=False, nullable=False)
    code = Column(String(20), nullable=True)  # short product code for project naming (e.g. "LR", "CF")

    task_templates = relationship(
        "ProductTaskTemplate",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductTaskTemplate.sort_order",
    )

    document_requirements = relationship(
        "ProductDocumentRequirement",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductDocumentRequirement.sort_order",
    )

    def __repr__(self):
        return f"<Product {self.name}>"


class ProductTaskTemplate(TimestampMixin, Base):
    __tablename__ = "product_task_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    task_name = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    # JSON array of subtask name strings, e.g. ["Subtask A", "Subtask B"]
    subtask_names = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="task_templates")

    def __repr__(self):
        return f"<ProductTaskTemplate {self.task_name}>"


class ProductDocumentRequirement(TimestampMixin, Base):
    """Per-product required document template for project checklist."""
    __tablename__ = "product_document_requirements"

    id = Column(String, primary_key=True, default=generate_uuid)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    document_name = Column(String(255), nullable=False)
    document_category = Column(String(100), nullable=True)
    document_type = Column(String(20), nullable=False, default="required")  # "required" | "deliverable"
    sort_order = Column(Integer, nullable=False, default=0)

    product = relationship("Product", back_populates="document_requirements")

    def __repr__(self):
        return f"<ProductDocumentRequirement {self.document_name}>"

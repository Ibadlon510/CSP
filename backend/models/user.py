"""User model with roles and organization membership."""
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class UserRole:
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MANAGER = "manager"
    PRO = "pro"
    ACCOUNTANT = "accountant"
    CLIENT = "client"

    ALL = [SUPER_ADMIN, ADMIN, MANAGER, PRO, ACCOUNTANT, CLIENT]


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.CLIENT)
    is_active = Column(Boolean, default=True, nullable=False)

    # Multi-tenancy
    org_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="users")

    # Reporting manager (for approval workflows)
    manager_id = Column(String, ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<User {self.email} role={self.role}>"

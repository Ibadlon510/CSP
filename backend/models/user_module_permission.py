"""User-level delegation: who can edit settings for which module."""
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class UserModulePermission(TimestampMixin, Base):
    """Allows a user to edit settings for a specific module without being admin."""
    __tablename__ = "user_module_permissions"
    __table_args__ = (UniqueConstraint("user_id", "module_id", name="uq_user_module"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(String(50), nullable=False)
    permission = Column(String(50), nullable=False, default="settings")  # settings, view

    def __repr__(self):
        return f"<UserModulePermission user={self.user_id} module={self.module_id}>"

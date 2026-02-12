"""SavedSearch model — user-saved filter/group presets per page, with org sharing."""
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from models.base import generate_uuid, TimestampMixin
from core.database import Base


class SavedSearch(TimestampMixin, Base):
    """Named filter + grouping preset that a user can save and optionally share org-wide."""
    __tablename__ = "saved_searches"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    page = Column(String(50), nullable=False)  # e.g. "my_tasks", "contacts", "projects"
    criteria = Column(JSON, nullable=False)  # { search, filters, groupBy }
    is_default = Column(Boolean, default=False, nullable=False)
    is_shared = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    # Relationships
    user = relationship("User", backref="saved_searches")

    def __repr__(self):
        return f"<SavedSearch(id={self.id}, name={self.name}, page={self.page})>"

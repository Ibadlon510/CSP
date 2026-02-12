"""In-app notification model."""
from sqlalchemy import Column, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, default="general")  # general, expiry, retention, system
    is_read = Column(Boolean, nullable=False, default=False)

    # Optional link to related resource
    resource_type = Column(String(50), nullable=True)  # contact, document, wallet, etc.
    resource_id = Column(String, nullable=True)

    def __repr__(self):
        return f"<Notification {self.title}>"

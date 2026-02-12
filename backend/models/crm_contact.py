"""CRM Contact model - person linked to Contact or Lead (for account management)."""
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from core.database import Base
from models.base import generate_uuid, TimestampMixin


class CrmContact(TimestampMixin, Base):
    """Person/contact linked to a Contact or Lead."""
    __tablename__ = "crm_contacts"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True, index=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    role = Column(String(100), nullable=True)

    def __repr__(self):
        return f"<CrmContact {self.name}>"

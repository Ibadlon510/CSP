"""Compliance & UBO: ownership links, snapshots, risk scoring."""
from sqlalchemy import Column, String, ForeignKey, Float, Date, DateTime, Text, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON

from core.database import Base
from models.base import generate_uuid, TimestampMixin
import enum


class OwnershipLinkType(str, enum.Enum):
    OWNERSHIP = "ownership"
    CONTROL = "control"
    DIRECTOR = "director"
    MANAGES = "manages"  # senior management fallback
    EMPLOYEE = "employee"
    FAMILY = "family"


class RegisterType(str, enum.Enum):
    UBO = "ubo"
    PARTNERS = "partners"
    DIRECTORS = "directors"


class RiskBand(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class OwnershipLink(TimestampMixin, Base):
    """Unified contact link: ownership, control, director, employee, family. owner -> owned."""
    __tablename__ = "ownership_links"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    owned_contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    link_type = Column(SQLEnum(OwnershipLinkType), nullable=False, default=OwnershipLinkType.OWNERSHIP)
    percentage = Column(Float, nullable=True)  # for ownership / UBO
    voting_pct = Column(Float, nullable=True)  # for control
    is_nominee = Column(String(5), nullable=True, default="false")  # "true" / "false" for SQLite
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    # Role label for director / manages / employee
    role_label = Column(String(100), nullable=True)  # e.g. "Managing Director", "Accountant"
    # For family only: father, mother, spouse, child, sibling, dependent, other
    relationship_kind = Column(String(50), nullable=True)
    # Shareholding (when link_type = ownership)
    number_of_shares = Column(Float, nullable=True)
    share_class = Column(String(50), nullable=True)  # ordinary, preference, etc.
    nominal_value_per_share = Column(Float, nullable=True)
    share_currency = Column(String(10), nullable=True)  # AED, USD

    # Role flags (additive, can coexist with link_type)
    is_ubo = Column(Boolean, nullable=True, default=False)
    is_secretary = Column(Boolean, nullable=True, default=False)
    is_poa_authorized = Column(Boolean, nullable=True, default=False)

    owner = relationship("Contact", foreign_keys=[owner_contact_id])
    owned = relationship("Contact", foreign_keys=[owned_contact_id])

    def __repr__(self):
        return f"<OwnershipLink {self.owner_contact_id} -> {self.owned_contact_id} {self.link_type} {self.percentage}%>"


class ComplianceSnapshot(TimestampMixin, Base):
    """Snapshot of a generated register (UBO, Partners, Directors) for audit trail."""
    __tablename__ = "compliance_snapshots"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    register_type = Column(SQLEnum(RegisterType), nullable=False)
    version_hash = Column(String(64), nullable=True)
    file_path = Column(String(500), nullable=True)  # R2 key or local path
    generated_at = Column(DateTime, nullable=False)
    generated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    snapshot_data = Column(JSON, nullable=True)  # optional JSON of UBO list / tree at generation time

    def __repr__(self):
        return f"<ComplianceSnapshot {self.register_type.value} {self.entity_contact_id}>"


class ComplianceRisk(TimestampMixin, Base):
    """AML/KYC risk score per contact (person or entity)."""
    __tablename__ = "compliance_risk"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    risk_score = Column(Float, nullable=True)  # 0-100
    risk_band = Column(SQLEnum(RiskBand), nullable=True)
    factors_json = Column(JSON, nullable=True)  # {"nationality": 40, "industry": 30, "complexity": 30}
    last_calculated_at = Column(DateTime, nullable=True)

    contact = relationship("Contact", foreign_keys=[contact_id])

    def __repr__(self):
        return f"<ComplianceRisk contact={self.contact_id} band={self.risk_band}>"


class ComplianceGraphLayout(TimestampMixin, Base):
    """Persisted node positions for the React Flow ownership graph."""
    __tablename__ = "compliance_graph_layouts"

    id = Column(String, primary_key=True, default=generate_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    root_contact_id = Column(String, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    positions_json = Column(JSON, nullable=False)  # { "contact_id": { "x": 0, "y": 0 }, ... }

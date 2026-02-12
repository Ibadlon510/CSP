"""Compliance & UBO: ownership links, graph, snapshots, risk."""
from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional, List, Any


# ----- OwnershipLink -----
# link_type: ownership | control | director | manages | employee | family
FAMILY_KINDS = ("father", "mother", "spouse", "child", "sibling", "dependent", "other")


class OwnershipLinkCreate(BaseModel):
    owner_contact_id: str
    owned_contact_id: str
    link_type: str = "ownership"
    percentage: Optional[float] = None
    voting_pct: Optional[float] = None
    is_nominee: Optional[bool] = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    role_label: Optional[str] = None
    relationship_kind: Optional[str] = None
    number_of_shares: Optional[float] = None
    share_class: Optional[str] = None
    nominal_value_per_share: Optional[float] = None
    share_currency: Optional[str] = None


class OwnershipLinkUpdate(BaseModel):
    link_type: Optional[str] = None
    percentage: Optional[float] = None
    voting_pct: Optional[float] = None
    is_nominee: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    role_label: Optional[str] = None
    relationship_kind: Optional[str] = None
    number_of_shares: Optional[float] = None
    share_class: Optional[str] = None
    nominal_value_per_share: Optional[float] = None
    share_currency: Optional[str] = None


class OwnershipLinkResponse(BaseModel):
    id: str
    org_id: str
    owner_contact_id: str
    owned_contact_id: str
    link_type: str
    percentage: Optional[float] = None
    voting_pct: Optional[float] = None
    is_nominee: bool
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    role_label: Optional[str] = None
    relationship_kind: Optional[str] = None
    number_of_shares: Optional[float] = None
    share_class: Optional[str] = None
    nominal_value_per_share: Optional[float] = None
    share_currency: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ----- Profile links (outgoing + incoming with inverse_label) -----
class ContactLinkItem(BaseModel):
    """One link for profile display: outgoing or incoming, with optional inverse label for family."""
    link_id: str
    direction: str  # "outgoing" | "incoming"
    other_contact_id: str
    other_contact_name: str
    other_contact_type: str  # company | individual
    link_type: str
    percentage: Optional[float] = None
    voting_pct: Optional[float] = None
    role_label: Optional[str] = None
    relationship_kind: Optional[str] = None
    inverse_label: Optional[str] = None  # e.g. "son" when viewing incoming family link (father)
    number_of_shares: Optional[float] = None
    share_class: Optional[str] = None
    nominal_value_per_share: Optional[float] = None
    share_currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ContactLinksResponse(BaseModel):
    contact_id: str
    contact_name: str
    outgoing: List[ContactLinkItem]
    incoming: List[ContactLinkItem]


# ----- Graph (for React Flow) -----
class GraphNodeData(BaseModel):
    contact_id: str
    name: str
    contact_type: str  # company | individual
    risk_band: Optional[str] = None
    kyc_status: Optional[str] = None  # complete | incomplete | expiry_warning


class GraphNode(BaseModel):
    id: str  # contact_id
    type: Optional[str] = None
    data: GraphNodeData
    position: Optional[dict] = None


class GraphEdge(BaseModel):
    id: str  # link id or "owner-owned-type"
    source: str  # owner_contact_id
    target: str  # owned_contact_id
    label: Optional[str] = None
    data: Optional[dict] = None  # percentage, link_type, etc.


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    root_contact_id: Optional[str] = None


# ----- Compliance Snapshot -----
class ComplianceSnapshotResponse(BaseModel):
    id: str
    org_id: str
    entity_contact_id: str
    register_type: str
    version_hash: Optional[str] = None
    file_path: Optional[str] = None
    generated_at: datetime
    generated_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateRegisterRequest(BaseModel):
    entity_contact_id: str
    register_type: str  # ubo | partners | directors
    format: str  # pdf | excel


class GenerateRegisterResponse(BaseModel):
    snapshot_id: str
    file_path: str
    register_type: str
    generated_at: datetime


# ----- UBO Resolver -----
class UBOItem(BaseModel):
    contact_id: str
    name: str
    effective_pct: float
    is_control: bool
    is_senior_manager_fallback: bool


class UBOResolverResponse(BaseModel):
    ubos: List[UBOItem]
    effective_ownership: dict
    cycles: List[List[str]]
    warnings: List[str]


# ----- Validation -----
class ValidationResponse(BaseModel):
    ownership_sum_valid: bool
    total_percentage: float
    dead_ends: List[dict]
    cycles: List[List[str]]
    warnings: List[str]


# ----- Dashboard summary -----
class DashboardEntitySummary(BaseModel):
    contact_id: str
    name: str
    contact_type: str
    jurisdiction: Optional[str] = None
    status: str
    ubo_count: int
    ownership_sum_valid: Optional[bool] = None
    has_cycles: bool
    dead_ends_count: int
    kyc_status: Optional[str] = None  # complete | incomplete | expiry_warning
    warnings: List[str] = []


class DashboardSummaryResponse(BaseModel):
    entities: List[DashboardEntitySummary]


# ----- Graph Layout -----
class GraphLayoutSaveRequest(BaseModel):
    root_contact_id: str
    positions: dict  # { "contact_id": { "x": 0, "y": 0 }, ... }


class GraphLayoutResponse(BaseModel):
    root_contact_id: str
    positions: dict


# ----- Compliance Risk -----
class ComplianceRiskResponse(BaseModel):
    id: str
    contact_id: str
    risk_score: Optional[float] = None
    risk_band: Optional[str] = None
    factors_json: Optional[dict] = None
    last_calculated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

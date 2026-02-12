"""Compliance & UBO: ownership links CRUD and graph API.

Endpoints:
- GET/POST /ownership-links, GET/PATCH/DELETE /ownership-links/{id}  - CRUD for ownership/control links
- GET /graph?root_contact_id=  - Ownership graph (nodes + edges) for React Flow
- GET /ubo?entity_contact_id=  - Resolve UBOs (25% + control + senior manager fallback)
- GET /validation?entity_contact_id=  - Validation (100% sum, dead-ends, cycles)
- GET /dashboard-summary  - Entities with UBO count and validation status
- GET/POST /risk/{contact_id}  - Risk score (GET or recalculate)
- POST /registers/generate  - Generate UBO/Partners/Directors register (PDF/Excel), create snapshot
- GET /snapshots  - List snapshots; GET /snapshots/{id}/download  - Download file
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.contact import Contact, ContactType
from models.compliance import OwnershipLink, OwnershipLinkType
from schemas.compliance import (
    OwnershipLinkCreate,
    OwnershipLinkUpdate,
    OwnershipLinkResponse,
    ContactLinkItem,
    ContactLinksResponse,
    GraphNode,
    GraphNodeData,
    GraphEdge,
    GraphResponse,
    UBOItem,
    UBOResolverResponse,
    ComplianceRiskResponse,
    ComplianceSnapshotResponse,
    ValidationResponse,
    DashboardSummaryResponse,
    DashboardEntitySummary,
    GenerateRegisterRequest,
    GenerateRegisterResponse,
    GraphLayoutSaveRequest,
    GraphLayoutResponse,
)
from services.ubo_resolver import resolve_ubos
from services.risk_scoring import score_contact_risk, save_risk
from services.compliance_validation import validate_entity
from services.register_generator import generate_register
from services.kyc_status import get_kyc_status
from models.compliance import ComplianceRisk, ComplianceSnapshot, ComplianceGraphLayout, RiskBand, RegisterType

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


def _link_type_from_str(s: str) -> OwnershipLinkType:
    try:
        return OwnershipLinkType(s.lower().strip())
    except ValueError:
        return OwnershipLinkType.OWNERSHIP


# Inverse label for family when showing on the "to" contact's profile (incoming link)
FAMILY_INVERSE_LABEL = {
    "father": "son",
    "mother": "daughter",
    "child": "parent",
    "spouse": "spouse",
    "sibling": "sibling",
    "dependent": "guardian",
    "other": "other",
}


def _link_to_response(l: OwnershipLink) -> OwnershipLinkResponse:
    return OwnershipLinkResponse(
        id=l.id,
        org_id=l.org_id,
        owner_contact_id=l.owner_contact_id,
        owned_contact_id=l.owned_contact_id,
        link_type=l.link_type.value if l.link_type else "ownership",
        percentage=l.percentage,
        voting_pct=l.voting_pct,
        is_nominee=(l.is_nominee == "true") if l.is_nominee else False,
        start_date=l.start_date,
        end_date=l.end_date,
        role_label=getattr(l, "role_label", None),
        relationship_kind=getattr(l, "relationship_kind", None),
        number_of_shares=getattr(l, "number_of_shares", None),
        share_class=getattr(l, "share_class", None),
        nominal_value_per_share=getattr(l, "nominal_value_per_share", None),
        share_currency=getattr(l, "share_currency", None),
        created_at=l.created_at,
        updated_at=l.updated_at,
    )


@router.get("/ownership-links", response_model=list[OwnershipLinkResponse])
def list_ownership_links(
    owned_contact_id: str | None = Query(None, description="Filter by owned entity"),
    owner_contact_id: str | None = Query(None, description="Filter by owner"),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """List ownership/control links for current org."""
    if not current_user.org_id:
        return []
    q = db.query(OwnershipLink).filter(OwnershipLink.org_id == current_user.org_id)
    if owned_contact_id:
        q = q.filter(OwnershipLink.owned_contact_id == owned_contact_id)
    if owner_contact_id:
        q = q.filter(OwnershipLink.owner_contact_id == owner_contact_id)
    links = q.order_by(OwnershipLink.updated_at.desc()).all()
    return [_link_to_response(l) for l in links]


@router.post("/ownership-links", response_model=OwnershipLinkResponse, status_code=status.HTTP_201_CREATED)
def create_ownership_link(
    body: OwnershipLinkCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Create an ownership or control link."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    owner = db.query(Contact).filter(
        Contact.id == body.owner_contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner contact not found")
    owned = db.query(Contact).filter(
        Contact.id == body.owned_contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Owned contact not found")
    link_type = _link_type_from_str(body.link_type)
    if link_type == OwnershipLinkType.FAMILY and not (body.relationship_kind or "").strip():
        raise HTTPException(status_code=400, detail="relationship_kind is required when link_type is family")
    if link_type == OwnershipLinkType.FAMILY:
        if owner.contact_type != ContactType.INDIVIDUAL or owned.contact_type != ContactType.INDIVIDUAL:
            raise HTTPException(status_code=400, detail="Family links must be between two individuals")
    if link_type == OwnershipLinkType.EMPLOYEE:
        if owner.contact_type != ContactType.INDIVIDUAL or owned.contact_type != ContactType.COMPANY:
            raise HTTPException(status_code=400, detail="Employee links must be from an individual to a company")
    link = OwnershipLink(
        org_id=current_user.org_id,
        owner_contact_id=body.owner_contact_id,
        owned_contact_id=body.owned_contact_id,
        link_type=link_type,
        percentage=body.percentage,
        voting_pct=body.voting_pct,
        is_nominee="true" if body.is_nominee else "false",
        start_date=body.start_date,
        end_date=body.end_date,
        role_label=body.role_label,
        relationship_kind=body.relationship_kind,
        number_of_shares=body.number_of_shares,
        share_class=body.share_class,
        nominal_value_per_share=body.nominal_value_per_share,
        share_currency=body.share_currency,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _link_to_response(link)


@router.get("/ownership-links/{link_id}", response_model=OwnershipLinkResponse)
def get_ownership_link(
    link_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get a single ownership link."""
    link = db.query(OwnershipLink).filter(
        OwnershipLink.id == link_id,
        OwnershipLink.org_id == current_user.org_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    return _link_to_response(link)


@router.patch("/ownership-links/{link_id}", response_model=OwnershipLinkResponse)
def update_ownership_link(
    link_id: str,
    body: OwnershipLinkUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update an ownership link."""
    link = db.query(OwnershipLink).filter(
        OwnershipLink.id == link_id,
        OwnershipLink.org_id == current_user.org_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if body.link_type is not None:
        link.link_type = _link_type_from_str(body.link_type)
    if body.percentage is not None:
        link.percentage = body.percentage
    if body.voting_pct is not None:
        link.voting_pct = body.voting_pct
    if body.is_nominee is not None:
        link.is_nominee = "true" if body.is_nominee else "false"
    if body.start_date is not None:
        link.start_date = body.start_date
    if body.end_date is not None:
        link.end_date = body.end_date
    if body.role_label is not None:
        link.role_label = body.role_label
    if body.relationship_kind is not None:
        link.relationship_kind = body.relationship_kind
    if body.number_of_shares is not None:
        link.number_of_shares = body.number_of_shares
    if body.share_class is not None:
        link.share_class = body.share_class
    if body.nominal_value_per_share is not None:
        link.nominal_value_per_share = body.nominal_value_per_share
    if body.share_currency is not None:
        link.share_currency = body.share_currency
    db.commit()
    db.refresh(link)
    return _link_to_response(link)


@router.get("/contact-links", response_model=ContactLinksResponse)
def get_contact_links(
    contact_id: str = Query(..., description="Contact to get outgoing and incoming links for"),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get all links for a contact: outgoing (where they are connected) and incoming (who is connected to them). Includes inverse_label for family when viewing incoming."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    outgoing_links = db.query(OwnershipLink).filter(
        OwnershipLink.org_id == current_user.org_id,
        OwnershipLink.owner_contact_id == contact_id,
    ).all()
    incoming_links = db.query(OwnershipLink).filter(
        OwnershipLink.org_id == current_user.org_id,
        OwnershipLink.owned_contact_id == contact_id,
    ).all()
    contact_ids = set()
    for l in outgoing_links:
        contact_ids.add(l.owned_contact_id)
    for l in incoming_links:
        contact_ids.add(l.owner_contact_id)
    contacts_map = {}
    if contact_ids:
        for c in db.query(Contact).filter(Contact.id.in_(contact_ids), Contact.org_id == current_user.org_id).all():
            contacts_map[c.id] = c

    def make_item(link: OwnershipLink, direction: str, other_id: str) -> ContactLinkItem:
        other = contacts_map.get(other_id)
        other_name = other.name if other else other_id
        other_type = (other.contact_type.value if other and other.contact_type else "company")
        inv_label = None
        if direction == "incoming" and link.link_type == OwnershipLinkType.FAMILY and link.relationship_kind:
            inv_label = FAMILY_INVERSE_LABEL.get((link.relationship_kind or "").lower(), link.relationship_kind)
        return ContactLinkItem(
            link_id=link.id,
            direction=direction,
            other_contact_id=other_id,
            other_contact_name=other_name,
            other_contact_type=other_type,
            link_type=link.link_type.value if link.link_type else "ownership",
            percentage=link.percentage,
            voting_pct=link.voting_pct,
            role_label=getattr(link, "role_label", None),
            relationship_kind=getattr(link, "relationship_kind", None),
            inverse_label=inv_label,
            number_of_shares=getattr(link, "number_of_shares", None),
            share_class=getattr(link, "share_class", None),
            nominal_value_per_share=getattr(link, "nominal_value_per_share", None),
            share_currency=getattr(link, "share_currency", None),
            start_date=link.start_date,
            end_date=link.end_date,
        )

    outgoing = [make_item(l, "outgoing", l.owned_contact_id) for l in outgoing_links]
    incoming = [make_item(l, "incoming", l.owner_contact_id) for l in incoming_links]
    return ContactLinksResponse(
        contact_id=contact_id,
        contact_name=contact.name,
        outgoing=outgoing,
        incoming=incoming,
    )


@router.delete("/ownership-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ownership_link(
    link_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Delete an ownership link."""
    link = db.query(OwnershipLink).filter(
        OwnershipLink.id == link_id,
        OwnershipLink.org_id == current_user.org_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return None


_COMPLIANCE_GRAPH_LINK_TYPES = (OwnershipLinkType.OWNERSHIP, OwnershipLinkType.CONTROL, OwnershipLinkType.DIRECTOR, OwnershipLinkType.MANAGES)


def _collect_graph_contacts(
    db: Session,
    org_id: str,
    root_contact_id: str,
    visited: set,
    max_depth: int = 20,
    depth: int = 0,
) -> set:
    """Recursively collect contact IDs reachable via ownership/control/director/manages only (no employee/family)."""
    if depth >= max_depth or root_contact_id in visited:
        return visited
    visited.add(root_contact_id)
    owned_links = db.query(OwnershipLink).filter(
        OwnershipLink.org_id == org_id,
        OwnershipLink.owned_contact_id == root_contact_id,
    ).all()
    for l in owned_links:
        if l.link_type in _COMPLIANCE_GRAPH_LINK_TYPES:
            _collect_graph_contacts(db, org_id, l.owner_contact_id, visited, max_depth, depth + 1)
    owner_links = db.query(OwnershipLink).filter(
        OwnershipLink.org_id == org_id,
        OwnershipLink.owner_contact_id == root_contact_id,
    ).all()
    for l in owner_links:
        if l.link_type in _COMPLIANCE_GRAPH_LINK_TYPES:
            _collect_graph_contacts(db, org_id, l.owned_contact_id, visited, max_depth, depth + 1)
    return visited


@router.get("/graph", response_model=GraphResponse)
def get_ownership_graph(
    root_contact_id: str = Query(..., description="Entity (contact) ID to build graph from"),
    include_all_links: bool = Query(False, description="Include employee/family links in graph"),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get ownership graph for React Flow: nodes (contacts) and edges (ownership links)."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    root = db.query(Contact).filter(
        Contact.id == root_contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not root:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact_ids = _collect_graph_contacts(db, current_user.org_id, root_contact_id, set())
    if not contact_ids:
        contact_ids = {root_contact_id}
    contacts = db.query(Contact).filter(
        Contact.org_id == current_user.org_id,
        Contact.id.in_(contact_ids),
    ).all()
    contact_map = {c.id: c for c in contacts}
    # Pre-load risk bands for all contacts in the graph
    risk_map = {}
    risk_rows = db.query(ComplianceRisk).filter(
        ComplianceRisk.org_id == current_user.org_id,
        ComplianceRisk.contact_id.in_(contact_ids),
    ).all()
    for r in risk_rows:
        risk_map[r.contact_id] = r.risk_band.value if r.risk_band else None
    nodes = []
    for c in contacts:
        kyc = get_kyc_status(db, current_user.org_id, c.id)
        nodes.append(GraphNode(
            id=c.id,
            type="default",
            data=GraphNodeData(
                contact_id=c.id,
                name=c.name,
                contact_type=c.contact_type.value if c.contact_type else "company",
                risk_band=risk_map.get(c.id),
                kyc_status=kyc["status"],
            ),
            position={"x": 0, "y": 0},
        ))
    links = db.query(OwnershipLink).filter(
        OwnershipLink.org_id == current_user.org_id,
        OwnershipLink.owner_contact_id.in_(contact_ids),
        OwnershipLink.owned_contact_id.in_(contact_ids),
    ).all()
    if not include_all_links:
        links = [l for l in links if l.link_type in _COMPLIANCE_GRAPH_LINK_TYPES]
    edges = []
    for l in links:
        label = ""
        if l.percentage is not None:
            label = f"{l.percentage:.0f}%"
        elif l.voting_pct is not None:
            label = f"Vote {l.voting_pct:.0f}%"
        edges.append(GraphEdge(
            id=l.id,
            source=l.owner_contact_id,
            target=l.owned_contact_id,
            label=label or None,
            data={"percentage": l.percentage, "link_type": l.link_type.value if l.link_type else "ownership", "voting_pct": l.voting_pct},
        ))
    # Load saved positions if available
    layout = db.query(ComplianceGraphLayout).filter(
        ComplianceGraphLayout.org_id == current_user.org_id,
        ComplianceGraphLayout.root_contact_id == root_contact_id,
    ).first()
    saved_positions = layout.positions_json if layout else {}
    for node in nodes:
        if node.id in saved_positions:
            node.position = saved_positions[node.id]

    return GraphResponse(nodes=nodes, edges=edges, root_contact_id=root_contact_id)


# ----- Graph Layout -----
@router.post("/graph/layout", response_model=GraphLayoutResponse)
def save_graph_layout(
    body: GraphLayoutSaveRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Save node positions for an ownership graph."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    layout = db.query(ComplianceGraphLayout).filter(
        ComplianceGraphLayout.org_id == current_user.org_id,
        ComplianceGraphLayout.root_contact_id == body.root_contact_id,
    ).first()
    if layout:
        layout.positions_json = body.positions
    else:
        layout = ComplianceGraphLayout(
            org_id=current_user.org_id,
            root_contact_id=body.root_contact_id,
            positions_json=body.positions,
        )
        db.add(layout)
    db.commit()
    return GraphLayoutResponse(root_contact_id=body.root_contact_id, positions=body.positions)


@router.get("/graph/layout", response_model=GraphLayoutResponse)
def get_graph_layout(
    root_contact_id: str = Query(..., description="Root entity contact ID"),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Load saved node positions for an ownership graph."""
    layout = db.query(ComplianceGraphLayout).filter(
        ComplianceGraphLayout.org_id == current_user.org_id,
        ComplianceGraphLayout.root_contact_id == root_contact_id,
    ).first()
    if not layout:
        return GraphLayoutResponse(root_contact_id=root_contact_id, positions={})
    return GraphLayoutResponse(root_contact_id=root_contact_id, positions=layout.positions_json)


# ----- UBO Resolver -----
@router.get("/ubo", response_model=UBOResolverResponse)
def get_ubo_list(
    entity_contact_id: str = Query(..., description="Company (contact) ID to resolve UBOs for"),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Resolve UBOs for the given entity per UAE Cabinet Decision 109/2023 (25% + control + senior manager fallback)."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    entity = db.query(Contact).filter(
        Contact.id == entity_contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    senior_id = getattr(entity, "senior_manager_contact_id", None)
    result = resolve_ubos(db, current_user.org_id, entity_contact_id, senior_manager_contact_id=senior_id)
    return UBOResolverResponse(
        ubos=[UBOItem(**u) for u in result["ubos"]],
        effective_ownership=result["effective_ownership"],
        cycles=result["cycles"],
        warnings=result["warnings"],
    )


# ----- Risk Scoring -----
@router.get("/risk/{contact_id}", response_model=ComplianceRiskResponse)
def get_risk(
    contact_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get stored risk for a contact, or compute and store if missing."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    risk = db.query(ComplianceRisk).filter(
        ComplianceRisk.org_id == current_user.org_id,
        ComplianceRisk.contact_id == contact_id,
    ).first()
    if not risk:
        result = score_contact_risk(db, current_user.org_id, contact_id)
        risk = save_risk(db, current_user.org_id, contact_id, result)
    return ComplianceRiskResponse(
        id=risk.id,
        contact_id=risk.contact_id,
        risk_score=risk.risk_score,
        risk_band=risk.risk_band.value if risk.risk_band else None,
        factors_json=risk.factors_json,
        last_calculated_at=risk.last_calculated_at,
    )


@router.get("/validation", response_model=ValidationResponse)
def get_validation(
    entity_contact_id: str = Query(..., description="Entity to validate"),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Validate ownership structure: 100% sum, no dead-ends, no cycles."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    contact = db.query(Contact).filter(
        Contact.id == entity_contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Entity not found")
    result = validate_entity(db, current_user.org_id, entity_contact_id)
    return ValidationResponse(
        ownership_sum_valid=result["ownership_sum_valid"],
        total_percentage=result["total_percentage"],
        dead_ends=result["dead_ends"],
        cycles=result["cycles"],
        warnings=result["warnings"],
    )


@router.get("/dashboard-summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Summary of all companies with UBO count and validation status for compliance dashboard."""
    if not current_user.org_id:
        return DashboardSummaryResponse(entities=[])
    companies = db.query(Contact).filter(
        Contact.org_id == current_user.org_id,
        Contact.contact_type == ContactType.COMPANY,
    ).order_by(Contact.name).all()
    entities = []
    for c in companies:
        ubo_result = resolve_ubos(db, current_user.org_id, c.id, getattr(c, "senior_manager_contact_id", None))
        val = validate_entity(db, current_user.org_id, c.id)
        kyc = get_kyc_status(db, current_user.org_id, c.id)
        entities.append(DashboardEntitySummary(
            contact_id=c.id,
            name=c.name,
            contact_type=c.contact_type.value,
            jurisdiction=c.jurisdiction,
            status=c.status.value if c.status else "active",
            ubo_count=len(ubo_result["ubos"]),
            ownership_sum_valid=val["ownership_sum_valid"],
            has_cycles=len(val["cycles"]) > 0,
            dead_ends_count=len(val["dead_ends"]),
            kyc_status=kyc["status"],
            warnings=ubo_result["warnings"] + val["warnings"],
        ))
    return DashboardSummaryResponse(entities=entities)


@router.post("/risk/{contact_id}/recalculate", response_model=ComplianceRiskResponse)
def recalculate_risk(
    contact_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Recalculate and store risk score for a contact."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    result = score_contact_risk(db, current_user.org_id, contact_id)
    risk = save_risk(db, current_user.org_id, contact_id, result)
    return ComplianceRiskResponse(
        id=risk.id,
        contact_id=risk.contact_id,
        risk_score=risk.risk_score,
        risk_band=risk.risk_band.value if risk.risk_band else None,
        factors_json=risk.factors_json,
        last_calculated_at=risk.last_calculated_at,
    )


# ----- Register generation & snapshots -----
@router.post("/registers/generate", response_model=GenerateRegisterResponse)
def post_generate_register(
    body: GenerateRegisterRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Generate Register of UBOs, Partners, or Directors (PDF or Excel); create snapshot and return download info."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    contact = db.query(Contact).filter(
        Contact.id == body.entity_contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Entity not found")
    try:
        snapshot = generate_register(
            db,
            current_user.org_id,
            body.entity_contact_id,
            body.register_type,
            body.format,
            generated_by=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return GenerateRegisterResponse(
        snapshot_id=snapshot.id,
        file_path=snapshot.file_path or "",
        register_type=snapshot.register_type.value,
        generated_at=snapshot.generated_at,
    )


@router.get("/snapshots", response_model=list[ComplianceSnapshotResponse])
def list_snapshots(
    entity_contact_id: str | None = Query(None),
    register_type: str | None = Query(None),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """List compliance snapshots (generated registers) for the org."""
    if not current_user.org_id:
        return []
    q = db.query(ComplianceSnapshot).filter(ComplianceSnapshot.org_id == current_user.org_id)
    if entity_contact_id:
        q = q.filter(ComplianceSnapshot.entity_contact_id == entity_contact_id)
    if register_type:
        try:
            q = q.filter(ComplianceSnapshot.register_type == RegisterType(register_type))
        except ValueError:
            pass
    snapshots = q.order_by(ComplianceSnapshot.generated_at.desc()).limit(100).all()
    return [
        ComplianceSnapshotResponse(
            id=s.id,
            org_id=s.org_id,
            entity_contact_id=s.entity_contact_id,
            register_type=s.register_type.value,
            version_hash=s.version_hash,
            file_path=s.file_path,
            generated_at=s.generated_at,
            generated_by=s.generated_by,
            created_at=s.created_at,
        )
        for s in snapshots
    ]


@router.get("/snapshots/{snapshot_id}/download")
def download_snapshot(
    snapshot_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Download the generated register file for a snapshot."""
    snapshot = db.query(ComplianceSnapshot).filter(
        ComplianceSnapshot.id == snapshot_id,
        ComplianceSnapshot.org_id == current_user.org_id,
    ).first()
    if not snapshot or not snapshot.file_path:
        raise HTTPException(status_code=404, detail="Snapshot or file not found")
    base = Path(__file__).resolve().parent.parent
    full_path = base / snapshot.file_path
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")
    media_type = "application/pdf" if full_path.suffix.lower() == ".pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return FileResponse(full_path, media_type=media_type, filename=full_path.name)

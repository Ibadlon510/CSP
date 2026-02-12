"""CRM API - leads, contacts, opportunities."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.lead import Lead, LeadStatus
from models.crm_contact import CrmContact
from models.opportunity import Opportunity, OpportunityStage
from schemas.crm import (
    LeadCreate, LeadUpdate, LeadResponse,
    CrmContactCreate, CrmContactUpdate, CrmContactResponse,
    OpportunityCreate, OpportunityUpdate, OpportunityResponse,
)

router = APIRouter(prefix="/api/crm", tags=["CRM"])


def _lead_response(l: Lead) -> LeadResponse:
    return LeadResponse(
        id=l.id, org_id=l.org_id, name=l.name, email=l.email, phone=l.phone,
        source=l.source, status=l.status, assigned_to=l.assigned_to, notes=l.notes,
        created_at=l.created_at,
    )


def _crm_contact_response(c: CrmContact) -> CrmContactResponse:
    return CrmContactResponse(
        id=c.id, org_id=c.org_id, contact_id=c.contact_id, lead_id=c.lead_id,
        name=c.name, email=c.email, phone=c.phone, role=c.role, created_at=c.created_at,
    )


def _opportunity_response(o: Opportunity, db: Session | None = None) -> OpportunityResponse:
    assigned_name = None
    contact_name = None
    if db and o.assigned_to:
        u = db.query(User).filter(User.id == o.assigned_to).first()
        if u:
            assigned_name = u.full_name
    if db and o.contact_id:
        from models.contact import Contact
        c = db.query(Contact).filter(Contact.id == o.contact_id).first()
        if c:
            contact_name = c.name
    return OpportunityResponse(
        id=o.id, org_id=o.org_id, contact_id=o.contact_id, lead_id=o.lead_id,
        name=o.name, amount=o.amount, stage=o.stage, probability=o.probability,
        expected_close_date=o.expected_close_date, assigned_to=o.assigned_to,
        assigned_to_name=assigned_name, contact_name=contact_name,
        created_at=o.created_at,
    )


# --- Leads ---
@router.get("/leads", response_model=list[LeadResponse])
def list_leads(
    search: str | None = None,
    status: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(Lead).filter(Lead.org_id == current_user.org_id)
    if search:
        q = q.filter(or_(Lead.name.ilike(f"%{search}%"), Lead.email.ilike(f"%{search}%")))
    if status:
        q = q.filter(Lead.status == status)
    leads = q.order_by(Lead.created_at.desc()).all()
    return [_lead_response(l) for l in leads]


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(
    body: LeadCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    lead = Lead(
        org_id=current_user.org_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        source=body.source,
        status=body.status or LeadStatus.NEW,
        assigned_to=body.assigned_to,
        notes=body.notes,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_response(lead)


@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.org_id == current_user.org_id,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _lead_response(lead)


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: str,
    body: LeadUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.org_id == current_user.org_id,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lead, k, v)
    db.commit()
    db.refresh(lead)
    return _lead_response(lead)


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.org_id == current_user.org_id,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return None


# --- CrmContacts ---
@router.get("/contacts", response_model=list[CrmContactResponse])
def list_crm_contacts(
    contact_id: str | None = None,
    lead_id: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(CrmContact).filter(CrmContact.org_id == current_user.org_id)
    if contact_id:
        q = q.filter(CrmContact.contact_id == contact_id)
    if lead_id:
        q = q.filter(CrmContact.lead_id == lead_id)
    contacts = q.order_by(CrmContact.name).all()
    return [_crm_contact_response(c) for c in contacts]


@router.post("/contacts", response_model=CrmContactResponse, status_code=status.HTTP_201_CREATED)
def create_crm_contact(
    body: CrmContactCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    c = CrmContact(
        org_id=current_user.org_id,
        contact_id=body.contact_id,
        lead_id=body.lead_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        role=body.role,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _crm_contact_response(c)


# --- Opportunities (Pipeline) ---
@router.get("/opportunities", response_model=list[OpportunityResponse])
def list_opportunities(
    stage: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(Opportunity).filter(Opportunity.org_id == current_user.org_id)
    if stage:
        q = q.filter(Opportunity.stage == stage)
    opps = q.order_by(Opportunity.expected_close_date.desc().nullslast(), Opportunity.created_at.desc()).all()
    return [_opportunity_response(o, db) for o in opps]


@router.post("/opportunities", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    body: OpportunityCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    o = Opportunity(
        org_id=current_user.org_id,
        contact_id=body.contact_id,
        lead_id=body.lead_id,
        name=body.name,
        amount=body.amount,
        stage=body.stage or OpportunityStage.LEAD,
        probability=body.probability,
        expected_close_date=body.expected_close_date,
        assigned_to=body.assigned_to,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return _opportunity_response(o, db)


@router.patch("/opportunities/{opp_id}", response_model=OpportunityResponse)
def update_opportunity(
    opp_id: str,
    body: OpportunityUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    o = db.query(Opportunity).filter(
        Opportunity.id == opp_id,
        Opportunity.org_id == current_user.org_id,
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return _opportunity_response(o, db)


@router.delete("/opportunities/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity(
    opp_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    o = db.query(Opportunity).filter(
        Opportunity.id == opp_id,
        Opportunity.org_id == current_user.org_id,
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    db.delete(o)
    db.commit()
    return None

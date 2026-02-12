"""Sales Quotations API."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.quotation import Quotation, QuotationLine, QuotationStatus
from models.contact import Contact
from models.lead import Lead
from models.opportunity import Opportunity
from schemas.quotation import QuotationCreate, QuotationUpdate, QuotationResponse, QuotationLineResponse
from services.number_sequence import next_quotation_number

router = APIRouter(prefix="/api/quotations", tags=["Quotations"])


def _quotation_response(q):
    lines = [
        QuotationLineResponse(
            id=l.id, quotation_id=l.quotation_id, product_id=getattr(l, "product_id", None),
            product_name=l.product.name if getattr(l, "product", None) else None,
            description=l.description, quantity=l.quantity, unit_price=l.unit_price, vat_rate=l.vat_rate,
            amount=l.amount, created_at=l.created_at,
        )
        for l in q.lines
    ]
    return QuotationResponse(
        id=q.id, org_id=q.org_id, number=q.number, contact_id=getattr(q, "contact_id", None), contact_name=q.contact.name if q.contact else None,
        lead_id=q.lead_id, lead_name=q.lead.name if getattr(q, "lead", None) else None,
        opportunity_id=getattr(q, "opportunity_id", None), opportunity_name=q.opportunity.name if getattr(q, "opportunity", None) else None,
        status=q.status, valid_until=q.valid_until, total=q.total, vat_amount=q.vat_amount,
        created_by=q.created_by, created_by_name=q.creator.full_name if getattr(q, "creator", None) else None,
        created_at=q.created_at, lines=lines,
    )


@router.get("/", response_model=list[QuotationResponse])
def list_quotations(
    status: str | None = None,
    contact_id: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(Quotation).filter(Quotation.org_id == current_user.org_id).options(
        joinedload(Quotation.lines), joinedload(Quotation.contact),
        joinedload(Quotation.lead), joinedload(Quotation.opportunity), joinedload(Quotation.creator),
    )
    if status:
        q = q.filter(Quotation.status == status)
    if contact_id:
        q = q.filter(Quotation.contact_id == contact_id)
    quotations = q.order_by(Quotation.created_at.desc()).all()
    return [_quotation_response(qu) for qu in quotations]


@router.post("/", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
def create_quotation(
    body: QuotationCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    if body.contact_id:
        c = db.query(Contact).filter(
            Contact.id == body.contact_id,
            Contact.org_id == current_user.org_id,
        ).first()
        if not c:
            raise HTTPException(status_code=404, detail="Contact not found")
    if body.lead_id:
        l = db.query(Lead).filter(
            Lead.id == body.lead_id,
            Lead.org_id == current_user.org_id,
        ).first()
        if not l:
            raise HTTPException(status_code=404, detail="Lead not found")
    if body.opportunity_id:
        opp = db.query(Opportunity).filter(
            Opportunity.id == body.opportunity_id,
            Opportunity.org_id == current_user.org_id,
        ).first()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")

    number = next_quotation_number(db, current_user.org_id, Quotation)
    q = Quotation(
        org_id=current_user.org_id,
        number=number,
        contact_id=body.contact_id,
        lead_id=body.lead_id,
        opportunity_id=body.opportunity_id,
        status=QuotationStatus.DRAFT,
        valid_until=body.valid_until,
        total=Decimal("0"),
        vat_amount=Decimal("0"),
        created_by=current_user.id,
    )
    db.add(q)
    db.flush()

    total = Decimal("0")
    vat_total = Decimal("0")
    for line_in in body.lines:
        vat_amt = (line_in.quantity * line_in.unit_price * line_in.vat_rate / 100).quantize(Decimal("0.01"))
        amt = (line_in.quantity * line_in.unit_price + vat_amt).quantize(Decimal("0.01"))
        ln = QuotationLine(
            quotation_id=q.id,
            product_id=line_in.product_id if hasattr(line_in, "product_id") else None,
            description=line_in.description,
            quantity=line_in.quantity,
            unit_price=line_in.unit_price,
            vat_rate=line_in.vat_rate,
            amount=amt,
        )
        db.add(ln)
        total += amt
        vat_total += vat_amt

    q.total = total
    q.vat_amount = vat_total
    db.commit()
    db.refresh(q)
    q = db.query(Quotation).options(
        joinedload(Quotation.lines), joinedload(Quotation.contact),
        joinedload(Quotation.lead), joinedload(Quotation.opportunity), joinedload(Quotation.creator),
    ).filter(Quotation.id == q.id).first()
    return _quotation_response(q)


@router.get("/{quotation_id}", response_model=QuotationResponse)
def get_quotation(
    quotation_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    q = db.query(Quotation).options(
        joinedload(Quotation.lines), joinedload(Quotation.contact),
        joinedload(Quotation.lead), joinedload(Quotation.opportunity), joinedload(Quotation.creator),
    ).filter(
        Quotation.id == quotation_id,
        Quotation.org_id == current_user.org_id,
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _quotation_response(q)


@router.patch("/{quotation_id}", response_model=QuotationResponse)
def update_quotation(
    quotation_id: str,
    body: QuotationUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    q = db.query(Quotation).options(
        joinedload(Quotation.lines), joinedload(Quotation.contact),
        joinedload(Quotation.lead), joinedload(Quotation.opportunity), joinedload(Quotation.creator),
    ).filter(
        Quotation.id == quotation_id,
        Quotation.org_id == current_user.org_id,
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    data = body.model_dump(exclude_unset=True)
    new_lines = data.pop("lines", None)

    for k, v in data.items():
        setattr(q, k, v)

    # Replace lines if provided
    if new_lines is not None:
        # Delete existing lines
        for old_line in list(q.lines):
            db.delete(old_line)
        db.flush()

        total = Decimal("0")
        vat_total = Decimal("0")
        for line_in in body.lines:
            vat_amt = (line_in.quantity * line_in.unit_price * line_in.vat_rate / 100).quantize(Decimal("0.01"))
            amt = (line_in.quantity * line_in.unit_price + vat_amt).quantize(Decimal("0.01"))
            ln = QuotationLine(
                quotation_id=q.id,
                product_id=line_in.product_id,
                description=line_in.description,
                quantity=line_in.quantity,
                unit_price=line_in.unit_price,
                vat_rate=line_in.vat_rate,
                amount=amt,
            )
            db.add(ln)
            total += amt
            vat_total += vat_amt

        q.total = total
        q.vat_amount = vat_total

    db.commit()
    db.refresh(q)
    q = db.query(Quotation).options(
        joinedload(Quotation.lines), joinedload(Quotation.contact),
        joinedload(Quotation.lead), joinedload(Quotation.opportunity), joinedload(Quotation.creator),
    ).filter(Quotation.id == q.id).first()
    return _quotation_response(q)

"""Sales Orders API."""
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.sales_order import SalesOrder, SalesOrderLine, SalesOrderStatus
from models.quotation import Quotation, QuotationStatus
from models.contact import Contact
from models.lead import Lead
from models.opportunity import Opportunity
from models.invoice import Invoice, InvoiceLine, InvoiceStatus
from models.project import Project, ProjectStatus
from models.product import Product
from schemas.sales_order import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderLineResponse
from services.number_sequence import next_order_number, next_invoice_number
from services.workflow import create_tasks_from_product_templates

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def _order_response(o, db=None):
    lines = [
        SalesOrderLineResponse(
            id=l.id, sales_order_id=l.sales_order_id, product_id=getattr(l, "product_id", None),
            product_name=l.product.name if getattr(l, "product", None) else None,
            description=l.description, quantity=l.quantity, unit_price=l.unit_price,
            vat_rate=getattr(l, "vat_rate", Decimal("0")) or Decimal("0"),
            amount=l.amount,
            unit_cost=getattr(l, "unit_cost", Decimal("0")) or Decimal("0"),
            commission_attrib=getattr(l, "commission_attrib", None),
            created_at=l.created_at,
        )
        for l in o.lines
    ]
    # Look up linked invoice and project
    linked_project_id = None
    linked_invoice_id = None
    if db:
        inv = db.query(Invoice).filter(Invoice.sales_order_id == o.id).first()
        if inv:
            linked_invoice_id = inv.id
        proj = db.query(Project).filter(Project.sales_order_id == o.id).first()
        if proj:
            linked_project_id = proj.id
    return SalesOrderResponse(
        id=o.id, org_id=o.org_id, number=o.number, contact_id=getattr(o, "contact_id", None), contact_name=o.contact.name if o.contact else None,
        quotation_id=o.quotation_id, quotation_number=o.quotation.number if getattr(o, "quotation", None) else None,
        lead_id=getattr(o, "lead_id", None), lead_name=o.lead.name if getattr(o, "lead", None) else None,
        opportunity_id=getattr(o, "opportunity_id", None), opportunity_name=o.opportunity.name if getattr(o, "opportunity", None) else None,
        created_by=getattr(o, "created_by", None), created_by_name=o.creator.full_name if getattr(o, "creator", None) else None,
        status=o.status, confirmed_at=getattr(o, "confirmed_at", None),
        discount_mode=getattr(o, "discount_mode", "amount") or "amount",
        order_discount_amount=getattr(o, "order_discount_amount", Decimal("0")) or Decimal("0"),
        order_discount_percent=getattr(o, "order_discount_percent", Decimal("0")) or Decimal("0"),
        created_at=o.created_at, lines=lines,
        project_id=linked_project_id,
        invoice_id=linked_invoice_id,
    )


@router.get("/", response_model=list[SalesOrderResponse])
def list_orders(
    status: str | None = None,
    contact_id: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(SalesOrder).filter(SalesOrder.org_id == current_user.org_id).options(
        joinedload(SalesOrder.lines), joinedload(SalesOrder.contact),
        joinedload(SalesOrder.lead), joinedload(SalesOrder.opportunity), joinedload(SalesOrder.quotation), joinedload(SalesOrder.creator),
    )
    if status:
        q = q.filter(SalesOrder.status == status)
    if contact_id:
        q = q.filter(SalesOrder.contact_id == contact_id)
    orders = q.order_by(SalesOrder.created_at.desc()).all()
    return [_order_response(o, db) for o in orders]


@router.post("/", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    body: SalesOrderCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    contact = db.query(Contact).filter(
        Contact.id == body.contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    quo = None
    if body.quotation_id:
        quo = db.query(Quotation).options(joinedload(Quotation.lines)).filter(
            Quotation.id == body.quotation_id,
            Quotation.org_id == current_user.org_id,
        ).first()
        if not quo:
            raise HTTPException(status_code=404, detail="Quotation not found")
        if quo.status != QuotationStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Quotation must be accepted to create order")

    if not quo and not body.lines:
        raise HTTPException(status_code=400, detail="Provide quotation_id or lines")

    lead_id = body.lead_id
    opportunity_id = body.opportunity_id
    if quo:
        lead_id = quo.lead_id or lead_id
        opportunity_id = quo.opportunity_id or opportunity_id
    if lead_id:
        if not db.query(Lead).filter(Lead.id == lead_id, Lead.org_id == current_user.org_id).first():
            raise HTTPException(status_code=404, detail="Lead not found")
    if opportunity_id:
        if not db.query(Opportunity).filter(Opportunity.id == opportunity_id, Opportunity.org_id == current_user.org_id).first():
            raise HTTPException(status_code=404, detail="Opportunity not found")

    number = next_order_number(db, current_user.org_id, SalesOrder)
    o = SalesOrder(
        org_id=current_user.org_id,
        number=number,
        contact_id=body.contact_id,
        quotation_id=body.quotation_id,
        lead_id=lead_id,
        opportunity_id=opportunity_id,
        status=SalesOrderStatus.PENDING,
        created_by=current_user.id,
    )
    db.add(o)
    db.flush()

    if quo:
        for ql in quo.lines:
            ln = SalesOrderLine(
                sales_order_id=o.id,
                product_id=getattr(ql, "product_id", None),
                description=ql.description,
                quantity=ql.quantity,
                unit_price=ql.unit_price,
                vat_rate=getattr(ql, "vat_rate", Decimal("0")) or Decimal("0"),
                amount=ql.amount,
            )
            db.add(ln)
    else:
        for line_in in body.lines:
            amt = (line_in.quantity * line_in.unit_price).quantize(Decimal("0.01"))
            ln = SalesOrderLine(
                sales_order_id=o.id,
                product_id=line_in.product_id if hasattr(line_in, "product_id") else None,
                description=line_in.description,
                quantity=line_in.quantity,
                unit_price=line_in.unit_price,
                vat_rate=line_in.vat_rate if hasattr(line_in, "vat_rate") else Decimal("0"),
                amount=amt,
            )
            db.add(ln)

    db.commit()
    db.refresh(o)
    o = db.query(SalesOrder).options(
        joinedload(SalesOrder.lines), joinedload(SalesOrder.contact),
        joinedload(SalesOrder.lead), joinedload(SalesOrder.opportunity), joinedload(SalesOrder.quotation), joinedload(SalesOrder.creator),
    ).filter(SalesOrder.id == o.id).first()
    return _order_response(o)


@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_order(
    order_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    o = db.query(SalesOrder).options(
        joinedload(SalesOrder.lines), joinedload(SalesOrder.contact),
        joinedload(SalesOrder.lead), joinedload(SalesOrder.opportunity), joinedload(SalesOrder.quotation), joinedload(SalesOrder.creator),
    ).filter(
        SalesOrder.id == order_id,
        SalesOrder.org_id == current_user.org_id,
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_response(o, db)


@router.patch("/{order_id}", response_model=SalesOrderResponse)
def update_order(
    order_id: str,
    body: SalesOrderUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    o = db.query(SalesOrder).options(
        joinedload(SalesOrder.lines), joinedload(SalesOrder.contact),
        joinedload(SalesOrder.lead), joinedload(SalesOrder.opportunity), joinedload(SalesOrder.quotation), joinedload(SalesOrder.creator),
    ).filter(
        SalesOrder.id == order_id,
        SalesOrder.org_id == current_user.org_id,
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    data = body.model_dump(exclude_unset=True)
    line_updates = data.pop("line_updates", None)

    # Validate discount_mode
    if "discount_mode" in data and data["discount_mode"] not in ("amount", "percent"):
        raise HTTPException(status_code=400, detail="discount_mode must be 'amount' or 'percent'")

    # Apply simple order-level fields
    for k, v in data.items():
        setattr(o, k, v)

    # Apply line-level SOV updates (unit_cost, commission_attrib)
    if line_updates:
        line_map = {l.id: l for l in o.lines}
        for lu in line_updates:
            line = line_map.get(lu["line_id"])
            if not line:
                raise HTTPException(status_code=400, detail=f"Line {lu['line_id']} not found on this order")
            if "unit_cost" in lu and lu["unit_cost"] is not None:
                if lu["unit_cost"] < 0:
                    raise HTTPException(status_code=400, detail="unit_cost must be non-negative")
                line.unit_cost = lu["unit_cost"]
            if "commission_attrib" in lu and lu["commission_attrib"] is not None:
                line.commission_attrib = lu["commission_attrib"]

    db.commit()
    db.refresh(o)
    return _order_response(o, db)


class ConfirmOrderResponse(SalesOrderResponse):
    """Order response plus invoice and project created by confirm."""
    confirmed_invoice_id: str | None = None
    confirmed_project_id: str | None = None


@router.post("/{order_id}/confirm", response_model=ConfirmOrderResponse)
def confirm_order(
    order_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """
    Confirm sales order: create invoice from order, then if any line product has creates_project
    create one project with tasks from product templates. One invoice per SO; second confirm returns 400.
    """
    o = (
        db.query(SalesOrder)
        .options(
            joinedload(SalesOrder.lines), joinedload(SalesOrder.contact),
            joinedload(SalesOrder.lead), joinedload(SalesOrder.opportunity), joinedload(SalesOrder.quotation), joinedload(SalesOrder.creator),
        )
        .filter(SalesOrder.id == order_id, SalesOrder.org_id == current_user.org_id)
        .first()
    )
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.status == SalesOrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot confirm cancelled order")
    existing = db.query(Invoice).filter(
        Invoice.sales_order_id == order_id,
        Invoice.org_id == current_user.org_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Order already confirmed",
        )
    if not o.contact_id:
        raise HTTPException(status_code=400, detail="Order has no contact; set contact before confirming")
    org_id = current_user.org_id
    number = next_invoice_number(db, org_id, Invoice)
    inv = Invoice(
        org_id=org_id,
        number=number,
        contact_id=o.contact_id,
        sales_order_id=o.id,
        lead_id=getattr(o, "lead_id", None),
        opportunity_id=getattr(o, "opportunity_id", None),
        status=InvoiceStatus.DRAFT,
        total=Decimal("0"),
        vat_amount=Decimal("0"),
        created_by=current_user.id,
    )
    db.add(inv)
    db.flush()
    total_vat = Decimal("0")
    total_excl = Decimal("0")
    for ol in o.lines:
        line_vat_rate = getattr(ol, "vat_rate", Decimal("0")) or Decimal("0")
        line_vat = (ol.amount * line_vat_rate / Decimal("100")).quantize(Decimal("0.01"))
        ln = InvoiceLine(
            invoice_id=inv.id,
            product_id=getattr(ol, "product_id", None),
            description=ol.description,
            quantity=ol.quantity,
            unit_price=ol.unit_price,
            vat_rate=line_vat_rate,
            amount=ol.amount,
        )
        db.add(ln)
        total_excl += ol.amount
        total_vat += line_vat
    inv.total = total_excl + total_vat
    inv.vat_amount = total_vat
    db.flush()
    product_ids_creating_project = set()
    for line in o.lines:
        pid = getattr(line, "product_id", None)
        if not pid:
            continue
        prod = db.query(Product).filter(Product.id == pid, Product.org_id == org_id).first()
        if prod and getattr(prod, "creates_project", False):
            product_ids_creating_project.add(pid)
    project_id = None
    if product_ids_creating_project:
        proj = Project(
            org_id=org_id,
            contact_id=inv.contact_id,
            title=f"Project for {inv.number}",
            invoice_id=inv.id,
            sales_order_id=o.id,
            status=ProjectStatus.PLANNING,
        )
        db.add(proj)
        db.flush()
        create_tasks_from_product_templates(db, org_id, proj.id, list(product_ids_creating_project))
        project_id = proj.id
    o.status = SalesOrderStatus.CONFIRMED
    o.confirmed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(o)
    o = db.query(SalesOrder).options(
        joinedload(SalesOrder.lines), joinedload(SalesOrder.contact),
        joinedload(SalesOrder.lead), joinedload(SalesOrder.opportunity), joinedload(SalesOrder.quotation), joinedload(SalesOrder.creator),
    ).filter(SalesOrder.id == o.id).first()
    resp = _order_response(o, db)
    return ConfirmOrderResponse(
        **resp.model_dump(),
        confirmed_invoice_id=inv.id,
        confirmed_project_id=project_id,
    )

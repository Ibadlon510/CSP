"""Sales Invoices API - with invoice payment -> wallet credit."""
from decimal import Decimal
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.invoice import Invoice, InvoiceLine, InvoiceStatus
from models.sales_order import SalesOrder
from models.contact import Contact
from models.lead import Lead
from models.opportunity import Opportunity
from models.wallet import ClientWallet, Transaction, TransactionType, TransactionStatus
from schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceLineResponse, InvoicePaymentRequest
from services.number_sequence import next_invoice_number

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


def _invoice_response(i):
    lines = [
        InvoiceLineResponse(
            id=l.id, invoice_id=l.invoice_id, product_id=getattr(l, "product_id", None),
            product_name=l.product.name if getattr(l, "product", None) else None,
            description=l.description, quantity=l.quantity, unit_price=l.unit_price,
            vat_rate=getattr(l, "vat_rate", Decimal("0")) or Decimal("0"),
            amount=l.amount, created_at=l.created_at,
        )
        for l in i.lines
    ]
    return InvoiceResponse(
        id=i.id, org_id=i.org_id, number=i.number, contact_id=getattr(i, "contact_id", None), contact_name=i.contact.name if i.contact else None,
        sales_order_id=i.sales_order_id, sales_order_number=i.sales_order.number if getattr(i, "sales_order", None) else None,
        lead_id=getattr(i, "lead_id", None), lead_name=i.lead.name if getattr(i, "lead", None) else None,
        opportunity_id=getattr(i, "opportunity_id", None), opportunity_name=i.opportunity.name if getattr(i, "opportunity", None) else None,
        created_by=getattr(i, "created_by", None), created_by_name=i.creator.full_name if getattr(i, "creator", None) else None,
        status=i.status, due_date=i.due_date, total=i.total, vat_amount=i.vat_amount,
        paid_at=i.paid_at, created_at=i.created_at, lines=lines,
    )


@router.get("/", response_model=list[InvoiceResponse])
def list_invoices(
    status: str | None = None,
    contact_id: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(Invoice).filter(Invoice.org_id == current_user.org_id).options(
        joinedload(Invoice.lines), joinedload(Invoice.contact),
        joinedload(Invoice.sales_order), joinedload(Invoice.lead), joinedload(Invoice.opportunity), joinedload(Invoice.creator),
    )
    if status:
        q = q.filter(Invoice.status == status)
    if contact_id:
        q = q.filter(Invoice.contact_id == contact_id)
    invoices = q.order_by(Invoice.created_at.desc()).all()
    return [_invoice_response(i) for i in invoices]


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    body: InvoiceCreate,
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
    order = None
    if body.sales_order_id:
        order = db.query(SalesOrder).options(joinedload(SalesOrder.lines)).filter(
            SalesOrder.id == body.sales_order_id,
            SalesOrder.org_id == current_user.org_id,
        ).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

    if not order and not body.lines:
        raise HTTPException(status_code=400, detail="Provide sales_order_id or lines")

    lead_id = body.lead_id
    opportunity_id = body.opportunity_id
    if order:
        lead_id = order.lead_id or lead_id
        opportunity_id = order.opportunity_id or opportunity_id
    if lead_id:
        if not db.query(Lead).filter(Lead.id == lead_id, Lead.org_id == current_user.org_id).first():
            raise HTTPException(status_code=404, detail="Lead not found")
    if opportunity_id:
        if not db.query(Opportunity).filter(Opportunity.id == opportunity_id, Opportunity.org_id == current_user.org_id).first():
            raise HTTPException(status_code=404, detail="Opportunity not found")

    number = next_invoice_number(db, current_user.org_id, Invoice)
    i = Invoice(
        org_id=current_user.org_id,
        number=number,
        contact_id=body.contact_id,
        sales_order_id=body.sales_order_id,
        lead_id=lead_id,
        opportunity_id=opportunity_id,
        status=InvoiceStatus.DRAFT,
        due_date=body.due_date,
        total=Decimal("0"),
        vat_amount=Decimal("0"),
        created_by=current_user.id,
    )
    db.add(i)
    db.flush()

    total_excl = Decimal("0")
    total_vat = Decimal("0")
    if order:
        for ol in order.lines:
            line_vat_rate = getattr(ol, "vat_rate", Decimal("0")) or Decimal("0")
            line_vat = (ol.amount * line_vat_rate / Decimal("100")).quantize(Decimal("0.01"))
            ln = InvoiceLine(
                invoice_id=i.id,
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
    else:
        for line_in in body.lines:
            amt = (line_in.quantity * line_in.unit_price).quantize(Decimal("0.01"))
            line_vat_rate = line_in.vat_rate if hasattr(line_in, "vat_rate") else Decimal("0")
            line_vat = (amt * line_vat_rate / Decimal("100")).quantize(Decimal("0.01"))
            ln = InvoiceLine(
                invoice_id=i.id,
                product_id=line_in.product_id if hasattr(line_in, "product_id") else None,
                description=line_in.description,
                quantity=line_in.quantity,
                unit_price=line_in.unit_price,
                vat_rate=line_vat_rate,
                amount=amt,
            )
            db.add(ln)
            total_excl += amt
            total_vat += line_vat
    i.total = total_excl + total_vat
    i.vat_amount = total_vat

    db.commit()
    db.refresh(i)
    i = db.query(Invoice).options(
        joinedload(Invoice.lines), joinedload(Invoice.contact),
        joinedload(Invoice.sales_order), joinedload(Invoice.lead), joinedload(Invoice.opportunity), joinedload(Invoice.creator),
    ).filter(Invoice.id == i.id).first()
    return _invoice_response(i)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    i = db.query(Invoice).options(
        joinedload(Invoice.lines), joinedload(Invoice.contact),
        joinedload(Invoice.sales_order), joinedload(Invoice.lead), joinedload(Invoice.opportunity), joinedload(Invoice.creator),
    ).filter(
        Invoice.id == invoice_id,
        Invoice.org_id == current_user.org_id,
    ).first()
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _invoice_response(i)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    i = db.query(Invoice).options(
        joinedload(Invoice.lines), joinedload(Invoice.contact),
        joinedload(Invoice.sales_order), joinedload(Invoice.lead), joinedload(Invoice.opportunity), joinedload(Invoice.creator),
    ).filter(
        Invoice.id == invoice_id,
        Invoice.org_id == current_user.org_id,
    ).first()
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return _invoice_response(i)


@router.post("/{invoice_id}/pay", response_model=InvoiceResponse)
def pay_invoice(
    invoice_id: str,
    payload: InvoicePaymentRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Record invoice payment and credit contact wallet."""
    i = db.query(Invoice).options(
        joinedload(Invoice.lines), joinedload(Invoice.contact),
        joinedload(Invoice.sales_order), joinedload(Invoice.lead), joinedload(Invoice.opportunity), joinedload(Invoice.creator),
    ).filter(
        Invoice.id == invoice_id,
        Invoice.org_id == current_user.org_id,
    ).first()
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if i.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Invoice already paid")
    if not i.contact_id:
        raise HTTPException(status_code=400, detail="Invoice has no contact; cannot record payment")
    amount = payload.amount
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    wallet = db.query(ClientWallet).filter(
        ClientWallet.contact_id == i.contact_id,
        ClientWallet.org_id == current_user.org_id,
    ).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="No wallet found for this contact. Create a wallet first.")

    balance_before = wallet.balance
    balance_after = balance_before + amount
    wallet.balance = balance_after

    txn = Transaction(
        wallet_id=wallet.id,
        org_id=current_user.org_id,
        type=TransactionType.TOP_UP,
        amount=amount,
        currency=wallet.currency,
        balance_before=balance_before,
        balance_after=balance_after,
        status=TransactionStatus.COMPLETED,
        description=f"Payment for invoice {i.number}",
        reference_id=i.number,
        created_by=current_user.id,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(txn)

    i.status = InvoiceStatus.PAID
    i.paid_at = datetime.now(timezone.utc)
    db.commit()
    i = db.query(Invoice).options(
        joinedload(Invoice.lines), joinedload(Invoice.contact),
        joinedload(Invoice.sales_order), joinedload(Invoice.lead), joinedload(Invoice.opportunity), joinedload(Invoice.creator),
    ).filter(Invoice.id == i.id).first()
    return _invoice_response(i)

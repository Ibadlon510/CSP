"""Contact CRUD and addresses API. Documents use the unified Documents API (api/documents.py)."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.contact import Contact, ContactAddress, ContactType, ContactStatus, AddressType
from models.document import Document
from models.quotation import Quotation
from models.sales_order import SalesOrder
from models.invoice import Invoice
from models.project import Project
from models.opportunity import Opportunity
from schemas.contact import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactAddressCreate,
    ContactAddressUpdate,
    ContactAddressResponse,
    ContactDocumentResponse,
)

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def _contact_to_response(c: Contact, db: Session | None = None) -> ContactResponse:
    return ContactResponse(
        id=c.id,
        org_id=c.org_id,
        contact_type=c.contact_type.value if c.contact_type else "company",
        name=c.name,
        email=c.email,
        phone_primary=c.phone_primary,
        phone_mobile=c.phone_mobile,
        phone_office=c.phone_office,
        status=c.status.value if c.status else "active",
        assigned_manager_id=c.assigned_manager_id,
        notes=c.notes,
        country=c.country,
        trade_license_no=c.trade_license_no,
        jurisdiction=c.jurisdiction,
        legal_form=c.legal_form,
        license_issue_date=c.license_issue_date,
        license_expiry_date=c.license_expiry_date,
        establishment_card_expiry=c.establishment_card_expiry,
        visa_expiry_date=c.visa_expiry_date,
        tax_registration_no=c.tax_registration_no,
        website=c.website,
        activity_license_activities=c.activity_license_activities,
        vat_registered=c.vat_registered,
        vat_period_type=c.vat_period_type,
        vat_period_end_day=c.vat_period_end_day,
        vat_first_period_end_date=c.vat_first_period_end_date,
        vat_return_due_days=c.vat_return_due_days,
        vat_notes=c.vat_notes,
        ct_registered=c.ct_registered,
        ct_registration_no=c.ct_registration_no,
        ct_period_type=c.ct_period_type,
        ct_financial_year_start_month=c.ct_financial_year_start_month,
        ct_financial_year_start_day=c.ct_financial_year_start_day,
        ct_filing_due_months=c.ct_filing_due_months,
        ct_notes=c.ct_notes,
        first_name=c.first_name,
        last_name=c.last_name,
        passport_no=c.passport_no,
        passport_expiry=c.passport_expiry,
        nationality=c.nationality,
        date_of_birth=c.date_of_birth,
        visa_type=c.visa_type,
        emirates_id=c.emirates_id,
        emirates_id_expiry=c.emirates_id_expiry,
        gender=c.gender,
        designation_title=c.designation_title,
        addresses=[ContactAddressResponse.model_validate(a) for a in c.addresses],
        documents=_get_contact_documents(c.id, db),
        created_at=c.created_at,
    )


@router.get("/", response_model=list[ContactResponse])
def list_contacts(
    search: str | None = None,
    contact_type: str | None = None,
    jurisdiction: str | None = None,
    status: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """List contacts for current org with optional search/filter."""
    if not current_user.org_id:
        return []
    q = db.query(Contact).filter(Contact.org_id == current_user.org_id).options(
        joinedload(Contact.addresses),
    )
    if search:
        q = q.filter(
            or_(
                Contact.name.ilike(f"%{search}%"),
                Contact.trade_license_no.ilike(f"%{search}%"),
                Contact.email.ilike(f"%{search}%"),
            )
        )
    if contact_type:
        try:
            q = q.filter(Contact.contact_type == ContactType(contact_type))
        except ValueError:
            pass
    if jurisdiction:
        q = q.filter(Contact.jurisdiction == jurisdiction)
    if status:
        try:
            q = q.filter(Contact.status == ContactStatus(status))
        except ValueError:
            pass
    contacts = q.order_by(Contact.name).all()
    return [_contact_to_response(c, db) for c in contacts]


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def create_contact(
    body: ContactCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Create a new contact in current org."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    try:
        ct = ContactType((body.contact_type or "company").lower().strip())
    except ValueError:
        ct = ContactType.COMPANY
    try:
        st = ContactStatus((body.status or "active").lower().strip()) if body.status else ContactStatus.ACTIVE
    except ValueError:
        st = ContactStatus.ACTIVE
    try:
        contact = Contact(
            org_id=current_user.org_id,
            contact_type=ct,
            name=body.name,
            email=body.email,
            phone_primary=body.phone_primary,
            phone_mobile=body.phone_mobile,
            phone_office=body.phone_office,
            status=st,
            assigned_manager_id=body.assigned_manager_id,
            notes=body.notes,
            country=body.country,
            trade_license_no=body.trade_license_no,
            jurisdiction=body.jurisdiction,
            legal_form=body.legal_form,
            license_issue_date=body.license_issue_date,
            license_expiry_date=body.license_expiry_date,
            establishment_card_expiry=body.establishment_card_expiry,
            visa_expiry_date=body.visa_expiry_date,
            tax_registration_no=body.tax_registration_no,
            website=body.website,
            activity_license_activities=body.activity_license_activities,
            vat_registered=body.vat_registered,
            vat_period_type=body.vat_period_type,
            vat_period_end_day=body.vat_period_end_day,
            vat_first_period_end_date=body.vat_first_period_end_date,
            vat_return_due_days=body.vat_return_due_days,
            vat_notes=body.vat_notes,
            ct_registered=body.ct_registered,
            ct_registration_no=body.ct_registration_no,
            ct_period_type=body.ct_period_type,
            ct_financial_year_start_month=body.ct_financial_year_start_month,
            ct_financial_year_start_day=body.ct_financial_year_start_day,
            ct_filing_due_months=body.ct_filing_due_months,
            ct_notes=body.ct_notes,
            first_name=body.first_name,
            last_name=body.last_name,
            passport_no=body.passport_no,
            passport_expiry=body.passport_expiry,
            nationality=body.nationality,
            date_of_birth=body.date_of_birth,
            visa_type=body.visa_type,
            emirates_id=body.emirates_id,
            emirates_id_expiry=body.emirates_id_expiry,
            gender=body.gender,
            designation_title=body.designation_title,
        )
        db.add(contact)
        db.flush()
        for addr in body.addresses:
            try:
                at = AddressType((addr.address_type or "other").lower().strip())
            except ValueError:
                at = AddressType.OTHER
            a = ContactAddress(
                contact_id=contact.id,
                address_type=at,
                address_line_1=(addr.address_line_1 or "").strip() or "—",
                address_line_2=addr.address_line_2.strip() if addr.address_line_2 else None,
                city=addr.city.strip() if addr.city else None,
                state_emirate=addr.state_emirate.strip() if addr.state_emirate else None,
                postal_code=addr.postal_code.strip() if addr.postal_code else None,
                country=addr.country.strip() if addr.country else None,
                is_primary=bool(addr.is_primary) if addr.is_primary is not None else False,
                notes=addr.notes.strip() if addr.notes else None,
            )
            db.add(a)
        db.flush()
        primaries = db.query(ContactAddress).filter(ContactAddress.contact_id == contact.id, ContactAddress.is_primary == True).all()
        if len(primaries) > 1:
            for a in primaries[1:]:
                a.is_primary = False
        db.commit()
        db.refresh(contact)
        contact = db.query(Contact).options(joinedload(Contact.addresses)).filter(Contact.id == contact.id).first()
        return _contact_to_response(contact, db)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create contact: {str(e)}")


@router.get("/expiring", response_model=list[ContactResponse])
def list_expiring(
    days: int = 90,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Contacts with license, visa, or passport expiring within the given days."""
    if not current_user.org_id:
        return []
    threshold = date.today() + timedelta(days=days)
    q = db.query(Contact).filter(Contact.org_id == current_user.org_id).options(
        joinedload(Contact.addresses),
    )
    q = q.filter(
        or_(
            (Contact.license_expiry_date.isnot(None)) & (Contact.license_expiry_date <= threshold),
            (Contact.visa_expiry_date.isnot(None)) & (Contact.visa_expiry_date <= threshold),
            (Contact.passport_expiry.isnot(None)) & (Contact.passport_expiry <= threshold),
            (Contact.emirates_id_expiry.isnot(None)) & (Contact.emirates_id_expiry <= threshold),
        )
    )
    contacts = q.order_by(Contact.license_expiry_date, Contact.visa_expiry_date).all()
    return [_contact_to_response(c, db) for c in contacts]


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(
    contact_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get one contact by id."""
    contact = db.query(Contact).options(
        joinedload(Contact.addresses),
    ).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return _contact_to_response(contact, db)


@router.get("/{contact_id}/linked-records")
def get_linked_records(
    contact_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Return counts and recent items from modules linked to this contact."""
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    org = current_user.org_id

    # Quotations
    quots = db.query(Quotation.id, Quotation.number, Quotation.status).filter(
        Quotation.contact_id == contact_id, Quotation.org_id == org
    ).order_by(Quotation.created_at.desc()).all()

    # Sales Orders
    orders = db.query(SalesOrder.id, SalesOrder.number, SalesOrder.status).filter(
        SalesOrder.contact_id == contact_id, SalesOrder.org_id == org
    ).order_by(SalesOrder.created_at.desc()).all()

    # Invoices
    invoices = db.query(Invoice.id, Invoice.number, Invoice.status).filter(
        Invoice.contact_id == contact_id, Invoice.org_id == org
    ).order_by(Invoice.created_at.desc()).all()

    # Projects
    projects = db.query(Project.id, Project.title, Project.status).filter(
        Project.contact_id == contact_id, Project.org_id == org
    ).order_by(Project.created_at.desc()).all()

    # Opportunities
    opps = db.query(Opportunity.id, Opportunity.name, Opportunity.stage).filter(
        Opportunity.contact_id == contact_id, Opportunity.org_id == org
    ).order_by(Opportunity.created_at.desc()).all()

    return {
        "quotations": [{"id": r.id, "number": r.number, "status": r.status} for r in quots],
        "sales_orders": [{"id": r.id, "number": r.number, "status": r.status} for r in orders],
        "invoices": [{"id": r.id, "number": r.number, "status": r.status} for r in invoices],
        "projects": [{"id": r.id, "title": r.title, "status": r.status.value if hasattr(r.status, 'value') else r.status} for r in projects],
        "opportunities": [{"id": r.id, "name": r.name, "stage": r.stage} for r in opps],
    }


@router.patch("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: str,
    body: ContactUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update a contact."""
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "contact_type" and v is not None:
            try:
                setattr(contact, k, ContactType(v))
            except ValueError:
                pass
        elif k == "status" and v is not None:
            try:
                setattr(contact, k, ContactStatus(v))
            except ValueError:
                pass
        else:
            setattr(contact, k, v)
    db.commit()
    db.refresh(contact)
    contact = db.query(Contact).options(joinedload(Contact.addresses)).filter(Contact.id == contact_id).first()
    return _contact_to_response(contact, db)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Delete a contact."""
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return None


# ----- Addresses -----
@router.get("/{contact_id}/addresses", response_model=list[ContactAddressResponse])
def list_addresses(
    contact_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.org_id == current_user.org_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return [ContactAddressResponse.model_validate(a) for a in contact.addresses]


@router.post("/{contact_id}/addresses", response_model=ContactAddressResponse, status_code=status.HTTP_201_CREATED)
def add_address(
    contact_id: str,
    body: ContactAddressCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.org_id == current_user.org_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    try:
        at = AddressType(body.address_type)
    except ValueError:
        at = AddressType.OTHER
    addr = ContactAddress(
        contact_id=contact_id,
        address_type=at,
        address_line_1=body.address_line_1,
        address_line_2=body.address_line_2,
        city=body.city,
        state_emirate=body.state_emirate,
        postal_code=body.postal_code,
        country=body.country,
        is_primary=bool(body.is_primary) if body.is_primary is not None else False,
        notes=body.notes,
    )
    if addr.is_primary:
        db.query(ContactAddress).filter(ContactAddress.contact_id == contact_id).update({ContactAddress.is_primary: False})
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return ContactAddressResponse.model_validate(addr)


@router.patch("/{contact_id}/addresses/{address_id}", response_model=ContactAddressResponse)
def update_address(
    contact_id: str,
    address_id: str,
    body: ContactAddressUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    addr = db.query(ContactAddress).join(Contact).filter(
        ContactAddress.id == address_id,
        ContactAddress.contact_id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if body.is_primary:
        db.query(ContactAddress).filter(ContactAddress.contact_id == contact_id, ContactAddress.id != address_id).update({ContactAddress.is_primary: False}, synchronize_session=False)
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "address_type" and v is not None:
            try:
                setattr(addr, k, AddressType(v))
            except ValueError:
                pass
        else:
            setattr(addr, k, v)
    db.commit()
    db.refresh(addr)
    return ContactAddressResponse.model_validate(addr)


@router.delete("/{contact_id}/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    contact_id: str,
    address_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    addr = db.query(ContactAddress).join(Contact).filter(
        ContactAddress.id == address_id,
        ContactAddress.contact_id == contact_id,
        Contact.org_id == current_user.org_id,
    ).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    db.delete(addr)
    db.commit()
    return None


# ----- Documents -----
# Document upload/download is handled by the unified Documents API (api/documents.py).
# Contact responses still include a documents list for convenience, sourced from the unified table.
def _get_contact_documents(contact_id: str, db: Session | None = None) -> list:
    """Fetch documents for a contact from the unified documents table."""
    if db is None:
        return []
    docs = db.query(Document).filter(
        Document.contact_id == contact_id,
        Document.status == "active",
    ).order_by(Document.created_at.desc()).all()
    return [
        ContactDocumentResponse(
            id=d.id, category=d.category, file_name=d.file_name,
            file_path=d.file_path, file_size=str(d.file_size) if d.file_size else None,
        )
        for d in docs
    ]

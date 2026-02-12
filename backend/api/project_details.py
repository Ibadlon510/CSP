"""Project detail sub-resource API: handover, proposed names, license activities,
visa applications, document checklist, project products, related fields,
compliance, and financials."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.deps import get_current_user, require_roles
from models.user import User, UserRole
from models.project import (
    Project, ProjectStatus,
    ProjectHandover, ProjectProposedName, ProjectLicenseActivity,
    ProjectVisaApplication, ProjectDocumentChecklist, ProjectProduct,
    ProjectRelatedField,
)
from models.contact import Contact
from models.product import Product, ProductDocumentRequirement
from models.document import Document
from models.compliance import OwnershipLink, OwnershipLinkType
from models.wallet import Transaction
from models.sales_order import SalesOrder, SalesOrderLine
from models.audit_log import AuditLog
from models.notification import Notification
from models.approval import ApprovalRequest, ApprovalProcessSetting
from models.base import utcnow
from schemas.project import (
    ProjectHandoverUpsert, ProjectHandoverResponse,
    ProjectProposedNameCreate, ProjectProposedNameResponse,
    ProjectLicenseActivityCreate, ProjectLicenseActivityResponse,
    ProjectVisaApplicationCreate, ProjectVisaApplicationUpdate, ProjectVisaApplicationResponse,
    ProjectDocumentChecklistCreate, ProjectDocumentChecklistUpdate, ProjectDocumentChecklistResponse,
    ProjectProductCreate, ProjectProductResponse,
    ProjectRelatedFieldCreate, ProjectRelatedFieldUpdate, ProjectRelatedFieldResponse,
)
from services.audit import log_action

router = APIRouter(prefix="/api/projects", tags=["project-details"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_project(db: Session, project_id: str, org_id: str) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.org_id == org_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return p


# ============= Handover =============

CONTACT_MAPPED_FIELDS = [
    "contact_type", "name", "email", "phone_mobile", "phone_primary",
    # Company-specific
    "trade_license_no", "jurisdiction", "legal_form",
    "license_issue_date", "license_expiry_date",
    "activity_license_activities",
    "vat_registered", "vat_period_type", "vat_period_end_day",
    "vat_first_period_end_date", "vat_return_due_days", "vat_notes",
    "ct_registered", "ct_registration_no", "ct_period_type",
    "ct_financial_year_start_month", "ct_financial_year_start_day",
    "ct_filing_due_months", "ct_notes",
    # Individual-specific
    "gender", "nationality", "date_of_birth", "place_of_birth",
    "passport_no", "passport_expiry",
    "visa_type", "emirates_id", "emirates_id_expiry",
    "designation_title",
]

HANDOVER_ONLY_FIELDS = [
    "is_visa_application", "channel_partner_plan", "initial_company_formation",
    "price_per_share", "total_number_of_shares", "shareholding_total", "total_share_value",
    "license_authority", "legal_entity_type_detailed", "applied_years",
    "top_5_countries", "visa_eligibility", "preferred_mobile_country",
]


@router.get("/{project_id}/handover", response_model=ProjectHandoverResponse)
def get_handover(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id, current_user.org_id)
    handover = db.query(ProjectHandover).filter(ProjectHandover.project_id == project_id).first()

    # Merge contact fields + handover fields
    merged: dict = {"project_id": project_id, "contact_id": project.contact_id}

    # Contact fields
    contact = db.query(Contact).filter(Contact.id == project.contact_id).first() if project.contact_id else None
    if contact:
        for f in CONTACT_MAPPED_FIELDS:
            val = getattr(contact, f, None)
            merged[f] = val.value if hasattr(val, "value") else val

    # Handover-only fields
    if handover:
        merged["id"] = handover.id
        merged["created_at"] = handover.created_at
        merged["updated_at"] = handover.updated_at
        for f in HANDOVER_ONLY_FIELDS:
            merged[f] = getattr(handover, f, None)

    # Sub-resources
    proposed = db.query(ProjectProposedName).filter(
        ProjectProposedName.project_id == project_id
    ).order_by(ProjectProposedName.priority).all()
    merged["proposed_names"] = [ProjectProposedNameResponse.model_validate(n) for n in proposed]

    activities = db.query(ProjectLicenseActivity).filter(
        ProjectLicenseActivity.project_id == project_id
    ).all()
    merged["license_activities"] = [ProjectLicenseActivityResponse.model_validate(a) for a in activities]

    visas = db.query(ProjectVisaApplication).filter(
        ProjectVisaApplication.project_id == project_id
    ).all()
    visa_responses = []
    for v in visas:
        vr = ProjectVisaApplicationResponse.model_validate(v)
        c = db.query(Contact).filter(Contact.id == v.contact_id).first()
        vr.contact_name = c.name if c else None
        visa_responses.append(vr)
    merged["visa_applications"] = visa_responses

    return ProjectHandoverResponse(**merged)


@router.put("/{project_id}/handover", response_model=ProjectHandoverResponse)
def upsert_handover(
    project_id: str,
    payload: ProjectHandoverUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id, current_user.org_id)
    data = payload.model_dump(exclude_unset=True)

    # Write contact-mapped fields back to Contact
    if project.contact_id:
        contact = db.query(Contact).filter(Contact.id == project.contact_id).first()
        if contact:
            for f in CONTACT_MAPPED_FIELDS:
                if f in data:
                    setattr(contact, f, data[f])

    # Upsert handover-only fields
    handover = db.query(ProjectHandover).filter(ProjectHandover.project_id == project_id).first()
    if not handover:
        handover = ProjectHandover(project_id=project_id, org_id=current_user.org_id)
        db.add(handover)
    for f in HANDOVER_ONLY_FIELDS:
        if f in data:
            setattr(handover, f, data[f])

    db.commit()

    log_action(db, current_user.id, current_user.org_id,
               action="update", resource="project_handover", resource_id=project_id,
               detail="Updated handover data")

    return get_handover(project_id, db, current_user)


# ============= Proposed Names =============

@router.get("/{project_id}/proposed-names", response_model=List[ProjectProposedNameResponse])
def list_proposed_names(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    return [
        ProjectProposedNameResponse.model_validate(n)
        for n in db.query(ProjectProposedName).filter(
            ProjectProposedName.project_id == project_id
        ).order_by(ProjectProposedName.priority).all()
    ]


@router.post("/{project_id}/proposed-names", response_model=ProjectProposedNameResponse, status_code=201)
def create_proposed_name(
    project_id: str,
    payload: ProjectProposedNameCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    count = db.query(ProjectProposedName).filter(ProjectProposedName.project_id == project_id).count()
    if count >= 3:
        raise HTTPException(400, "Maximum 3 proposed names allowed")
    n = ProjectProposedName(
        project_id=project_id, org_id=current_user.org_id,
        name=payload.name, priority=payload.priority,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return ProjectProposedNameResponse.model_validate(n)


@router.delete("/{project_id}/proposed-names/{name_id}")
def delete_proposed_name(
    project_id: str, name_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(ProjectProposedName).filter(
        ProjectProposedName.id == name_id,
        ProjectProposedName.project_id == project_id,
    ).first()
    if not n:
        raise HTTPException(404, "Proposed name not found")
    db.delete(n)
    db.commit()
    return {"message": "Deleted"}


# ============= License Activities =============

@router.get("/{project_id}/license-activities", response_model=List[ProjectLicenseActivityResponse])
def list_license_activities(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    return [
        ProjectLicenseActivityResponse.model_validate(a)
        for a in db.query(ProjectLicenseActivity).filter(
            ProjectLicenseActivity.project_id == project_id
        ).all()
    ]


@router.post("/{project_id}/license-activities", response_model=ProjectLicenseActivityResponse, status_code=201)
def create_license_activity(
    project_id: str,
    payload: ProjectLicenseActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    a = ProjectLicenseActivity(
        project_id=project_id, org_id=current_user.org_id,
        activity_name=payload.activity_name, activity_code=payload.activity_code,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return ProjectLicenseActivityResponse.model_validate(a)


@router.delete("/{project_id}/license-activities/{activity_id}")
def delete_license_activity(
    project_id: str, activity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(ProjectLicenseActivity).filter(
        ProjectLicenseActivity.id == activity_id,
        ProjectLicenseActivity.project_id == project_id,
    ).first()
    if not a:
        raise HTTPException(404, "License activity not found")
    db.delete(a)
    db.commit()
    return {"message": "Deleted"}


# ============= Visa Applications =============

@router.get("/{project_id}/visa-applications", response_model=List[ProjectVisaApplicationResponse])
def list_visa_applications(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    visas = db.query(ProjectVisaApplication).filter(
        ProjectVisaApplication.project_id == project_id
    ).all()
    result = []
    for v in visas:
        vr = ProjectVisaApplicationResponse.model_validate(v)
        c = db.query(Contact).filter(Contact.id == v.contact_id).first()
        vr.contact_name = c.name if c else None
        result.append(vr)
    return result


@router.post("/{project_id}/visa-applications", response_model=ProjectVisaApplicationResponse, status_code=201)
def create_visa_application(
    project_id: str,
    payload: ProjectVisaApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id, current_user.org_id)

    # Validate visa allocation cap
    handover = db.query(ProjectHandover).filter(ProjectHandover.project_id == project_id).first()
    if handover and handover.visa_eligibility is not None:
        current_count = db.query(ProjectVisaApplication).filter(
            ProjectVisaApplication.project_id == project_id
        ).count()
        if current_count >= handover.visa_eligibility:
            raise HTTPException(400, f"Visa allocation cap reached ({handover.visa_eligibility} slots)")

    # Validate contact
    contact = db.query(Contact).filter(
        Contact.id == payload.contact_id, Contact.org_id == current_user.org_id
    ).first()
    if not contact:
        raise HTTPException(404, "Contact not found")

    va = ProjectVisaApplication(
        project_id=project_id, org_id=current_user.org_id,
        contact_id=payload.contact_id,
        visa_type=payload.visa_type, designation=payload.designation,
        salary=payload.salary, notes=payload.notes,
    )
    db.add(va)

    # Auto-link as Related Party if not already linked
    if project.contact_id:
        existing_link = db.query(OwnershipLink).filter(
            OwnershipLink.owner_contact_id == payload.contact_id,
            OwnershipLink.owned_contact_id == project.contact_id,
        ).first()
        if not existing_link:
            link = OwnershipLink(
                org_id=current_user.org_id,
                owner_contact_id=payload.contact_id,
                owned_contact_id=project.contact_id,
                link_type=OwnershipLinkType.EMPLOYEE,
            )
            db.add(link)

    db.commit()
    db.refresh(va)
    vr = ProjectVisaApplicationResponse.model_validate(va)
    vr.contact_name = contact.name
    return vr


@router.patch("/{project_id}/visa-applications/{va_id}", response_model=ProjectVisaApplicationResponse)
def update_visa_application(
    project_id: str, va_id: str,
    payload: ProjectVisaApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    va = db.query(ProjectVisaApplication).filter(
        ProjectVisaApplication.id == va_id,
        ProjectVisaApplication.project_id == project_id,
    ).first()
    if not va:
        raise HTTPException(404, "Visa application not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(va, field, val)
    db.commit()
    db.refresh(va)
    vr = ProjectVisaApplicationResponse.model_validate(va)
    c = db.query(Contact).filter(Contact.id == va.contact_id).first()
    vr.contact_name = c.name if c else None
    return vr


@router.delete("/{project_id}/visa-applications/{va_id}")
def delete_visa_application(
    project_id: str, va_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    va = db.query(ProjectVisaApplication).filter(
        ProjectVisaApplication.id == va_id,
        ProjectVisaApplication.project_id == project_id,
    ).first()
    if not va:
        raise HTTPException(404, "Visa application not found")
    db.delete(va)
    db.commit()
    return {"message": "Deleted"}


# ============= Document Checklist =============

@router.get("/{project_id}/document-checklist", response_model=List[ProjectDocumentChecklistResponse])
def list_document_checklist(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    items = db.query(ProjectDocumentChecklist).filter(
        ProjectDocumentChecklist.project_id == project_id
    ).order_by(ProjectDocumentChecklist.sort_order).all()
    result = []
    for it in items:
        d = ProjectDocumentChecklistResponse.model_validate(it)
        if it.document_id:
            doc = db.query(Document).filter(Document.id == it.document_id).first()
            if doc:
                d.document_file_name = doc.file_name
                d.document_file_path = doc.file_path
        result.append(d)
    return result


@router.post("/{project_id}/document-checklist", response_model=ProjectDocumentChecklistResponse, status_code=201)
def add_checklist_item(
    project_id: str,
    payload: ProjectDocumentChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    item = ProjectDocumentChecklist(
        project_id=project_id, org_id=current_user.org_id,
        requirement_name=payload.requirement_name,
        document_category=payload.document_category,
        sort_order=payload.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ProjectDocumentChecklistResponse.model_validate(item)


@router.patch("/{project_id}/document-checklist/{item_id}", response_model=ProjectDocumentChecklistResponse)
def update_checklist_item(
    project_id: str, item_id: str,
    payload: ProjectDocumentChecklistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ProjectDocumentChecklist).filter(
        ProjectDocumentChecklist.id == item_id,
        ProjectDocumentChecklist.project_id == project_id,
    ).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
    was_verified = item.is_verified
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, val)
    db.commit()
    db.refresh(item)

    # Notify project owner when a doc is newly verified
    if item.is_verified and not was_verified:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.owner_id and project.owner_id != current_user.id:
            notif = Notification(
                org_id=current_user.org_id,
                user_id=project.owner_id,
                title="Document Verified",
                message=f"\"{item.requirement_name}\" has been verified by {current_user.full_name}.",
                category="document",
                resource_type="project",
                resource_id=project_id,
            )
            db.add(notif)
            db.commit()

    d = ProjectDocumentChecklistResponse.model_validate(item)
    if item.document_id:
        doc = db.query(Document).filter(Document.id == item.document_id).first()
        if doc:
            d.document_file_name = doc.file_name
            d.document_file_path = doc.file_path
    return d


@router.delete("/{project_id}/document-checklist/{item_id}")
def delete_checklist_item(
    project_id: str, item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ProjectDocumentChecklist).filter(
        ProjectDocumentChecklist.id == item_id,
        ProjectDocumentChecklist.project_id == project_id,
    ).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}


# ============= Project Products =============

def _append_doc_checklist_for_product(db: Session, project_id: str, org_id: str, product_id: str):
    """Append missing document requirements from a product to the project checklist."""
    reqs = db.query(ProductDocumentRequirement).filter(
        ProductDocumentRequirement.product_id == product_id
    ).order_by(ProductDocumentRequirement.sort_order).all()
    if not reqs:
        return
    existing_cats = {
        r.document_category
        for r in db.query(ProjectDocumentChecklist).filter(
            ProjectDocumentChecklist.project_id == project_id
        ).all()
        if r.document_category
    }
    max_sort = db.query(ProjectDocumentChecklist).filter(
        ProjectDocumentChecklist.project_id == project_id
    ).count()
    for req in reqs:
        if req.document_category and req.document_category in existing_cats:
            continue
        item = ProjectDocumentChecklist(
            project_id=project_id, org_id=org_id,
            requirement_name=req.document_name,
            document_category=req.document_category,
            document_type=getattr(req, "document_type", "required"),
            sort_order=max_sort,
        )
        db.add(item)
        max_sort += 1
        if req.document_category:
            existing_cats.add(req.document_category)


@router.get("/{project_id}/products", response_model=List[ProjectProductResponse])
def list_project_products(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    pps = db.query(ProjectProduct).filter(
        ProjectProduct.project_id == project_id
    ).order_by(ProjectProduct.created_at).all()
    result = []
    for pp in pps:
        d = ProjectProductResponse.model_validate(pp)
        prod = db.query(Product).filter(Product.id == pp.product_id).first()
        d.product_name = prod.name if prod else None
        d.product_code = prod.code if prod else None
        if pp.sales_order_id:
            so = db.query(SalesOrder).filter(SalesOrder.id == pp.sales_order_id).first()
            d.sales_order_number = so.number if so else None
        if pp.added_by:
            u = db.query(User).filter(User.id == pp.added_by).first()
            d.added_by_name = u.full_name if u else None
        result.append(d)
    return result


@router.post("/{project_id}/products", response_model=ProjectProductResponse, status_code=201)
def add_project_product(
    project_id: str,
    payload: ProjectProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id, current_user.org_id)
    product = db.query(Product).filter(
        Product.id == payload.product_id, Product.org_id == current_user.org_id
    ).first()
    if not product:
        raise HTTPException(404, "Product not found")

    unit_price = payload.unit_price if payload.unit_price is not None else product.default_unit_price

    pp = ProjectProduct(
        project_id=project_id, org_id=current_user.org_id,
        product_id=payload.product_id,
        quantity=payload.quantity, unit_price=unit_price,
        source="added", is_billable=payload.is_billable,
        added_by=current_user.id,
    )

    if payload.is_billable:
        pp.status = "active"
        # Append doc checklist immediately
        _append_doc_checklist_for_product(db, project_id, current_user.org_id, payload.product_id)
    else:
        # Non-billable: needs approval
        pp.status = "pending_approval"
        db.add(pp)
        db.flush()
        # Find approver
        approver_id = current_user.manager_id
        if not approver_id:
            setting = db.query(ApprovalProcessSetting).filter(
                ApprovalProcessSetting.org_id == current_user.org_id,
                ApprovalProcessSetting.approval_type == "non_billable_product",
            ).first()
            if setting and setting.fallback_approver_id:
                approver_id = setting.fallback_approver_id
        if approver_id:
            ar = ApprovalRequest(
                org_id=current_user.org_id,
                request_type="non_billable_product",
                resource_type="project_product",
                resource_id=pp.id,
                requested_by=current_user.id,
                approver_id=approver_id,
            )
            db.add(ar)
            # Notification
            notif = Notification(
                org_id=current_user.org_id,
                user_id=approver_id,
                title="Approval Required: Non-Billable Product",
                message=f"{current_user.full_name} added non-billable product '{product.name}' to project. Please approve or reject.",
                category="approval",
                resource_type="project_product",
                resource_id=pp.id,
            )
            db.add(notif)

    db.add(pp)
    db.commit()
    db.refresh(pp)

    d = ProjectProductResponse.model_validate(pp)
    d.product_name = product.name
    d.product_code = product.code
    d.added_by_name = current_user.full_name
    if pp.sales_order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == pp.sales_order_id).first()
        d.sales_order_number = so.number if so else None
    return d


@router.post("/{project_id}/products/create-orders")
def create_orders_from_products(
    project_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create sales orders from selected billable project products.
    payload: { product_ids: [pp_id, ...], mode: "single" | "separate" }
    """
    project = _get_project(db, project_id, current_user.org_id)
    if not project.contact_id:
        raise HTTPException(400, "Project has no linked contact for billing")

    pp_ids = payload.get("product_ids") or []
    mode = payload.get("mode", "single")  # "single" or "separate"
    if not pp_ids:
        raise HTTPException(400, "No products selected")

    pps = db.query(ProjectProduct).filter(
        ProjectProduct.id.in_(pp_ids),
        ProjectProduct.project_id == project_id,
        ProjectProduct.is_billable == True,
        ProjectProduct.sales_order_id.is_(None),
    ).all()
    if not pps:
        raise HTTPException(400, "No eligible unbilled products found")

    from services.number_sequence import next_order_number
    created_orders = []

    if mode == "single":
        # One SO with all products as lines
        so = SalesOrder(
            org_id=current_user.org_id,
            number=next_order_number(db, current_user.org_id, SalesOrder),
            contact_id=project.contact_id,
            status="confirmed",
        )
        db.add(so)
        db.flush()
        for pp in pps:
            product = db.query(Product).filter(Product.id == pp.product_id).first()
            line = SalesOrderLine(
                sales_order_id=so.id,
                product_id=pp.product_id,
                description=product.name if product else "",
                quantity=pp.quantity,
                unit_price=pp.unit_price or Decimal("0"),
                amount=(pp.quantity * (pp.unit_price or Decimal("0"))),
            )
            db.add(line)
            pp.sales_order_id = so.id
        created_orders.append(so.number)
    else:
        # Separate SO per product
        for pp in pps:
            product = db.query(Product).filter(Product.id == pp.product_id).first()
            so = SalesOrder(
                org_id=current_user.org_id,
                number=next_order_number(db, current_user.org_id, SalesOrder),
                contact_id=project.contact_id,
                status="confirmed",
            )
            db.add(so)
            db.flush()
            line = SalesOrderLine(
                sales_order_id=so.id,
                product_id=pp.product_id,
                description=product.name if product else "",
                quantity=pp.quantity,
                unit_price=pp.unit_price or Decimal("0"),
                amount=(pp.quantity * (pp.unit_price or Decimal("0"))),
            )
            db.add(line)
            pp.sales_order_id = so.id
            created_orders.append(so.number)

    db.commit()
    return {"message": f"Created {len(created_orders)} sales order(s)", "orders": created_orders}


@router.delete("/{project_id}/products/{pp_id}")
def remove_project_product(
    project_id: str, pp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pp = db.query(ProjectProduct).filter(
        ProjectProduct.id == pp_id,
        ProjectProduct.project_id == project_id,
        ProjectProduct.source == "added",
    ).first()
    if not pp:
        raise HTTPException(404, "Added product not found (cannot remove original products)")
    db.delete(pp)
    db.commit()
    return {"message": "Deleted"}


# ============= Related Fields =============

@router.get("/{project_id}/related-fields", response_model=List[ProjectRelatedFieldResponse])
def list_related_fields(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    return [
        ProjectRelatedFieldResponse.model_validate(f)
        for f in db.query(ProjectRelatedField).filter(
            ProjectRelatedField.project_id == project_id
        ).all()
    ]


@router.post("/{project_id}/related-fields", response_model=ProjectRelatedFieldResponse, status_code=201)
def create_related_field(
    project_id: str,
    payload: ProjectRelatedFieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    f = ProjectRelatedField(
        project_id=project_id, org_id=current_user.org_id,
        field_name=payload.field_name, field_value=payload.field_value,
        field_type=payload.field_type,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return ProjectRelatedFieldResponse.model_validate(f)


@router.patch("/{project_id}/related-fields/{field_id}", response_model=ProjectRelatedFieldResponse)
def update_related_field(
    project_id: str, field_id: str,
    payload: ProjectRelatedFieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(ProjectRelatedField).filter(
        ProjectRelatedField.id == field_id,
        ProjectRelatedField.project_id == project_id,
    ).first()
    if not f:
        raise HTTPException(404, "Related field not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(f, key, val)
    db.commit()
    db.refresh(f)
    return ProjectRelatedFieldResponse.model_validate(f)


@router.delete("/{project_id}/related-fields/{field_id}")
def delete_related_field(
    project_id: str, field_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(ProjectRelatedField).filter(
        ProjectRelatedField.id == field_id,
        ProjectRelatedField.project_id == project_id,
    ).first()
    if not f:
        raise HTTPException(404, "Related field not found")
    db.delete(f)
    db.commit()
    return {"message": "Deleted"}


# ============= Compliance =============

@router.get("/{project_id}/compliance")
def get_project_compliance(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id, current_user.org_id)
    contact_id = project.contact_id

    # Screening form ref — look for a document with category screening linked to the contact
    screening = None
    if contact_id:
        doc = db.query(Document).filter(
            Document.contact_id == contact_id,
            Document.category == "screening_form",
            Document.org_id == current_user.org_id,
        ).order_by(Document.created_at.desc()).first()
        if doc:
            screening = {
                "document_id": doc.id,
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "submitted_at": doc.created_at.isoformat() if doc.created_at else None,
            }

    # Onboarding form ref
    onboarding = None
    if contact_id:
        doc = db.query(Document).filter(
            Document.contact_id == contact_id,
            Document.category == "onboarding_form",
            Document.org_id == current_user.org_id,
        ).order_by(Document.created_at.desc()).first()
        if doc:
            onboarding = {
                "document_id": doc.id,
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "submitted_at": doc.created_at.isoformat() if doc.created_at else None,
            }

    # Related parties (ownership links for the client contact)
    related_parties = []
    if contact_id:
        links = db.query(OwnershipLink).filter(
            OwnershipLink.owned_contact_id == contact_id,
            OwnershipLink.org_id == current_user.org_id,
        ).all()
        for link in links:
            owner = db.query(Contact).filter(Contact.id == link.owner_contact_id).first()
            related_parties.append({
                "link_id": link.id,
                "contact_id": link.owner_contact_id,
                "contact_name": owner.name if owner else None,
                "contact_type": owner.contact_type.value if owner and owner.contact_type else None,
                "passport_no": owner.passport_no if owner else None,
                "nationality": owner.nationality if owner else None,
                "percentage": link.percentage,
                "link_type": link.link_type.value if link.link_type else None,
                "is_ubo": link.is_ubo,
                "is_secretary": link.is_secretary,
                "is_poa_authorized": link.is_poa_authorized,
                "role_label": link.role_label,
                "number_of_shares": link.number_of_shares,
            })

    return {
        "project_id": project_id,
        "client_contact_id": contact_id,
        "screening_form": screening,
        "onboarding_form": onboarding,
        "related_parties": related_parties,
    }


# ============= Financials =============

@router.get("/{project_id}/financials")
def get_project_financials(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    transactions = db.query(Transaction).filter(
        Transaction.project_id == project_id,
        Transaction.org_id == current_user.org_id,
    ).order_by(Transaction.created_at.desc()).all()

    total_debit = Decimal("0")
    total_credit = Decimal("0")
    rows = []
    for t in transactions:
        amt = t.amount or Decimal("0")
        if t.transaction_type in ("debit", "government_fee"):
            total_debit += amt
        else:
            total_credit += amt
        rows.append({
            "id": t.id,
            "date": t.created_at.isoformat() if t.created_at else None,
            "description": t.description,
            "type": t.transaction_type,
            "amount": float(amt),
            "status": t.status,
        })

    return {
        "project_id": project_id,
        "total_debit": float(total_debit),
        "total_credit": float(total_credit),
        "net": float(total_credit - total_debit),
        "transactions": rows,
    }


# ============= Activity Log =============

@router.get("/{project_id}/activity-log")
def get_project_activity_log(
    project_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    # Gather audit entries for this project + its tasks
    from sqlalchemy import or_
    entries = db.query(AuditLog).filter(
        AuditLog.org_id == current_user.org_id,
        or_(
            # Direct project actions
            (AuditLog.resource == "project") & (AuditLog.resource_id == project_id),
            # Project sub-resource actions
            (AuditLog.resource == "project_handover") & (AuditLog.resource_id == project_id),
            # Task actions (resource_id is the task id, but detail often contains project ref)
            (AuditLog.resource == "task") & (AuditLog.detail.like(f"%{project_id}%")),
            # Auto-complete
            (AuditLog.resource == "project") & (AuditLog.resource_id == project_id),
        ),
    ).order_by(AuditLog.timestamp.desc()).limit(limit).all()

    # Also fetch task-level audit entries by looking up task IDs in this project
    from models.project import Task
    task_ids = [t.id for t in db.query(Task.id).filter(Task.project_id == project_id).all()]
    if task_ids:
        task_entries = db.query(AuditLog).filter(
            AuditLog.org_id == current_user.org_id,
            AuditLog.resource.in_(["task", "task_comment"]),
            AuditLog.resource_id.in_(task_ids),
        ).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        # Merge and dedupe
        seen_ids = {e.id for e in entries}
        for te in task_entries:
            if te.id not in seen_ids:
                entries.append(te)
        entries.sort(key=lambda e: e.timestamp, reverse=True)
        entries = entries[:limit]

    result = []
    for e in entries:
        user_name = None
        if e.user_id:
            u = db.query(User).filter(User.id == e.user_id).first()
            user_name = u.full_name if u else e.user_email
        result.append({
            "id": e.id,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "user_id": e.user_id,
            "user_name": user_name or e.user_email,
            "action": e.action,
            "resource": e.resource,
            "resource_id": e.resource_id,
            "detail": e.detail,
        })
    return result


# ============= Project Documents (list + filter) =============

@router.get("/{project_id}/documents")
def list_project_documents(
    project_id: str,
    purpose: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project(db, project_id, current_user.org_id)
    q = db.query(Document).filter(
        Document.project_id == project_id,
        Document.org_id == current_user.org_id,
    )
    if purpose:
        q = q.filter(Document.purpose == purpose)
    docs = q.order_by(Document.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "file_name": d.file_name,
            "file_path": d.file_path,
            "category": d.category,
            "purpose": d.purpose,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]

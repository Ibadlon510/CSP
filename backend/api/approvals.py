"""Approvals API — list pending approvals, approve/reject."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.approval import ApprovalRequest, ApprovalProcessSetting
from models.project import ProjectProduct, ProjectDocumentChecklist
from models.product import ProductDocumentRequirement
from models.notification import Notification
from models.base import utcnow
from schemas.approval import (
    ApprovalRequestResponse,
    ApprovalActionPayload,
    ApprovalProcessSettingResponse,
    ApprovalProcessSettingUpdate,
)
from services.audit import log_action

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


def _enrich_approval(ar: ApprovalRequest, db: Session) -> ApprovalRequestResponse:
    d = ApprovalRequestResponse.model_validate(ar)
    if ar.requested_by:
        u = db.query(User).filter(User.id == ar.requested_by).first()
        d.requester_name = u.full_name if u else None
    if ar.approver_id:
        u = db.query(User).filter(User.id == ar.approver_id).first()
        d.approver_name = u.full_name if u else None
    # Build a human-readable label
    if ar.resource_type == "project_product":
        pp = db.query(ProjectProduct).filter(ProjectProduct.id == ar.resource_id).first()
        if pp and pp.product:
            d.resource_label = f"Non-billable product: {pp.product.name}"
    return d


@router.get("/", response_model=List[ApprovalRequestResponse])
def list_approvals(
    status: str = "pending",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List approval requests for the current user as approver."""
    q = db.query(ApprovalRequest).filter(
        ApprovalRequest.org_id == current_user.org_id,
        ApprovalRequest.approver_id == current_user.id,
    )
    if status:
        q = q.filter(ApprovalRequest.status == status)
    return [_enrich_approval(ar, db) for ar in q.order_by(ApprovalRequest.requested_at.desc()).all()]


@router.post("/{approval_id}/approve", response_model=ApprovalRequestResponse)
def approve_request(
    approval_id: str,
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ar = db.query(ApprovalRequest).filter(
        ApprovalRequest.id == approval_id,
        ApprovalRequest.org_id == current_user.org_id,
    ).first()
    if not ar:
        raise HTTPException(404, "Approval request not found")
    if ar.approver_id != current_user.id:
        raise HTTPException(403, "You are not the approver for this request")
    if ar.status != "pending":
        raise HTTPException(400, f"Request already {ar.status}")

    ar.status = "approved"
    ar.resolved_at = utcnow()
    ar.comment = payload.comment

    # Activate the resource
    if ar.resource_type == "project_product":
        pp = db.query(ProjectProduct).filter(ProjectProduct.id == ar.resource_id).first()
        if pp:
            pp.status = "active"
            # Append doc checklist now that product is approved
            _append_doc_checklist_for_product(db, pp.project_id, pp.org_id, pp.product_id)

    db.commit()

    # Notify requester
    if ar.requested_by:
        notif = Notification(
            org_id=ar.org_id,
            user_id=ar.requested_by,
            title="Approval Granted",
            message=f"Your request ({ar.request_type}) has been approved by {current_user.full_name}.",
            category="approval",
            resource_type=ar.resource_type,
            resource_id=ar.resource_id,
        )
        db.add(notif)
        db.commit()

    log_action(db, current_user.id, current_user.org_id,
               action="approve", resource="approval_request", resource_id=ar.id,
               detail=f"Approved {ar.request_type} for {ar.resource_type}:{ar.resource_id}")

    return _enrich_approval(ar, db)


@router.post("/{approval_id}/reject", response_model=ApprovalRequestResponse)
def reject_request(
    approval_id: str,
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ar = db.query(ApprovalRequest).filter(
        ApprovalRequest.id == approval_id,
        ApprovalRequest.org_id == current_user.org_id,
    ).first()
    if not ar:
        raise HTTPException(404, "Approval request not found")
    if ar.approver_id != current_user.id:
        raise HTTPException(403, "You are not the approver for this request")
    if ar.status != "pending":
        raise HTTPException(400, f"Request already {ar.status}")

    ar.status = "rejected"
    ar.resolved_at = utcnow()
    ar.comment = payload.comment

    # Mark resource as rejected
    if ar.resource_type == "project_product":
        pp = db.query(ProjectProduct).filter(ProjectProduct.id == ar.resource_id).first()
        if pp:
            pp.status = "rejected"

    db.commit()

    # Notify requester
    if ar.requested_by:
        reason = f" Reason: {payload.comment}" if payload.comment else ""
        notif = Notification(
            org_id=ar.org_id,
            user_id=ar.requested_by,
            title="Approval Rejected",
            message=f"Your request ({ar.request_type}) has been rejected by {current_user.full_name}.{reason}",
            category="approval",
            resource_type=ar.resource_type,
            resource_id=ar.resource_id,
        )
        db.add(notif)
        db.commit()

    log_action(db, current_user.id, current_user.org_id,
               action="reject", resource="approval_request", resource_id=ar.id,
               detail=f"Rejected {ar.request_type} for {ar.resource_type}:{ar.resource_id}")

    return _enrich_approval(ar, db)


# ============= Approval Process Settings =============

@router.get("/settings", response_model=List[ApprovalProcessSettingResponse])
def list_approval_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all approval process settings for this org."""
    settings = db.query(ApprovalProcessSetting).filter(
        ApprovalProcessSetting.org_id == current_user.org_id,
    ).all()
    result = []
    for s in settings:
        d = ApprovalProcessSettingResponse.model_validate(s)
        if s.fallback_approver_id:
            u = db.query(User).filter(User.id == s.fallback_approver_id).first()
            d.fallback_approver_name = u.full_name if u else None
        result.append(d)
    # Ensure at least a default row exists for non_billable_product
    if not any(s.approval_type == "non_billable_product" for s in settings):
        default = ApprovalProcessSetting(
            org_id=current_user.org_id,
            approval_type="non_billable_product",
            is_enabled=True,
        )
        db.add(default)
        db.commit()
        db.refresh(default)
        result.append(ApprovalProcessSettingResponse.model_validate(default))
    return result


@router.patch("/settings/{setting_id}", response_model=ApprovalProcessSettingResponse)
def update_approval_setting(
    setting_id: str,
    payload: ApprovalProcessSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(ApprovalProcessSetting).filter(
        ApprovalProcessSetting.id == setting_id,
        ApprovalProcessSetting.org_id == current_user.org_id,
    ).first()
    if not s:
        raise HTTPException(404, "Approval setting not found")
    if payload.is_enabled is not None:
        s.is_enabled = payload.is_enabled
    if payload.fallback_approver_id is not None:
        s.fallback_approver_id = payload.fallback_approver_id or None
    db.commit()
    db.refresh(s)
    d = ApprovalProcessSettingResponse.model_validate(s)
    if s.fallback_approver_id:
        u = db.query(User).filter(User.id == s.fallback_approver_id).first()
        d.fallback_approver_name = u.full_name if u else None
    return d


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

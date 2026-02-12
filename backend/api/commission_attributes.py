"""Commission Attributes API — CRUD for org-level commission attribute options."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.commission_attribute import CommissionAttribute
from schemas.sales_order import (
    CommissionAttributeCreate,
    CommissionAttributeUpdate,
    CommissionAttributeResponse,
)

router = APIRouter(prefix="/api/commission-attributes", tags=["Commission Attributes"])


@router.get("/", response_model=list[CommissionAttributeResponse])
def list_commission_attributes(
    is_active: bool | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(CommissionAttribute).filter(CommissionAttribute.org_id == current_user.org_id)
    if is_active is not None:
        q = q.filter(CommissionAttribute.is_active == is_active)
    return q.order_by(CommissionAttribute.sort_order, CommissionAttribute.label).all()


@router.post("/", response_model=CommissionAttributeResponse, status_code=status.HTTP_201_CREATED)
def create_commission_attribute(
    body: CommissionAttributeCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    ca = CommissionAttribute(
        org_id=current_user.org_id,
        label=body.label.strip(),
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(ca)
    db.commit()
    db.refresh(ca)
    return ca


@router.patch("/{attr_id}", response_model=CommissionAttributeResponse)
def update_commission_attribute(
    attr_id: str,
    body: CommissionAttributeUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    ca = db.query(CommissionAttribute).filter(
        CommissionAttribute.id == attr_id,
        CommissionAttribute.org_id == current_user.org_id,
    ).first()
    if not ca:
        raise HTTPException(status_code=404, detail="Commission attribute not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "label" and v is not None:
            v = v.strip()
        setattr(ca, k, v)
    db.commit()
    db.refresh(ca)
    return ca


@router.delete("/{attr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commission_attribute(
    attr_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    ca = db.query(CommissionAttribute).filter(
        CommissionAttribute.id == attr_id,
        CommissionAttribute.org_id == current_user.org_id,
    ).first()
    if not ca:
        raise HTTPException(status_code=404, detail="Commission attribute not found")
    db.delete(ca)
    db.commit()

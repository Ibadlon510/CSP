"""Saved search CRUD — user-saved filter/group presets with org sharing."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.saved_search import SavedSearch
from models.base import generate_uuid

router = APIRouter(prefix="/api/saved-searches", tags=["Saved Searches"])


# ── Schemas ──

class SavedSearchCreate(BaseModel):
    name: str
    page: str
    criteria: dict
    is_default: bool = False
    is_shared: bool = False


class SavedSearchUpdate(BaseModel):
    name: Optional[str] = None
    criteria: Optional[dict] = None
    is_default: Optional[bool] = None
    is_shared: Optional[bool] = None
    sort_order: Optional[int] = None


class SavedSearchResponse(BaseModel):
    id: str
    user_id: str
    name: str
    page: str
    criteria: dict
    is_default: bool
    is_shared: bool
    sort_order: int
    is_owned: bool = True
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ── Endpoints ──

@router.get("/", response_model=List[SavedSearchResponse])
def list_saved_searches(
    page: str = Query(..., description="Page key, e.g. 'my_tasks'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List own + org-shared saved searches for a given page."""
    rows = db.query(SavedSearch).filter(
        SavedSearch.page == page,
        or_(
            SavedSearch.user_id == current_user.id,
            (SavedSearch.org_id == current_user.org_id) & (SavedSearch.is_shared == True),
        ),
    ).order_by(SavedSearch.sort_order, SavedSearch.name).all()

    result = []
    for r in rows:
        is_owned = r.user_id == current_user.id
        creator = db.query(User).filter(User.id == r.user_id).first() if not is_owned else current_user
        result.append(SavedSearchResponse(
            id=r.id,
            user_id=r.user_id,
            name=r.name,
            page=r.page,
            criteria=r.criteria or {},
            is_default=r.is_default,
            is_shared=r.is_shared,
            sort_order=r.sort_order,
            is_owned=is_owned,
            created_by_name=creator.full_name if creator else None,
            created_at=r.created_at.isoformat() if r.created_at else "",
            updated_at=r.updated_at.isoformat() if r.updated_at else "",
        ))
    return result


@router.post("/", response_model=SavedSearchResponse)
def create_saved_search(
    payload: SavedSearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a named saved search."""
    # Check for duplicate name on same page
    existing = db.query(SavedSearch).filter(
        SavedSearch.user_id == current_user.id,
        SavedSearch.page == payload.page,
        SavedSearch.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(409, f"A saved search named '{payload.name}' already exists on this page")

    # If setting as default, unset any existing default for this user+page
    if payload.is_default:
        db.query(SavedSearch).filter(
            SavedSearch.user_id == current_user.id,
            SavedSearch.page == payload.page,
            SavedSearch.is_default == True,
        ).update({"is_default": False})

    ss = SavedSearch(
        id=generate_uuid(),
        user_id=current_user.id,
        org_id=current_user.org_id,
        name=payload.name,
        page=payload.page,
        criteria=payload.criteria,
        is_default=payload.is_default,
        is_shared=payload.is_shared,
    )
    db.add(ss)
    db.commit()
    db.refresh(ss)

    return SavedSearchResponse(
        id=ss.id,
        user_id=ss.user_id,
        name=ss.name,
        page=ss.page,
        criteria=ss.criteria or {},
        is_default=ss.is_default,
        is_shared=ss.is_shared,
        sort_order=ss.sort_order,
        is_owned=True,
        created_by_name=current_user.full_name,
        created_at=ss.created_at.isoformat() if ss.created_at else "",
        updated_at=ss.updated_at.isoformat() if ss.updated_at else "",
    )


@router.patch("/{search_id}", response_model=SavedSearchResponse)
def update_saved_search(
    search_id: str,
    payload: SavedSearchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a saved search (owner only)."""
    ss = db.query(SavedSearch).filter(SavedSearch.id == search_id).first()
    if not ss:
        raise HTTPException(404, "Saved search not found")
    if ss.user_id != current_user.id:
        raise HTTPException(403, "Only the owner can edit this saved search")

    if payload.name is not None:
        # Check uniqueness
        dup = db.query(SavedSearch).filter(
            SavedSearch.user_id == current_user.id,
            SavedSearch.page == ss.page,
            SavedSearch.name == payload.name,
            SavedSearch.id != search_id,
        ).first()
        if dup:
            raise HTTPException(409, f"A saved search named '{payload.name}' already exists")
        ss.name = payload.name

    if payload.criteria is not None:
        ss.criteria = payload.criteria
    if payload.is_shared is not None:
        ss.is_shared = payload.is_shared
    if payload.sort_order is not None:
        ss.sort_order = payload.sort_order

    if payload.is_default is not None:
        if payload.is_default:
            # Unset other defaults for this user+page
            db.query(SavedSearch).filter(
                SavedSearch.user_id == current_user.id,
                SavedSearch.page == ss.page,
                SavedSearch.is_default == True,
                SavedSearch.id != search_id,
            ).update({"is_default": False})
        ss.is_default = payload.is_default

    db.commit()
    db.refresh(ss)

    return SavedSearchResponse(
        id=ss.id,
        user_id=ss.user_id,
        name=ss.name,
        page=ss.page,
        criteria=ss.criteria or {},
        is_default=ss.is_default,
        is_shared=ss.is_shared,
        sort_order=ss.sort_order,
        is_owned=True,
        created_by_name=current_user.full_name,
        created_at=ss.created_at.isoformat() if ss.created_at else "",
        updated_at=ss.updated_at.isoformat() if ss.updated_at else "",
    )


@router.delete("/{search_id}")
def delete_saved_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a saved search (owner only)."""
    ss = db.query(SavedSearch).filter(SavedSearch.id == search_id).first()
    if not ss:
        raise HTTPException(404, "Saved search not found")
    if ss.user_id != current_user.id:
        raise HTTPException(403, "Only the owner can delete this saved search")

    db.delete(ss)
    db.commit()
    return {"ok": True}

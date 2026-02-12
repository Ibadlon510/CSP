"""User management endpoints (admin only)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from core.deps import require_admin
from core.security import hash_password
from models.user import User, UserRole
from schemas.auth import UserResponse

router = APIRouter(prefix="/api/users", tags=["Users"])


class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = UserRole.PRO


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    manager_id: str | None = None


@router.get("/", response_model=list[UserResponse])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users in the admin's organization."""
    users = db.query(User).filter(User.org_id == admin.org_id).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            org_id=u.org_id,
            org_name=admin.organization.name if admin.organization else None,
            manager_id=u.manager_id,
        )
        for u in users
    ]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    req: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin creates a user within their org."""
    if req.role not in UserRole.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {UserRole.ALL}")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
        org_id=admin.org_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_active=user.is_active, org_id=user.org_id,
        org_name=admin.organization.name if admin.organization else None,
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    req: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin updates a user in their org."""
    user = db.query(User).filter(User.id == user_id, User.org_id == admin.org_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.role is not None:
        if req.role not in UserRole.ALL:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {UserRole.ALL}")
        user.role = req.role
    if req.is_active is not None:
        user.is_active = req.is_active
    if req.manager_id is not None:
        user.manager_id = req.manager_id if req.manager_id else None
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role, is_active=user.is_active, org_id=user.org_id,
        org_name=admin.organization.name if admin.organization else None,
        manager_id=user.manager_id,
    )

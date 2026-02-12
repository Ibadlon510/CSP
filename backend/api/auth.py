"""Auth endpoints — register, login, me."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token
from core.deps import get_current_user
from models.user import User, UserRole
from models.organization import Organization
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from services.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new user. Optionally creates an organization."""
    # Check duplicate email
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create org if name provided
    org = None
    if req.org_name:
        org = Organization(name=req.org_name)
        db.add(org)
        db.flush()

    # Create user
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=UserRole.ADMIN if org else UserRole.CLIENT,
        org_id=org.id if org else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Audit
    log_action(
        db,
        action="user.register",
        user_id=user.id,
        user_email=user.email,
        org_id=user.org_id,
        resource="user",
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
    )

    token = create_access_token({"sub": user.id, "role": user.role, "org_id": user.org_id})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Login with email + password, returns JWT."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    log_action(
        db,
        action="user.login",
        user_id=user.id,
        user_email=user.email,
        org_id=user.org_id,
        ip_address=request.client.host if request.client else None,
    )

    token = create_access_token({"sub": user.id, "role": user.role, "org_id": user.org_id})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        org_id=current_user.org_id,
        org_name=current_user.organization.name if current_user.organization else None,
    )

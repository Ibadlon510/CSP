"""Auth endpoints — register, login, me."""
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token, decode_access_token
from core.deps import get_current_user
from models.user import User, UserRole
from models.organization import Organization
from schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse,
)
from services.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ── Lightweight in-memory rate limiter ──
_RATE_WINDOW = 60  # seconds
_RATE_LIMIT = 10   # max requests per window per IP
_rate_log: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(request: Request):
    """Raise 429 if the client IP exceeds the rate limit."""
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    hits = _rate_log[ip]
    # Prune old entries
    _rate_log[ip] = [t for t in hits if now - t < _RATE_WINDOW]
    if len(_rate_log[ip]) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    _rate_log[ip].append(now)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new user. Optionally creates an organization."""
    _check_rate_limit(request)
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
    _check_rate_limit(request)
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


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Request a password reset. Generates a short-lived reset token.
    In production with SMTP, the token would be emailed. For now it is
    logged server-side and returned in DEBUG mode only."""
    import logging
    _check_rate_limit(request)
    user = db.query(User).filter(User.email == req.email).first()
    # Always return success to avoid email enumeration
    if not user:
        return MessageResponse(message="If that email exists, a reset link has been sent.")
    reset_token = create_access_token(
        {"sub": user.id, "purpose": "password_reset"},
        expires_minutes=15,
    )
    logging.getLogger("csp-erp").info("Password reset token for %s: %s", user.email, reset_token)
    log_action(db, action="user.forgot_password", user_id=user.id, user_email=user.email,
               ip_address=request.client.host if request.client else None)
    # TODO: Send email with reset link when SMTP is configured
    from core.config import settings
    msg = "If that email exists, a reset link has been sent."
    if settings.debug:
        msg = f"[DEBUG] Reset token: {reset_token}"
    return MessageResponse(message=msg)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Reset password using a valid reset token."""
    _check_rate_limit(request)
    payload = decode_access_token(req.token)
    if not payload or payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.hashed_password = hash_password(req.new_password)
    db.commit()
    log_action(db, action="user.reset_password", user_id=user.id, user_email=user.email,
               ip_address=request.client.host if request.client else None)
    return MessageResponse(message="Password has been reset successfully. You can now log in.")

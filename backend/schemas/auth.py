"""Auth request/response schemas."""
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    org_name: str | None = None  # If provided, creates a new organization


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    org_id: str | None = None
    org_name: str | None = None
    manager_id: str | None = None

    class Config:
        from_attributes = True

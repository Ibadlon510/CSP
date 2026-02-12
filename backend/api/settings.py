"""Settings API: system, technical, defaults, access rights, module settings."""
import json
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings as app_settings
from core.database import get_db, SessionLocal
from core.deps import get_current_user, require_roles
from models.user import User, UserRole
from models.org_settings import OrganizationSettings, OrgModuleSetting, ModuleId
from models.user_module_permission import UserModulePermission
from models.organization import Organization
from schemas.settings import (
    TechnicalInfoResponse,
    RoleDefinition,
    DefaultsResponse,
    DefaultsUpdateRequest,
    ModuleSettingItem,
    ModuleSettingsResponse,
    ModuleSettingsUpdateRequest,
    SystemInfoResponse,
)
from sqlalchemy import text

router = APIRouter(prefix="/api/settings", tags=["Settings"])

# Role definitions with capabilities
ROLE_DEFINITIONS: list[RoleDefinition] = [
    RoleDefinition(
        id=UserRole.SUPER_ADMIN,
        label="Super Admin",
        description="Platform/tenant owner. Full access to all settings.",
        can_view_system=True,
        can_edit_system=True,
        can_view_technical=True,
        can_view_defaults=True,
        can_edit_defaults=True,
        can_view_access_rights=True,
        can_edit_access_rights=True,
        can_view_module_settings=True,
        can_edit_module_settings=True,
    ),
    RoleDefinition(
        id=UserRole.ADMIN,
        label="Admin",
        description="Organization admin. Full org settings except some system-level.",
        can_view_system=True,
        can_edit_system=False,
        can_view_technical=True,
        can_view_defaults=True,
        can_edit_defaults=True,
        can_view_access_rights=True,
        can_edit_access_rights=True,
        can_view_module_settings=True,
        can_edit_module_settings=True,
    ),
    RoleDefinition(
        id=UserRole.MANAGER,
        label="Manager",
        description="Team lead. Can view technical and defaults; edit if delegated.",
        can_view_system=False,
        can_edit_system=False,
        can_view_technical=True,
        can_view_defaults=True,
        can_edit_defaults=False,
        can_view_access_rights=False,
        can_edit_access_rights=False,
        can_view_module_settings=True,
        can_edit_module_settings=False,
    ),
    RoleDefinition(
        id=UserRole.PRO,
        label="PRO",
        description="Field PRO. Can edit module settings if delegated.",
        can_view_system=False,
        can_edit_system=False,
        can_view_technical=False,
        can_view_defaults=False,
        can_edit_defaults=False,
        can_view_access_rights=False,
        can_edit_access_rights=False,
        can_view_module_settings=True,  # Only delegated modules
        can_edit_module_settings=False,  # Only if delegated
    ),
    RoleDefinition(
        id=UserRole.ACCOUNTANT,
        label="Accountant",
        description="Finance. Can edit financial defaults if delegated.",
        can_view_system=False,
        can_edit_system=False,
        can_view_technical=False,
        can_view_defaults=True,
        can_edit_defaults=False,  # Only if delegated
        can_view_access_rights=False,
        can_edit_access_rights=False,
        can_view_module_settings=True,
        can_edit_module_settings=False,
    ),
    RoleDefinition(
        id=UserRole.CLIENT,
        label="Client",
        description="External client. No settings access.",
        can_view_system=False,
        can_edit_system=False,
        can_view_technical=False,
        can_view_defaults=False,
        can_edit_defaults=False,
        can_view_access_rights=False,
        can_edit_access_rights=False,
        can_view_module_settings=False,
        can_edit_module_settings=False,
    ),
]

# Module labels for UI
MODULE_LABELS = {
    ModuleId.CONTACTS: "Contacts",
    ModuleId.CRM: "CRM",
    ModuleId.QUOTATIONS: "Quotations",
    ModuleId.ORDERS: "Orders",
    ModuleId.INVOICES: "Invoices",
    ModuleId.DOCUMENTS: "Documents",
    ModuleId.WALLETS: "Wallets",
    ModuleId.PROJECTS: "Projects",
    ModuleId.USERS: "Users",
    ModuleId.COMPLIANCE: "Compliance",
    ModuleId.CALENDAR: "Calendar",
}


def _require_settings_view(current_user: User = Depends(get_current_user)) -> User:
    """Allow admin, manager, accountant to view at least some settings."""
    if current_user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT):
        return current_user
    # PRO can view only if they have module permission
    return current_user


def _require_admin_or_super(current_user: User = Depends(get_current_user)) -> User:
    """Restrict to admin/super_admin."""
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _get_org_settings(db: Session, org_id: str) -> OrganizationSettings | None:
    return db.query(OrganizationSettings).filter(OrganizationSettings.org_id == org_id).first()


def _ensure_org_settings(db: Session, org_id: str) -> OrganizationSettings:
    s = _get_org_settings(db, org_id)
    if s is None:
        s = OrganizationSettings(org_id=org_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _get_db_status() -> str:
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return "ok"
    except Exception:
        return "degraded"


@router.get("/technical", response_model=TechnicalInfoResponse)
def get_technical_info(
    current_user: User = Depends(_require_settings_view),
    db: Session = Depends(get_db),
):
    """Read-only technical info. Access: admin, manager."""
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    env = "development" if app_settings.debug else "production"
    db_status = _get_db_status()
    return TechnicalInfoResponse(
        api_version="0.1.0",
        service="csp-erp-api",
        environment=env,
        debug=app_settings.debug,
        database_status=db_status,
        jwt_expire_minutes=app_settings.jwt_expire_minutes,
    )


@router.get("/roles", response_model=List[RoleDefinition])
def list_roles(
    current_user: User = Depends(_require_admin_or_super),
):
    """List role definitions and capabilities. Access: admin only."""
    return ROLE_DEFINITIONS


@router.get("/system", response_model=SystemInfoResponse)
def get_system_info(
    current_user: User = Depends(_require_admin_or_super),
    db: Session = Depends(get_db),
):
    """Org profile (read). Access: admin only."""
    if not current_user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No organization")
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return SystemInfoResponse(
        org_id=org.id,
        org_name=org.name,
        subdomain=org.subdomain,
        is_active=org.is_active,
    )


@router.get("/defaults", response_model=DefaultsResponse)
def get_defaults(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get org defaults. Access: admin, manager, accountant (view)."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    s = _get_org_settings(db, current_user.org_id)
    if s is None:
        return DefaultsResponse()
    expiry_days = [90, 60, 30]
    if s.expiry_alert_days:
        try:
            expiry_days = json.loads(s.expiry_alert_days)
        except (json.JSONDecodeError, TypeError):
            pass
    return DefaultsResponse(
        default_wallet_min_balance=s.default_wallet_min_balance or Decimal("1000"),
        default_vat_rate=s.default_vat_rate or Decimal("5.00"),
        default_currency=s.default_currency or "AED",
        quotation_prefix=s.quotation_prefix or "QUO",
        order_prefix=s.order_prefix or "ORD",
        invoice_prefix=s.invoice_prefix or "INV",
        number_padding=str(s.number_padding) if s.number_padding else "3",
        expiry_alert_days=expiry_days,
    )


@router.patch("/defaults", response_model=DefaultsResponse)
def update_defaults(
    payload: DefaultsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update org defaults. Access: admin, or delegated (accountant for financial)."""
    can_edit = current_user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN)
    if not can_edit:
        # Check if accountant has delegation (via UserModulePermission for "defaults" or "wallets")
        perm = db.query(UserModulePermission).filter(
            UserModulePermission.user_id == current_user.id,
            UserModulePermission.module_id.in_(["defaults", "wallets"]),
            UserModulePermission.permission == "settings",
        ).first()
        if not perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    s = _ensure_org_settings(db, current_user.org_id)
    if payload.default_wallet_min_balance is not None:
        s.default_wallet_min_balance = payload.default_wallet_min_balance
    if payload.default_vat_rate is not None:
        s.default_vat_rate = payload.default_vat_rate
    if payload.default_currency is not None:
        s.default_currency = payload.default_currency
    if payload.quotation_prefix is not None:
        s.quotation_prefix = payload.quotation_prefix
    if payload.order_prefix is not None:
        s.order_prefix = payload.order_prefix
    if payload.invoice_prefix is not None:
        s.invoice_prefix = payload.invoice_prefix
    if payload.number_padding is not None:
        s.number_padding = str(payload.number_padding)
    if payload.expiry_alert_days is not None:
        s.expiry_alert_days = json.dumps(payload.expiry_alert_days)
    db.commit()
    db.refresh(s)
    expiry_days = [90, 60, 30]
    if s.expiry_alert_days:
        try:
            expiry_days = json.loads(s.expiry_alert_days)
        except (json.JSONDecodeError, TypeError):
            pass
    return DefaultsResponse(
        default_wallet_min_balance=s.default_wallet_min_balance or Decimal("1000"),
        default_vat_rate=s.default_vat_rate or Decimal("5.00"),
        default_currency=s.default_currency or "AED",
        quotation_prefix=s.quotation_prefix or "QUO",
        order_prefix=s.order_prefix or "ORD",
        invoice_prefix=s.invoice_prefix or "INV",
        number_padding=str(s.number_padding) if s.number_padding else "3",
        expiry_alert_days=expiry_days,
    )


@router.get("/modules", response_model=ModuleSettingsResponse)
def get_module_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get module visibility. Access: admin, manager (view)."""
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    rows = db.query(OrgModuleSetting).filter(OrgModuleSetting.org_id == current_user.org_id).all()
    by_module = {r.module_id: r.enabled for r in rows}
    items = []
    for mid in ModuleId.ALL:
        enabled = by_module.get(mid, True)  # Default enabled
        items.append(ModuleSettingItem(module_id=mid, label=MODULE_LABELS.get(mid, mid), enabled=enabled))
    return ModuleSettingsResponse(modules=items)


@router.patch("/modules", response_model=ModuleSettingsResponse)
def update_module_setting(
    payload: ModuleSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update single module visibility. Access: admin or delegated module permission."""
    can_edit = current_user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN)
    if not can_edit:
        perm = db.query(UserModulePermission).filter(
            UserModulePermission.user_id == current_user.id,
            UserModulePermission.module_id == payload.module_id,
            UserModulePermission.permission == "settings",
        ).first()
        if not perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this module")
    if payload.module_id not in ModuleId.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid module_id. Must be one of: {ModuleId.ALL}")
    if not current_user.org_id:
        raise HTTPException(status_code=404, detail="No organization")
    row = db.query(OrgModuleSetting).filter(
        OrgModuleSetting.org_id == current_user.org_id,
        OrgModuleSetting.module_id == payload.module_id,
    ).first()
    if row is None:
        row = OrgModuleSetting(org_id=current_user.org_id, module_id=payload.module_id, enabled=payload.enabled)
        db.add(row)
    else:
        row.enabled = payload.enabled
    db.commit()
    db.refresh(row)
    return get_module_settings(current_user=current_user, db=db)


@router.get("/access/visible-sections")
def get_visible_sections(current_user: User = Depends(get_current_user)):
    """Return which settings sections the current user can see."""
    role_def = next((r for r in ROLE_DEFINITIONS if r.id == current_user.role), None)
    if not role_def:
        return {"system": False, "technical": False, "defaults": False, "access_rights": False, "modules": False, "approvals": False}
    return {
        "system": role_def.can_view_system,
        "technical": role_def.can_view_technical,
        "defaults": role_def.can_view_defaults or role_def.can_edit_defaults,
        "access_rights": role_def.can_view_access_rights,
        "modules": role_def.can_view_module_settings or role_def.can_edit_module_settings,
        "approvals": current_user.role in ("super_admin", "admin", "manager"),
    }

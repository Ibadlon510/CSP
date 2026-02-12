"""Settings API schemas."""
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class TechnicalInfoResponse(BaseModel):
    """Read-only technical information."""
    api_version: str = "0.1.0"
    service: str = "csp-erp-api"
    environment: str  # development | production
    debug: bool
    database_status: str
    jwt_expire_minutes: int


class RoleDefinition(BaseModel):
    """Role with description and capabilities."""
    id: str
    label: str
    description: str
    can_view_system: bool = False
    can_edit_system: bool = False
    can_view_technical: bool = False
    can_view_defaults: bool = False
    can_edit_defaults: bool = False
    can_view_access_rights: bool = False
    can_edit_access_rights: bool = False
    can_view_module_settings: bool = False
    can_edit_module_settings: bool = False


class DefaultsResponse(BaseModel):
    """Org defaults (read)."""
    default_wallet_min_balance: Decimal = Field(default=Decimal("1000"))
    default_vat_rate: Decimal = Field(default=Decimal("5.00"))
    default_currency: str = "AED"
    quotation_prefix: str = "QUO"
    order_prefix: str = "ORD"
    invoice_prefix: str = "INV"
    number_padding: str = "3"
    expiry_alert_days: list[int] = Field(default_factory=lambda: [90, 60, 30])


class DefaultsUpdateRequest(BaseModel):
    """Org defaults (update)."""
    default_wallet_min_balance: Optional[Decimal] = None
    default_vat_rate: Optional[Decimal] = None
    default_currency: Optional[str] = None
    quotation_prefix: Optional[str] = None
    order_prefix: Optional[str] = None
    invoice_prefix: Optional[str] = None
    number_padding: Optional[str] = None
    expiry_alert_days: Optional[list[int]] = None


class ModuleSettingItem(BaseModel):
    """Single module enabled/disabled."""
    module_id: str
    label: str
    enabled: bool


class ModuleSettingsResponse(BaseModel):
    """All module settings for org."""
    modules: list[ModuleSettingItem]


class ModuleSettingsUpdateRequest(BaseModel):
    """Update module visibility."""
    module_id: str
    enabled: bool


class SystemInfoResponse(BaseModel):
    """System / org profile (read)."""
    org_id: str
    org_name: str
    subdomain: Optional[str] = None
    is_active: bool


class UserModulePermissionResponse(BaseModel):
    """User module permission (for access rights page)."""
    id: str
    user_id: str
    user_email: str
    user_name: str
    module_id: str
    permission: str

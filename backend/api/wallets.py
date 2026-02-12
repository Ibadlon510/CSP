"""
Wallets API - Trust-based financial management
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from typing import List, Optional
from decimal import Decimal

from core.database import get_db
from core.deps import get_current_user, require_roles
from models.user import User, UserRole
from models.wallet import ClientWallet, Transaction, WalletAlert, WalletStatus, TransactionType, TransactionStatus, AlertLevel
from models.contact import Contact
from schemas.wallet import (
    ClientWalletCreate, 
    ClientWalletUpdate, 
    ClientWalletResponse,
    TransactionCreate,
    TransactionResponse,
    WalletAlertResponse,
    WalletAlertResolve,
    TopUpRequest,
    FeeChargeRequest,
    WalletSummary
)
from services.audit import log_action
from models.base import utcnow
from models.org_settings import OrganizationSettings

router = APIRouter(prefix="/api/wallets", tags=["wallets"])


def _get_org_wallet_defaults(db: Session, org_id: str) -> tuple[Decimal, str]:
    """Get default minimum_balance and currency from org settings."""
    s = db.query(OrganizationSettings).filter(OrganizationSettings.org_id == org_id).first()
    if s is None:
        return Decimal("1000.00"), "AED"
    min_bal = s.default_wallet_min_balance if s.default_wallet_min_balance is not None else Decimal("1000.00")
    curr = s.default_currency or "AED"
    return min_bal, curr


def check_and_create_alert(wallet: ClientWallet, db: Session):
    """Check if wallet is below threshold and create alert if needed"""
    if wallet.balance < wallet.minimum_balance:
        # Check if there's already an active critical alert
        existing = db.query(WalletAlert).filter(
            WalletAlert.wallet_id == wallet.id,
            WalletAlert.level == AlertLevel.CRITICAL,
            WalletAlert.is_resolved == False
        ).first()
        
        if not existing:
            alert = WalletAlert(
                wallet_id=wallet.id,
                org_id=wallet.org_id,
                level=AlertLevel.CRITICAL,
                title="🚨 Red Alert: Low Wallet Balance",
                message=f"Wallet balance ({wallet.balance} {wallet.currency}) is below minimum threshold ({wallet.minimum_balance} {wallet.currency}). Immediate top-up required.",
                balance_at_alert=wallet.balance,
                threshold_at_alert=wallet.minimum_balance
            )
            db.add(alert)


def resolve_low_balance_alerts(wallet: ClientWallet, db: Session, resolved_by_user_id: str):
    """Resolve low balance alerts if balance is back above threshold"""
    if wallet.balance >= wallet.minimum_balance:
        alerts = db.query(WalletAlert).filter(
            WalletAlert.wallet_id == wallet.id,
            WalletAlert.level == AlertLevel.CRITICAL,
            WalletAlert.is_resolved == False
        ).all()
        
        for alert in alerts:
            alert.is_resolved = True
            alert.resolved_at = utcnow()
            alert.resolved_by = resolved_by_user_id


@router.get("/", response_model=List[ClientWalletResponse])
def list_wallets(
    status: Optional[str] = None,
    below_threshold: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all wallets for the organization"""
    query = db.query(ClientWallet).filter(ClientWallet.org_id == current_user.org_id)
    
    if status:
        query = query.filter(ClientWallet.status == status)
    
    if below_threshold is not None:
        if below_threshold:
            query = query.filter(ClientWallet.balance < ClientWallet.minimum_balance)
        else:
            query = query.filter(ClientWallet.balance >= ClientWallet.minimum_balance)
    
    wallets = query.options(joinedload(ClientWallet.contact)).all()
    
    # Enrich with contact name and alert status
    result = []
    for w in wallets:
        data = ClientWalletResponse.model_validate(w)
        data.contact_name = w.contact.name if w.contact else None
        data.is_below_threshold = w.balance < w.minimum_balance
        
        # Check for active alerts
        active_alert_count = db.query(func.count(WalletAlert.id)).filter(
            WalletAlert.wallet_id == w.id,
            WalletAlert.is_resolved == False
        ).scalar()
        data.has_active_alerts = active_alert_count > 0
        
        result.append(data)
    
    return result


@router.post("/", response_model=ClientWalletResponse)
def create_wallet(
    payload: ClientWalletCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]))
):
    """Create a new wallet for a contact."""
    contact = db.query(Contact).filter(
        Contact.id == payload.contact_id,
        Contact.org_id == current_user.org_id
    ).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    existing = db.query(ClientWallet).filter(ClientWallet.contact_id == payload.contact_id).first()
    if existing:
        raise HTTPException(400, "Wallet already exists for this contact")

    default_min, default_currency = _get_org_wallet_defaults(db, current_user.org_id)
    currency = payload.currency if payload.currency is not None else default_currency
    minimum_balance = payload.minimum_balance if payload.minimum_balance is not None else default_min

    wallet = ClientWallet(
        contact_id=payload.contact_id,
        org_id=current_user.org_id,
        currency=currency,
        minimum_balance=minimum_balance,
        notes=payload.notes,
        balance=Decimal("0.00")
    )
    
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    
    detail_msg = f"Created wallet for contact {contact.name}"
    log_action(
        db, current_user.id, current_user.org_id,
        action="create", resource="wallet", resource_id=wallet.id,
        detail=detail_msg
    )
    
    # Check for Red Alert on creation
    check_and_create_alert(wallet, db)
    db.commit()
    db.refresh(wallet)
    wallet = db.query(ClientWallet).options(joinedload(ClientWallet.contact)).filter(ClientWallet.id == wallet.id).first()
    data = ClientWalletResponse.model_validate(wallet)
    data.contact_name = wallet.contact.name if wallet.contact else None
    data.is_below_threshold = wallet.balance < wallet.minimum_balance
    active_alert_count = db.query(func.count(WalletAlert.id)).filter(WalletAlert.wallet_id == wallet.id, WalletAlert.is_resolved == False).scalar()
    data.has_active_alerts = (active_alert_count or 0) > 0
    return data


@router.get("/vat-report")
def get_vat_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Monthly VAT summary: total VAT collected (service fees at 5%)."""
    from datetime import datetime
    from sqlalchemy import and_, extract

    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month

    # Transactions with VAT (fee_charge with vat_amount > 0)
    query = db.query(Transaction).filter(
        Transaction.org_id == current_user.org_id,
        Transaction.type == TransactionType.FEE_CHARGE,
        extract("year", Transaction.created_at) == y,
        extract("month", Transaction.created_at) == m,
    )
    # Filter where vat_amount is not null and > 0 (when we have the column)
    try:
        rows = query.all()
    except Exception:
        rows = []

    total_vat = Decimal("0.00")
    total_exclusive = Decimal("0.00")
    count = 0
    for t in rows:
        vat = getattr(t, "vat_amount", None) or Decimal("0.00")
        if vat and float(vat) > 0:
            total_vat += vat
            total_exclusive += getattr(t, "amount_exclusive", None) or abs(t.amount)
            count += 1

    return {
        "month": m,
        "year": y,
        "total_vat_collected": float(total_vat),
        "total_exclusive": float(total_exclusive),
        "transaction_count_with_vat": count,
        "currency": "AED",
    }


@router.get("/summary", response_model=WalletSummary)
def get_wallet_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get wallet summary statistics"""
    total = db.query(func.count(ClientWallet.id)).filter(
        ClientWallet.org_id == current_user.org_id
    ).scalar() or 0
    
    active = db.query(func.count(ClientWallet.id)).filter(
        ClientWallet.org_id == current_user.org_id,
        ClientWallet.status == WalletStatus.ACTIVE
    ).scalar() or 0
    
    total_balance = db.query(func.sum(ClientWallet.balance)).filter(
        ClientWallet.org_id == current_user.org_id,
        ClientWallet.status == WalletStatus.ACTIVE
    ).scalar() or Decimal("0.00")
    
    below_threshold = db.query(func.count(ClientWallet.id)).filter(
        ClientWallet.org_id == current_user.org_id,
        ClientWallet.balance < ClientWallet.minimum_balance
    ).scalar() or 0
    
    critical_alerts = db.query(func.count(WalletAlert.id)).filter(
        WalletAlert.org_id == current_user.org_id,
        WalletAlert.level == AlertLevel.CRITICAL,
        WalletAlert.is_resolved == False
    ).scalar() or 0
    
    return WalletSummary(
        total_wallets=total,
        active_wallets=active,
        total_balance=total_balance,
        wallets_below_threshold=below_threshold,
        critical_alerts=critical_alerts
    )


@router.get("/{wallet_id}", response_model=ClientWalletResponse)
def get_wallet(
    wallet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get wallet details"""
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).options(joinedload(ClientWallet.contact)).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    data = ClientWalletResponse.model_validate(wallet)
    data.contact_name = wallet.contact.name if wallet.contact else None
    data.is_below_threshold = wallet.balance < wallet.minimum_balance
    
    # Check for active alerts
    active_alert_count = db.query(func.count(WalletAlert.id)).filter(
        WalletAlert.wallet_id == wallet.id,
        WalletAlert.is_resolved == False
    ).scalar()
    data.has_active_alerts = active_alert_count > 0
    
    return data


@router.patch("/{wallet_id}", response_model=ClientWalletResponse)
def update_wallet(
    wallet_id: str,
    payload: ClientWalletUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]))
):
    """Update wallet settings"""
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    if payload.minimum_balance is not None:
        wallet.minimum_balance = payload.minimum_balance
    if payload.status is not None:
        wallet.status = payload.status
    if payload.is_locked is not None:
        wallet.is_locked = payload.is_locked
    if payload.notes is not None:
        wallet.notes = payload.notes
    
    db.commit()
    db.refresh(wallet)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="update", resource="wallet", resource_id=wallet.id,
        detail="Updated wallet settings"
    )
    
    # Re-check alerts after update
    check_and_create_alert(wallet, db)
    resolve_low_balance_alerts(wallet, db, current_user.id)
    db.commit()
    db.refresh(wallet)
    wallet = db.query(ClientWallet).options(joinedload(ClientWallet.contact)).filter(ClientWallet.id == wallet.id).first()
    data = ClientWalletResponse.model_validate(wallet)
    data.contact_name = wallet.contact.name if wallet.contact else None
    data.is_below_threshold = wallet.balance < wallet.minimum_balance
    active_alert_count = db.query(func.count(WalletAlert.id)).filter(WalletAlert.wallet_id == wallet.id, WalletAlert.is_resolved == False).scalar()
    data.has_active_alerts = (active_alert_count or 0) > 0
    return data


@router.delete("/{wallet_id}")
def delete_wallet(
    wallet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Delete a wallet (admin only)"""
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    if wallet.balance != 0:
        raise HTTPException(400, "Cannot delete wallet with non-zero balance")
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="delete", resource="wallet", resource_id=wallet.id,
        detail=f"Deleted wallet {wallet_id}"
    )
    
    db.delete(wallet)
    db.commit()
    
    return {"message": "Wallet deleted successfully"}


# ============= Transaction Endpoints =============

@router.get("/{wallet_id}/transactions", response_model=List[TransactionResponse])
def list_transactions(
    wallet_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List transactions for a wallet"""
    # Verify wallet ownership
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    transactions = db.query(Transaction).filter(
        Transaction.wallet_id == wallet_id
    ).order_by(Transaction.created_at.desc()).limit(limit).offset(offset).all()
    
    return [TransactionResponse.model_validate(t) for t in transactions]


VAT_RATE = Decimal("0.05")  # 5% UAE


@router.post("/{wallet_id}/fee-charge", response_model=TransactionResponse)
def fee_charge_wallet(
    wallet_id: str,
    payload: FeeChargeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT]))
):
    """Record a fee charge (debit). Optional VAT (5% for service fee) and link to project/task."""
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    if wallet.is_locked:
        raise HTTPException(400, "Wallet is locked")
    
    if wallet.status != WalletStatus.ACTIVE:
        raise HTTPException(400, "Wallet is not active")
    
    if payload.apply_vat:
        amount_exclusive = payload.amount
        vat_amount = (amount_exclusive * VAT_RATE).quantize(Decimal("0.01"))
        amount_total = amount_exclusive + vat_amount
    else:
        amount_exclusive = payload.amount
        vat_amount = Decimal("0.00")
        amount_total = payload.amount
    
    debit_amount = -amount_total
    balance_before = wallet.balance
    balance_after = balance_before + debit_amount
    
    if balance_after < 0 and not payload.red_alert_override:
        raise HTTPException(
            400,
            f"Insufficient funds. Balance: {balance_before} {wallet.currency}, required: {amount_total}. Use red_alert_override with manager approval."
        )
    
    if balance_after < 0 and payload.red_alert_override:
        log_action(
            db, current_user.id, current_user.org_id,
            action="red_alert_override", resource="wallet", resource_id=wallet_id,
            detail=f"Manager override: fee charge {amount_total} {wallet.currency} despite negative balance"
        )
    
    wallet.balance = balance_after
    
    transaction = Transaction(
        wallet_id=wallet_id,
        org_id=current_user.org_id,
        type=TransactionType.FEE_CHARGE,
        amount=debit_amount,
        currency=wallet.currency,
        amount_exclusive=amount_exclusive,
        vat_amount=vat_amount,
        amount_total=amount_total,
        balance_before=balance_before,
        balance_after=balance_after,
        status=TransactionStatus.COMPLETED,
        description=payload.description,
        reference_id=payload.reference_id,
        project_id=payload.project_id,
        task_id=payload.task_id,
        created_by=current_user.id,
        completed_at=utcnow(),
        red_alert_override=payload.red_alert_override,
        red_alert_override_by=current_user.id if payload.red_alert_override else None,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="fee_charge", resource="wallet", resource_id=wallet_id,
        detail=f"Fee charge {amount_total} {wallet.currency}" + (" (with VAT)" if payload.apply_vat else " (govt fee)")
    )
    
    check_and_create_alert(wallet, db)
    db.commit()
    
    return TransactionResponse.model_validate(transaction)


@router.post("/{wallet_id}/top-up", response_model=TransactionResponse)
def top_up_wallet(
    wallet_id: str,
    payload: TopUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT]))
):
    """Top-up a wallet (add funds)"""
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    if wallet.is_locked:
        raise HTTPException(400, "Wallet is locked")
    
    if wallet.status != WalletStatus.ACTIVE:
        raise HTTPException(400, "Wallet is not active")
    
    # Create transaction
    balance_before = wallet.balance
    wallet.balance += payload.amount
    balance_after = wallet.balance
    
    transaction = Transaction(
        wallet_id=wallet_id,
        org_id=current_user.org_id,
        type=TransactionType.TOP_UP,
        amount=payload.amount,
        currency=wallet.currency,
        balance_before=balance_before,
        balance_after=balance_after,
        status=TransactionStatus.COMPLETED,
        description=payload.description,
        reference_id=payload.reference_id,
        created_by=current_user.id,
        completed_at=utcnow()
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="top_up", resource="wallet", resource_id=wallet_id,
        detail=f"Topped up {payload.amount} {wallet.currency}"
    )
    
    # Check if this resolves any Red Alerts
    resolve_low_balance_alerts(wallet, db, current_user.id)
    db.commit()
    
    return TransactionResponse.model_validate(transaction)


# ============= Alert Endpoints =============

@router.get("/{wallet_id}/alerts", response_model=List[WalletAlertResponse])
def list_wallet_alerts(
    wallet_id: str,
    include_resolved: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List alerts for a wallet"""
    # Verify wallet ownership
    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    
    query = db.query(WalletAlert).filter(WalletAlert.wallet_id == wallet_id)
    
    if not include_resolved:
        query = query.filter(WalletAlert.is_resolved == False)
    
    alerts = query.order_by(WalletAlert.created_at.desc()).all()
    
    return [WalletAlertResponse.model_validate(a) for a in alerts]


@router.get("/alerts/critical", response_model=List[WalletAlertResponse])
def list_critical_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all critical (Red Alert) alerts for the organization"""
    alerts = db.query(WalletAlert).filter(
        WalletAlert.org_id == current_user.org_id,
        WalletAlert.level == AlertLevel.CRITICAL,
        WalletAlert.is_resolved == False
    ).order_by(WalletAlert.created_at.desc()).all()
    
    return [WalletAlertResponse.model_validate(a) for a in alerts]


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    payload: WalletAlertResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]))
):
    """Manually resolve an alert"""
    alert = db.query(WalletAlert).filter(
        WalletAlert.id == alert_id,
        WalletAlert.org_id == current_user.org_id
    ).first()
    
    if not alert:
        raise HTTPException(404, "Alert not found")
    
    if alert.is_resolved:
        raise HTTPException(400, "Alert is already resolved")
    
    alert.is_resolved = True
    alert.resolved_at = utcnow()
    alert.resolved_by = current_user.id
    
    db.commit()
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="resolve_alert", resource="wallet_alert", resource_id=alert_id,
        detail="Manually resolved alert"
    )
    
    return {"message": "Alert resolved successfully"}


# ----- Statement exports -----
@router.get("/{wallet_id}/statement/pdf")
def download_statement_pdf(
    wallet_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download wallet statement as PDF."""
    from datetime import date as date_type
    from fastapi.responses import Response
    from services.wallet_export import generate_statement_pdf

    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id, ClientWallet.org_id == current_user.org_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    df = date_type.fromisoformat(date_from) if date_from else None
    dt = date_type.fromisoformat(date_to) if date_to else None
    pdf_bytes = generate_statement_pdf(db, current_user.org_id, wallet_id, df, dt)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=statement_{wallet_id[:8]}.pdf"},
    )


@router.get("/{wallet_id}/statement/excel")
def download_statement_excel(
    wallet_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download wallet statement as Excel."""
    from datetime import date as date_type
    from fastapi.responses import Response
    from services.wallet_export import generate_statement_excel

    wallet = db.query(ClientWallet).filter(
        ClientWallet.id == wallet_id, ClientWallet.org_id == current_user.org_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    df = date_type.fromisoformat(date_from) if date_from else None
    dt = date_type.fromisoformat(date_to) if date_to else None
    xlsx_bytes = generate_statement_excel(db, current_user.org_id, wallet_id, df, dt)
    if xlsx_bytes is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=statement_{wallet_id[:8]}.xlsx"},
    )

"""
AML/KYC risk scoring: nationality, industry, ownership complexity.
Weights configurable; score 0-100; bands low / medium / high.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from models.contact import Contact, ContactType
from models.compliance import OwnershipLink, OwnershipLinkType, ComplianceRisk, RiskBand


# High-risk country codes (example; extend from OFAC/sanctions or org config)
HIGH_RISK_COUNTRIES = {
    "IR", "KP", "SY", "RU", "BY",  # example
}
MEDIUM_RISK_COUNTRIES = {
    "AF", "MM", "IQ", "LY", "SO", "YE", "SD", "SS", "CD", "ML", "NG", "VE", "ET", "HT",
}

# High-risk activity keywords (NACE / sector)
HIGH_RISK_ACTIVITIES = {
    "gambling", "casino", "weapon", "arms", "precious metal", "gem", "diamond",
    "cash", "money transfer", "crypto", "bitcoin", "forex", "trust", "foundation",
}
MEDIUM_RISK_ACTIVITIES = {
    "real estate", "construction", "import", "export", "trading", "trading company",
}

DEFAULT_WEIGHTS = {"nationality": 40, "industry": 30, "complexity": 30}


def _nationality_score(country: Optional[str]) -> float:
    if not country or not country.strip():
        return 50  # unknown
    code = (country.strip() or "")[:2].upper()
    if code in HIGH_RISK_COUNTRIES:
        return 90
    if code in MEDIUM_RISK_COUNTRIES:
        return 60
    return 20


def _industry_score(activities: Optional[str]) -> float:
    if not activities:
        return 30
    lower = activities.lower()
    for a in HIGH_RISK_ACTIVITIES:
        if a in lower:
            return 85
    for a in MEDIUM_RISK_ACTIVITIES:
        if a in lower:
            return 55
    return 25


def _complexity_score(db: Session, org_id: str, contact_id: str) -> float:
    """Depth and breadth of ownership structure involving this contact."""
    depth = 0
    stack = [(contact_id, 0)]
    seen = {contact_id}
    max_depth = 0
    total_links = 0
    while stack and depth < 15:
        cid, d = stack.pop()
        max_depth = max(max_depth, d)
        links_out = (
            db.query(OwnershipLink)
            .filter(
                OwnershipLink.org_id == org_id,
                OwnershipLink.owner_contact_id == cid,
            )
            .all()
        )
        links_in = (
            db.query(OwnershipLink)
            .filter(
                OwnershipLink.org_id == org_id,
                OwnershipLink.owned_contact_id == cid,
            )
            .all()
        )
        total_links += len(links_out) + len(links_in)
        for l in links_out:
            if l.owned_contact_id not in seen:
                seen.add(l.owned_contact_id)
                stack.append((l.owned_contact_id, d + 1))
        for l in links_in:
            if l.owner_contact_id not in seen:
                seen.add(l.owner_contact_id)
                stack.append((l.owner_contact_id, d + 1))
        depth += 1
    # Score: more depth and more links = higher complexity risk
    score = min(95, 20 + max_depth * 15 + min(40, total_links * 2))
    return score


def score_contact_risk(
    db: Session,
    org_id: str,
    contact_id: str,
    weights: Optional[dict] = None,
) -> dict:
    """
    Compute risk score for a contact. Returns:
    - risk_score: 0-100
    - risk_band: low | medium | high
    - factors_json: { nationality: score, industry: score, complexity: score }
    """
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.org_id == org_id,
    ).first()
    if not contact:
        return {"risk_score": None, "risk_band": None, "factors_json": None}
    w = weights or DEFAULT_WEIGHTS
    n_score = _nationality_score(contact.country or contact.nationality)
    act = contact.activity_license_activities or ""
    i_score = _industry_score(act)
    c_score = _complexity_score(db, org_id, contact_id)
    total_w = w.get("nationality", 40) + w.get("industry", 30) + w.get("complexity", 30) or 100
    risk_score = (
        n_score * (w.get("nationality", 40) / total_w) +
        i_score * (w.get("industry", 30) / total_w) +
        c_score * (w.get("complexity", 30) / total_w)
    )
    risk_score = round(min(100, max(0, risk_score)), 1)
    if risk_score >= 70:
        band = RiskBand.HIGH
    elif risk_score >= 40:
        band = RiskBand.MEDIUM
    else:
        band = RiskBand.LOW
    factors = {"nationality": n_score, "industry": i_score, "complexity": c_score}
    return {
        "risk_score": risk_score,
        "risk_band": band.value,
        "factors_json": factors,
    }


def save_risk(db: Session, org_id: str, contact_id: str, result: dict) -> ComplianceRisk:
    """Upsert compliance_risk for contact."""
    existing = db.query(ComplianceRisk).filter(
        ComplianceRisk.org_id == org_id,
        ComplianceRisk.contact_id == contact_id,
    ).first()
    now = datetime.now(timezone.utc)
    if existing:
        existing.risk_score = result["risk_score"]
        existing.risk_band = RiskBand(result["risk_band"]) if result.get("risk_band") else None
        existing.factors_json = result.get("factors_json")
        existing.last_calculated_at = now
        db.commit()
        db.refresh(existing)
        return existing
    risk = ComplianceRisk(
        org_id=org_id,
        contact_id=contact_id,
        risk_score=result["risk_score"],
        risk_band=RiskBand(result["risk_band"]) if result.get("risk_band") else None,
        factors_json=result.get("factors_json"),
        last_calculated_at=now,
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return risk

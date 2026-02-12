"""
Compliance validation: ownership sum 100%, dead-end corporate shareholders, cycles.
"""
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from models.contact import Contact, ContactType
from models.compliance import OwnershipLink, OwnershipLinkType
from services.ubo_resolver import resolve_ubos, _load_links_and_contacts, _find_cycles


def validate_entity(
    db: Session,
    org_id: str,
    entity_contact_id: str,
) -> dict:
    """
    Run full validation for an entity. Returns:
    - ownership_sum_valid: bool (total ownership for entity == 100%)
    - total_percentage: float
    - dead_ends: list of { contact_id, name } (corporate shareholders with no UBOs declared)
    - cycles: list of list of contact_id
    - warnings: list of str
    """
    links, contacts = _load_links_and_contacts(db, org_id, entity_contact_id)
    entity = contacts.get(entity_contact_id)
    if not entity:
        return {
            "ownership_sum_valid": False,
            "total_percentage": 0,
            "dead_ends": [],
            "cycles": [],
            "warnings": ["Entity not found"],
        }
    contact_ids = set(contacts.keys())

    # Ownership sum for this entity (incoming ownership links only)
    total = sum(
        (l.percentage or 0) for l in links
        if l.owned_contact_id == entity_contact_id and l.link_type == OwnershipLinkType.OWNERSHIP
    )
    ownership_sum_valid = abs(total - 100.0) < 0.01
    warnings = []
    if not ownership_sum_valid:
        warnings.append(f"Total ownership is {total:.1f}%, not 100%")

    # Cycles
    cycles = _find_cycles(links, contact_ids)
    if cycles:
        warnings.append("Cycle(s) detected in ownership structure")

    # Dead-ends: corporate shareholders (owned by this entity or in the graph) that have no ownership links
    # (i.e. we don't know who owns them) or they are companies with no UBOs
    dead_ends = []
    for cid in contact_ids:
        c = contacts.get(cid)
        if not c or c.contact_type != ContactType.COMPANY:
            continue
        if cid == entity_contact_id:
            continue
        # Is this company an owner of something in the graph? If so, we need UBOs for it
        is_shareholder = any(l.owner_contact_id == cid for l in links)
        if not is_shareholder:
            continue
        # Resolve UBOs for this corporate shareholder
        ubo_result = resolve_ubos(db, org_id, cid)
        if not ubo_result["ubos"]:
            dead_ends.append({"contact_id": cid, "name": c.name})

    return {
        "ownership_sum_valid": ownership_sum_valid,
        "total_percentage": round(total, 2),
        "dead_ends": dead_ends,
        "cycles": cycles,
        "warnings": warnings,
    }

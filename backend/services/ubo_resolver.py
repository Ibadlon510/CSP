"""
UBO Resolver: recursive effective ownership and UBO identification per UAE Cabinet Decision 109/2023.
Uses in-memory traversal over ownership_links (no Neo4j). Threshold 25%; control and senior-manager fallback.
"""
from collections import defaultdict
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from models.contact import Contact, ContactType
from models.compliance import OwnershipLink, OwnershipLinkType


UBO_THRESHOLD = 25.0
MAX_DEPTH = 20


def _load_links_and_contacts(
    db: Session,
    org_id: str,
    root_contact_id: str,
) -> tuple[list[OwnershipLink], dict[str, Contact]]:
    """Load all ownership links and contacts reachable from root (bidirectional)."""
    contact_ids = {root_contact_id}
    depth = 0
    while depth < MAX_DEPTH:
        links = (
            db.query(OwnershipLink)
            .filter(
                OwnershipLink.org_id == org_id,
                (OwnershipLink.owner_contact_id.in_(contact_ids)) | (OwnershipLink.owned_contact_id.in_(contact_ids)),
            )
            .all()
        )
        if not links:
            break
        for l in links:
            contact_ids.add(l.owner_contact_id)
            contact_ids.add(l.owned_contact_id)
        prev = len(contact_ids)
        # one more expand from owned side (incoming to current set)
        more = (
            db.query(OwnershipLink.owner_contact_id, OwnershipLink.owned_contact_id)
            .filter(OwnershipLink.org_id == org_id)
            .filter(
                (OwnershipLink.owner_contact_id.in_(contact_ids)) | (OwnershipLink.owned_contact_id.in_(contact_ids)),
            )
            .all()
        )
        for o, w in more:
            contact_ids.add(o)
            contact_ids.add(w)
        if len(contact_ids) == prev:
            break
        depth += 1
    all_links = (
        db.query(OwnershipLink)
        .filter(OwnershipLink.org_id == org_id)
        .filter(
            OwnershipLink.owner_contact_id.in_(contact_ids),
            OwnershipLink.owned_contact_id.in_(contact_ids),
        )
        .all()
    )
    contacts = {c.id: c for c in db.query(Contact).filter(Contact.id.in_(contact_ids), Contact.org_id == org_id).all()}
    return all_links, contacts


def _find_cycles(links: list[OwnershipLink], contact_ids: set[str]) -> list[list[str]]:
    """Simple cycle detection: DFS from each node, report back-edges to ancestor."""
    out_edges = defaultdict(list)
    for l in links:
        out_edges[l.owner_contact_id].append(l.owned_contact_id)
    cycles = []
    path = []
    path_set = set()
    in_path = {}

    def dfs(cid: str) -> bool:
        if cid in in_path:
            cycle = path[in_path[cid]:] + [cid]
            if len(cycle) > 1:
                cycles.append(cycle)
            return True
        if cid in path_set:
            return False
        path_set.add(cid)
        in_path[cid] = len(path)
        path.append(cid)
        for to in out_edges.get(cid, []):
            dfs(to)
        path.pop()
        del in_path[cid]
        path_set.discard(cid)
        return False

    for cid in contact_ids:
        if cid not in path_set:
            dfs(cid)
    return cycles


def _effective_ownership_paths(
    links: list[OwnershipLink],
    contacts: dict[str, Contact],
    target_contact_id: str,
) -> dict[str, list[tuple[list[str], float]]]:
    """
    For each natural person (individual), compute all paths to target and path effective %.
    Returns: { person_contact_id: [ (path_contact_ids, effective_pct), ... ] }
    Path is from person (leaf) to target (root); effective_pct = product of edge percentages along path.
    """
    # Incoming to a node: who owns it -> (owner_id, percentage for ownership)
    incoming = defaultdict(list)
    for l in links:
        if l.link_type == OwnershipLinkType.OWNERSHIP and l.percentage is not None:
            incoming[l.owned_contact_id].append((l.owner_contact_id, float(l.percentage)))
        elif l.link_type == OwnershipLinkType.CONTROL:
            pct = float(l.voting_pct) if l.voting_pct is not None else 100.0
            incoming[l.owned_contact_id].append((l.owner_contact_id, pct))

    result = defaultdict(list)
    visited_paths = set()

    def dfs(node_id: str, path: list[str], product: float, depth: int):
        if depth > MAX_DEPTH or product <= 0:
            return
        path_key = tuple(path + [node_id])
        if path_key in visited_paths:
            return
        visited_paths.add(path_key)
        contact = contacts.get(node_id)
        if contact and contact.contact_type == ContactType.INDIVIDUAL:
            result[node_id].append((path + [node_id], product))
        for owner_id, pct in incoming.get(node_id, []):
            if owner_id in path:  # cycle, skip
                continue
            dfs(owner_id, path + [node_id], product * (pct / 100.0), depth + 1)

    dfs(target_contact_id, [], 100.0, 0)
    return dict(result)


def _aggregate_effective(
    path_map: dict[str, list[tuple[list[str], float]]],
) -> dict[str, float]:
    """Aggregate effective ownership by person (sum of path contributions)."""
    agg = defaultdict(float)
    for person_id, paths in path_map.items():
        for _path, pct in paths:
            agg[person_id] += pct
    return dict(agg)


def _control_ubos(links: list[OwnershipLink], contacts: dict[str, Contact], target_contact_id: str) -> set[str]:
    """Persons who are UBOs by control (CONTROLS or DIRECTOR with control)."""
    control_owners = set()
    for l in links:
        if l.owned_contact_id != target_contact_id:
            continue
        if l.link_type in (OwnershipLinkType.CONTROL, OwnershipLinkType.DIRECTOR):
            if l.is_nominee == "true":
                continue
            owner = contacts.get(l.owner_contact_id)
            if owner and owner.contact_type == ContactType.INDIVIDUAL:
                control_owners.add(l.owner_contact_id)
    return control_owners


def resolve_ubos(
    db: Session,
    org_id: str,
    entity_contact_id: str,
    senior_manager_contact_id: Optional[str] = None,
) -> dict:
    """
    Resolve UBOs for the given entity (company). Returns:
    - ubos: list of { contact_id, name, effective_pct, is_control, is_senior_manager_fallback }
    - effective_ownership: { contact_id: effective_pct } for all individuals
    - cycles: list of cycles (list of contact_id lists)
    - warnings: list of strings
    """
    links, contacts = _load_links_and_contacts(db, org_id, entity_contact_id)
    entity = contacts.get(entity_contact_id)
    if not entity:
        return {
            "ubos": [],
            "effective_ownership": {},
            "cycles": [],
            "warnings": ["Entity not found"],
        }
    contact_ids = set(contacts.keys())
    cycles = _find_cycles(links, contact_ids)
    path_map = _effective_ownership_paths(links, contacts, entity_contact_id)
    aggregated = _aggregate_effective(path_map)
    control_ubos = _control_ubos(links, contacts, entity_contact_id)

    ubos = []
    seen = set()
    for person_id, pct in aggregated.items():
        if person_id in seen:
            continue
        if pct >= UBO_THRESHOLD or person_id in control_ubos:
            seen.add(person_id)
            c = contacts.get(person_id)
            ubos.append({
                "contact_id": person_id,
                "name": c.name if c else person_id,
                "effective_pct": round(pct, 2),
                "is_control": person_id in control_ubos and (pct < UBO_THRESHOLD or not pct),
                "is_senior_manager_fallback": False,
            })
    for person_id in control_ubos:
        if person_id not in seen:
            c = contacts.get(person_id)
            ubos.append({
                "contact_id": person_id,
                "name": c.name if c else person_id,
                "effective_pct": aggregated.get(person_id, 0) or 0,
                "is_control": True,
                "is_senior_manager_fallback": False,
            })
            seen.add(person_id)

    # Fallback: if no UBO identified, use senior manager
    if not ubos and senior_manager_contact_id and senior_manager_contact_id in contacts:
        c = contacts[senior_manager_contact_id]
        if c.contact_type == ContactType.INDIVIDUAL:
            ubos.append({
                "contact_id": senior_manager_contact_id,
                "name": c.name,
                "effective_pct": 0,
                "is_control": False,
                "is_senior_manager_fallback": True,
            })
    elif not ubos and entity.senior_manager_contact_id and entity.senior_manager_contact_id in contacts:
        c = contacts[entity.senior_manager_contact_id]
        if c.contact_type == ContactType.INDIVIDUAL:
            ubos.append({
                "contact_id": entity.senior_manager_contact_id,
                "name": c.name,
                "effective_pct": 0,
                "is_control": False,
                "is_senior_manager_fallback": True,
            })

    warnings = []
    if cycles:
        warnings.append("Cycle(s) detected in ownership structure")
    total_ownership = sum(
        l.percentage or 0 for l in links
        if l.owned_contact_id == entity_contact_id and l.link_type == OwnershipLinkType.OWNERSHIP
    )
    if abs(total_ownership - 100.0) > 0.01:
        warnings.append(f"Total ownership sums to {total_ownership:.1f}%, not 100%")

    return {
        "ubos": ubos,
        "effective_ownership": {k: round(v, 2) for k, v in aggregated.items()},
        "cycles": cycles,
        "warnings": warnings,
    }

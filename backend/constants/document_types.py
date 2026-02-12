"""Canonical system document types for UAE CSP/ERP.

Documents accept either a system slug or an org-specific slug from document_categories.
Validation is done in the API layer.
"""

# System document types: slug -> display name (and optional metadata later).
# Typical link: Entity/Contact/Task/Project as noted in comments.
SYSTEM_DOCUMENT_CATEGORIES = [
    {"slug": "trade_license", "name": "Trade License"},  # Entity / Contact
    {"slug": "moa", "name": "MOA (Memorandum of Association)"},  # Entity
    {"slug": "passport", "name": "Passport"},  # Contact
    {"slug": "visa", "name": "Visa copy"},  # Contact / Employee
    {"slug": "contract", "name": "Contract"},  # Contact / Task / Project
    {"slug": "receipt", "name": "Receipt"},  # Contact / Project
    {"slug": "other", "name": "Other"},  # Any
]

# Slugs only, for validation.
DOCUMENT_TYPE_SLUGS = [t["slug"] for t in SYSTEM_DOCUMENT_CATEGORIES]

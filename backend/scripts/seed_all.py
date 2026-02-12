"""
Consolidated seed script — merges seed_demo + seed_showcase into one idempotent script.
Creates organization, users, contacts, products, leads, opportunities, quotations,
orders, invoices, projects, wallets, documents, comments, reactions, attachments,
favorites, and activities.

Run from backend directory:
  python -m scripts.seed_all

All functions are idempotent (safe to re-run).
"""
import os
import sys
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

# Ensure backend is on path
_backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.chdir(_backend)

from sqlalchemy.orm import Session
from core.database import SessionLocal, engine, Base
from core.security import hash_password
from models.base import generate_uuid
import models  # noqa: F401 - register all models

from models.organization import Organization
from models.user import User, UserRole
from models.org_settings import OrganizationSettings, OrgModuleSetting, ModuleId
from models.contact import Contact, ContactAddress, ContactType, ContactStatus, AddressType
from models.product import Product
from models.lead import Lead, LeadStatus
from models.opportunity import Opportunity, OpportunityStage
from models.crm_contact import CrmContact
from models.quotation import Quotation, QuotationLine, QuotationStatus
from models.sales_order import SalesOrder, SalesOrderLine, SalesOrderStatus
from models.invoice import Invoice, InvoiceLine, InvoiceStatus
from models.project import (
    Project, Task, TaskAssignee, ProjectStatus, TaskStatus, TaskPriority,
    TaskComment, CommentReaction, TaskAttachment, TaskDependency, UserFavorite,
)
from models.wallet import (
    ClientWallet, Transaction, WalletAlert,
    WalletStatus, TransactionType, TransactionStatus, AlertLevel,
)
from models.document import Document, DocumentCategory, DocumentStatus
from models.activity import Activity, ActivityType, ActivityStatus
from models.compliance import OwnershipLink, OwnershipLinkType
from models.product import ProductTaskTemplate, ProductDocumentRequirement
from constants.document_types import SYSTEM_DOCUMENT_CATEGORIES

# Ensure tables exist
Base.metadata.create_all(bind=engine)

# Ensure document_type column exists (needed for PostgreSQL where create_all won't alter existing tables)
from sqlalchemy import text as _text, inspect as _inspect
_insp = _inspect(engine)
if "product_document_requirements" in _insp.get_table_names():
    _cols = [c["name"] for c in _insp.get_columns("product_document_requirements")]
    if "document_type" not in _cols:
        with engine.connect() as _conn:
            _conn.execute(_text("ALTER TABLE product_document_requirements ADD COLUMN document_type VARCHAR(20) NOT NULL DEFAULT 'required'"))
            _conn.commit()
if "project_document_checklist" in _insp.get_table_names():
    _cols = [c["name"] for c in _insp.get_columns("project_document_checklist")]
    if "document_type" not in _cols:
        with engine.connect() as _conn:
            _conn.execute(_text("ALTER TABLE project_document_checklist ADD COLUMN document_type VARCHAR(20) NOT NULL DEFAULT 'required'"))
            _conn.commit()

DEMO_EMAIL = "demo@csp.local"
DEMO_PASSWORD = "demo123"
DEMO_ORG_NAME = "Demo CSP"

NOW = datetime.now(timezone.utc)
DAY = timedelta(days=1)


# ─────────────────────────────────────────────────────────
# 1. Organization, Users & Settings
# ─────────────────────────────────────────────────────────

def get_or_create_org_and_users(db: Session):
    """Create Demo CSP org and 3 users (admin, manager, pro)."""
    org = db.query(Organization).filter(Organization.name == DEMO_ORG_NAME).first()
    if not org:
        org = Organization(name=DEMO_ORG_NAME)
        db.add(org)
        db.flush()
        print(f"  Created organization: {DEMO_ORG_NAME}")

    # Org settings
    settings = db.query(OrganizationSettings).filter(OrganizationSettings.org_id == org.id).first()
    if not settings:
        settings = OrganizationSettings(
            org_id=org.id,
            default_wallet_min_balance=Decimal("1000.00"),
            default_vat_rate=Decimal("5.00"),
            default_currency="AED",
            quotation_prefix="QUO",
            order_prefix="ORD",
            invoice_prefix="INV",
            number_padding="3",
        )
        db.add(settings)
        print("  Created organization settings")

    # Enable all modules
    for mod_id in ModuleId.ALL:
        existing = db.query(OrgModuleSetting).filter(
            OrgModuleSetting.org_id == org.id,
            OrgModuleSetting.module_id == mod_id,
        ).first()
        if not existing:
            db.add(OrgModuleSetting(org_id=org.id, module_id=mod_id, enabled=True))

    # Users
    user_data = [
        (DEMO_EMAIL, "Demo User", UserRole.ADMIN),
        ("sarah@csp.local", "Sarah Ahmed", UserRole.MANAGER),
        ("omar@csp.local", "Omar Khalid", UserRole.PRO),
    ]
    users = []
    for email, name, role in user_data:
        u = db.query(User).filter(User.email == email, User.org_id == org.id).first()
        if not u:
            u = User(
                email=email,
                hashed_password=hash_password(DEMO_PASSWORD),
                full_name=name,
                role=role,
                org_id=org.id,
                is_active=True,
            )
            db.add(u)
            db.flush()
            print(f"  Created user: {email}")
        else:
            u.org_id = org.id
            u.role = role
            u.is_active = True
        users.append(u)

    print(f"  Users: {len(users)} (all passwords: {DEMO_PASSWORD})")
    return org, users


# ─────────────────────────────────────────────────────────
# 2. Contacts
# ─────────────────────────────────────────────────────────

def seed_contacts(db: Session, org_id: str, manager_id: str) -> list:
    """Create sample contacts (companies + individuals)."""
    contacts = []
    companies = [
        {"name": "Gulf Trading LLC", "email": "accounts@gulftrading.ae", "phone": "+971 4 123 4567", "country": "UAE"},
        {"name": "Desert Sands Consulting", "email": "info@desertsands.ae", "phone": "+971 2 555 0123", "country": "UAE"},
        {"name": "Al Noor Services FZE", "email": "admin@alnoor.ae", "phone": "+971 6 789 0000", "country": "UAE"},
    ]
    for c in companies:
        existing = db.query(Contact).filter(Contact.org_id == org_id, Contact.name == c["name"]).first()
        if existing:
            contacts.append(existing)
            continue
        contact = Contact(
            org_id=org_id,
            contact_type=ContactType.COMPANY,
            name=c["name"],
            email=c["email"],
            phone_primary=c["phone"],
            status=ContactStatus.ACTIVE,
            country=c["country"],
            assigned_manager_id=manager_id,
            trade_license_no="TL-" + c["name"][:3].upper() + "123" if "LLC" in c["name"] or "FZE" in c["name"] else None,
            vat_registered=True,
        )
        db.add(contact)
        db.flush()
        db.add(ContactAddress(
            contact_id=contact.id,
            address_type=AddressType.REGISTERED_OFFICE,
            address_line_1="Business Bay, Tower 1",
            address_line_2="Office 1205",
            city="Dubai",
            state_emirate="Dubai",
            country="UAE",
            is_primary=True,
        ))
        contacts.append(contact)

    individuals = [
        {"name": "Ahmed Hassan", "email": "ahmed.hassan@email.ae", "phone": "+971 50 111 2233"},
        {"name": "Sara Al Maktoum", "email": "sara.almaktoum@email.ae", "phone": "+971 50 444 5566"},
    ]
    for ind in individuals:
        existing = db.query(Contact).filter(Contact.org_id == org_id, Contact.name == ind["name"]).first()
        if existing:
            contacts.append(existing)
            continue
        contact = Contact(
            org_id=org_id,
            contact_type=ContactType.INDIVIDUAL,
            name=ind["name"],
            email=ind["email"],
            phone_primary=ind["phone"],
            status=ContactStatus.ACTIVE,
            country="UAE",
            assigned_manager_id=manager_id,
        )
        db.add(contact)
        db.flush()
        db.add(ContactAddress(
            contact_id=contact.id,
            address_type=AddressType.RESIDENTIAL,
            address_line_1="Villa 45, Palm Jumeirah",
            city="Dubai",
            state_emirate="Dubai",
            country="UAE",
            is_primary=True,
        ))
        contacts.append(contact)

    print(f"  Contacts: {len(contacts)} (companies + individuals)")
    return contacts


# ─────────────────────────────────────────────────────────
# 3. Products
# ─────────────────────────────────────────────────────────

def seed_products(db: Session, org_id: str) -> list:
    """Create sample products with task templates and document requirements."""
    products = []
    items = [
        {
            "name": "Trade License Renewal",
            "code": "LR",
            "description": "Annual renewal of trade license including compliance check, document updates, and authority submissions.",
            "price": Decimal("3500.00"),
            "creates_project": True,
            "tasks": [
                ("Audit current license status", ["Check expiry date", "Verify trade activities"]),
                ("Renew tenancy contract", ["Contact landlord", "Negotiate terms", "Sign agreement"]),
                ("Update MOA if needed", []),
                ("Submit renewal application", ["Prepare form", "Attach documents", "Pay fees"]),
                ("Collect renewed license", []),
            ],
            "docs_required": [
                ("Current Trade License", "trade_license"),
                ("Tenancy Contract", "contract"),
                ("Passport Copies (all partners)", "passport"),
                ("Emirates ID Copies", "other"),
            ],
            "docs_deliverable": [
                ("Renewed Trade License", "trade_license"),
                ("Updated Establishment Card", "other"),
            ],
        },
        {
            "name": "VAT Registration",
            "code": "VAT",
            "description": "Complete VAT registration with FTA including eligibility assessment, documentation, portal submission, and TRN certificate collection.",
            "price": Decimal("2500.00"),
            "creates_project": True,
            "tasks": [
                ("Collect financial statements", ["Request from client", "Review for completeness"]),
                ("Review VAT threshold eligibility", []),
                ("Prepare FTA registration form", ["Fill application", "Attach supporting docs"]),
                ("Submit to FTA portal", []),
                ("Follow up on approval", ["Check portal status", "Respond to queries"]),
                ("Collect TRN certificate", []),
            ],
            "docs_required": [
                ("Trade License", "trade_license"),
                ("Financial Statements (12 months)", "other"),
                ("Passport of Authorized Signatory", "passport"),
                ("Bank Statement", "other"),
            ],
            "docs_deliverable": [
                ("VAT Registration Certificate (TRN)", "other"),
                ("FTA Portal Access Credentials", "other"),
            ],
        },
        {
            "name": "Company Formation",
            "code": "CF",
            "description": "Full company formation package including name reservation, MOA drafting, DED submission, trade license issuance, visa processing, and bank account setup.",
            "price": Decimal("15000.00"),
            "creates_project": True,
            "tasks": [
                ("Initial consultation & activity selection", []),
                ("Name reservation with DED", ["Propose 3 names", "Submit reservation"]),
                ("Draft Memorandum of Association", ["Define shareholding", "Legal review", "Client approval"]),
                ("Submit to DED for approval", ["Prepare application", "Attach all documents"]),
                ("Obtain initial approval letter", []),
                ("Office lease agreement", ["Find office", "Negotiate lease", "Sign Ejari"]),
                ("Pay government fees", ["Calculate fees", "Process payment"]),
                ("Collect trade license", []),
                ("Apply for investor/partner visas", ["Medical test", "Emirates ID", "Visa stamping"]),
                ("Open corporate bank account", ["Prepare bank docs", "Schedule appointment", "Follow up"]),
                ("Final compliance review", ["Verify all documents", "Handover to client"]),
            ],
            "docs_required": [
                ("Passport Copies (all shareholders)", "passport"),
                ("Visa Copies (if applicable)", "visa"),
                ("Emirates ID Copies", "other"),
                ("NOC from Sponsor (if employed)", "other"),
                ("Proof of Address", "other"),
                ("Business Plan", "other"),
            ],
            "docs_deliverable": [
                ("Trade License", "trade_license"),
                ("Memorandum of Association", "moa"),
                ("Certificate of Incorporation", "other"),
                ("Establishment Card", "other"),
                ("Investor Visa", "visa"),
                ("Emirates ID", "other"),
            ],
        },
        {
            "name": "Accounting Retainer",
            "code": "AR",
            "description": "Monthly accounting and bookkeeping services including transaction recording, bank reconciliation, financial reporting, and VAT return preparation.",
            "price": Decimal("3000.00"),
            "creates_project": False,
            "tasks": [],
            "docs_required": [
                ("Bank Statements (monthly)", "other"),
                ("Sales Invoices", "other"),
                ("Purchase Invoices", "receipt"),
                ("Petty Cash Records", "other"),
            ],
            "docs_deliverable": [
                ("Monthly Financial Report", "other"),
                ("VAT Return Filing Confirmation", "other"),
            ],
        },
    ]

    for item in items:
        existing = db.query(Product).filter(Product.org_id == org_id, Product.name == item["name"]).first()
        if existing:
            # Update code if missing
            if not existing.code and item.get("code"):
                existing.code = item["code"]
            if not existing.creates_project and item.get("creates_project"):
                existing.creates_project = item["creates_project"]
            products.append(existing)
            # Seed task templates if missing
            existing_templates = db.query(ProductTaskTemplate).filter(ProductTaskTemplate.product_id == existing.id).count()
            if existing_templates == 0 and item.get("tasks"):
                for sort_i, (task_name, subtasks) in enumerate(item["tasks"]):
                    db.add(ProductTaskTemplate(
                        org_id=org_id, product_id=existing.id, task_name=task_name,
                        sort_order=sort_i, subtask_names=subtasks if subtasks else None,
                    ))
            # Seed doc requirements if missing
            existing_docs = db.query(ProductDocumentRequirement).filter(ProductDocumentRequirement.product_id == existing.id).count()
            if existing_docs == 0:
                sort_i = 0
                for doc_name, doc_cat in item.get("docs_required", []):
                    db.add(ProductDocumentRequirement(
                        org_id=org_id, product_id=existing.id, document_name=doc_name,
                        document_category=doc_cat, document_type="required", sort_order=sort_i,
                    ))
                    sort_i += 1
                for doc_name, doc_cat in item.get("docs_deliverable", []):
                    db.add(ProductDocumentRequirement(
                        org_id=org_id, product_id=existing.id, document_name=doc_name,
                        document_category=doc_cat, document_type="deliverable", sort_order=sort_i,
                    ))
                    sort_i += 1
            continue

        p = Product(
            org_id=org_id, name=item["name"], description=item["description"],
            default_unit_price=item["price"], is_active=True,
            creates_project=item.get("creates_project", False),
            code=item.get("code"),
        )
        db.add(p)
        db.flush()

        # Task templates
        for sort_i, (task_name, subtasks) in enumerate(item.get("tasks", [])):
            db.add(ProductTaskTemplate(
                org_id=org_id, product_id=p.id, task_name=task_name,
                sort_order=sort_i, subtask_names=subtasks if subtasks else None,
            ))

        # Document requirements (required + deliverable)
        sort_i = 0
        for doc_name, doc_cat in item.get("docs_required", []):
            db.add(ProductDocumentRequirement(
                org_id=org_id, product_id=p.id, document_name=doc_name,
                document_category=doc_cat, document_type="required", sort_order=sort_i,
            ))
            sort_i += 1
        for doc_name, doc_cat in item.get("docs_deliverable", []):
            db.add(ProductDocumentRequirement(
                org_id=org_id, product_id=p.id, document_name=doc_name,
                document_category=doc_cat, document_type="deliverable", sort_order=sort_i,
            ))
            sort_i += 1

        products.append(p)

    db.flush()
    total_templates = sum(len(item.get("tasks", [])) for item in items)
    total_docs = sum(len(item.get("docs_required", [])) + len(item.get("docs_deliverable", [])) for item in items)
    print(f"  Products: {len(products)} (with {total_templates} task templates, {total_docs} doc requirements)")
    return products


# ─────────────────────────────────────────────────────────
# 4. Leads & Opportunities
# ─────────────────────────────────────────────────────────

def seed_leads_and_opportunities(db: Session, org_id: str, user_id: str, contacts: list):
    """Create leads, opportunities, and CRM contacts."""
    leads = []
    opps = []
    lead_data = [
        ("Tech Startup FZ", "founder@techstart.ae", "Website", LeadStatus.QUALIFIED),
        ("Marina Trading Co", "info@marinatrading.ae", "Referral", LeadStatus.CONTACTED),
        ("Green Energy LLC", "contact@greenenergy.ae", "Walk-in", LeadStatus.NEW),
    ]
    for name, email, source, status in lead_data:
        existing = db.query(Lead).filter(Lead.org_id == org_id, Lead.name == name).first()
        if existing:
            leads.append(existing)
            continue
        lead = Lead(
            org_id=org_id, name=name, email=email, phone="+971 50 999 0000",
            source=source, status=status, assigned_to=user_id, notes=f"Sample lead: {source}",
        )
        db.add(lead)
        db.flush()
        leads.append(lead)
        opp = Opportunity(
            org_id=org_id, lead_id=lead.id, name=f"Deal - {name}",
            amount=Decimal("12000.00") if "Tech" in name else Decimal("8500.00"),
            stage=OpportunityStage.QUOTE_SENT if status == LeadStatus.QUALIFIED else OpportunityStage.LEAD,
            probability=Decimal("60") if status == LeadStatus.QUALIFIED else Decimal("30"),
            expected_close_date=date.today() + timedelta(days=30),
        )
        db.add(opp)
        db.flush()
        opps.append(opp)

    # Contact-linked opportunity
    if contacts:
        try:
            c = contacts[0]
            existing_opp = db.query(Opportunity).filter(
                Opportunity.org_id == org_id, Opportunity.name == f"Retainer - {c.name}"
            ).first()
            if not existing_opp:
                opp = Opportunity(
                    org_id=org_id, contact_id=c.id, name=f"Retainer - {c.name}",
                    amount=Decimal("25000.00"), stage=OpportunityStage.NEGOTIATION,
                    probability=Decimal("75"), expected_close_date=date.today() + timedelta(days=14),
                )
                db.add(opp)
                db.flush()
                opps.append(opp)
        except Exception:
            pass

    # CRM contacts
    for lead in leads[:2]:
        existing = db.query(CrmContact).filter(CrmContact.org_id == org_id, CrmContact.lead_id == lead.id).first()
        if not existing:
            db.add(CrmContact(
                org_id=org_id, lead_id=lead.id, name=lead.name + " Contact",
                email=lead.email, phone=lead.phone, role="Decision Maker",
            ))
    for contact in contacts[:2]:
        existing = db.query(CrmContact).filter(CrmContact.org_id == org_id, CrmContact.contact_id == contact.id).first()
        if not existing:
            db.add(CrmContact(
                org_id=org_id, contact_id=contact.id, name=contact.name + " (Primary)",
                email=contact.email, phone=contact.phone_primary, role="Account Manager",
            ))

    print(f"  Leads: {len(leads)}, Opportunities: {len(opps)}, CRM contacts created")
    return leads, opps


# ─────────────────────────────────────────────────────────
# 5. Quotations, Orders, Invoices
# ─────────────────────────────────────────────────────────

def seed_quotations_orders_invoices(db: Session, org_id: str, user_id: str, contacts: list, products: list):
    """Create quotations, sales orders, and invoices with lines."""
    from services.number_sequence import next_quotation_number, next_order_number, next_invoice_number

    quotations = []
    orders = []
    invoices = []

    # Quotations
    for i, contact in enumerate(contacts[:2]):
        num = next_quotation_number(db, org_id, Quotation)
        existing = db.query(Quotation).filter(Quotation.org_id == org_id, Quotation.number == num).first()
        if existing:
            quotations.append(existing)
            continue
        q = Quotation(
            org_id=org_id, number=num, contact_id=contact.id,
            status=QuotationStatus.SENT if i == 0 else QuotationStatus.DRAFT,
            valid_until=date.today() + timedelta(days=30),
            total=Decimal("0"), vat_amount=Decimal("0"), created_by=user_id,
        )
        db.add(q)
        db.flush()
        line_total = Decimal("0")
        for prod in products[:2]:
            qty = 1
            price = prod.default_unit_price or Decimal("0")
            vat = Decimal("5")
            amount = (price * qty * (1 + vat / 100)).quantize(Decimal("0.01"))
            line_total += amount
            db.add(QuotationLine(
                quotation_id=q.id, product_id=prod.id, description=prod.name,
                quantity=qty, unit_price=price, vat_rate=vat, amount=amount,
            ))
        q.total = line_total
        q.vat_amount = line_total - line_total / Decimal("1.05")
        quotations.append(q)

    # Sales orders
    for i, contact in enumerate(contacts[:2]):
        num = next_order_number(db, org_id, SalesOrder)
        existing = db.query(SalesOrder).filter(SalesOrder.org_id == org_id, SalesOrder.number == num).first()
        if existing:
            orders.append(existing)
            continue
        ord_status = SalesOrderStatus.CONFIRMED if i == 0 else SalesOrderStatus.PENDING
        o = SalesOrder(
            org_id=org_id, number=num, contact_id=contact.id, status=ord_status,
            confirmed_at=datetime.now(timezone.utc) if ord_status == SalesOrderStatus.CONFIRMED else None,
        )
        db.add(o)
        db.flush()
        for prod in products[:2]:
            qty = 1
            price = prod.default_unit_price or Decimal("0")
            vat = Decimal("5")
            amount = (price * qty * (1 + vat / 100)).quantize(Decimal("0.01"))
            db.add(SalesOrderLine(
                sales_order_id=o.id, product_id=prod.id, description=prod.name,
                quantity=qty, unit_price=price, vat_rate=vat, amount=amount,
            ))
        orders.append(o)

    # Invoices
    for i, contact in enumerate(contacts[:2]):
        num = next_invoice_number(db, org_id, Invoice)
        existing = db.query(Invoice).filter(Invoice.org_id == org_id, Invoice.number == num).first()
        if existing:
            invoices.append(existing)
            continue
        inv_status = InvoiceStatus.PAID if i == 0 else InvoiceStatus.SENT
        total = Decimal("0")
        for prod in products[:2]:
            qty = 1
            price = prod.default_unit_price or Decimal("0")
            total += (price * qty * Decimal("1.05")).quantize(Decimal("0.01"))
        inv = Invoice(
            org_id=org_id, number=num, contact_id=contact.id, status=inv_status,
            due_date=date.today() + timedelta(days=14), total=total,
            vat_amount=total - total / Decimal("1.05"),
            paid_at=datetime.now(timezone.utc) if inv_status == InvoiceStatus.PAID else None,
        )
        db.add(inv)
        db.flush()
        for prod in products[:2]:
            qty = 1
            price = prod.default_unit_price or Decimal("0")
            vat = Decimal("5")
            amount = (price * qty * (1 + vat / 100)).quantize(Decimal("0.01"))
            db.add(InvoiceLine(
                invoice_id=inv.id, product_id=prod.id, description=prod.name,
                quantity=qty, unit_price=price, vat_rate=vat, amount=amount,
            ))
        invoices.append(inv)

    print(f"  Quotations: {len(quotations)}, Orders: {len(orders)}, Invoices: {len(invoices)}")
    return quotations, orders, invoices


# ─────────────────────────────────────────────────────────
# 6. Showcase Projects (rich tasks, dependencies, multi-assignee)
# ─────────────────────────────────────────────────────────

def seed_showcase_projects(db: Session, org_id: str, users: list):
    """Create 3 projects with diverse tasks, dependencies, multi-assignees."""
    demo, sarah, omar = users[0], users[1], users[2]
    contact = db.query(Contact).filter(Contact.org_id == org_id).first()
    contact_id = contact.id if contact else None

    projects_data = [
        {
            "title": "Company Formation - Al Reef Technologies",
            "description": "Full company formation package including trade license, visa processing, office setup, and compliance registration.",
            "status": ProjectStatus.IN_PROGRESS,
            "priority": "high",
            "start_date": NOW - 10 * DAY,
            "due_date": NOW + 20 * DAY,
            "tasks": [
                {"title": "Prepare incorporation documents", "status": TaskStatus.DONE, "priority": TaskPriority.HIGH, "category": "Compliance",
                 "start_date": NOW - 10 * DAY, "due_date": NOW - 7 * DAY, "assigned": [demo, sarah]},
                {"title": "Submit to DED for approval", "status": TaskStatus.DONE, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW - 7 * DAY, "due_date": NOW - 4 * DAY, "assigned": [sarah]},
                {"title": "Obtain initial approval letter", "status": TaskStatus.DONE, "priority": TaskPriority.MEDIUM, "category": "Authority",
                 "start_date": NOW - 4 * DAY, "due_date": NOW - 2 * DAY, "assigned": [sarah]},
                {"title": "Draft Memorandum of Association", "status": TaskStatus.IN_PROGRESS, "priority": TaskPriority.HIGH, "category": "Compliance",
                 "start_date": NOW - 2 * DAY, "due_date": NOW + 2 * DAY, "assigned": [demo, omar]},
                {"title": "Office lease agreement", "status": TaskStatus.IN_PROGRESS, "priority": TaskPriority.MEDIUM, "category": "Operations",
                 "start_date": NOW - 1 * DAY, "due_date": NOW + 5 * DAY, "assigned": [omar]},
                {"title": "Pay government fees", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Sales",
                 "start_date": NOW + 2 * DAY, "due_date": NOW + 4 * DAY, "assigned": [demo]},
                {"title": "Collect trade license", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Authority",
                 "start_date": NOW + 5 * DAY, "due_date": NOW + 8 * DAY, "assigned": [sarah]},
                {"title": "Apply for investor visa", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW + 8 * DAY, "due_date": NOW + 15 * DAY, "assigned": [sarah, omar]},
                {"title": "Open corporate bank account", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Operations",
                 "start_date": NOW + 10 * DAY, "due_date": NOW + 18 * DAY, "assigned": [demo]},
                {"title": "Final compliance review", "status": TaskStatus.TODO, "priority": TaskPriority.URGENT, "category": "Compliance",
                 "start_date": NOW + 15 * DAY, "due_date": NOW + 20 * DAY, "assigned": [demo, sarah, omar]},
            ],
        },
        {
            "title": "VAT Registration - Desert Sands Consulting",
            "description": "Complete VAT registration with FTA including documentation review, submission, and certificate collection.",
            "status": ProjectStatus.IN_PROGRESS,
            "priority": "medium",
            "start_date": NOW - 5 * DAY,
            "due_date": NOW + 10 * DAY,
            "tasks": [
                {"title": "Collect financial statements", "status": TaskStatus.DONE, "priority": TaskPriority.HIGH, "category": "Compliance",
                 "start_date": NOW - 5 * DAY, "due_date": NOW - 3 * DAY, "assigned": [omar]},
                {"title": "Review VAT threshold eligibility", "status": TaskStatus.DONE, "priority": TaskPriority.MEDIUM, "category": "Compliance",
                 "start_date": NOW - 3 * DAY, "due_date": NOW - 1 * DAY, "assigned": [demo]},
                {"title": "Prepare FTA registration form", "status": TaskStatus.IN_PROGRESS, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW - 1 * DAY, "due_date": NOW + 2 * DAY, "assigned": [sarah]},
                {"title": "Submit to FTA portal", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW + 2 * DAY, "due_date": NOW + 4 * DAY, "assigned": [sarah]},
                {"title": "Follow up on approval", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Authority",
                 "start_date": NOW + 4 * DAY, "due_date": NOW + 8 * DAY, "assigned": [omar]},
                {"title": "Collect TRN certificate", "status": TaskStatus.TODO, "priority": TaskPriority.LOW, "category": "Authority",
                 "start_date": NOW + 8 * DAY, "due_date": NOW + 10 * DAY, "assigned": [demo]},
            ],
        },
        {
            "title": "Annual License Renewal - Gulf Trading LLC",
            "description": "Renewal of trade license and all associated permits for Gulf Trading LLC. Includes compliance check and document updates.",
            "status": ProjectStatus.PLANNING,
            "priority": "low",
            "start_date": NOW + 5 * DAY,
            "due_date": NOW + 35 * DAY,
            "tasks": [
                {"title": "Audit current license status", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Compliance",
                 "start_date": NOW + 5 * DAY, "due_date": NOW + 10 * DAY, "assigned": [demo]},
                {"title": "Renew tenancy contract", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Operations",
                 "start_date": NOW + 7 * DAY, "due_date": NOW + 15 * DAY, "assigned": [omar]},
                {"title": "Update MOA if needed", "status": TaskStatus.TODO, "priority": TaskPriority.LOW, "category": "Compliance",
                 "start_date": NOW + 10 * DAY, "due_date": NOW + 20 * DAY, "assigned": [sarah]},
                {"title": "Submit renewal application", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW + 20 * DAY, "due_date": NOW + 25 * DAY, "assigned": [sarah, demo]},
                {"title": "Pay renewal fees", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Sales",
                 "start_date": NOW + 25 * DAY, "due_date": NOW + 30 * DAY, "assigned": [demo]},
            ],
        },
    ]

    created_projects = []
    all_tasks = []

    for pdata in projects_data:
        existing = db.query(Project).filter(Project.org_id == org_id, Project.title == pdata["title"]).first()
        if existing:
            created_projects.append(existing)
            all_tasks.extend(db.query(Task).filter(Task.project_id == existing.id).all())
            continue

        proj = Project(
            org_id=org_id, title=pdata["title"], description=pdata["description"],
            status=pdata["status"], priority=pdata["priority"],
            start_date=pdata["start_date"], due_date=pdata["due_date"],
            contact_id=contact_id, owner_id=demo.id,
        )
        db.add(proj)
        db.flush()
        created_projects.append(proj)

        prev_task = None
        for i, tdata in enumerate(pdata["tasks"]):
            t = Task(
                project_id=proj.id, org_id=org_id, title=tdata["title"],
                status=tdata["status"], priority=tdata["priority"],
                category=tdata.get("category"),
                start_date=tdata.get("start_date"), due_date=tdata.get("due_date"),
                assigned_to=tdata["assigned"][0].id if tdata.get("assigned") else None,
                sort_order=i,
            )
            db.add(t)
            db.flush()
            all_tasks.append(t)

            # Multi-assignees
            for assignee in tdata.get("assigned", []):
                db.add(TaskAssignee(task_id=t.id, user_id=assignee.id))

            # Dependencies: each task depends on the previous (Gantt chain)
            if prev_task and i > 0:
                db.add(TaskDependency(
                    predecessor_id=prev_task.id, successor_id=t.id,
                    org_id=org_id, dependency_type="finish_to_start",
                ))
            prev_task = t

        print(f"  Created project: {pdata['title'][:50]} ({len(pdata['tasks'])} tasks)")

    print(f"  Showcase projects: {len(created_projects)}, tasks: {len(all_tasks)}")
    return created_projects, all_tasks


# ─────────────────────────────────────────────────────────
# 7. Wallets
# ─────────────────────────────────────────────────────────

def seed_wallets(db: Session, org_id: str, user_id: str, contacts: list):
    """Create client wallets and sample transactions."""
    wallets = []
    for contact in contacts[:3]:
        existing = db.query(ClientWallet).filter(ClientWallet.contact_id == contact.id).first()
        if existing:
            wallets.append(existing)
            continue
        w = ClientWallet(
            contact_id=contact.id, org_id=org_id, balance=Decimal("5000.00"),
            currency="AED", minimum_balance=Decimal("1000.00"),
            status=WalletStatus.ACTIVE, is_locked=False,
        )
        db.add(w)
        db.flush()
        db.add(Transaction(
            wallet_id=w.id, org_id=org_id, type=TransactionType.TOP_UP,
            amount=Decimal("5000.00"), currency="AED",
            balance_before=Decimal("0"), balance_after=Decimal("5000.00"),
            status=TransactionStatus.COMPLETED, description="Initial top-up",
            created_by=user_id, completed_at=datetime.now(timezone.utc),
        ))
        db.add(Transaction(
            wallet_id=w.id, org_id=org_id, type=TransactionType.FEE_CHARGE,
            amount=Decimal("-525.00"), amount_exclusive=Decimal("500.00"),
            vat_amount=Decimal("25.00"), amount_total=Decimal("525.00"),
            currency="AED", balance_before=Decimal("5000.00"),
            balance_after=Decimal("4475.00"), status=TransactionStatus.COMPLETED,
            description="Service fee - Trade license",
            created_by=user_id, completed_at=datetime.now(timezone.utc),
        ))
        w.balance = Decimal("4475.00")
        wallets.append(w)

    if wallets:
        wa = db.query(WalletAlert).filter(
            WalletAlert.wallet_id == wallets[0].id, WalletAlert.is_resolved == False,
        ).first()
        if not wa:
            db.add(WalletAlert(
                wallet_id=wallets[0].id, org_id=org_id, level=AlertLevel.WARNING,
                title="Low balance", message="Balance approaching minimum threshold.",
                is_resolved=False, balance_at_alert=Decimal("1200.00"),
                threshold_at_alert=Decimal("1000.00"),
            ))
    print(f"  Wallets: {len(wallets)} with transactions")
    return wallets


# ─────────────────────────────────────────────────────────
# 8. Documents
# ─────────────────────────────────────────────────────────

def seed_document_categories(db: Session, org_id: str):
    """Ensure org has system document categories."""
    slugs_seen = set()
    for t in SYSTEM_DOCUMENT_CATEGORIES:
        slug, name = t["slug"], t["name"]
        if slug in slugs_seen:
            continue
        slugs_seen.add(slug)
        existing = db.query(DocumentCategory).filter(
            DocumentCategory.org_id == org_id, DocumentCategory.slug == slug,
        ).first()
        if not existing:
            db.add(DocumentCategory(
                org_id=org_id, name=name, slug=slug, parent_id=None, is_system="true",
            ))
    db.flush()


def seed_documents(db: Session, org_id: str, user_id: str, contacts: list):
    """Create sample document metadata (no real files)."""
    categories = [t["slug"] for t in SYSTEM_DOCUMENT_CATEGORIES[:5]]
    file_names = ["trade_license_2025.pdf", "passport_copy.pdf", "service_agreement.pdf", "receipt_001.pdf"]
    created = 0
    for contact in contacts[:3]:
        for i, (cat, fname) in enumerate(zip(categories[:len(file_names)], file_names)):
            existing = db.query(Document).filter(
                Document.org_id == org_id, Document.contact_id == contact.id, Document.file_name == fname,
            ).first()
            if existing:
                continue
            doc_id = generate_uuid()
            db.add(Document(
                id=doc_id, org_id=org_id, contact_id=contact.id, category=cat,
                folder="demo", description=f"Sample {cat} for {contact.name}",
                file_name=fname, file_path=f"{org_id}/documents/{doc_id}.pdf",
                file_size=1024 * (i + 1), mime_type="application/pdf",
                status=DocumentStatus.ACTIVE, uploaded_by=user_id,
            ))
            created += 1
    print(f"  Documents: {created} (metadata only)")


# ─────────────────────────────────────────────────────────
# 9. Comments & Reactions (showcase)
# ─────────────────────────────────────────────────────────

def seed_comments_and_reactions(db: Session, org_id: str, users: list, tasks: list):
    """Add threaded comments with reactions to tasks."""
    if not tasks:
        return
    demo, sarah, omar = users[0], users[1], users[2]

    comment_data = [
        (0, demo, "Documents have been prepared and submitted to the client for review.", [
            (sarah, "Client confirmed receipt. All looks good!"),
            (omar, "Great, moving to next step."),
        ], [(sarah, "thumbsup"), (omar, "thumbsup"), (demo, "rocket")]),
        (1, sarah, "DED approval is taking longer than expected. I've escalated with our contact at the authority.", [
            (demo, "Thanks Sarah, please keep us posted. We need this by end of week."),
            (sarah, "Just got confirmation — approval will be issued tomorrow."),
            (omar, "That's a relief! I'll prepare the next steps."),
        ], [(demo, "eyes"), (omar, "fire")]),
        (3, demo, "MOA draft v1 is ready for internal review. @Sarah please check the shareholding structure.", [
            (sarah, "Reviewed — found a minor issue with share allocation percentages. Fixing now."),
            (demo, "Updated and re-uploaded. Ready for client sign-off."),
        ], [(sarah, "heart"), (omar, "thumbsup")]),
        (4, omar, "Found a great office space in Business Bay. Rent is within budget at 45,000 AED/year.", [
            (demo, "Good find! Can you share photos and the floor plan?"),
            (omar, "Uploaded the brochure to attachments."),
        ], [(demo, "rocket"), (sarah, "eyes")]),
        (5, demo, "Government fee estimate: AED 12,500 for trade license + AED 3,200 for visa processing.", [], [(sarah, "thumbsup")]),
        (7, sarah, "Visa applications will need medical fitness test + Emirates ID registration. Timeline: ~10 working days.", [
            (omar, "I'll coordinate the medical appointments."),
        ], [(demo, "thumbsup"), (omar, "fire")]),
    ]

    created = 0
    for task_idx, author, content, replies, reactions in comment_data:
        if task_idx >= len(tasks):
            continue
        task = tasks[task_idx]
        existing = db.query(TaskComment).filter(
            TaskComment.task_id == task.id, TaskComment.content == content
        ).first()
        if existing:
            continue
        comment = TaskComment(task_id=task.id, org_id=org_id, user_id=author.id, content=content)
        db.add(comment)
        db.flush()
        created += 1
        for rxn_user, emoji in reactions:
            db.add(CommentReaction(comment_id=comment.id, user_id=rxn_user.id, org_id=org_id, emoji=emoji))
        for reply_user, reply_content in replies:
            reply = TaskComment(
                task_id=task.id, org_id=org_id, user_id=reply_user.id,
                content=reply_content, parent_id=comment.id,
            )
            db.add(reply)
            db.flush()
            created += 1
            if "confirm" in reply_content.lower() or "great" in reply_content.lower():
                db.add(CommentReaction(comment_id=reply.id, user_id=demo.id, org_id=org_id, emoji="thumbsup"))
    print(f"  Comments: {created} (with reactions)")


# ─────────────────────────────────────────────────────────
# 10. Attachments (metadata only)
# ─────────────────────────────────────────────────────────

def seed_attachments(db: Session, org_id: str, users: list, tasks: list):
    """Add fake attachment metadata to demonstrate the Files tab."""
    if not tasks:
        return
    demo, sarah, omar = users[0], users[1], users[2]
    attachment_data = [
        (0, demo, "incorporation_docs_v2.pdf", 245760, "application/pdf"),
        (0, sarah, "passport_copies.pdf", 1048576, "application/pdf"),
        (0, omar, "shareholder_agreement.docx", 89600, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        (1, sarah, "DED_approval_letter.pdf", 156000, "application/pdf"),
        (3, demo, "MOA_draft_v1.pdf", 320000, "application/pdf"),
        (3, demo, "MOA_draft_v2_final.pdf", 335000, "application/pdf"),
        (4, omar, "office_brochure_business_bay.pdf", 2100000, "application/pdf"),
        (4, omar, "floor_plan_office_1205.png", 890000, "image/png"),
        (7, sarah, "visa_application_form.pdf", 95000, "application/pdf"),
        (7, sarah, "medical_test_requirements.pdf", 45000, "application/pdf"),
    ]
    created = 0
    for task_idx, uploader, filename, size, mime in attachment_data:
        if task_idx >= len(tasks):
            continue
        task = tasks[task_idx]
        existing = db.query(TaskAttachment).filter(
            TaskAttachment.task_id == task.id, TaskAttachment.filename == filename
        ).first()
        if existing:
            continue
        db.add(TaskAttachment(
            task_id=task.id, org_id=org_id, user_id=uploader.id,
            filename=filename, file_path=f"uploads/tasks/{task.id}/{generate_uuid()}.dat",
            file_size=size, mime_type=mime,
        ))
        created += 1
    print(f"  Attachments: {created} (metadata only)")


# ─────────────────────────────────────────────────────────
# 11. Favorites
# ─────────────────────────────────────────────────────────

def seed_favorites(db: Session, org_id: str, user_id: str, projects: list):
    """Pin first 2 projects as favorites for the demo user."""
    created = 0
    for i, proj in enumerate(projects[:2]):
        existing = db.query(UserFavorite).filter(
            UserFavorite.user_id == user_id, UserFavorite.project_id == proj.id
        ).first()
        if existing:
            continue
        db.add(UserFavorite(user_id=user_id, org_id=org_id, project_id=proj.id, sort_order=i))
        created += 1
    print(f"  Favorites: {created} projects pinned")


# ─────────────────────────────────────────────────────────
# 12. Activities
# ─────────────────────────────────────────────────────────

def seed_activities(db: Session, org_id: str, users: list, projects: list, contacts: list):
    """Create today's activities for dashboards, linked to contacts."""
    if not projects:
        return
    demo, sarah, omar = users[0], users[1], users[2]
    today = NOW.replace(hour=0, minute=0, second=0, microsecond=0)

    # Map project index -> contact for linking activities to contacts
    contact_map = {i: contacts[min(i, len(contacts) - 1)].id if contacts else None for i in range(len(projects))}

    activities_data = [
        (0, demo, "Client kick-off meeting", ActivityType.MEETING, 9, 0, 10, 0, "Meeting Room A"),
        (0, sarah, "Review DED requirements", ActivityType.CALL, 10, 0, 10, 30, None),
        (1, sarah, "FTA portal submission call", ActivityType.CALL, 10, 30, 11, 0, None),
        (0, omar, "Office space viewing", ActivityType.VISIT, 11, 0, 12, 0, "Business Bay, Tower 1"),
        (0, demo, "MOA review session", ActivityType.MEETING, 13, 0, 14, 0, "Conference Room B"),
        (1, demo, "VAT threshold analysis", ActivityType.FOLLOW_UP, 14, 0, 14, 30, None),
        (2, omar, "License audit prep call", ActivityType.CALL, 14, 30, 15, 0, None),
        (0, sarah, "Investor visa planning", ActivityType.MEETING, 15, 0, 16, 0, "Meeting Room A"),
        (1, sarah, "Follow up with FTA contact", ActivityType.FOLLOW_UP, 16, 0, 16, 30, None),
        (2, demo, "Renewal timeline meeting", ActivityType.MEETING, 16, 0, 17, 0, "Online - Zoom"),
    ]

    created = 0
    for proj_idx, user, title, atype, sh, sm, eh, em, location in activities_data:
        if proj_idx >= len(projects):
            continue
        proj = projects[proj_idx]
        existing = db.query(Activity).filter(
            Activity.org_id == org_id, Activity.title == title, Activity.project_id == proj.id,
        ).first()
        if existing:
            continue
        start_dt = today.replace(hour=sh, minute=sm)
        end_dt = today.replace(hour=eh, minute=em)
        db.add(Activity(
            org_id=org_id, project_id=proj.id, title=title, activity_type=atype,
            start_datetime=start_dt, end_datetime=end_dt,
            status=ActivityStatus.PENDING if end_dt > NOW else ActivityStatus.COMPLETED,
            assigned_to=user.id, created_by=demo.id, location=location,
            contact_id=contact_map.get(proj_idx),
        ))
        created += 1
    print(f"  Activities: {created} (meetings, calls, follow-ups, visits)")


# ─────────────────────────────────────────────────────────
# 13. Ownership Links (for Ownership Map)
# ─────────────────────────────────────────────────────────

def seed_ownership_links(db: Session, org_id: str, contacts: list):
    """Create sample ownership links between contacts for the Ownership Map."""
    if len(contacts) < 4:
        print("  Ownership links: not enough contacts, skipping")
        return
    # companies = contacts[0:3], individuals = contacts[3:5]
    links_data = [
        # Ahmed Hassan owns 51% of Gulf Trading LLC
        (3, 0, OwnershipLinkType.OWNERSHIP, 51.0, "Managing Director"),
        # Sara Al Maktoum owns 49% of Gulf Trading LLC
        (4, 0, OwnershipLinkType.OWNERSHIP, 49.0, None),
        # Gulf Trading LLC owns 60% of Al Noor Services FZE
        (0, 2, OwnershipLinkType.OWNERSHIP, 60.0, None),
        # Ahmed Hassan is director of Al Noor Services FZE
        (3, 2, OwnershipLinkType.DIRECTOR, None, "Director"),
        # Sara Al Maktoum is director of Desert Sands Consulting
        (4, 1, OwnershipLinkType.DIRECTOR, None, "Director"),
        # Ahmed Hassan owns 40% of Desert Sands Consulting
        (3, 1, OwnershipLinkType.OWNERSHIP, 40.0, None),
    ]
    created = 0
    for owner_idx, owned_idx, link_type, pct, role in links_data:
        if owner_idx >= len(contacts) or owned_idx >= len(contacts):
            continue
        owner = contacts[owner_idx]
        owned = contacts[owned_idx]
        existing = db.query(OwnershipLink).filter(
            OwnershipLink.org_id == org_id,
            OwnershipLink.owner_contact_id == owner.id,
            OwnershipLink.owned_contact_id == owned.id,
            OwnershipLink.link_type == link_type,
        ).first()
        if existing:
            continue
        db.add(OwnershipLink(
            org_id=org_id,
            owner_contact_id=owner.id,
            owned_contact_id=owned.id,
            link_type=link_type,
            percentage=pct,
            role_label=role,
        ))
        created += 1
    print(f"  Ownership links: {created} (for Ownership Map)")


# ─────────────────────────────────────────────────────────
# Main runner
# ─────────────────────────────────────────────────────────

def run():
    """Run the consolidated seed — fully idempotent."""
    print("\n=== CSP-ERP: Seeding all demo data ===\n")
    db = SessionLocal()
    try:
        # 1. Org + users
        org, users = get_or_create_org_and_users(db)
        org_id = org.id
        demo = users[0]

        # 2. Core data
        contacts = seed_contacts(db, org_id, demo.id)
        products = seed_products(db, org_id)
        leads, opps = seed_leads_and_opportunities(db, org_id, demo.id, contacts)
        quots, orders, invoices = seed_quotations_orders_invoices(db, org_id, demo.id, contacts, products)

        # 3. Showcase projects (rich tasks)
        projects, tasks = seed_showcase_projects(db, org_id, users)

        # 4. Supporting data
        seed_wallets(db, org_id, demo.id, contacts)
        seed_document_categories(db, org_id)
        seed_documents(db, org_id, demo.id, contacts)

        # 5. Collaboration features
        seed_comments_and_reactions(db, org_id, users, tasks)
        seed_attachments(db, org_id, users, tasks)
        seed_favorites(db, org_id, demo.id, projects)
        seed_activities(db, org_id, users, projects, contacts)
        seed_ownership_links(db, org_id, contacts)

        db.commit()
        print(f"\n=== Done! ===")
        print(f"  Org: {org.name}")
        print(f"  Users: demo@csp.local / sarah@csp.local / omar@csp.local (all pw: demo123)")
        print(f"  Contacts: {len(contacts)}, Products: {len(products)}")
        print(f"  Leads: {len(leads)}, Opportunities: {len(opps)}")
        print(f"  Quotations: {len(quots)}, Orders: {len(orders)}, Invoices: {len(invoices)}")
        print(f"  Projects: {len(projects)}, Tasks: {len(tasks)}")
        print()
    except Exception as e:
        db.rollback()
        print(f"SEED ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()

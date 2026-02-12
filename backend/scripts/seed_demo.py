"""
Seed demo data for the quick-login user (demo@csp.local / demo123).
Creates organization "Demo CSP", demo user, and sample data across all modules.

Run from backend directory:
  python -m scripts.seed_demo

Or from project root:
  cd backend && ./venv/bin/python -m scripts.seed_demo

If you see "no such table: entities": your DB has stale FKs from an old migration.
Use a fresh database: stop the app, delete backend/csp_erp.db (and .db-shm, .db-wal
if present), run ./start once to create tables, then run this script.
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
from core.database import SessionLocal, engine
from core.security import hash_password
from models.base import generate_uuid
import models  # noqa: F401 - register all models

from models.organization import Organization
from models.user import User, UserRole
from models.org_settings import OrganizationSettings
from models.contact import Contact, ContactAddress, ContactType, ContactStatus, AddressType
from models.product import Product
from models.lead import Lead, LeadStatus
from models.opportunity import Opportunity, OpportunityStage
from models.crm_contact import CrmContact
from models.quotation import Quotation, QuotationLine, QuotationStatus
from models.sales_order import SalesOrder, SalesOrderLine, SalesOrderStatus
from models.invoice import Invoice, InvoiceLine, InvoiceStatus
from models.project import Project, Task, ProjectStatus, TaskStatus, TaskPriority
from models.wallet import (
    ClientWallet,
    Transaction,
    WalletAlert,
    WalletStatus,
    TransactionType,
    TransactionStatus,
    AlertLevel,
)
from models.document import Document, DocumentCategory, DocumentStatus
from models.org_settings import OrgModuleSetting, ModuleId
from constants.document_types import SYSTEM_DOCUMENT_CATEGORIES

DEMO_EMAIL = "demo@csp.local"
DEMO_PASSWORD = "demo123"
DEMO_ORG_NAME = "Demo CSP"
DEMO_USER_NAME = "Demo User"


def get_or_create_demo_org_and_user(db: Session) -> tuple[Organization, User]:
    """Get or create Demo CSP org and demo@csp.local user."""
    org = db.query(Organization).filter(Organization.name == DEMO_ORG_NAME).first()
    if not org:
        org = Organization(name=DEMO_ORG_NAME)
        db.add(org)
        db.flush()
        print(f"  Created organization: {DEMO_ORG_NAME}")

    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user:
        user = User(
            email=DEMO_EMAIL,
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name=DEMO_USER_NAME,
            role=UserRole.ADMIN,
            org_id=org.id,
            is_active=True,
        )
        db.add(user)
        db.flush()
        print(f"  Created user: {DEMO_EMAIL} (password: {DEMO_PASSWORD})")
    else:
        # Ensure user belongs to demo org and has admin role
        user.org_id = org.id
        user.role = UserRole.ADMIN
        user.is_active = True
        print(f"  Using existing user: {DEMO_EMAIL}")

    # Org settings (for number sequences etc.)
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

    # Enable all modules for this org
    for mod_id in ModuleId.ALL:
        existing = db.query(OrgModuleSetting).filter(
            OrgModuleSetting.org_id == org.id,
            OrgModuleSetting.module_id == mod_id,
        ).first()
        if not existing:
            db.add(OrgModuleSetting(org_id=org.id, module_id=mod_id, enabled=True))
    print("  Ensured all modules enabled")
    return org, user


def seed_contacts(db: Session, org_id: str, manager_id: str) -> list[Contact]:
    """Create sample contacts (companies and individuals)."""
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
        addr = ContactAddress(
            contact_id=contact.id,
            address_type=AddressType.REGISTERED_OFFICE,
            address_line_1="Business Bay, Tower 1",
            address_line_2="Office 1205",
            city="Dubai",
            state_emirate="Dubai",
            country="UAE",
            is_primary=True,
        )
        db.add(addr)
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
        addr = ContactAddress(
            contact_id=contact.id,
            address_type=AddressType.RESIDENTIAL,
            address_line_1="Villa 45, Palm Jumeirah",
            city="Dubai",
            state_emirate="Dubai",
            country="UAE",
            is_primary=True,
        )
        db.add(addr)
        contacts.append(contact)

    print(f"  Contacts: {len(contacts)} (companies + individuals)")
    return contacts


def seed_products(db: Session, org_id: str) -> list[Product]:
    """Create sample products."""
    products = []
    items = [
        ("Trade License Renewal", "Annual renewal of trade license", Decimal("3500.00")),
        ("VAT Registration", "VAT registration with FTA", Decimal("2500.00")),
        ("Company Formation", "New company setup package", Decimal("15000.00")),
        ("Accounting Retainer", "Monthly accounting and bookkeeping", Decimal("3000.00")),
    ]
    for name, desc, price in items:
        existing = db.query(Product).filter(Product.org_id == org_id, Product.name == name).first()
        if existing:
            products.append(existing)
            continue
        p = Product(
            org_id=org_id,
            name=name,
            description=desc,
            default_unit_price=price,
            is_active=True,
            creates_project=False,
        )
        db.add(p)
        db.flush()
        products.append(p)
    print(f"  Products: {len(products)}")
    return products


def seed_leads_and_opportunities(
    db: Session, org_id: str, user_id: str, contacts: list[Contact]
) -> tuple[list[Lead], list[Opportunity]]:
    """Create sample leads and opportunities."""
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
            org_id=org_id,
            name=name,
            email=email,
            phone="+971 50 999 0000",
            source=source,
            status=status,
            assigned_to=user_id,
            notes=f"Sample lead: {source}",
        )
        db.add(lead)
        db.flush()
        leads.append(lead)
        # One opportunity per lead
        opp = Opportunity(
            org_id=org_id,
            lead_id=lead.id,
            name=f"Deal - {name}",
            amount=Decimal("12000.00") if "Tech" in name else Decimal("8500.00"),
            stage=OpportunityStage.QUOTE_SENT if status == LeadStatus.QUALIFIED else OpportunityStage.LEAD,
            probability=Decimal("60") if status == LeadStatus.QUALIFIED else Decimal("30"),
            expected_close_date=date.today() + timedelta(days=30),
        )
        db.add(opp)
        db.flush()
        opps.append(opp)

    # One opportunity linked to a contact (optional; requires contact_id on opportunities)
    if contacts:
        try:
            c = contacts[0]
            opp = Opportunity(
                org_id=org_id,
                contact_id=c.id,
                name=f"Retainer - {c.name}",
                amount=Decimal("25000.00"),
                stage=OpportunityStage.NEGOTIATION,
                probability=Decimal("75"),
                expected_close_date=date.today() + timedelta(days=14),
            )
            db.add(opp)
            db.flush()
            opps.append(opp)
        except Exception:
            # DB may lack contact_id or have stale FK to entities; skip contact-linked opp
            pass

    # CRM contacts (people at leads/contacts)
    for lead in leads[:2]:
        existing = db.query(CrmContact).filter(
            CrmContact.org_id == org_id,
            CrmContact.lead_id == lead.id,
        ).first()
        if not existing:
            cc = CrmContact(
                org_id=org_id,
                lead_id=lead.id,
                name=lead.name + " Contact",
                email=lead.email,
                phone=lead.phone,
                role="Decision Maker",
            )
            db.add(cc)
    for contact in contacts[:2]:
        existing = db.query(CrmContact).filter(
            CrmContact.org_id == org_id,
            CrmContact.contact_id == contact.id,
        ).first()
        if not existing:
            cc = CrmContact(
                org_id=org_id,
                contact_id=contact.id,
                name=contact.name + " (Primary)",
                email=contact.email,
                phone=contact.phone_primary,
                role="Account Manager",
            )
            db.add(cc)

    print(f"  Leads: {len(leads)}, Opportunities: {len(opps)}, CRM contacts created")
    return leads, opps


def seed_quotations_orders_invoices(
    db: Session,
    org_id: str,
    user_id: str,
    contacts: list[Contact],
    products: list[Product],
    leads: list[Lead],
    opportunities: list[Opportunity],
) -> tuple[list[Quotation], list[SalesOrder], list[Invoice]]:
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
            org_id=org_id,
            number=num,
            contact_id=contact.id,
            status=QuotationStatus.SENT if i == 0 else QuotationStatus.DRAFT,
            valid_until=date.today() + timedelta(days=30),
            total=Decimal("0"),
            vat_amount=Decimal("0"),
            created_by=user_id,
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
                quotation_id=q.id,
                product_id=prod.id,
                description=prod.name,
                quantity=qty,
                unit_price=price,
                vat_rate=vat,
                amount=amount,
            ))
        q.total = line_total
        q.vat_amount = line_total - line_total / Decimal("1.05")
        quotations.append(q)

    # Sales orders (linked to contact)
    for i, contact in enumerate(contacts[:2]):
        num = next_order_number(db, org_id, SalesOrder)
        existing = db.query(SalesOrder).filter(SalesOrder.org_id == org_id, SalesOrder.number == num).first()
        if existing:
            orders.append(existing)
            continue
        ord_status = SalesOrderStatus.CONFIRMED if i == 0 else SalesOrderStatus.PENDING
        o = SalesOrder(
            org_id=org_id,
            number=num,
            contact_id=contact.id,
            status=ord_status,
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
                sales_order_id=o.id,
                product_id=prod.id,
                description=prod.name,
                quantity=qty,
                unit_price=price,
                vat_rate=vat,
                amount=amount,
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
            org_id=org_id,
            number=num,
            contact_id=contact.id,
            status=inv_status,
            due_date=date.today() + timedelta(days=14),
            total=total,
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
                invoice_id=inv.id,
                product_id=prod.id,
                description=prod.name,
                quantity=qty,
                unit_price=price,
                vat_rate=vat,
                amount=amount,
            ))
        invoices.append(inv)

    print(f"  Quotations: {len(quotations)}, Orders: {len(orders)}, Invoices: {len(invoices)}")
    return quotations, orders, invoices


def seed_projects_and_tasks(
    db: Session, org_id: str, user_id: str, contacts: list[Contact], orders: list[SalesOrder], invoices: list[Invoice]
) -> list[Project]:
    """Create sample projects with tasks."""
    projects = []
    if not contacts:
        return projects

    titles = [
        ("Trade License Renewal - Gulf Trading", ProjectStatus.IN_PROGRESS),
        ("VAT Registration - Desert Sands", ProjectStatus.PLANNING),
    ]
    for title, status in titles:
        existing = db.query(Project).filter(Project.org_id == org_id, Project.title == title).first()
        if existing:
            projects.append(existing)
            continue
        proj = Project(
            org_id=org_id,
            contact_id=contacts[0].id,
            title=title,
            description="Sample project for demo.",
            status=status,
            start_date=datetime.now(timezone.utc),
            due_date=datetime.now(timezone.utc) + timedelta(days=30),
            owner_id=user_id,
            sales_order_id=orders[0].id if orders else None,
            invoice_id=invoices[0].id if invoices else None,
        )
        db.add(proj)
        db.flush()
        tasks_data = [
            ("Submit documents", TaskStatus.DONE, TaskPriority.HIGH),
            ("FTA approval", TaskStatus.IN_PROGRESS, TaskPriority.HIGH),
            ("Collect license", TaskStatus.TODO, TaskPriority.MEDIUM),
        ]
        for ttitle, tstatus, tpri in tasks_data:
            db.add(Task(
                project_id=proj.id,
                org_id=org_id,
                title=ttitle,
                status=tstatus,
                priority=tpri,
                assigned_to=user_id,
            ))
        projects.append(proj)
    print(f"  Projects: {len(projects)} with tasks")
    return projects


def seed_wallets(
    db: Session, org_id: str, user_id: str, contacts: list[Contact]
) -> list[ClientWallet]:
    """Create client wallets and sample transactions."""
    wallets = []
    for contact in contacts[:3]:
        existing = db.query(ClientWallet).filter(ClientWallet.contact_id == contact.id).first()
        if existing:
            wallets.append(existing)
            continue
        w = ClientWallet(
            contact_id=contact.id,
            org_id=org_id,
            balance=Decimal("5000.00"),
            currency="AED",
            minimum_balance=Decimal("1000.00"),
            status=WalletStatus.ACTIVE,
            is_locked=False,
        )
        db.add(w)
        db.flush()
        # Top-up transaction
        db.add(Transaction(
            wallet_id=w.id,
            org_id=org_id,
            type=TransactionType.TOP_UP,
            amount=Decimal("5000.00"),
            currency="AED",
            balance_before=Decimal("0"),
            balance_after=Decimal("5000.00"),
            status=TransactionStatus.COMPLETED,
            description="Initial top-up",
            created_by=user_id,
            completed_at=datetime.now(timezone.utc),
        ))
        # Optional: one fee charge to show history
        db.add(Transaction(
            wallet_id=w.id,
            org_id=org_id,
            type=TransactionType.FEE_CHARGE,
            amount=Decimal("-525.00"),  # 500 + 5% VAT
            amount_exclusive=Decimal("500.00"),
            vat_amount=Decimal("25.00"),
            amount_total=Decimal("525.00"),
            currency="AED",
            balance_before=Decimal("5000.00"),
            balance_after=Decimal("4475.00"),
            status=TransactionStatus.COMPLETED,
            description="Service fee - Trade license",
            created_by=user_id,
            completed_at=datetime.now(timezone.utc),
        ))
        w.balance = Decimal("4475.00")
        wallets.append(w)

    # One wallet alert (low balance warning)
    if wallets:
        wa = db.query(WalletAlert).filter(
            WalletAlert.wallet_id == wallets[0].id,
            WalletAlert.is_resolved == False,
        ).first()
        if not wa:
            db.add(WalletAlert(
                wallet_id=wallets[0].id,
                org_id=org_id,
                level=AlertLevel.WARNING,
                title="Low balance",
                message="Balance approaching minimum threshold.",
                is_resolved=False,
                balance_at_alert=Decimal("1200.00"),
                threshold_at_alert=Decimal("1000.00"),
            ))
    print(f"  Wallets: {len(wallets)} with transactions")
    return wallets


def seed_document_categories(db: Session, org_id: str) -> None:
    """Ensure org has system document categories in document_categories (for list_categories / document-types)."""
    slugs_seen = set()
    for t in SYSTEM_DOCUMENT_CATEGORIES:
        slug, name = t["slug"], t["name"]
        if slug in slugs_seen:
            continue
        slugs_seen.add(slug)
        existing = db.query(DocumentCategory).filter(
            DocumentCategory.org_id == org_id,
            DocumentCategory.slug == slug,
        ).first()
        if not existing:
            db.add(DocumentCategory(
                org_id=org_id,
                name=name,
                slug=slug,
                parent_id=None,
                is_system="true",
            ))
    db.flush()


def seed_documents(db: Session, org_id: str, user_id: str, contacts: list[Contact]) -> None:
    """Create sample document metadata (no real files - list/detail only)."""
    categories = [t["slug"] for t in SYSTEM_DOCUMENT_CATEGORIES[:5]]  # trade_license, moa, passport, visa, contract
    file_names = ["trade_license_2025.pdf", "passport_copy.pdf", "service_agreement.pdf", "receipt_001.pdf"]
    created = 0
    for contact in contacts[:3]:
        for i, (cat, fname) in enumerate(zip(categories[: len(file_names)], file_names)):
            existing = db.query(Document).filter(
                Document.org_id == org_id,
                Document.contact_id == contact.id,
                Document.file_name == fname,
            ).first()
            if existing:
                continue
            doc_id = generate_uuid()
            db.add(Document(
                id=doc_id,
                org_id=org_id,
                contact_id=contact.id,
                category=cat,
                folder="demo",
                description=f"Sample {cat} for {contact.name}",
                file_name=fname,
                file_path=f"{org_id}/documents/{doc_id}.pdf",
                file_size=1024 * (i + 1),
                mime_type="application/pdf",
                status=DocumentStatus.ACTIVE,
                uploaded_by=user_id,
            ))
            created += 1
    print(f"  Documents: {created} (metadata only; view/download may 404 without real files)")


def run():
    """Run the seed script."""
    print("Seeding demo data for quick-login user...")
    db = SessionLocal()
    try:
        org, user = get_or_create_demo_org_and_user(db)
        org_id = org.id
        user_id = user.id

        contacts = seed_contacts(db, org_id, user_id)
        products = seed_products(db, org_id)
        leads, opportunities = seed_leads_and_opportunities(db, org_id, user_id, contacts)
        quotations, orders, invoices = seed_quotations_orders_invoices(
            db, org_id, user_id, contacts, products, leads, opportunities
        )
        projects = seed_projects_and_tasks(db, org_id, user_id, contacts, orders, invoices)
        seed_wallets(db, org_id, user_id, contacts)
        seed_document_categories(db, org_id)
        seed_documents(db, org_id, user_id, contacts)

        db.commit()
        print("Done. Log in with: demo@csp.local / demo123")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()

# Comprehensive Accounting Module — Implementation Plan

Full double-entry accounting module with Invoices, Wallets (master + sub-wallets), Payments, Journal Entries, Bank Reconciliation, multi-currency, AR + AP, and Chart of Accounts — all integrated under a unified Accounting sidebar section.

---

## Design Decisions (Confirmed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Wallet structure | **Master wallet per contact + sub-wallet per SO** |
| 2 | Double-entry | **Full** — every event → balanced journal entries |
| 3 | AR + AP | **Both** — customer invoices + vendor bills |
| 4 | Bank recon | **Yes** — bank statement import + matching |
| 5 | Multi-currency | **Yes** — with exchange rates (AED base) |
| 6 | CoA | **Minimal but sufficient** UAE CoA seed, expandable |
| 7 | Migration | **Going forward** + ability to import retroactively |
| 8 | Payment terms | Yes — configurable (Net 30, etc.) |
| 9 | Fiscal year | Calendar year, with period-locking |
| 10 | Credit/Debit notes | Included in scope |
| 11 | Proforma Invoice | **Sales Order serves as proforma** — no separate proforma model needed |

---

## Models — Full Definitions

All models use `generate_uuid` for PK, `TimestampMixin` (created_at, updated_at) unless noted.

### Enums

```python
class AccountType:
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"
    ALL = [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]

class JournalType:
    SALE = "sale"
    PURCHASE = "purchase"
    BANK = "bank"
    CASH = "cash"
    GENERAL = "general"
    ALL = [SALE, PURCHASE, BANK, CASH, GENERAL]

class EntryState:
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"
    ALL = [DRAFT, POSTED, CANCELLED]

class PaymentType:
    INBOUND = "inbound"    # customer pays us
    OUTBOUND = "outbound"  # we pay vendor
    ALL = [INBOUND, OUTBOUND]

class PaymentMethod:
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHEQUE = "cheque"
    ONLINE = "online"
    ALL = [BANK_TRANSFER, CASH, CHEQUE, ONLINE]

class PaymentState:
    DRAFT = "draft"
    POSTED = "posted"
    RECONCILED = "reconciled"
    CANCELLED = "cancelled"
    ALL = [DRAFT, POSTED, RECONCILED, CANCELLED]

class VendorBillStatus:
    DRAFT = "draft"
    POSTED = "posted"
    PAID = "paid"
    CANCELLED = "cancelled"
    ALL = [DRAFT, POSTED, PAID, CANCELLED]

class FiscalState:
    OPEN = "open"
    CLOSED = "closed"
    ALL = [OPEN, CLOSED]

class BankStatementState:
    DRAFT = "draft"
    PROCESSING = "processing"
    DONE = "done"
    ALL = [DRAFT, PROCESSING, DONE]

class TaxType:
    SALE = "sale"
    PURCHASE = "purchase"
    ALL = [SALE, PURCHASE]

class SubWalletStatus:
    ACTIVE = "active"
    CLOSED = "closed"
    ALL = [ACTIVE, CLOSED]

class AttachmentEntityType:
    JOURNAL_ENTRY = "journal_entry"
    INVOICE = "invoice"
    VENDOR_BILL = "vendor_bill"
    PAYMENT = "payment"
    BANK_STATEMENT = "bank_statement"
    ALL = [JOURNAL_ENTRY, INVOICE, VENDOR_BILL, PAYMENT, BANK_STATEMENT]
```

### `Account` (Chart of Accounts)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| code | String(20) | NOT NULL | e.g. "1130" |
| name | String(200) | NOT NULL | e.g. "Accounts Receivable" |
| account_type | String(20) | NOT NULL | AccountType enum |
| parent_id | String | FK → accounts.id, nullable | Self-referential for hierarchy |
| is_reconcilable | Boolean | NOT NULL, default=False | True for AR, AP, Bank accounts |
| currency | String(3) | NOT NULL, default="AED" | |
| active | Boolean | NOT NULL, default=True | Soft-disable |

**Relationships:**
- `parent` → self (Account), many-to-one
- `children` → self (Account), one-to-many, back_populates="parent"
- `journal_entry_lines` → JournalEntryLine, one-to-many

**Indexes:** composite (org_id, code) unique

---

### `Journal`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| code | String(10) | NOT NULL | SAL, PUR, BNK, CSH, MISC |
| name | String(100) | NOT NULL | "Sales Journal" |
| type | String(20) | NOT NULL | JournalType enum |
| default_debit_account_id | String | FK → accounts.id, nullable | |
| default_credit_account_id | String | FK → accounts.id, nullable | |
| currency | String(3) | NOT NULL, default="AED" | |
| active | Boolean | NOT NULL, default=True | |

**Relationships:**
- `default_debit_account` → Account, many-to-one
- `default_credit_account` → Account, many-to-one
- `entries` → JournalEntry, one-to-many

**Indexes:** composite (org_id, code) unique

---

### `JournalEntry`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| journal_id | String | FK → journals.id, NOT NULL | |
| number | String(50) | NOT NULL, unique | Auto-seq per journal: "SAL/2026/0001" |
| date | Date | NOT NULL | Accounting date |
| ref | String(200) | nullable | Human ref: invoice #, SO # |
| state | String(20) | NOT NULL, default="draft" | EntryState enum |
| narration | Text | nullable | Free-form notes |
| invoice_id | String | FK → invoices.id, nullable | Source customer invoice |
| vendor_bill_id | String | FK → vendor_bills.id, nullable | Source vendor bill |
| payment_id | String | FK → payments.id, nullable | Source payment |
| currency | String(3) | NOT NULL, default="AED" | |
| created_by | String | FK → users.id, nullable | |
| posted_at | DateTime | nullable | Timestamp when posted |

**Relationships:**
- `journal` → Journal, many-to-one
- `lines` → JournalEntryLine, one-to-many, cascade="all, delete-orphan"
- `invoice` → Invoice, many-to-one (nullable)
- `vendor_bill` → VendorBill, many-to-one (nullable)
- `payment` → Payment, many-to-one (nullable)

**Indexes:** (org_id, date), (org_id, state)

---

### `JournalEntryLine`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| entry_id | String | FK → journal_entries.id ON DELETE CASCADE, NOT NULL, index | |
| account_id | String | FK → accounts.id, NOT NULL, index | |
| partner_id | String | FK → contacts.id, nullable, index | Customer or vendor |
| name | String(300) | NOT NULL | Line label/description |
| debit | Numeric(15,2) | NOT NULL, default=0 | |
| credit | Numeric(15,2) | NOT NULL, default=0 | |
| currency | String(3) | NOT NULL, default="AED" | |
| amount_currency | Numeric(15,2) | nullable | Foreign currency amount (if different from base) |
| wallet_id | String | FK → client_wallets.id, nullable, index | Master wallet analytic tag |
| sub_wallet_id | String | FK → sub_wallets.id, nullable, index | SO-specific analytic tag |
| tax_id | String | FK → tax_rates.id, nullable | Tax rate applied |
| reconcile_id | String(50) | nullable, index | Group ID for reconciled lines (AR/AP matching) |
| reconciled | Boolean | NOT NULL, default=False | |

**Relationships:**
- `entry` → JournalEntry, many-to-one
- `account` → Account, many-to-one
- `partner` → Contact, many-to-one (nullable)
- `wallet` → ClientWallet, many-to-one (nullable)
- `sub_wallet` → SubWallet, many-to-one (nullable)
- `tax` → TaxRate, many-to-one (nullable)

**Constraint:** CHECK(debit >= 0 AND credit >= 0), CHECK(NOT (debit > 0 AND credit > 0)) — a line is either debit or credit, never both.

---

### `Payment`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| number | String(50) | NOT NULL, unique | "PAY/2026/0001" |
| partner_id | String | FK → contacts.id, NOT NULL | Customer or vendor |
| payment_type | String(20) | NOT NULL | PaymentType enum |
| payment_method | String(20) | NOT NULL, default="bank_transfer" | PaymentMethod enum |
| amount | Numeric(15,2) | NOT NULL | |
| currency | String(3) | NOT NULL, default="AED" | |
| journal_id | String | FK → journals.id, NOT NULL | Bank/Cash journal used |
| payment_date | Date | NOT NULL | |
| state | String(20) | NOT NULL, default="draft" | PaymentState enum |
| memo | String(500) | nullable | |
| created_by | String | FK → users.id, nullable | |

**Relationships:**
- `partner` → Contact, many-to-one
- `journal` → Journal, many-to-one
- `invoice_links` → PaymentInvoiceLink, one-to-many, cascade="all, delete-orphan"
- `journal_entries` → JournalEntry, one-to-many (via payment_id back-ref)

---

### `PaymentInvoiceLink`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| payment_id | String | FK → payments.id ON DELETE CASCADE, NOT NULL, index | |
| invoice_id | String | FK → invoices.id, nullable | Customer invoice |
| vendor_bill_id | String | FK → vendor_bills.id, nullable | Vendor bill |
| amount_allocated | Numeric(15,2) | NOT NULL | Portion of payment for this invoice/bill |

**Constraint:** exactly one of invoice_id or vendor_bill_id must be set.

---

### `VendorBill`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| number | String(50) | NOT NULL | "BILL/2026/0001" |
| vendor_id | String | FK → contacts.id, NOT NULL, index | Vendor contact |
| bill_date | Date | NOT NULL | |
| due_date | Date | nullable | Computed from payment_term or manual |
| payment_term_id | String | FK → payment_terms.id, nullable | |
| status | String(20) | NOT NULL, default="draft" | VendorBillStatus enum |
| total | Numeric(15,2) | NOT NULL, default=0 | Total incl. VAT |
| vat_amount | Numeric(15,2) | NOT NULL, default=0 | |
| currency | String(3) | NOT NULL, default="AED" | |
| notes | Text | nullable | |
| created_by | String | FK → users.id, nullable | |

**Relationships:**
- `vendor` → Contact, many-to-one
- `payment_term` → PaymentTerm, many-to-one (nullable)
- `lines` → VendorBillLine, one-to-many, cascade="all, delete-orphan"
- `journal_entries` → JournalEntry, one-to-many (via vendor_bill_id back-ref)

**Indexes:** composite (org_id, number) unique

---

### `VendorBillLine`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| bill_id | String | FK → vendor_bills.id ON DELETE CASCADE, NOT NULL, index | |
| account_id | String | FK → accounts.id, NOT NULL | Expense account |
| description | String(500) | NOT NULL | |
| quantity | Numeric(10,2) | NOT NULL, default=1 | |
| unit_price | Numeric(15,2) | NOT NULL | |
| vat_rate | Numeric(5,2) | NOT NULL, default=0 | |
| amount | Numeric(15,2) | NOT NULL | qty × unit_price (excl. VAT) |

**Relationships:**
- `bill` → VendorBill, many-to-one
- `account` → Account, many-to-one

---

### `Currency`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| code | String(3) PK | | "AED", "USD", "EUR" |
| name | String(100) | NOT NULL | "UAE Dirham" |
| symbol | String(5) | NOT NULL | "د.إ", "$", "€" |
| decimal_places | Integer | NOT NULL, default=2 | |
| active | Boolean | NOT NULL, default=True | |

No org_id — currencies are global. Seeded at startup.

---

### `ExchangeRate`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| currency_code | String(3) | FK → currencies.code, NOT NULL | |
| rate | Numeric(18,8) | NOT NULL | Rate to base (AED). e.g. USD→AED = 3.6725 |
| date | Date | NOT NULL | Effective date |

**Indexes:** composite (org_id, currency_code, date) unique — one rate per currency per day per org.

---

### `PaymentTerm`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| name | String(100) | NOT NULL | "Net 30", "Immediate" |
| active | Boolean | NOT NULL, default=True | |

**Relationships:**
- `lines` → PaymentTermLine, one-to-many, cascade="all, delete-orphan"

---

### `PaymentTermLine`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| term_id | String | FK → payment_terms.id ON DELETE CASCADE, NOT NULL | |
| days | Integer | NOT NULL | Days after invoice date |
| percentage | Numeric(5,2) | NOT NULL | e.g. 100.00 = full amount at N days |

**Example:** "Net 30" = 1 line: days=30, percentage=100.00

---

### `FiscalYear`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| name | String(50) | NOT NULL | "2026" |
| date_start | Date | NOT NULL | 2026-01-01 |
| date_end | Date | NOT NULL | 2026-12-31 |
| state | String(20) | NOT NULL, default="open" | FiscalState enum |

**Relationships:**
- `periods` → FiscalPeriod, one-to-many, cascade="all, delete-orphan"

---

### `FiscalPeriod`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| fiscal_year_id | String | FK → fiscal_years.id ON DELETE CASCADE, NOT NULL | |
| name | String(50) | NOT NULL | "January 2026" |
| date_start | Date | NOT NULL | |
| date_end | Date | NOT NULL | |
| state | String(20) | NOT NULL, default="open" | FiscalState enum |

**Validation:** No journal entries can be posted to a closed period.

---

### `BankStatement`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| journal_id | String | FK → journals.id, NOT NULL | Bank journal |
| date | Date | NOT NULL | Statement date |
| name | String(100) | NOT NULL | "Feb 2026 Statement" |
| opening_balance | Numeric(15,2) | NOT NULL, default=0 | |
| closing_balance | Numeric(15,2) | NOT NULL, default=0 | |
| state | String(20) | NOT NULL, default="draft" | BankStatementState enum |
| created_by | String | FK → users.id, nullable | |

**Relationships:**
- `journal` → Journal, many-to-one
- `lines` → BankStatementLine, one-to-many, cascade="all, delete-orphan"

---

### `BankStatementLine`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| statement_id | String | FK → bank_statements.id ON DELETE CASCADE, NOT NULL, index | |
| date | Date | NOT NULL | Transaction date |
| description | String(500) | NOT NULL | |
| amount | Numeric(15,2) | NOT NULL | Positive=credit, negative=debit |
| partner_id | String | FK → contacts.id, nullable | Auto/manually matched |
| is_reconciled | Boolean | NOT NULL, default=False | |
| payment_id | String | FK → payments.id, nullable | Linked payment |
| journal_entry_id | String | FK → journal_entries.id, nullable | Linked JE (for manual entries) |

**Relationships:**
- `statement` → BankStatement, many-to-one
- `partner` → Contact, many-to-one (nullable)
- `payment` → Payment, many-to-one (nullable)
- `journal_entry` → JournalEntry, many-to-one (nullable)

---

### `TaxRate`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| name | String(100) | NOT NULL | "VAT 5%", "VAT 0%", "Exempt" |
| rate | Numeric(5,2) | NOT NULL | 5.00, 0.00 |
| tax_type | String(20) | NOT NULL | TaxType enum (sale/purchase) |
| account_id | String | FK → accounts.id, NOT NULL | Tax payable/receivable account |
| active | Boolean | NOT NULL, default=True | |

**Seed:** "VAT 5% (Sales)" → rate=5, type=sale, account=2120; "VAT 5% (Purchase)" → rate=5, type=purchase, account=1150; "VAT 0%" → rate=0

---

### `SubWallet` (new model — `backend/models/sub_wallet.py`)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| master_wallet_id | String | FK → client_wallets.id ON DELETE CASCADE, NOT NULL, index | |
| sales_order_id | String | FK → sales_orders.id, NOT NULL, index | Triggering SO |
| label | String(200) | NOT NULL | Auto: "SO-2026-001 — [Contact Name]" |
| balance | Numeric(15,2) | NOT NULL, default=0 | **Cached** — recomputed from JE lines |
| currency | String(3) | NOT NULL, default="AED" | |
| status | String(20) | NOT NULL, default="active" | SubWalletStatus enum |

**Relationships:**
- `master_wallet` → ClientWallet, many-to-one, back_populates="sub_wallets"
- `sales_order` → SalesOrder, many-to-one
- `journal_entry_lines` → JournalEntryLine, one-to-many (via sub_wallet_id)

**Indexes:** composite (master_wallet_id, sales_order_id) unique — one sub-wallet per SO per master wallet.

**Balance logic:** `balance = SUM(credit) - SUM(debit)` from JournalEntryLine WHERE sub_wallet_id = this.id. Cached on write; recomputable.

---

### `AccountingAttachment` (new model — `backend/models/accounting_attachment.py`)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | String PK | default=generate_uuid | |
| org_id | String | FK → organizations.id, NOT NULL, index | |
| entity_type | String(30) | NOT NULL | AttachmentEntityType enum |
| entity_id | String | NOT NULL, index | Polymorphic FK to JE/invoice/bill/payment/statement |
| document_id | String | FK → documents.id ON DELETE CASCADE, NOT NULL | Reuses existing Document model |
| uploaded_by | String | FK → users.id, nullable | |

**Relationships:**
- `document` → Document, many-to-one

**Indexes:** composite (entity_type, entity_id) for listing attachments per entity.

---

### Modifications to Existing `ClientWallet`

| Change | Detail |
|--------|--------|
| New relationship | `sub_wallets` → SubWallet, one-to-many, back_populates="master_wallet", cascade="all, delete-orphan" |
| Balance logic | Master `balance` = SUM of `sub_wallets.balance`. Recomputed when sub-wallet balances change. |
| No column changes | Existing columns stay as-is. |

### Modifications to Existing `Invoice`

| Change | Detail |
|--------|--------|
| New column | `payment_term_id` — String, FK → payment_terms.id, nullable |
| New relationship | `payment_term` → PaymentTerm, many-to-one (nullable) |
| New relationship | `journal_entries` → JournalEntry, one-to-many (via invoice_id back-ref) |

---

## Sidebar Restructure

```
Accounting                    ← replaces separate Invoice & Wallet items
  ├── Overview                ← dashboard: AR, AP, cash, alerts
  ├── Customer Invoices       ← existing invoices, moved here
  ├── Vendor Bills            ← new
  ├── Payments                ← new
  ├── Client Wallets          ← existing wallets, moved here
  ├── Bank Reconciliation     ← new
  ├── Journal Entries         ← new
  ├── Chart of Accounts       ← new (admin/accountant only)
  └── Reports                 ← new (Trial Balance, P&L, BS, GL, Aging, VAT)
```

---

## Implementation Phases

### Phase 1: Accounting Foundation (backend models + APIs + seed)
1. Create `backend/models/accounting.py` with all new models listed above
2. Create `backend/models/sub_wallet.py` — `SubWallet` model
3. Create `backend/schemas/accounting.py` — Pydantic schemas for all
4. Create `backend/services/accounting_engine.py` — journal entry creation, posting, validation (balanced check), reversal
5. Create `backend/services/chart_of_accounts_seed.py` — minimal UAE CoA + default journals + default tax rates
6. Create `backend/api/accounting.py` — CRUD for accounts, journals, entries, payments, vendor bills, bank statements, fiscal years, currencies, tax rates, payment terms
7. Create `backend/migrations/add_accounting_tables.py`
8. Update `backend/models/__init__.py` — register all new models
9. Update `backend/models/org_settings.py` — add `ACCOUNTING` to `ModuleId`
10. Update `backend/main.py` — include accounting router
11. Auto-seed CoA + journals on first org access (or via API)

### Phase 2: Wallet Refactor + SO Integration
1. Add `SubWallet` model + relationship to `ClientWallet`
2. Update `backend/api/orders.py` `confirm_order`:
   - Auto-create master `ClientWallet` if contact doesn't have one
   - Auto-create `SubWallet` linked to the SO
3. Add `sub_wallet_id` column to `JournalEntryLine`
4. Refactor `backend/api/wallets.py`:
   - Master wallet balance = SUM of sub-wallet balances (derived from journal lines)
   - Top-up → generates journal entry (DR Bank / CR Client Trust Liability) tagged with sub_wallet
   - Fee charge → generates journal entry (DR Client Trust Liability / CR Revenue + CR VAT Payable) tagged with sub_wallet
   - Keep `Transaction` table as a read-friendly log (auto-created from journal entries)
5. Update wallet frontend to show sub-wallets per SO
6. Keep Red Alert / threshold system (runs on master wallet computed balance)

### Phase 3: Invoice + Payment Journal Integration
1. Refactor `backend/api/invoices.py`:
   - Invoice post (`draft` → `posted`) → auto-generate JE: DR AR / CR Revenue + CR VAT Payable
   - Credit note → reverse JE
2. Create payment registration flow:
   - Register payment → auto-generate JE: DR Bank / CR AR
   - Link payment to invoice(s) via `PaymentInvoiceLink`
   - Support partial payments (multiple payments per invoice)
   - Auto-reconcile AR lines
3. Vendor bill flow:
   - Bill post → JE: DR Expense / CR AP + DR VAT Receivable
   - Vendor payment → JE: DR AP / CR Bank
4. Add `payment_term_id` to Invoice and VendorBill
5. Due date auto-calculation from payment terms

### Phase 4: Bank Reconciliation
1. Bank statement import (CSV parser, extensible to OFX)
2. `BankStatement` + `BankStatementLine` CRUD API
3. Auto-match: match statement lines to existing payments by amount/date/reference
4. Manual match: user links unmatched lines to payments or creates new journal entries
5. Reconciliation status tracking
6. Frontend: bank recon page with match/unmatch UI

### Phase 5: Multi-Currency
1. `Currency` + `ExchangeRate` models + CRUD
2. `amount_currency` + `currency` on `JournalEntryLine` (amounts in foreign currency)
3. Exchange rate lookup on entry posting (convert to base AED)
4. Realized/unrealized exchange gain/loss accounts
5. Multi-currency on invoices, payments, vendor bills
6. Currency selector in frontend forms

### Phase 6: Documents & Attachments
1. `AccountingAttachment` model: `id, org_id, entity_type (journal_entry|invoice|vendor_bill|payment|bank_statement), entity_id, document_id (FK documents), uploaded_by, created_at`
2. Reuse existing `Document` model/storage for file management
3. API: attach/detach/list attachments on any accounting entity
4. Upload receipt scans, bank slips, contracts to journal entries, invoices, payments
5. Invoice PDF generation — professional branded PDF (with company TRN, QR code placeholder)
6. **Payment Receipt PDF** — auto-generated when inbound payment is posted. Includes: receipt number, date, customer name, amount, payment method, linked invoice(s), company details/TRN
7. Statement of Account PDF — per-customer statement for a date range
8. Frontend: attachment panel on invoice detail, payment detail, JE detail pages; "Download Receipt" button on payment detail

### Phase 7: Reports + Frontend
1. **Accounting Overview** dashboard page (AR total, AP total, cash position, overdue invoices, wallet alerts)
2. **Customer Invoices** page (move existing, add journal entry link)
3. **Vendor Bills** page (new)
4. **Payments** page (new — list, create, reconcile)
5. **Client Wallets** page (move existing, add sub-wallet view)
6. **Bank Reconciliation** page (new)
7. **Journal Entries** page (new — list, create, view)
8. **Chart of Accounts** page (new — tree view, CRUD)
9. **Reports** page with:
   - **Profit & Loss** (date range, comparative)
   - **Balance Sheet** (as-of date)
   - Trial Balance
   - General Ledger
   - Aged Receivables / Aged Payables
   - VAT Return

### Phase 8: Retroactive Import Tool
1. API endpoint: `POST /api/accounting/import/journal-entries` — bulk import from CSV/JSON
2. Validation: balanced entries, valid accounts, valid periods
3. Can be used to backfill existing invoice/wallet history
4. Frontend: import wizard in Chart of Accounts or Journal Entries page

---

## Files Created / Modified

### New Backend Files
| File | Purpose |
|------|---------|
| `backend/models/accounting.py` | Account, Journal, JournalEntry, JournalEntryLine, Payment, PaymentInvoiceLink, VendorBill, VendorBillLine, Currency, ExchangeRate, PaymentTerm, PaymentTermLine, FiscalYear, FiscalPeriod, BankStatement, BankStatementLine, TaxRate |
| `backend/models/sub_wallet.py` | SubWallet model |
| `backend/schemas/accounting.py` | All Pydantic schemas for accounting |
| `backend/api/accounting.py` | All accounting API routes |
| `backend/services/accounting_engine.py` | JE creation, posting, validation, reversal, reconciliation |
| `backend/services/chart_of_accounts_seed.py` | UAE CoA seed + default journals/taxes |
| `backend/services/bank_recon.py` | Bank statement import + auto-match |
| `backend/services/invoice_pdf.py` | Invoice PDF + Statement of Account PDF generation |
| `backend/models/accounting_attachment.py` | AccountingAttachment model (polymorphic link to documents) |
| `backend/migrations/add_accounting_tables.py` | DB migration |

### Modified Backend Files
| File | Changes |
|------|---------|
| `backend/models/__init__.py` | Register all new models |
| `backend/models/org_settings.py` | Add `ACCOUNTING` to `ModuleId` |
| `backend/models/wallet.py` | Add relationship to SubWallet |
| `backend/api/orders.py` | Auto-create master wallet + sub-wallet on SO confirm |
| `backend/api/invoices.py` | Generate JEs on post/pay, payment term support |
| `backend/api/wallets.py` | Refactor to JE-driven balance, sub-wallet support |
| `backend/main.py` | Include accounting router |

### New Frontend Files
| File | Purpose |
|------|---------|
| `frontend/app/(dashboard)/dashboard/accounting/page.tsx` | Overview dashboard |
| `frontend/app/(dashboard)/dashboard/accounting/invoices/page.tsx` | Customer invoices (moved) |
| `frontend/app/(dashboard)/dashboard/accounting/vendor-bills/page.tsx` | Vendor bills |
| `frontend/app/(dashboard)/dashboard/accounting/payments/page.tsx` | Payments |
| `frontend/app/(dashboard)/dashboard/accounting/wallets/page.tsx` | Client wallets (moved) |
| `frontend/app/(dashboard)/dashboard/accounting/bank-recon/page.tsx` | Bank reconciliation |
| `frontend/app/(dashboard)/dashboard/accounting/journal-entries/page.tsx` | Journal entries |
| `frontend/app/(dashboard)/dashboard/accounting/chart-of-accounts/page.tsx` | CoA tree |
| `frontend/app/(dashboard)/dashboard/accounting/reports/page.tsx` | Financial reports |

### Modified Frontend Files
| File | Changes |
|------|---------|
| `frontend/app/(dashboard)/layout.tsx` | Replace Invoice + Wallet nav items with Accounting parent + sub-nav |

---

## UAE CoA Seed (Minimal but Sufficient)

```
1000  Assets
  1100  Current Assets
    1110  Cash
    1120  Bank Account
    1130  Accounts Receivable
    1140  Client Trust Funds (Wallets)
    1150  VAT Receivable (Input VAT)
    1160  Prepaid Expenses
  1200  Non-Current Assets
    1210  Fixed Assets
    1220  Accumulated Depreciation

2000  Liabilities
  2100  Current Liabilities
    2110  Accounts Payable
    2120  VAT Payable (Output VAT)
    2130  Client Trust Liability (Wallet Deposits)
    2140  Accrued Expenses
  2200  Non-Current Liabilities
    2210  Long-term Loans

3000  Equity
  3100  Owner's Equity / Capital
  3200  Retained Earnings

4000  Revenue
  4100  Service Revenue
  4200  Government Fee Revenue (pass-through)
  4300  Other Income
  4400  Exchange Gain

5000  Expenses
  5100  Cost of Services
  5200  Government Fees Paid (pass-through)
  5300  Salaries & Wages
  5400  Rent
  5500  Office Expenses
  5600  Depreciation
  5700  Exchange Loss
  5800  Other Expenses
```

---

## Journal Entry Examples

### Invoice Posted (Customer)
```
DR 1130 Accounts Receivable    1,050.00
    CR 4100 Service Revenue              1,000.00
    CR 2120 VAT Payable                     50.00
    (analytic: sub_wallet = SO-2026-001)
```

### Invoice Payment Received
```
DR 1120 Bank Account           1,050.00
    CR 1130 Accounts Receivable          1,050.00
    → reconcile AR lines
```

### Wallet Top-Up (Client deposits trust funds)
```
DR 1120 Bank Account           5,000.00
    CR 2130 Client Trust Liability       5,000.00
    (analytic: sub_wallet = SO-2026-001)
```

### Wallet Fee Charge (Service fee with VAT)
```
DR 2130 Client Trust Liability   525.00
    CR 4100 Service Revenue                500.00
    CR 2120 VAT Payable                     25.00
    (analytic: sub_wallet = SO-2026-001)
```

### Wallet Fee Charge (Government fee, no VAT)
```
DR 2130 Client Trust Liability   200.00
    CR 5200 Govt Fees Paid (pass-through)  200.00
    (analytic: sub_wallet = SO-2026-001)
Note: also DR 5200 / CR 1120 Bank when CSP actually pays the govt fee
```

### Vendor Bill Posted
```
DR 5100 Cost of Services         500.00
DR 1150 VAT Receivable            25.00
    CR 2110 Accounts Payable             525.00
```

---

## Future Roadmap (Post-MVP)

These features are **not** in the current implementation scope but are planned for future sprints:

| Feature | Description |
|---------|-------------|
| **Recurring Invoices** | Auto-generate invoices on schedule (monthly retainers, annual renewals). Recurrence rule on invoice template, cron-based generation. |
| **Budgets** | Per-account or per-department budget tracking with variance alerts. Budget vs actual comparison reports. |
| **Cost Centers / Departments** | Additional analytic dimension (like wallet tagging). Tag journal entry lines with `cost_center_id` to track P&L per department, per project, etc. |
| **UAE FTA Compliance** | Auto-generate VAT Return Form 201, ensure tax invoices meet FTA requirements (TRN, QR code, mandatory fields), withholding tax support. |
| **Post-dated Cheques (PDC)** | Track issued/received PDCs with maturity dates. Auto-generate journal entries on maturity. PDC register report. Very common in UAE business. |

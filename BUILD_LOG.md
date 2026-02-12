# UAE CSP-ERP — Build Log

Consolidated record of all architectural decisions, implementation plans, and technical specs from the development of the CSP-ERP platform. Organized into completed work, in-progress items, future work, and the long-term roadmap.

**Tech Stack**: FastAPI (Python 3.11) + Next.js 14 (React/TypeScript) + SQLAlchemy + SQLite (dev) / PostgreSQL (prod)
**Last Updated**: Feb 12, 2026

---

# Part A — Completed Work

## A1. MVP Foundation & Architecture

### Tech Stack Decision

**FastAPI chosen over Django, NestJS, Laravel** based on:
- Financial calculations: Python `Decimal` for exact money math (no JS floating-point issues)
- Rapid development: CRUD APIs in ~50 lines vs 100+ (Django) or 150+ (NestJS)
- Auto-generated OpenAPI docs at `/docs`
- Native async/await for concurrent operations
- Python ecosystem for future OCR/AI features (Tesseract, OpenAI)
- Performance: ~8,500 req/sec (more than sufficient for projected 500-2,000 req/hour)

### 6-Phase Roadmap

| Phase | Focus | Timeline |
|-------|-------|----------|
| **1 (MVP)** | Foundation + Financials + CRM + Sales | 5-6 months |
| **2** | Workflow Automation + PRO Mobile | 2-3 months |
| **3** | Advanced Financials + Bulk Operations | 2 months |
| **3.5** | Documents App | 2 months |
| **4** | HR, Payroll & Commission | 2-3 months |
| **5** | Client Self-Service Portal | 2 months |
| **6** | Compliance & Advanced Features | Ongoing |

### MVP Sprint Breakdown (16 Weeks)

| Sprint | Weeks | Focus | Key Deliverables |
|--------|-------|-------|-----------------|
| 1 | 1-2 | Foundation | Auth (JWT+bcrypt), multi-tenancy, RBAC, dashboard shell |
| 2 | 3-4 | Entities | Entity CRUD, document uploads, search/filter, jurisdictions |
| 3 | 5-6 | Wallet | Wallet ledger, transactions, double-entry accounting, audit trail |
| 4 | 7-8 | Projects | Project/task management, wallet-project linking |
| 5 | 9-10 | Financials | VAT toggle, Red Alert warning gate, financial reports, PDF export |
| 6 | 11-12 | Alerts | Expiry alerts (T-90/60/30/7), notification system, APScheduler cron |
| 7 | 13-14 | Dashboard | Main dashboard, PRO mobile view, Excel/PDF exports |
| 8 | 15-16 | Polish | Testing, deployment, pilot preparation |

### Database Schema (Core Tables)

```
organizations, users (multi-tenant with org_id isolation)
contacts (unified — replaced entities)
client_wallets, wallet_transactions (double-entry with balance_after)
projects, tasks, task_assignees, task_comments
leads, contacts (CRM), opportunities
quotations, quotation_lines
sales_orders, sales_order_lines
invoices, invoice_lines
documents, document_categories
ownership_links (compliance graph)
compliance_snapshots, compliance_risk
activities (calendar events)
products, product_task_templates, product_document_requirements
saved_searches
notifications
approval_requests, approval_rules
commission_attributes
org_settings, org_module_settings
audit_logs
```

### API Architecture

```
backend/
├── main.py              # FastAPI app, 20 routers
├── core/
│   ├── config.py        # Settings from env vars
│   ├── security.py      # JWT + bcrypt
│   ├── database.py      # SQLAlchemy engine/session
│   └── deps.py          # Auth + RBAC dependencies
├── models/              # 26 SQLAlchemy models
├── schemas/             # 16 Pydantic schema sets
├── api/                 # 20 route files
├── services/            # Business logic (audit, compliance, workflow, etc.)
├── tasks/               # Background scheduler (APScheduler)
├── migrations/          # Manual migration scripts
├── scripts/             # seed_demo.py, seed_showcase.py
└── constants/           # document_types.py
```

### Frontend Architecture

```
frontend/
├── app/
│   ├── layout.tsx           # Root layout + Providers
│   ├── page.tsx             # Auth redirect
│   ├── login/, register/    # Auth pages
│   └── (dashboard)/
│       ├── layout.tsx       # Sidebar nav, module permissions
│       └── dashboard/
│           ├── page.tsx             # Dashboard home
│           ├── contacts/            # List + [id] detail + new
│           ├── projects/            # List + [id] detail + new + tasks
│           ├── wallets/             # List + [id] + top-up + alerts + new
│           ├── crm/                 # Pipeline Kanban + leads
│           ├── quotations/          # List + [id] detail
│           ├── orders/              # List + [id] detail
│           ├── invoices/            # List + [id] detail
│           ├── products/            # List + [id] detail + new
│           ├── documents/           # List + upload
│           ├── compliance/          # Dashboard + map
│           ├── calendar/            # Month/week/day views
│           ├── tasks/               # My Tasks (Spreadsheet/Timeline/Kanban)
│           ├── users/               # User management
│           └── settings/            # System, defaults, access, modules, approvals, technical
├── components/
│   ├── ui/                  # 26 shared components
│   ├── DocumentViewer.tsx
│   ├── Providers.tsx
│   └── Toast.tsx
└── lib/
    ├── api.ts               # API client with JWT + error handling
    ├── auth.ts              # Login/register/logout utilities
    └── format.ts            # fmtCurrency, fmtDate, fmtNumber, fmtPercent
```

### Deployment Configuration

- **Docker Compose**: PostgreSQL + backend + frontend services
- **Dockerfile.backend**: Python 3.11-slim, uvicorn
- **Dockerfile.frontend**: Multi-stage Node.js build
- **Local dev**: `start`/`stop` bash scripts (auto-venv, auto-npm, health checks)
- **PowerShell**: `scripts/run.ps1` for Windows dev

### Key MVP Decisions

- **No bulk import** in MVP — manually enter first 10-20 clients
- **No native mobile app** — web-responsive for PROs on tablets/phones
- **SQLite for dev**, PostgreSQL for production
- **APScheduler** instead of Celery (simpler for MVP)
- **Local file storage** instead of R2 (deferred to Documents App phase)
- **Entities renamed to Contacts** — unified contact model for companies + individuals

---

## A2. Workflow & Products

### Invoice Source Chain

Full traceability: **Lead → Opportunity → Quotation → Sales Order → Invoice**

- `Quotation`: added `opportunity_id` (FK)
- `SalesOrder`: added `lead_id`, `opportunity_id` (FK); keeps `quotation_id`
- `Invoice`: added `lead_id`, `opportunity_id` (FK); keeps `sales_order_id`
- Chain is **not enforced** — invoices can be created at any point (with or without SO)
- When creating from upstream, source IDs propagate automatically

### Product Model

```
Product: id, org_id, name, description, default_unit_price, is_active, creates_project
ProductTaskTemplate: id, org_id, product_id, task_name, sort_order, subtask_names (JSON)
ProductDocumentRequirement: id, org_id, product_id (per-product required doc checklist)
```

- Products optionally linked to quotation/order/invoice lines via `product_id` (nullable FK)
- When `creates_project = True`, must have ≥1 task template

### Sales Order Confirm Flow

`POST /api/orders/{order_id}/confirm`:
1. Load SO with lines + products
2. Create Invoice from SO (copy contact, lines, source IDs)
3. If any line's product has `creates_project=True` → create one Project
4. Create tasks from product task templates (deduplicate by task name, merge subtask names across products)
5. Set SO status to confirmed; one invoice per SO via Confirm

### Task Creation Algorithm

1. Collect products with `creates_project=True` from invoice lines
2. Load all `ProductTaskTemplate` rows for those products
3. Build unique task names → merge subtask names (union, deduplicate)
4. Create parent Task per unique name, child Tasks for subtasks (`parent_id` FK)
5. Order by `sort_order`

---

## A3. Contact Relationship Model

### Unified Link Table

Single `ownership_links` table with direction: `owner_contact_id → owned_contact_id` (subject → object).

| Link Type | Subject | Object | Used in UBO? |
|-----------|---------|--------|-------------|
| **ownership** | Individual or Company | Company | Yes — percentage, voting_pct, is_nominee, shareholding |
| **control** | Individual or Company | Company | Yes — voting control |
| **director** | Individual | Company | Yes — role_label (e.g. "Managing Director") |
| **manages** | Individual | Company | Yes — senior management fallback |
| **employee** | Individual | Company | No — role_label (e.g. "Accountant", "PRO") |
| **family** | Individual | Individual | No — relationship_kind (father, mother, spouse, child, sibling, dependent, other) |

### Extended Fields

- `role_label` (string, nullable): free text for director/manages/employee
- `relationship_kind` (string, nullable): family link type
- `number_of_shares`, `share_class`, `nominal_value_per_share`, `share_currency`: shareholding details for ownership links
- Existing: `percentage`, `voting_pct`, `is_nominee`, `start_date`, `end_date`

### Bidirectional Visibility

- **Outgoing** (where I am connected): `owner_contact_id = this_contact`
- **Incoming** (who is connected to me): `owned_contact_id = this_contact`
- One row per relationship; no duplicate "reverse" row
- Family links use **inverse labels** (e.g. stored as "A is father of C" → C's profile shows "Father: A")

### Profile Display

Two sections per contact:
1. "Where [name] is connected" — outgoing links grouped by company/individual
2. "Who is connected to [name]" — incoming links with inverse labels for family

Future link types: `authorized_signatory`, `legal_rep`, `guarantor`

---

## A4. Contacts Compliance Links CRUD

### Frontend Implementation (contact detail page)

Full add/edit/delete for compliance links directly on the contact profile's Connections card.

**Add Link Flow**:
1. Click "Add connection" → form opens
2. Choose direction (this contact is owner vs. owned)
3. Select other contact (searchable picker, filtered by contact type)
4. Select link type → type-specific fields appear
5. Submit → `POST /api/compliance/ownership-links`
6. Refetch contact-links to update display

**Edit**: Pre-fill form from `GET /api/compliance/ownership-links/{id}`, submit via `PATCH`
**Delete**: Confirm dialog → `DELETE /api/compliance/ownership-links/{id}`

No backend changes needed — all endpoints already existed.

---

## A5. Calendar & Activities Module

### Activity Model

```
Activity:
  id, org_id, project_id (FK), contact_id (FK, nullable)
  title, description
  activity_type: call | meeting | follow_up | visit | other
  assigned_to (FK users), created_by (FK users)
  start_datetime, end_datetime, location
  status: pending | completed | overdue
  reminder: none | 15min | 30min | 1hr | 1day
  recurrence: none | daily | weekly | monthly
  completion_notes (Text, nullable), completed_at
  created_at, updated_at
```

### Module Registration

- `CALENDAR = "calendar"` added to `ModuleId` enum
- Registered in `MODULE_LABELS`, sidebar nav, org module settings seed

### API Endpoints

- `GET /api/activities/` — all org activities (filterable: start_date, end_date, assigned_to, project_id, status)
- `GET /api/activities/today` — current user's today activities
- `GET /api/projects/{project_id}/activities` — project-scoped
- `POST /api/projects/{project_id}/activities` — create in project
- `PATCH /api/activities/{id}` — update (including mark complete with notes)
- `DELETE /api/activities/{id}`
- Notifications sent on create/assign; recurring activities auto-create next occurrence on completion

### Frontend

- **Calendar page**: month/week/day toggle views, custom CSS grid, color-coded by assignee
- **TasksTab**: "Scheduled Activities" section below tasks
- **Dashboard widget**: Today's Activities card

---

## A6. Document Types

### Canonical System Types

Defined in `backend/constants/document_types.py`:

| Slug | Display Name | Typical Link |
|------|-------------|-------------|
| trade_license | Trade License | Entity / Contact |
| moa | MOA (Memorandum of Association) | Entity |
| passport | Passport | Contact |
| visa | Visa copy | Contact / Employee |
| contract | Contract | Contact / Task / Project |
| receipt | Receipt | Contact / Project |
| other | Other | Any |

### Architecture

- `SYSTEM_DOCUMENT_CATEGORIES` constant in code (single source of truth)
- `DocumentCategory` model for org-specific custom categories
- API validates category against system slugs + org custom slugs
- Frontend dropdowns driven by API (no hardcoded lists)

---

## A7. SearchFilterBar & Saved Searches

### SavedSearch Model

```
saved_searches:
  id, user_id (FK), org_id (FK)
  name (VARCHAR 100), page (VARCHAR 50 — pageKey)
  criteria (JSON — { search, filters, groupBy })
  is_default (BOOLEAN), is_shared (BOOLEAN)
  sort_order, created_at, updated_at
  UNIQUE(user_id, page, name)
```

- `is_shared=True` → visible to all org users (read-only); only creator can edit/delete

### API: `/api/saved-searches`

- `GET /?page={pageKey}` — own + org-shared (includes `is_owned`, `created_by_name`)
- `POST /` — create
- `PATCH /{id}` — update (owner only)
- `DELETE /{id}` — delete (owner only)

### SearchFilterBar Component

Deployed on 13 list pages with per-page filter configs:

| Page | Filters | Group Options | Views |
|------|---------|---------------|-------|
| My Tasks | status, priority, category, due_date, project | status, priority, category, project, due_date | spreadsheet, kanban, timeline |
| Contacts | status, contact_type, jurisdiction | status, contact_type, jurisdiction | table, card |
| CRM | stage, source, assigned_to | stage, source, assigned_to | table, kanban |
| Projects | status, owner, contact | status, owner | table, card |
| Quotations | status, contact | status | table, card |
| Orders | status, contact | status | table, card |
| Invoices | status, contact, due_date | status | table, card |
| Products | is_active, creates_project | — | table, card |
| Documents | category, status, folder | category, folder | table, card |
| Wallets | status, below_threshold | status | table, card |
| Calendar | activity_type, assigned_to, status | — | (existing) |
| Compliance | issues_only | — | table |
| Users | role, is_active | role | table |

---

## A8. Task System Redesign

### Screens Built

| Screen | File | Status |
|--------|------|--------|
| Dashboard overview | `dashboard/page.tsx` | Polished |
| My Task page | `dashboard/tasks/page.tsx` | Created (Spreadsheet/Timeline/Kanban) |
| TasksTab multi-view | `projects/[id]/components/TasksTab.tsx` | Rewritten |
| Task detail page | `projects/[id]/tasks/[taskId]/page.tsx` | Rewritten |
| Task modals | `components/ui/TaskModal.tsx` | Created |

### Backend Additions

- `GET /api/tasks/my` — all tasks assigned to current user across projects
- `DELETE /tasks/{task_id}/comments/{comment_id}` — delete own comment

### Shared UI Components Created

`Pill`, `AvatarChip`, `AvatarStack`, `FormField`, `Toggle`, `TaskCard`, `PageViewToggle` (with `TASK_VIEWS` preset), `TaskModal`, `ProgressBar`, `KanbanBoard`

### CSS Additions

`.modal-backdrop`, `.modal-dialog`, `.kanban-board`, `.kanban-column`, `.kanban-card`, grid utilities

### Future Phases (designed but deferred)

- Phase 7: File attachments on tasks & comments
- Phase 8: Drag-and-drop Kanban (`@hello-pangea/dnd` — already installed)
- Phase 9: Comment threading & reactions
- Phase 10: Timeline with Gantt dependencies
- Phase 11: Dark mode (CSS variables defined)
- Phase 12: Favourites / Pinned projects in sidebar

---

## A9. Unified Design Standard

### Brand Identity

- **Inspiration**: Linear, Vercel, Notion, Stripe
- **Tone**: Professional, minimal, data-rich. Medium-high information density.
- **Palette**: Neutral-first (black/white/grey) with color only for semantic meaning

### Color Usage Rules

| Color | Token | Used For |
|-------|-------|----------|
| Black `#171717` | `--brand-primary` | Primary CTAs, active tabs, page titles |
| Blue `#0066ff` | `--accent-blue` | Links, interactive elements, info badges, company avatars |
| Purple `#8b5cf6` | `--accent-purple` | Individual/person avatars, secondary chart accent |
| Teal `#0d9488` | `--accent-teal` | Order/transaction accent, financial positive |
| Green `#22c55e` | `--success` | Completed/paid/active/verified states |
| Amber `#f59e0b` | `--warning` | Pending approval, expiring soon, sent status |
| Red `#ef4444` | `--danger` | Errors, cancelled/rejected/expired, destructive actions |

### Page Types

| Type | Examples | Structure |
|------|----------|-----------|
| Dashboard | `/dashboard` | Greeting + stat grid + quick actions + activity feed |
| List page | Contacts, Orders, etc. | Header + filter bar + data table + pagination/empty state |
| Detail (Layout A) | Projects, Orders, Invoices | Breadcrumb → header → summary card → tab bar → tab content |
| Detail (Layout B) | Contacts | Breadcrumb → two-column: sticky sidebar + tab bar + tab content |
| Kanban/Board | CRM Pipeline | Header + tab bar + horizontal scrolling columns |
| Settings | Settings pages | Header + vertical sidebar nav + content area |

### Component Specs

All compound components standardized:
- **Tab Bar**: Underline tabs (replaced pill tabs, button-toggle tabs, teal underline tabs)
- **Breadcrumb**: Context-aware with record navigator (Prev / 3 of 12 / Next)
- **Status Stepper**: Linear steps with terminal state support (cancelled, rejected, expired)
- **Meta Row**: Two variants — sidebar info row (icon box + label/value) and detail card meta
- **Slide-Over Panel**: 560px width, `var(--bg-overlay)` backdrop, optional sticky footer
- **Dropdown Menu**: Portal-based, 200px min-width, danger variant for destructive actions

### Avatar Standard

| Entity Type | Background | Text Color | Default Size |
|-------------|-----------|------------|-------------|
| Company | `--accent-blue-light` | `--accent-blue` | 64px |
| Individual | `--accent-purple-light` | `--accent-purple` | 64px |
| User/Owner | `--accent-blue-light` | `--accent-blue` | 28px |

---

## A10. Unified Design Implementation

### Shared Components Created (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Icon.tsx` | SVG icon wrapper (path + size) |
| `TabBar.tsx` | Underline tab navigation with optional counts |
| `Breadcrumb.tsx` | Context-aware breadcrumbs |
| `StatusStepper.tsx` | Linear workflow step indicator |
| `MetaRow.tsx` | Key-value info display (sidebar + detail variants) |
| `PageShell.tsx` | Loading/not-found/entity wrapper |
| `SlideOverPanel.tsx` | Right-side panel (560px) |
| `CollapsibleSection.tsx` | Expandable section with title |
| `DropdownMenu.tsx` | Portal-based dropdown |
| `FormField.tsx` | Label + input + hint wrapper |
| `Pill.tsx` | Status/priority colored badge |
| `AvatarChip.tsx` | User initial circle + name |
| `AvatarStack.tsx` | Overlapping avatar group |
| `Toggle.tsx` | Toggle switch with label |
| `TaskCard.tsx` | Kanban task card |
| `TaskModal.tsx` | Centered modal for task CRUD |
| `ProgressBar.tsx` | Thin colored progress bar |
| `KanbanBoard.tsx` | Drag-and-drop Kanban columns |
| `KanbanView.tsx` | Generic Kanban for any entity |
| `TimelineView.tsx` | Gantt-style date-range bars |
| `SpreadsheetView.tsx` | Status-grouped table sections |
| `PageViewShell.tsx` | 3-view orchestrator |
| `PageViewToggle.tsx` | Spreadsheet/Timeline/Kanban toggle |
| `SearchFilterBar.tsx` | Search + filter + group + saved presets |
| `ThemeToggle.tsx` | Dark mode toggle |
| `statusColors.ts` | Unified `STATUS_CONFIG` map |

### Utilities (`lib/format.ts`)

- `fmtCurrency(value, currency)` — `toLocaleString("en-AE")` + AED
- `fmtNumber(value, decimals)` — number formatting
- `fmtDate(value)` — `12 Feb 2026` format
- `fmtDateRelative(value)` — "3 days ago" / "in 45 days"
- `fmtPercent(value)` — `75%` or `12.5%`

### Rollout

- Phase 1: Foundation (shared code, zero page changes)
- Phase 2: Detail pages (Orders, Invoices, Quotations, Contacts, Projects, Products, Wallets, Tasks)
- Phase 3: List pages (11 pages — Icon swap + formatting)
- Phase 4: Specialized pages (CRM, Dashboard, Calendar, Compliance map)
- Phase 5: Form/create pages + Settings (6 form pages + 7 settings pages)

Per-file checklist applied: shared Icon, statusColors, fmtCurrency/fmtDate, TabBar, Breadcrumb, PageShell, SlideOverPanel, ARIA labels, CSS variables only.

---

## A11. Unified Views

### Generic View Components

| Component | File | Purpose |
|-----------|------|---------|
| `SpreadsheetView` | `SpreadsheetView.tsx` | Status-grouped table with Pill headers, hover rows, configurable columns |
| `KanbanView` | `KanbanView.tsx` | Generic Kanban for any entity (not just tasks), optional drag-and-drop |
| `TimelineView` | `TimelineView.tsx` | Gantt-style date-range bars with day grid |
| `PageViewShell` | `PageViewShell.tsx` | Orchestrates 3 views + PageViewToggle |

### Target Pages

| Page | Spreadsheet | Kanban | Timeline |
|------|------------|--------|----------|
| Tasks | ✅ grouped table | ✅ status columns | ✅ date-based Gantt |
| Orders | grouped table | status columns | date-based Gantt |
| Invoices | grouped table | status columns | due_date Gantt |
| Quotations | grouped table | status columns | valid_until Gantt |
| Projects | grouped table | status columns | due_date Gantt |
| Contacts | grouped table | status/type columns | license_expiry Gantt |
| Products | grouped table | active/inactive | N/A (card instead) |
| CRM | grouped table | stage columns | expected_close Gantt |
| Documents | grouped table | status/category | created_at timeline |

---

# Part B — In Progress

## B1. View Toggle Rollout

**Done**: `PageViewToggle` component exists. Tasks page uses all 3 views (Spreadsheet/Timeline/Kanban). `SearchFilterBar` deployed on 13 pages.

**Remaining**:
- Verify all list pages actually render the toggle (Calendar, CRM, Documents, Users, Compliance may still be table-only with hidden toggle)
- Confirm "Spreadsheet" naming used consistently vs. old "Table" naming
- Delete old `ViewToggle.tsx` if still present
- Upgrade status-based pages (Orders, Invoices, Quotations, Projects) to full Spreadsheet/Kanban/Timeline

## B2. Documents App

**Done**: Unified `Document` model with polymorphic links (contact_id, task_id). CRUD API. Upload page. Documents list with filters. `DocumentViewer.tsx` for in-browser PDF/image preview. Local file storage in `backend/uploads/`.

**Remaining**:
- **R2 cloud storage**: Migrate from local uploads to Cloudflare R2 with presigned URLs
- **Archive tier**: Implement `status: active → archived` flow, `archived_at`, restore, purge (hard delete from storage + DB)
- **Retention policy**: `retention_until` field exists but no cron job to flag expired documents
- **Virus scanning**: ClamAV or Cloudflare malware scanning on upload

---

# Part C — Future Work

## C1. Compliance & UBO Module

### Scope (UAE Cabinet Decision 109/2023)

- **UBO definition**: Natural person who ultimately owns or controls ≥25% of shares/voting rights, or exercises control by other means
- **Fallback**: If no person meets threshold, the person in charge of senior management
- **Register**: Register of Beneficial Owners required; updates within 15 days of any change

### Architecture

- **PostgreSQL-only** (Neo4j deferred): `ownership_links` table + recursive CTEs for UBO traversal
- **React Flow canvas**: Drag-and-drop node editor for ownership/control structures
- **Resolver**: Recursive effective ownership calculation (path product, cross-path aggregation, 25% + control threshold)
- **Risk scoring**: Nationality + industry + structure complexity → 0-100 score → Red/Amber/Green bands

### Components to Build

| Component | Description |
|-----------|-------------|
| **Visual Ownership Mapper** | React Flow canvas with person/company nodes, ownership % edges |
| **UBO Resolver Engine** | Recursive traversal, effective % calculation, fallback to senior management |
| **Register Generation** | PDF/Excel for DED/MoE/Free Zone formats (Register of UBOs, Partners, Directors) |
| **AML/KYC Integration** | Risk scoring, document linking, KYC status derived from required docs |
| **Compliance Dashboard** | Entity health view: missing UBO, expired KYC, high-risk flags |
| **Compliance Snapshots** | Versioned register exports stored in R2 with audit trail |

### Validation Rules

1. Total ownership of entity ≠ 100% → amber warning
2. Corporate shareholder with no declared UBOs → "dead end" warning
3. Cycle detection → error/warning
4. All surfaced in dashboard and on canvas

### Current State

- `OwnershipLink` model exists with full schema (ownership, control, director, manages, employee, family)
- CRUD API exists (`/api/compliance/ownership-links`)
- `compliance/page.tsx` and `compliance/map/page.tsx` exist
- `services/ubo_resolver.py`, `risk_scoring.py`, `register_generator.py`, `kyc_status.py` exist
- **Remaining**: Polish React Flow editing, register PDF quality, advanced risk scoring rules

### Sprint Plan (6-8 weeks)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Data model & graph | CRUD API, list graph for entity |
| 2 | UBO logic & risk | Recursive resolver, risk scoring, UBO list API |
| 3 | Canvas & basic UI | React Flow: load/edit graph, node side panel |
| 4 | Validation & dashboard | Ownership sum checks, dead-end detection, compliance dashboard |
| 5 | Registers & export | PDF/Excel templates, snapshot storage |
| 6 | Polish & UAE alignment | Nominee/control flags, DED/MoE template alignment |
| 7-8 | Buffer | Performance, role-based access, email reminders |

---

## C2. Sales Order SOV Breakdown Tab

### Concept

New "SOV Breakdown" tab on sales order detail page. One row per SO line. User inputs unit cost and commission attribute; system calculates revenue, planned expenses, profit, tax, and net achievement.

### Column Spec

| Column | Source | Editable? |
|--------|--------|-----------|
| Description | SO line | Read-only |
| Qty | SO line | Read-only |
| Unit Price | SO line (may reflect line-level discount) | Read-only |
| Unit Cost | User input | Yes |
| Line Subtotal | = Qty × Unit Price | Computed |
| Discount | Allocated order-level discount | Computed |
| Revenue | = Line Subtotal − Discount | Computed |
| Planned Expenses | = Qty × Unit Cost | Computed |
| Profit | = Revenue − Planned Expenses | Computed |
| Tax | From line VAT rate | Computed |
| Net Achievement | = Profit − Tax | Computed |
| Commission Attri | Dropdown | Yes |

### Discount Handling

- **Line-level** (Option C): Unit price already net of discount → used as-is
- **Order-level** (Option D): `order_discount_amount` or `order_discount_percent` on SalesOrder
- Allocation: `line_allocated_discount = total_order_discount × (line_subtotal / order_subtotal)`
- Revenue = line_subtotal − allocated discount

### Backend (partially exists)

- `SalesOrder`: `order_discount_amount`, `order_discount_percent` ✅ (already added)
- `SalesOrderLine`: needs `unit_cost` (Numeric, default 0), `commission_attrib` (String, nullable)
- `CommissionAttribute` model exists for dropdown options
- Migration needed for `unit_cost`, `commission_attrib` on `sales_order_lines`

### Frontend

- Order detail page: add SOV Breakdown tab alongside Line Items
- Table with editable cells (unit cost, commission attrib)
- Totals row at bottom
- PATCH order with line-level updates

---

# Part D — Long-Term Roadmap

## Phase 2: Workflow Automation + PRO Mobile (2-3 months)

- **Workflow Template Builder**: Visual designer for reusable workflows (stages → tasks with dependencies)
- **Pre-built templates**: Company formation, visa processing, license renewal, Golden Visa, Ejari
- **PRO Mobile App** (Flutter): Task list, GPS capture, receipt photo + OCR, offline queue
- **Government Fee Reconciliation**: OCR amount extraction, mismatch flagging, manager approval

## Phase 3: Advanced Financials + Bulk Operations (2 months)

- **Bulk Receipt Splitter**: One PRO payment → split across multiple client wallets
- **Payment Gateway**: PayTabs/Telr/Stripe integration for client self-top-up
- **Advanced VAT Reporting**: Monthly summary for FTA filing, credit notes, refunds

## Phase 3.5: Documents App Enhancements (2 months)

- **R2 Cloud Storage**: Presigned URLs, virus scanning
- **Archive/Retention**: Status lifecycle, retention cron job, purge with audit
- **Filing Taxonomy**: Folders, tags, bulk operations (tag, move, archive)

## Phase 4: HR, Payroll & Commission (2-3 months)

- **Employee Management**: Profiles, contracts, document vault, expiry tracking
- **Hybrid Payroll**: Basic salary + allowances + commissions − deductions
- **WPS Compliance**: Generate .SIF file for bank upload
- **Gratuity Calculator**: UAE Labor Law formula (21 days/year < 5 years, 30 days/year ≥ 5 years)

## Phase 5: Client Self-Service Portal (2 months)

- **Client Dashboard**: Read-only entity details, project status, wallet balance, expiry alerts
- **Service Store**: Shopify-style service catalog with intake forms
- **Client-Initiated Top-Ups**: Payment gateway integration

## Phase 6: Compliance & Government APIs (Ongoing)

- **UBO Module**: Full compliance suite (see Part C)
- **Auto-Generated Registers**: PDF per UAE Ministry of Economy template
- **Government API Integrations**: MOHRE (work permits), DED (trade licenses), GDRFA (visas), Ejari

---

# Appendix: UAE Glossary

| Term | Definition |
|------|-----------|
| **CSP** | Corporate Service Provider (company formation/PRO services) |
| **PRO** | Public Relations Officer (licensed government liaison) |
| **DED** | Dubai Economy (Mainland licensing authority) |
| **DMCC** | Dubai Multi Commodities Centre (Free Zone) |
| **ADGM** | Abu Dhabi Global Market (Financial Free Zone) |
| **DIFC** | Dubai International Financial Centre (Financial Free Zone) |
| **UBO** | Ultimate Beneficial Owner (≥25% ownership) |
| **GDRFA** | General Directorate of Residency and Foreigners Affairs (Immigration) |
| **WPS** | Wage Protection System (mandatory salary bank transfer) |
| **Ejari** | Dubai tenancy contract registration system |
| **Golden Visa** | 5-10 year UAE residency visa (no sponsor required) |
| **MOA** | Memorandum of Association (company charter) |
| **Establishment Card** | Physical card for company (like a company ID) |

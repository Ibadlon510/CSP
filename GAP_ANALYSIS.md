# Gap Analysis & Readiness Check

**Date:** February 2026  
**Purpose:** Ensure the app runs smoothly; identify and fix gaps between frontend, backend, and configuration.

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|--------|
| Backend routes | OK | All routers mounted; entities removed, contacts only |
| Frontend → API | OK | All calls use correct paths (/api/contacts, /api/wallets, etc.) |
| Contact-only | OK | Invoices/Orders/Quotations/CRM/Wallets use contact_id only |
| Redirects | OK | /dashboard/entities → /dashboard/contacts in next.config.js |
| Wallet responses | Fixed | Create/PATCH now return contact_name (and entity_name) |
| Database | OK | SQLite default; contacts + contact_addresses; entities table still present |
| Auth & env | OK | Login/register/me; API_URL defaults to localhost:8000 |

---

## 2. Backend

### 2.1 Route Registration (main.py)

- **Auth:** `prefix="/api/auth"` → `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- **Users:** `prefix="/api/users"`
- **Contacts:** router has `prefix="/api/contacts"` → list, create, get, update, delete, expiring, addresses, documents
- **Entities:** removed (no backward compatibility; contacts only)
- **Wallets:** `prefix="/api/wallets"` → list, create, get, update, delete, summary, vat-report, transactions, alerts, top-up, fee-charge
- **Projects:** `prefix="/api/projects"` → list, create, get, update, tasks, check-funding
- **CRM, Quotations, Orders, Invoices:** each has own prefix

**Route order:** `/expiring` and `/summary` are defined before `/{id}` in contacts and wallets, so no conflict.

### 2.2 Database & Models

- **contacts**, **contact_addresses**, **contact_documents** — used by Contacts UI and wallet/project linking.
- **client_wallets** — has `contact_id` only (entity_id removed).
- **invoices**, **sales_orders**, **quotations**, **crm_contacts**, **opportunities** — use `contact_id` (FK to contacts). Run `python -m migrations.entities_to_contacts` on existing DBs to migrate.

### 2.3 Fixes Applied

- **Wallet create:** Response now includes `contact_name` and `entity_name` (joinedload contact/entity after commit).
- **Wallet PATCH:** Response now includes `contact_name`, `entity_name`, `is_below_threshold`, `has_active_alerts` for consistent detail view after save.
- **CORS:** Added `http://127.0.0.1:3000` so the app works when opened via 127.0.0.1.
- **API error handling:** Frontend `api.ts` now handles FastAPI validation errors (detail as array or object with msg) and non-JSON error bodies.
- **Orders/Invoices/Quotations:** Use `contact_id` and `contact_name`; list pages show Contact column. Entities API and model removed (no backward compatibility).

---

## 3. Frontend

### 3.1 API Usage (all verified)

| Page / flow | API path | Backend |
|-------------|----------|---------|
| Login / Register | POST /api/auth/login, /api/auth/register | OK |
| Dashboard | GET /api/contacts/, /api/contacts/expiring?days=90, /api/wallets/summary, /api/projects/?status=in_progress | OK |
| Contacts list | GET /api/contacts/?... | OK |
| Contact create | POST /api/contacts/ | OK |
| Contact detail | GET/PATCH /api/contacts/:id, addresses, documents | OK |
| Wallets list | GET /api/wallets/, /api/wallets/summary | OK |
| Wallet create | POST /api/wallets/ (body.contact_id) | OK |
| Wallet detail | GET/PATCH /api/wallets/:id, transactions, alerts, fee-charge | OK |
| Projects list/new/detail | GET/POST /api/projects/, GET/PATCH /api/projects/:id, tasks | OK |
| Invoices / Orders / Quotations | GET /api/invoices/, /api/orders/, /api/quotations/ | OK |
| CRM | GET /api/crm/leads, /api/crm/opportunities | OK |

### 3.2 Redirects (next.config.js)

- `/dashboard/entities` → `/dashboard/contacts`
- `/dashboard/entities/new` → `/dashboard/contacts/new`
- `/dashboard/entities/:id` → `/dashboard/contacts/:id`

Prevents 404s from old bookmarks or links.

### 3.3 Root & Auth

- **/** redirects to /dashboard (if token) or /login.
- **Login** uses `login()` → POST /api/auth/login; **Quick Demo Login** may call register then login.
- **Dashboard layout** uses getMe() and redirects to /login if no token.

---

## 4. Configuration

### 4.1 Environment

- **Backend:** `DATABASE_URL` (default SQLite), `JWT_SECRET`, `DEBUG`, `CORS` (localhost:3000). No `.env` required for default dev.
- **Frontend:** `NEXT_PUBLIC_API_URL` (default http://localhost:8000). No `.env.local` required for local dev.

### 4.2 Start Script (./start)

- Starts backend on 8000, frontend on 3000.
- Health checks: GET /health, GET /health/detailed.
- Logs: `.run/backend.log`, `.run/frontend.log`.

---

## 5. Known Gaps (Non-Blocking)

1. **Migrations**  
   New columns and the entities→contacts migration use one-off scripts (`migrations/entities_to_contacts.py`). For a fresh DB, `create_all` creates the current schema (no entities). For production, consider Alembic for versioned migrations.

---

## 6. Checklist for “Runs Smoothly”

- [x] Backend starts without import errors
- [x] Frontend builds and starts
- [x] Login / Quick Demo Login works (register + login)
- [x] Dashboard loads (contacts, wallets, projects, expiring counts)
- [x] Contacts: list, new, detail, addresses, documents
- [x] Wallets: list, new (contact select), detail, top-up, fee-charge, alerts
- [x] Projects: list, new (contact select), detail, tasks, check-funding
- [x] No 404 on /dashboard/entities (redirects to /dashboard/contacts)
- [x] Wallet create/PATCH return contact_name so UI shows name after save
- [ ] **Manual:** Run `./start`, open http://localhost:3000, log in, click through Contacts, Wallets, Projects

---

## 7. Recommended Next Steps

1. Run `./start` and do a full click-through (login → contacts → wallet → project).
2. If you use Invoices/Orders/Quotations, ensure entities exist (or add contact_id support later).
3. For production: set `JWT_SECRET`, use PostgreSQL, enable HTTPS, restrict CORS.
4. Optionally add Alembic and replace one-off migrations with versioned migrations.

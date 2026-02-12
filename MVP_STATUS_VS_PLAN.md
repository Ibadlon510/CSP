# MVP Status vs Plan

Reference: `.cursor/plans/uae_csp-erp_mvp_plan_8b509f45.plan.md`

## Summary

| Sprint | Plan focus | Status | Notes |
|--------|------------|--------|--------|
| **1** | Foundation (auth, RBAC, multi-tenant, dashboard) | ✅ **Done** | JWT, roles, org isolation, dashboard shell |
| **2** | Contact Management (CRUD, documents, search/filter) | ✅ **Done** | Contacts (company/individual); addresses; local file storage; search/filter/expiring |
| **3** | Wallet (ledger, top-up, debit, Red Alert) | ✅ **Done** | Top-up, transactions, low-balance Red Alert |
| **4** | Projects & Tasks (link to wallet) | ✅ **Done** | Project/task CRUD; **missing**: estimated govt fee, link debit to project |
| **5** | VAT, Red Alert gate, reports | ⏳ **Partial** | Red Alert (low balance) done; **missing**: VAT fields, assignment gate, VAT report, PDF statement |
| **6** | Expiry alerts, Celery, email | ⏳ **Partial** | Expiry dates + dashboard widget done; **missing**: Celery cron, email notifications |
| **7** | Dashboard, exports, PRO view, profile | ⏳ **Partial** | Dashboard done; **missing**: Excel export, PRO “My Tasks”, user profile |
| **8** | Testing, deployment, pilot prep | ⏳ **Partial** | Docker/docs done; **missing**: Pytest, E2E, performance hardening |

**Conclusion:** Core MVP (Sprints 1–4) is **complete**. Sprints 5–8 from the plan are **partially** done; remaining work is listed below.

---

## Sprint 1: Foundation — ✅ Complete

| Deliverable | Done |
|-------------|------|
| Repo + FastAPI + Next.js structure | ✅ |
| PostgreSQL (prod) / SQLite (dev) | ✅ (SQLite dev; Postgres in docker-compose) |
| Redis | ❌ (not used yet; Celery in Sprint 6) |
| JWT auth (register, login, logout) | ✅ |
| Password hashing (bcrypt) | ✅ |
| RBAC (Super Admin, Admin, Manager, PRO, Accountant, Client) | ✅ |
| Multi-tenant organization | ✅ |
| Dashboard shell + navigation | ✅ |
| Alembic migrations | ❌ (using create_all in dev) |
| CI/CD (GitHub Actions) | ❌ |

---

## Sprint 2: Contact Management — ✅ Complete

| Deliverable | Done |
|-------------|------|
| Contact CRUD (company/individual), jurisdiction, expiry dates | ✅ |
| Contact list: search, filter (contact_type, jurisdiction, status, expiry) | ✅ |
| Contact detail page (addresses, documents) | ✅ |
| File upload (documents) | ✅ (local storage; plan: R2) |
| Document categories | ✅ |
| View/download documents | ✅ |
| Multiple addresses per contact (address types) | ✅ |

---

## Sprint 3: Wallet — ✅ Complete

| Deliverable | Done |
|-------------|------|
| ClientWallet + WalletTransaction models | ✅ |
| Balance snapshots (balance_before/after) | ✅ |
| Manual top-up (credit) | ✅ |
| Debit (fee_charge) | ✅ (API exists) |
| Transaction history + audit | ✅ |
| Red Alert (low balance) | ✅ |
| Double-entry / race-condition handling | ⚠️ (single-server; no explicit locking) |

---

## Sprint 4: Projects & Tasks — ✅ Complete

| Deliverable | Done |
|-------------|------|
| Project model + API (name, type, status, assigned) | ✅ |
| Task model + API (title, status, assignedTo, dueDate) | ✅ |
| Project list + detail, task list | ✅ |
| Task status (Pending → … → Completed) | ✅ |
| Assign tasks to users | ✅ |
| **estimatedGovtFee on project** | ✅ |
| **Link wallet debit to project/task** | ✅ (fee-charge with project_id/task_id) |
| **Task completion with receipt attachment** | ❌ (optional Phase 2) |

---

## Sprint 5: VAT & Financial Logic — ✅ Implemented

| Deliverable | Done |
|-------------|------|
| VAT: Service Fee (5%) vs Government Fee (0%) | ✅ (fee-charge with apply_vat) |
| Transaction: amount_exclusive, vat_amount, amount_total | ✅ |
| **Red Alert gate when assigning task to PRO** (balance vs estimated fee) | ✅ (check-funding endpoint + “Check funding” on task) |
| Manager override with audit | ✅ (red_alert_override on fee-charge, audit log) |
| VAT report (monthly summary) | ✅ (GET /api/wallets/vat-report?month=&year=) |
| Wallet statement PDF | ❌ |
| Financial dashboard widgets | ✅ (wallet summary exists) |
| Link wallet debit to project/task | ✅ (project_id, task_id on fee-charge) |
| estimated_govt_fee on project | ✅ (create/update + UI) |

---

## Sprint 6: Expiry Alerts & Notifications — ⏳ Partial

| Deliverable | Done |
|-------------|------|
| Expiry dates on contacts | ✅ |
| Dashboard “expiring” widget | ✅ |
| Celery + Redis | ❌ |
| Daily expiry cron (T-90, T-60, T-30, T-7) | ❌ |
| Email notifications (SendGrid/SES) | ❌ |
| In-app notification bell | ❌ |

---

## Sprint 7: Dashboard & Reporting — ⏳ Partial

| Deliverable | Done |
|-------------|------|
| Main dashboard (financial, expiry, projects) | ✅ |
| Transaction history export (Excel) | ❌ |
| Client wallet summary report | ⚠️ (API summary only; no export) |
| PRO “My Tasks” mobile view | ❌ |
| User profile (view/edit, change password, audit log) | ❌ |

---

## Sprint 8: Testing & Deployment — ⏳ Partial

| Deliverable | Done |
|-------------|------|
| Pytest (backend, critical paths) | ❌ |
| E2E (Playwright) | ❌ |
| Performance (indexes, <500ms) | ⚠️ (not formalized) |
| Security (SQL/XSS/rate limit review) | ⚠️ (basic) |
| API docs (OpenAPI) | ✅ |
| User/admin guides | ⚠️ (README, DEPLOYMENT) |
| Production deploy (Vercel, Railway, Docker) | ✅ (configs ready) |
| Pilot prep (import clients, training) | N/A |

---

## Recommended Next Steps (in order)

1. ~~**Sprint 5 – VAT & gate**~~ ✅ Done (estimated_govt_fee, VAT on fee_charge, check-funding, VAT report).
2. ~~**Sprint 5 – Link debit to project**~~ ✅ Done (fee-charge accepts project_id/task_id).
3. **Sprint 7 – Reporting & profile**
   - Transaction history export (Excel/CSV).
   - User profile: edit name, change password, view own audit log.
4. **Sprint 6 – Notifications**
   - Celery + Redis, daily expiry cron, email alerts (or stub).
5. **Sprint 8 – Quality**
   - Pytest for critical paths, basic E2E, deployment checklist.

This file will be updated as items are completed.

---

## Database migration (new columns)

If you have an **existing** SQLite database (`backend/csp_erp.db`) from before Sprint 5 changes, either:

1. **Option A:** Delete the file and restart the app (fresh DB with all new columns), or  
2. **Option B:** Run the following SQL (SQLite) to add the new columns:

```sql
-- Projects: estimated govt fee
ALTER TABLE projects ADD COLUMN estimated_govt_fee NUMERIC(15,2);

-- Transactions: VAT and project/task link
ALTER TABLE transactions ADD COLUMN amount_exclusive NUMERIC(15,2);
ALTER TABLE transactions ADD COLUMN vat_amount NUMERIC(15,2);
ALTER TABLE transactions ADD COLUMN amount_total NUMERIC(15,2);
ALTER TABLE transactions ADD COLUMN project_id VARCHAR;
ALTER TABLE transactions ADD COLUMN task_id VARCHAR;
ALTER TABLE transactions ADD COLUMN red_alert_override BOOLEAN DEFAULT 0;
ALTER TABLE transactions ADD COLUMN red_alert_override_by VARCHAR;
```

(If a column already exists, that ALTER will fail; skip that line.)

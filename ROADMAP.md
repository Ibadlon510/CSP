# UAE CSP-ERP — Full Development Roadmap

**Vision**: Multi-tenant SaaS for Corporate Service Providers — contact management (companies & individuals), trust-based financials, UAE compliance.

**Stack**: FastAPI (Python) + Next.js + PostgreSQL + Cloudflare R2

---

## Overview: All 6 Phases

| Phase | Name | Duration | When to Start |
|-------|------|----------|---------------|
| **1** | MVP — Foundation + Financial Control | 3–4 months | Now |
| **2** | Workflow Automation + PRO Mobile | 2–3 months | After MVP stable |
| **3** | Advanced Financials + Bulk Operations | 2 months | After Phase 2 |
| **4** | HR, Payroll & Commission Engine | 2–3 months | After Phase 3 |
| **5** | Client Self-Service Portal | 2 months | After Phase 4 |
| **6** | Compliance & Advanced Features | Ongoing | After Phase 5 |

---

## Phase 1: MVP (3–4 months) — **YOU ARE HERE**

**Goal**: Internal CSP operations with full financial visibility and no out-of-pocket surprises.

### Deliverables

- **1.1 Multi-tenant infrastructure** — Auth (JWT), RBAC, org isolation, audit logging, dashboard shell
- **1.2 Contact management (lite)** — Contact CRUD (company/individual), document uploads (R2), multiple addresses, expiry dates, search/filter, daily expiry alerts (T-90, T-60, T-30)
- **1.3 Trust-based financials** — Client wallet ledger (double-entry), manual top-ups, Red Alert gate (block task if balance &lt; estimated fee), VAT toggle (5% service / 0% govt), transaction history, wallet statement PDF
- **1.4 Projects & tasks (minimal)** — Project CRUD, tasks with assignment, complete task + receipt upload, link wallet debit to project/task
- **1.5 Basic reporting** — Dashboard widgets (wallets, expiry alerts, project status, activity feed), Excel export

### MVP Sprints (8 × 2 weeks)

| Sprint | Weeks | Focus |
|--------|--------|--------|
| 1 | 1–2 | Foundation: auth, multi-tenancy, dashboard shell, CI/CD |
| 2 | 3–4 | Contact management: CRUD, documents, addresses, search, filters |
| 3 | 5–6 | Wallet: ledger, top-up, debit, transaction history |
| 4 | 7–8 | Projects & tasks: board, assignment, completion, receipt upload |
| 5 | 9–10 | VAT, Red Alert gate, financial reports, PDF statement |
| 6 | 11–12 | Expiry alerts (Celery cron), email notifications, widgets |
| 7 | 13–14 | Dashboard, PRO web view, exports, mobile-responsive |
| 8 | 15–16 | Testing, deployment, pilot prep, documentation |

### Out of scope in MVP

- Bulk import (manual entry for first 10–20 clients)
- Native PRO mobile app (web-responsive only)
- Workflow templates (Phase 2)
- Payment gateway (Phase 3)
- UBO mapping (Phase 6)

### Success criteria

- 10+ entities, 5+ projects, 30+ wallet transactions
- Red Alert blocks task when balance insufficient
- Wallet statement in &lt;5s, expiry alerts sent
- Internal + 2–3 pilot clients using the system

---

## Phase 2: Workflow Automation + PRO Mobile (2–3 months)

**Goal**: Repeatable workflows and PRO field mobility.

### What to do next (after MVP)

1. **Workflow template builder** — Visual designer: templates → stages → tasks, dependencies, estimated govt fee per template, role per task. Pre-built templates: company formation (Mainland/DMCC/ADGM), visa processing, license renewal, Golden Visa, Ejari.
2. **PRO mobile app (Flutter)** — Task list (by client/project), batch mode, “Start task” (GPS captured), receipt photo, amount entered, “Complete task” → wallet debit. Offline queue + sync.
3. **Government fee reconciliation** — Receipt photo → OCR amount → compare to claimed amount → flag for manager → approve → debit.

### Success metrics

- 80% of projects from templates
- PRO app used daily by field PROs
- 90%+ tasks with receipt evidence
- Workflow completion time down ~30%

---

## Phase 3: Advanced Financials + Bulk Operations (2 months)

**Goal**: Client self-service top-ups and bulk receipt handling.

### What to do next (after Phase 2)

1. **Bulk receipt splitter** — One PRO receipt (e.g. AED 5,000) split across multiple clients/projects; manager approval; separate wallet debits per client.
2. **Payment gateway** — PayTabs / Telr / Stripe: client “Top up wallet” → redirect → webhook → credit wallet.
3. **Advanced VAT reporting** — Monthly VAT summary, service vs disbursement, Excel for FTA/accounting, credit notes/refunds.

### Success metrics

- 50% of top-ups via gateway
- Bulk split reduces PRO admin time ~40%
- VAT report in ~10s

---

## Phase 4: HR, Payroll & Commission Engine (2–3 months)

**Goal**: UAE HR and payroll compliance.

### What to do next (after Phase 3)

1. **Employee management** — Profiles, visa/labor card, contract, document vault, expiry tracking.
2. **Hybrid payroll** — Fixed salary + per-task commission + per-sale commission; monthly aggregation.
3. **WPS** — .SIF file generation for bank upload.
4. **Gratuity** — UAE formula (21/30 days), monthly accrual, liability dashboard, settlement on termination.

### Success metrics

- Salaries calculated automatically (no Excel)
- WPS file in &lt;30s
- Commission disputes eliminated (audit trail)

---

## Phase 5: Client Self-Service Portal (2 months)

**Goal**: Clients see status and can order/top up.

### What to do next (after Phase 4)

1. **Client dashboard** — Entity details, document vault, project status (e.g. Kanban), wallet balance + history, expiry alerts.
2. **Service store (optional)** — Catalog (e.g. “Company Formation – DMCC”), intake form, deposit → auto-create project, notify CSP.
3. **Client-initiated top-ups** — Use Phase 3 payment gateway; “Request service” → quote → pay.

### Success metrics

- 30% of projects client-initiated
- Support tickets down ~50%

---

## Phase 6: Compliance & Advanced Features (Ongoing)

**Goal**: UBO compliance and optional government integrations.

### What to do next (after Phase 5)

1. **UBO mapping tool** — Visual graph (e.g. Neo4j or JSON): entities + persons, ownership %, auto UBO, validation (totals 100%).
2. **Compliance registers** — Auto-generate Register of Members and Register of UBOs (PDF, UAE template), &lt;30s.
3. **Government API exploration** — MOHRE, DED, GDRFA, Ejari if partnerships/APIs available; otherwise keep manual entry.

### Success metrics

- UBO registers for all complex entities
- Compliance docs in &lt;1 min
- 1–2 govt APIs live if feasible

---

## After MVP: What to Do Next (Summary)

1. **Stabilize MVP** — Internal use + 2–3 pilots, fix critical issues.
2. **Start Phase 2** — Workflow template builder first, then PRO Flutter app and receipt reconciliation.
3. **Then Phase 3** — Bulk receipt splitter and payment gateway.
4. **Then Phase 4** — HR, payroll, WPS, gratuity.
5. **Then Phase 5** — Client portal and service store.
6. **Then Phase 6** — UBO tool, registers, govt API research.

---

## Key Documents

- **This file** — High-level roadmap (all phases).
- **MVP_DECISIONS_CONFIRMED.md** — MVP scope, sprints, stack, go-live, costs (Django variant; consider aligning to FastAPI).
- **Full plan** — Detailed phases, tech deep dive, DB schema, risks: `.cursor/plans/uae_csp-erp_mvp_plan_8b509f45.plan.md` (or latest in `.cursor/plans/`).

---

*Last updated: February 2026*

# UAE CSP-ERP

Multi-tenant SaaS for Corporate Service Providers: entity management, trust-based financials, UAE compliance.

**Stack:** FastAPI (Python) · Next.js 14 · PostgreSQL · Cloudflare R2

---

## What’s in this repo

| Path | Purpose |
|------|--------|
| **ROADMAP.md** | Full 6-phase plan: MVP → Phase 2 → … → Phase 6. Start here to see “what’s next” after MVP. |
| **MVP_DECISIONS_CONFIRMED.md** | MVP scope, sprints, go-live, costs (detailed). |
| **backend/** | FastAPI API (auth, entities, wallets, projects). Sprint 1+ implementation lives here. |
| **frontend/** | Next.js 14 (App Router). Dashboard, entities, wallets, projects. |

---

## Run the app (backend + frontend)

From the project root:

```bash
./start
```

- Backend: http://localhost:8000 (docs: http://localhost:8000/docs)
- Frontend: http://localhost:3000
- Logs: `.run/backend.log` and `.run/frontend.log`

To stop:

```bash
./stop
```

*(Optional: `./scripts/run.sh` runs both in the foreground with Ctrl+C to stop. On Windows use `.\scripts\run.ps1`.)*

---

## Quick start (manual)

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # edit .env with your DB/Redis
uvicorn main:app --reload
```

- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:3000  

---

## Plan at a glance

1. **Phase 1 (MVP)** — 8 sprints, 16 weeks: foundation, entities, wallet, projects/tasks, VAT, expiry alerts, dashboard, pilot prep.  
2. **Phase 2** — Workflow templates, PRO mobile (Flutter), receipt reconciliation.  
3. **Phase 3** — Bulk receipt splitter, payment gateway, VAT reporting.  
4. **Phase 4** — HR, payroll, WPS, gratuity.  
5. **Phase 5** — Client portal, service store.  
6. **Phase 6** — UBO mapping, compliance registers, govt APIs.  

Full detail: **ROADMAP.md** and the full plan in `.cursor/plans/`.

---

## Next steps

- [ ] Finish Sprint 1: auth, multi-tenancy, dashboard shell, CI/CD.  
- [ ] Add PostgreSQL and run migrations (Alembic).  
- [ ] Implement entity and wallet APIs per ROADMAP / MVP_DECISIONS.

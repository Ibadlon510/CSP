# UAE CSP-ERP Platform

**Modern SaaS Platform for Corporate Service Providers in UAE**

A comprehensive multi-tenant ERP system designed specifically for Corporate Service Providers, streamlining contact management (companies and individuals), trust-based financials, and UAE regulatory compliance.

---

## ✨ Key Features

### 🎯 MVP Ready for Production

- **🏢 Contact Management**
  - Full CRUD for companies and individuals (contact types)
  - Document vault with upload/download
  - Jurisdiction templates (DED, DMCC, ADGM, DIFC) for companies
  - Expiry tracking & alerts (license, visa, passport, establishment card)
  
- **💰 Trust-Based Financials**
  - Client wallet management
  - Transaction tracking (top-ups, fees, refunds)
  - 🚨 Red Alert system for low balances
  - Automated threshold monitoring
  
- **📋 Project & Task Management**
  - Project creation linked to contacts
  - Task boards with status tracking
  - Priority management & assignment
  - Progress visualization

- **👥 User Management & RBAC**
  - Multi-tenant architecture
  - Role-based access control (Super Admin, Admin, Manager, PRO, Accountant, Client)
  - Audit logging for compliance

- **🎨 Modern SaaS UI (2026 Edition)**
  - Sleek, minimalist design inspired by Linear, Vercel, and Notion
  - Light neutral palette with professional aesthetics
  - SVG icon system (Feather Icons)
  - Smooth animations and micro-interactions
  - Responsive dashboard with live metrics
  - Enhanced empty states and loading indicators

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm or yarn

### Run Locally

```bash
# Clone the repository
git clone <your-repo-url>
cd CSP

# Start both backend and frontend (stops any existing run on 8000/3000 first)
./start

# Stop the application
./stop
```

**Access:**
- **Frontend:** http://localhost:3000 (open this in your browser)
- **Backend API docs:** http://localhost:8000/docs
- Use the **"Quick Demo Login"** button on the login page

**Notes:**
- You can run `./start` again without running `./stop` first; the script will free ports 8000 and 3000 and restart.
- First run may take 1–2 minutes (pip and npm install). Wait until you see `[OK] Frontend` or try http://localhost:3000 after ~45 seconds.
- If something fails, see `STARTUP_ANALYSIS.md` and check `.run/backend.log`, `.run/frontend.log`, or `.run/npm_install.log`.

### Sample data (quick demo)

To see sample data in all modules when using **Quick Demo Login** (demo@csp.local / demo123):

```bash
# From project root (after at least one ./start so the DB exists)
cd backend && ./venv/bin/python -m scripts.seed_demo
```

This creates the demo org, demo user (if missing), and sample contacts, products, leads, opportunities, quotations, orders, invoices, projects with tasks, wallets with transactions, and document metadata. Then open http://localhost:3000, click **Quick Demo Login**, and browse Contacts, CRM, Quotations, Orders, Invoices, Projects, Wallets, and Documents.

If you see `no such table: entities`, use a fresh database: stop the app, delete `backend/csp_erp.db` (and `backend/csp_erp.db-shm`, `backend/csp_erp.db-wal` if present), run `./start` once to create tables, then run the seed command again.

---

## 📦 Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM with multi-tenant support
- **PostgreSQL** - Production database (SQLite for dev)
- **JWT** - Secure authentication
- **Pydantic** - Data validation
- **bcrypt** - Password hashing

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Modern Design System** - Contemporary SaaS UI components
- **Feather Icons** - Professional SVG icon library
- **CSS Custom Properties** - Themeable design tokens

---

## 🏗️ Project Structure

```
CSP/
├── .cursor/plans/         # Development plans
├── backend/
│   ├── api/              # API endpoints (auth, contacts, wallets, projects)
│   ├── core/             # Config, database, security, dependencies
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic (audit, etc.)
│   └── main.py           # FastAPI application
├── frontend/
│   ├── app/              # Next.js pages (App Router)
│   │   ├── (dashboard)/  # Dashboard layout & pages
│   │   ├── login/        # Authentication pages
│   │   └── globals.css   # Modern design system & components
│   └── lib/              # API client, auth helpers
├── docker-compose.yml    # Production deployment config
├── Dockerfile.backend    # Backend container
├── Dockerfile.frontend   # Frontend container
├── .env.example          # Environment variables template
├── DESIGN_SYSTEM.md      # Complete design system documentation
├── DESIGN_REDESIGN_SUMMARY.md  # Design changes overview
├── DEPLOYMENT.md         # Comprehensive deployment guide
├── ROADMAP.md            # Development roadmap (6 phases)
├── start                 # Start script (dev)
└── stop                  # Stop script (dev)
```

---

## 🎯 Development Roadmap

### ✅ Phase 1: MVP (Completed)
- ✅ Sprint 1-2: Contact Management (companies & individuals)
- ✅ Sprint 3: Trust-Based Financials (Wallets & Red Alert)
- ✅ Sprint 4: Project & Task Management
- ✅ Modern SaaS UI/UX redesign (2026 Edition)
- ✅ Multi-tenant architecture
- ✅ User authentication & RBAC

### 📋 Phase 2: Enhancement (Next)
- Advanced permissions matrix
- Document templates & categories
- Bulk operations
- Automated compliance dashboard
- Email notifications (Celery + Redis)

### 🔮 Phase 3-6: Advanced Features
- Government API integrations (DED, ICP, MOL, FTA)
- Advanced financial reports & VAT
- Client self-service portal
- Mobile apps (PRO field operations)
- AI-powered insights & predictions

*See [ROADMAP.md](ROADMAP.md) for detailed sprint breakdown*

---

## 🚀 Deployment

### Option 1: Docker Compose (Recommended)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit with your configuration
nano .env

# 3. Start all services (PostgreSQL, Backend, Frontend)
docker-compose up -d

# 4. View logs
docker-compose logs -f

# 5. Stop services
docker-compose down
```

### Option 2: Platform Deployments

**Backend:**
- Railway / Render (easiest)
- AWS ECS / Google Cloud Run
- DigitalOcean App Platform
- VPS (Ubuntu + systemd)

**Frontend:**
- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Cloudflare Pages

*See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step guides*

---

## 🔐 Security

### Built-in Security Features

- ✅ JWT-based authentication with expiry
- ✅ Password hashing with bcrypt
- ✅ Row-level multi-tenancy (org_id filtering)
- ✅ Audit logging for all actions
- ✅ CORS protection
- ✅ Environment-based secrets
- ✅ SQL injection prevention (SQLAlchemy ORM)

### Production Security Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string (32+ chars)
- [ ] Use PostgreSQL (not SQLite)
- [ ] Enable HTTPS with SSL certificates
- [ ] Set `DEBUG=false`
- [ ] Configure CORS to only allow your frontend domain
- [ ] Use strong database passwords
- [ ] Set up database backups
- [ ] Enable firewall rules
- [ ] Implement rate limiting (API Gateway or Nginx)
- [ ] Set up monitoring (Sentry, DataDog, etc.)

---

## 📊 API Documentation

Interactive API documentation is automatically generated:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

All endpoints require authentication (JWT token) except:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /health`

---

## 📄 Documents module – document types

The Documents app uses a **canonical list of system document types** plus optional **org-specific custom categories**.

**System document types** (defined in `backend/constants/document_types.py`):

| Slug           | Display name                           |
|----------------|----------------------------------------|
| trade_license  | Trade License                          |
| moa            | MOA (Memorandum of Association)        |
| passport       | Passport                               |
| visa           | Visa copy                              |
| contract       | Contract                               |
| receipt        | Receipt                                |
| other          | Other                                  |

**Validation:** On document upload and on metadata update (PATCH), the `category` field must be either one of the system slugs above or a slug from the org’s custom document categories (`document_categories` table). Invalid values return `400` with a clear error message.

**API:** `GET /api/documents/document-types/` returns the merged list (system types + org custom categories) for use in dropdowns; use `slug` as value and `name` as label.

---

## 🧪 Testing

### Backend Tests (Coming Soon)

```bash
cd backend
pytest
pytest --cov=. --cov-report=html
```

### Frontend Tests (Coming Soon)

```bash
cd frontend
npm test
npm run test:coverage
```

### Manual Testing

1. Use the "Quick Demo Login" to create a test account
2. Test all CRUD operations for contacts, wallets, and projects
3. Verify Red Alert triggers when wallet balance < minimum
4. Check audit logs in database

---

## 📝 Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/csp_db
# Or for dev: sqlite:///./csp_erp.db

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRE_MINUTES=1440

# App
DEBUG=false
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

*See `.env.example` for complete reference*

---

## 🗂️ Database Schema

### Core Tables

- **organizations** - Tenant isolation
- **users** - Authentication & roles
- **contacts** - Client companies and individuals
- **contact_addresses** - Multiple addresses per contact
- **contact_documents** - Document vault
- **client_wallets** - Trust funds
- **transactions** - Financial tracking
- **wallet_alerts** - Red Alert system
- **projects** - Project management
- **tasks** - Task tracking
- **audit_log** - Compliance tracking

---

## 🔄 Workflow Examples

### Contact Onboarding

1. Admin creates contact (company or individual)
2. Uploads documents (trade license, MOA, passport, etc.)
3. Creates wallet for the contact
4. Sets minimum balance threshold
5. System monitors and triggers Red Alert if balance low

### Project Management

1. Manager creates project linked to contact
2. Adds tasks with priorities and due dates
3. Assigns tasks to team members
4. Team updates task status
5. Dashboard shows progress visualization

---

## 📞 Support & Troubleshooting

### Common Issues

**"Connection failed" on frontend:**
- Check backend is running: http://localhost:8000/health
- Check `.run/backend.log` for errors
- Verify CORS settings in backend

**Database errors:**
- For dev, delete `csp_erp.db` and restart
- For prod, check PostgreSQL connection

**JWT errors:**
- Clear browser localStorage
- Re-login with fresh token

### Get Help

1. Check logs: `.run/backend.log`, `.run/frontend.log`
2. Review [DEPLOYMENT.md](DEPLOYMENT.md)
3. Consult API docs: http://localhost:8000/docs
4. Check ROADMAP.md for feature status

---

## 📈 Performance

### Current Capacity (MVP)

- **Contacts:** 10,000+ per organization
- **Concurrent users:** 50-100 per instance
- **Transactions:** 1M+ records

### Optimization (Phase 2+)

- Database indexing on frequently queried fields
- Connection pooling (pgBouncer)
- Redis caching for sessions
- CDN for static assets
- Background job processing (Celery)

---

## 🤝 Contributing

This is a private project. For collaboration:
- Review the ROADMAP.md for planned features
- Check DEPLOYMENT.md for setup instructions
- Follow the code style (Black for Python, Prettier for TypeScript)
- Write tests for new features

---

## 📜 License

Proprietary - All rights reserved

---

## 🎉 What's Next?

### Immediate Next Steps (Phase 2)

1. **Enhanced RBAC** - Fine-grained permissions matrix
2. **Document Templates** - Pre-built templates for common documents
3. **Compliance Dashboard** - Unified view of all expiry alerts
4. **Email Notifications** - Automated alerts via SMTP/SendGrid
5. **Advanced Reporting** - Financial reports, VAT tracking

### Long-term Vision (Phase 3-6)

- Government API integrations (DED, ICP, MOL, FTA)
- AI-powered compliance predictions
- Mobile apps for PRO field operations
- Client self-service portal
- Multi-currency support
- Advanced analytics & insights

*Full roadmap in [ROADMAP.md](ROADMAP.md)*

---

**Built with ❤️ for UAE Corporate Service Providers**

**Status:** ✅ MVP Ready for Production | 📋 Actively Developed

---

## 📸 Key Features

### Modern SaaS Design (2026)
- **Minimalist aesthetic** - Inspired by Linear, Vercel, Notion
- **Light neutral palette** - Professional black-and-white theme
- **SVG icon system** - Feather Icons for consistency
- **Smooth animations** - Hardware-accelerated transitions
- **Enhanced interactions** - Hover states, loading spinners, empty states
- **Fully responsive** - Desktop, tablet, and mobile optimized

### Dashboard & Analytics
- **Time-based greeting** - Personalized welcome messages
- **Live metrics cards** - Total contacts, active wallets, projects
- **Critical alerts** - Red Alert system for low wallet balances
- **Expiry tracking** - Monitor licenses, visas, and documents
- **Quick actions** - Fast access to common operations

### Contact Management
- **Advanced search** - Search by name, email, license number
- **Smart filters** - Type, status, expiring documents
- **Jurisdiction templates** - DED, DMCC, ADGM, DIFC presets
- **Document vault** - Upload and manage client documents
- **Tax registration** - VAT and Corporate Tax tracking

### Financial Management
- **Trust wallets** - Client fund management
- **Transaction tracking** - Top-ups, fees, refunds
- **Balance monitoring** - Minimum threshold alerts
- **Red Alert system** - Automated critical notifications
- **Multi-currency support** - AED and other currencies

### Project & Task Management
- **Project boards** - Visual task management
- **Status tracking** - To-do, In Progress, Done
- **Priority levels** - Low, Medium, High, Critical
- **Team assignments** - Assign tasks to users
- **Progress visualization** - Track completion rates

---

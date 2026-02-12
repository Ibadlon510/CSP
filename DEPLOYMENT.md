# UAE CSP-ERP - Deployment Guide

## Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- npm or yarn

### Local Development Setup

1. **Clone and setup:**
   ```bash
   git clone <your-repo>
   cd CSP
   ```

2. **Run the application:**
   ```bash
   ./start
   ```

3. **Stop the application:**
   ```bash
   ./stop
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API Docs: http://localhost:8000/docs
   - Quick Demo Login: Use the "Quick Demo Login" button on login page

---

## Production Deployment

### Option 1: Docker Compose (Recommended)

1. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop services:**
   ```bash
   docker-compose down
   ```

### Option 2: Manual Deployment

#### Backend (FastAPI)

**Deploy to Railway/Render:**

1. Create a new project
2. Connect your Git repository
3. Set environment variables:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `JWT_SECRET` (generate a secure random string)
   - `CORS_ORIGINS` (your frontend URL)

4. Build command: `pip install -r backend/requirements.txt`
5. Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

**Deploy to VPS (Ubuntu):**

```bash
# Install dependencies
sudo apt update
sudo apt install python3.11 python3-pip postgresql nginx

# Setup virtual environment
cd /var/www/csp-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup systemd service
sudo nano /etc/systemd/system/csp-backend.service
```

Service file content:
```ini
[Unit]
Description=CSP-ERP Backend API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/csp-backend
Environment="PATH=/var/www/csp-backend/venv/bin"
EnvironmentFile=/var/www/csp-backend/.env
ExecStart=/var/www/csp-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable csp-backend
sudo systemctl start csp-backend
```

#### Frontend (Next.js)

**Deploy to Vercel (Easiest):**

1. Push code to GitHub
2. Import project on Vercel
3. Set environment variable:
   - `NEXT_PUBLIC_API_URL` = your backend URL
4. Deploy automatically

**Deploy to Netlify:**

1. Build command: `cd frontend && npm run build`
2. Publish directory: `frontend/.next`
3. Set `NEXT_PUBLIC_API_URL` environment variable

**Deploy to VPS:**

```bash
# Build frontend
cd frontend
npm install
npm run build

# Start with PM2
npm install -g pm2
pm2 start npm --name "csp-frontend" -- start
pm2 save
pm2 startup
```

---

## Database Migrations (Production)

For production, use **Alembic** for migrations instead of auto-create:

```bash
cd backend
# Initialize Alembic (first time only)
alembic init alembic

# Generate migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

---

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (prod) | `sqlite:///./csp_erp.db` |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | - |
| `JWT_EXPIRE_MINUTES` | JWT token expiration | No | `1440` (24h) |
| `DEBUG` | Enable debug mode | No | `false` |
| `CORS_ORIGINS` | Allowed CORS origins | No | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes | `http://localhost:8000` |

---

## Security Checklist

- [ ] Change default JWT_SECRET to a strong random string (32+ characters)
- [ ] Set DEBUG=false in production
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS with SSL certificates
- [ ] Set up CORS properly (only allow your frontend domain)
- [ ] Use environment variables for all secrets
- [ ] Set up database backups
- [ ] Enable firewall rules
- [ ] Use strong database passwords
- [ ] Implement rate limiting (future sprint)
- [ ] Set up monitoring and logging

---

## Monitoring

### Health Checks

- Backend: `GET /health` → `{"status": "ok"}`
- Database: Check PostgreSQL connection
- Frontend: Access root URL

### Logs

**Docker Compose:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Systemd:**
```bash
journalctl -u csp-backend -f
```

---

## Backup Strategy

### Database Backup

```bash
# Backup
pg_dump -h localhost -U csp_user csp_erp_db > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U csp_user csp_erp_db < backup_20260207.sql
```

### File Uploads Backup

```bash
# Backup uploads directory
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/
```

---

## Scaling Considerations

### Horizontal Scaling

- Use load balancer (Nginx, HAProxy)
- Deploy multiple backend instances
- Use Redis for session storage
- Implement Celery for background jobs

### Database Optimization

- Add indexes on frequently queried fields
- Use connection pooling
- Implement read replicas for heavy reads

---

## Support

For issues or questions:
- Check logs first
- Review API documentation: http://your-backend/docs
- Consult ROADMAP.md for feature status

# In-Depth Analysis: Why the App May Not Start

**Date:** February 2026  
**Purpose:** Identify all reasons the app might fail to start and how to fix them.

---

## 0. Fixes Applied (So It Won’t Happen Again)

The following are now built into `./start`:

| Issue | Fix in ./start |
|-------|----------------|
| **Ports in use** | Start script **frees 8000 and 3000** at the beginning (same as ./stop), then waits 2s. You can run ./start without running ./stop first. |
| **pip timeout** | **600s timeout** and **retry once** if pip install fails. On second failure, clear message and exit 1. |
| **next: command not found** | Frontend is started with **./node_modules/.bin/next dev** (or **npx next dev** if the binary is missing). No reliance on PATH. |
| **node_modules missing** | **npm install** runs when node_modules or .bin/next is missing; **retry once** on failure; exit 1 with log path if both fail. |
| **Backend not ready** | Frontend is **only started after backend health check passes** (up to 25s). If backend never responds, script exits 1 and tails backend.log. |
| **Database “not reachable”** | Shown as **[WARN]** only; script does not exit. Backend is already up at that point. |
| **Frontend slow first compile** | **45s** wait (was 35s). On timeout, script shows last 12 lines of frontend.log and suggests trying the URL in a minute. |
| **Old log noise** | Backend and frontend logs are **reset each run** with a “Started &lt;date&gt;” line so failures are easier to read. |

**Idempotent start:** Running `./start` while the app is already running will stop the existing processes on 8000/3000 and start fresh. No need to remember to run `./stop` first.

---

## 1. Summary of Findings

| Component   | Status in isolation | Common failure mode                          |
|------------|----------------------|----------------------------------------------|
| Backend    | ✅ Starts and responds | Port 8000 in use; pip install timeout       |
| Frontend   | ✅ Starts with `npx next dev` | `next: command not found` if no node_modules; first compile slow |
| Database   | ✅ OK (SQLite)       | Health check can show "not reachable" if backend not ready yet |
| Start script | ✅ Logic correct   | Timing (waits may be too short); `set -e` can exit on optional failures if not careful |

---

## 2. Root Causes (What Can Go Wrong)

### 2.1 Ports already in use

- **Symptom:** Script says "Port 8000 already in use" or "Port 3000 already in use"; backend or frontend never listens.
- **Cause:** A previous run (or another app) is still using 8000 or 3000.
- **Fix:** Always run `./stop` before `./start`. If needed, manually free ports:
  ```bash
  lsof -ti:8000 | xargs kill -9
  lsof -ti:3000 | xargs kill -9
  ```

### 2.2 Backend: pip install timeout

- **Symptom:** `./start: line 59: ./venv/bin/pip: Operation timed out`
- **Cause:** Slow network or PyPI; pip’s default timeout is too low.
- **Fix:** Already increased in script with `PIP_DEFAULT_TIMEOUT=300`. If it still times out, install manually:
  ```bash
  cd backend
  ./venv/bin/pip install --timeout 600 -r requirements.txt
  cd ..
  ./start
  ```

### 2.3 Frontend: "next: command not found"

- **Symptom:** `.run/frontend.log` shows `sh: next: command not found`.
- **Cause:** `npm run dev` runs the `next` binary from `node_modules/.bin`; in some environments that path isn’t used when the script is started by `./start`.
- **Fix:** Script now uses `npx next dev` so the local `next` is always used. If `node_modules` is missing, the script runs `npm install` when `node_modules` or `node_modules/.bin/next` is missing.

### 2.4 Frontend: node_modules missing or incomplete

- **Symptom:** `next: command not found` or module-not-found errors.
- **Cause:** First run or after clone; `npm install` wasn’t run or didn’t finish.
- **Fix:** Run once manually, then start:
  ```bash
  cd frontend
  npm install
  cd ..
  ./stop
  ./start
  ```

### 2.5 Backend: "Database: not reachable"

- **Symptom:** Script reports `[FAIL] Database: not reachable` even though backend is OK.
- **Cause:** The `/health/detailed` check runs when the app is still starting, or the DB file is locked (e.g. another process).
- **Reality:** Backend and DB work when tested in isolation. This is usually a **timing** issue: script hits `/health/detailed` before the app is fully ready.
- **Fix:** Script now waits 4 seconds and retries backend health 15 times. If you still see this, check `.run/backend.log` for real errors; if there are none, the app is likely fine and you can open http://localhost:3000.

### 2.6 Frontend: "Not ready yet" after 20 seconds

- **Symptom:** `[WARN] Frontend not ready yet (Next.js may need more time)`.
- **Cause:** First run or cold start: Next.js compiles on first request and can take 20–60 seconds.
- **Fix:** Wait longer (e.g. 30–60 seconds) and open http://localhost:3000 again. Or increase the frontend verification loop in `start` (e.g. 30 attempts).

### 2.7 Browser: "Connection failed" / "Cannot reach the backend"

- **Symptom:** Login or dashboard shows connection failed or a message about not reaching the backend.
- **Cause:** Frontend (browser) cannot reach http://localhost:8000. Common reasons:
  - Backend not running (start failed or crashed).
  - Wrong URL (e.g. using 127.0.0.1:3000 without ensuring backend is reachable).
  - Firewall or network blocking localhost.
- **Fix:**
  1. Run `./stop` then `./start`, wait 30–40 seconds.
  2. In browser open **http://localhost:3000** (not file://).
  3. Verify backend: open http://localhost:8000/health in another tab; should show `{"status":"ok",...}`.
  4. If backend is OK but frontend still fails, check browser console and Network tab for CORS or mixed-content issues.

### 2.8 caniuse-lite / build errors (npm run build)

- **Symptom:** `ERR_INVALID_PACKAGE_CONFIG` for `caniuse-lite/package.json` when running `npm run build`.
- **Cause:** Corrupted or incompatible `node_modules` (e.g. after Node upgrade).
- **Fix:** Clean reinstall:
  ```bash
  cd frontend
  rm -rf node_modules package-lock.json
  npm install
  cd ..
  ```
  For daily development you use `./start` (which runs `npx next dev`), not `npm run build`, so this only matters for production builds.

---

## 3. Verification Checklist (Run These Yourself)

```bash
# 1. Stop everything
./stop

# 2. Ensure ports are free
lsof -i :8000 -i :3000   # should show nothing

# 3. Backend in isolation
cd backend
./venv/bin/python -c "from main import app; print('Backend OK')"
./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
sleep 5
curl -s http://localhost:8000/health
curl -s http://localhost:8000/health/detailed
kill %1 2>/dev/null
cd ..

# 4. Frontend in isolation (optional; takes ~15s)
cd frontend
npx next dev &
sleep 18
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
pkill -f "next dev" 2>/dev/null
cd ..

# 5. Full start
./start
# Wait until you see [OK] for both Backend and Frontend (or wait 60s), then:
# Open http://localhost:3000
```

---

## 4. Script Improvements (Current Behavior)

- **Auto-stop on start:** Frees ports 8000 and 3000 and kills any process from previous run. Sleep 2s before continuing.
- **Pip:** 600s timeout, retry once; exit 1 with instructions if both attempts fail.
- **Backend:** Wait up to 25s for /health; only then start frontend. If backend never responds, exit 1 and tail backend.log.
- **Database check:** Informational only; [WARN] if not ok, no exit.
- **npm install:** When node_modules or .bin/next missing; retry once; log to .run/npm_install.log; exit 1 if both fail.
- **Frontend launcher:** ./node_modules/.bin/next dev (fallback: npx next dev).
- **Frontend wait:** Up to 45s; on timeout, [WARN] and tail frontend.log.
- **Logs:** Cleared at each run with a Started date header.

---

## 5. Recommended User Flow

1. Run **`./start`** (it stops any existing run on 8000/3000 first).
2. Wait until you see `[OK] Backend` and `[OK] Frontend`, or up to ~45 seconds on first run.
3. Open **http://localhost:3000** in the browser.
4. If something fails, check:
   - `.run/backend.log` (backend errors)
   - `.run/frontend.log` (frontend / Next.js errors)
   - This document for the matching symptom and fix.

---

## 6. Quick Reference: Log Locations

| Log | Content |
|-----|--------|
| `.run/backend.log` | Uvicorn and FastAPI; import errors; DB errors |
| `.run/frontend.log` | Next.js dev server; compile errors; "next: command not found" |

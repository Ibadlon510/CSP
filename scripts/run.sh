#!/usr/bin/env bash
# Run UAE CSP-ERP: backend (FastAPI) + frontend (Next.js)
# Usage: ./scripts/run.sh   or   bash scripts/run.sh
# Stop: Ctrl+C (kills both backend and frontend)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BACKEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "Stopping backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup INT TERM EXIT

echo "UAE CSP-ERP — starting backend and frontend"
echo ""

# Start backend (FastAPI)
echo "[1/2] Starting backend (FastAPI) on http://localhost:8000 ..."
(
  cd "$PROJECT_ROOT/backend"
  if [ -d "venv" ]; then
    source venv/bin/activate
  fi
  # Install minimal deps if uvicorn missing (optional)
  if ! command -v uvicorn &>/dev/null; then
    pip install -q fastapi uvicorn 2>/dev/null || true
  fi
  exec uvicorn main:app --reload --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

# Give backend a moment to bind
sleep 2

# Start frontend (Next.js)
echo "[2/2] Starting frontend (Next.js) on http://localhost:3000 ..."
echo ""
echo "  Backend:  http://localhost:8000  (docs: http://localhost:8000/docs)"
echo "  Frontend: http://localhost:3000"
echo "  Stop both: Ctrl+C"
echo ""

cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies (first run)..."
  npm install
fi
npm run dev

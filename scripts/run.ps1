# Run UAE CSP-ERP: backend (FastAPI) + frontend (Next.js)
# Usage: .\scripts\run.ps1
# Backend runs in a new window; frontend runs here. Close both windows to stop.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }

$backendPath = Join-Path $ProjectRoot "backend"
$frontendPath = Join-Path $ProjectRoot "frontend"
$venvActivate = Join-Path $backendPath "venv\Scripts\Activate.ps1"

Write-Host "UAE CSP-ERP — starting backend and frontend" -ForegroundColor Cyan
Write-Host ""

# Start backend in a new window
$backendCmd = "Set-Location '$backendPath'; "
if (Test-Path $venvActivate) {
  $backendCmd += ". '$venvActivate'; "
}
$backendCmd += "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Start-Sleep -Seconds 2

# Frontend in current window
Set-Location $frontendPath
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing frontend dependencies (first run)..."
  npm install
}

Write-Host ""
Write-Host "  Backend:  http://localhost:8000  (new window)" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  Stop: Close this window for frontend; close the other window for backend." -ForegroundColor Yellow
Write-Host ""

npm run dev

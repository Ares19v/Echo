@echo off
title Echo – AI Voice Agent
color 0B
setlocal

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         Echo – AI Voice Agent            ║
echo  ║              STARTING...                 ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Activate Python venv ──────────────────────────────────────────────────
if not exist .venv (
    echo  ✗ Virtual environment not found. Run INSTALL.bat first.
    pause & exit /b 1
)
call .venv\Scripts\activate.bat

:: ── Validate .env ─────────────────────────────────────────────────────────
if not exist .env (
    echo  ⚠  No .env file found. Copying from .env.example...
    copy .env.example .env >nul
)

:: ── Start Docker services (DB + Redis) ────────────────────────────────────
echo [1/4] Starting database services...
docker compose up -d postgres redis >nul 2>&1
if %errorlevel% neq 0 (
    echo  ⚠  Docker not available – skipping DB start (demo mode only)
) else (
    echo  ✓ PostgreSQL + Redis running
    :: Wait for postgres to be ready
    timeout /t 3 /nobreak >nul
)

:: ── Start FastAPI backend ─────────────────────────────────────────────────
echo [2/4] Starting Echo API backend (port 8000)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)
start "Echo Backend" cmd /k "call .venv\Scripts\activate.bat && python run_backend.py"
timeout /t 3 /nobreak >nul
echo  ✓ API backend started

:: ── Start agent worker ────────────────────────────────────────────────────
echo [3/4] Starting Echo agent worker...
:: Kill any stale process holding port 8081 from a previous run
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul
start "Echo Agent Worker" cmd /k "call .venv\Scripts\activate.bat && python -m agent.worker start"
timeout /t 3 /nobreak >nul
echo  ✓ Agent worker started

:: ── Start React dashboard ─────────────────────────────────────────────────
echo [4/4] Starting admin dashboard (port 5173)...
start "Echo Dashboard" cmd /k "cd dashboard && npm run dev"
timeout /t 4 /nobreak >nul
echo  ✓ Dashboard started

:: ── Open in browser ───────────────────────────────────────────────────────
echo.
echo  ══════════════════════════════════════════════
echo   Echo is running!
echo.
echo   Dashboard:    http://localhost:5173  (or :5174)
echo   Simulator:    http://localhost:5173/simulator
echo   API Docs:     http://localhost:8000/docs
echo   API Health:   http://localhost:8000/health
echo   Agent Worker: http://localhost:8081 (internal)
echo.
echo   Open the Simulator page to talk to Echo AI!
echo  ══════════════════════════════════════════════
echo.
pause >nul
start "" http://localhost:5173/simulator

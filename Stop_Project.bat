@echo off
title Echo ? Stop All Services
color 0C
setlocal

echo.
echo  ======================================================
echo              Stopping Echo Services...
echo  ======================================================
echo.

echo [1/3] Terminating Backend on port 8000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo [2/3] Terminating Dashboard on port 5173...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo [3/3] Terminating any remaining Python worker processes...
taskkill /F /FI "WINDOWTITLE eq Echo*" >nul 2>&1

echo.
echo  ======================================================
echo   All Echo services have been stopped.
echo  ======================================================
echo.
timeout /t 3 /nobreak >nul

@echo off
title CYBER-NEXUS Investigation Engine
echo ===============================================================================
echo   CYBER-NEXUS: AI-Powered Unified Cyber Fraud Analysis & Digital Correlator
echo   Offline Single-Machine Forensic Console // Section 65B Indian Evidence Act
echo ===============================================================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

echo [1/3] Verifying database integrity and seeding demo evidence...
python backend\tests\verify_core.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Verification failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting FastAPI Backend Service on http://127.0.0.1:8000...
start "CYBER-NEXUS Backend" /min cmd /c "python backend\run_server.py"

echo.
echo [3/3] Starting Field Officer React Console on http://localhost:5173...
cd frontend
start "CYBER-NEXUS Frontend" /min cmd /c "npm run dev -- --host"

echo.
echo [SUCCESS] CYBER-NEXUS is live! Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo Press any key to stop all services...
pause >nul
taskkill /FI "WINDOWTITLE eq CYBER-NEXUS Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CYBER-NEXUS Frontend*" /T /F >nul 2>&1
echo Services stopped.

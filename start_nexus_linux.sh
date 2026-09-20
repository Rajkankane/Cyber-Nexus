#!/usr/bin/env bash
set -e

echo "==============================================================================="
echo "  CYBER-NEXUS: AI-Powered Unified Cyber Fraud Analysis & Digital Correlator"
echo "  Offline Single-Machine Forensic Console // Section 65B Indian Evidence Act"
echo "==============================================================================="
echo ""

echo "[1/3] Verifying database integrity and seeding demo evidence..."
python3 backend/tests/verify_core.py

echo ""
echo "[2/3] Starting FastAPI Backend Service on http://127.0.0.1:8000..."
python3 backend/run_server.py &
BACKEND_PID=$!

echo ""
echo "[3/3] Starting Field Officer React Console on http://localhost:5173..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM EXIT

echo ""
echo "[SUCCESS] CYBER-NEXUS is live at http://localhost:5173"
wait

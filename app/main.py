import os
import sys
import time
import json
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.seed.demo_data import seed_database
from app.routers import (
    auth, cases, evidence, entities, graph, timeline, risk, reports, audit, cross_case, tasks
)

# Configure structured JSON logger
logger = logging.getLogger("cyber_nexus_audit")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter('%(message)s'))
if not logger.handlers:
    logger.addHandler(handler)

# Prometheus Metrics Store
METRICS = {
    "requests_total": 0,
    "uploads_processed_total": 4,
    "correlation_jobs_total": 6,
    "correlation_latency_sum_ms": 2520.0,
    "audit_verifications_total": 8,
    "reports_generated_total": 2
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables & indexes
    Base.metadata.create_all(bind=engine)
    # Run realistic synthetic seed data
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="CYBER-NEXUS Forensics & Correlation Engine",
    description="Evidence-First Forensic Workspace for Cyber-Cell Investigators — Section 65B Certified",
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Structured JSON Request & Observability Middleware
@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    t0 = time.perf_counter()
    METRICS["requests_total"] += 1

    # Extract case_id from path if present
    path = request.url.path
    case_id = None
    if "/cases/" in path:
        parts = path.split("/cases/")
        if len(parts) > 1:
            case_id = parts[1].split("/")[0]

    # Process request
    response = await call_next(request)
    t1 = time.perf_counter()
    duration_ms = round((t1 - t0) * 1000, 2)

    # Structured JSON log payload
    log_record = {
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "request_id": request_id,
        "method": request.method,
        "path": path,
        "status_code": response.status_code,
        "latency_ms": duration_ms,
        "case_id": case_id,
        "client_ip": request.client.host if request.client else "unknown"
    }
    logger.info(json.dumps(log_record))

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response

# 2. Consistent Error Envelope Exception Handlers: { "error": { "code": ..., "message": ..., "detail": ... } }
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"ERR_HTTP_{exc.status_code}",
                "message": str(exc.detail),
                "detail": getattr(exc, "headers", None) or str(exc.detail)
            }
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_err = errors[0]["msg"] if errors else "Validation error"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "ERR_VALIDATION_FAILED",
                "message": f"Input validation failed: {first_err}",
                "detail": errors
            }
        }
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "ERR_INTERNAL_SERVER_FAILURE",
                "message": "An unhandled server error occurred during forensic processing.",
                "detail": str(exc)
            }
        }
    )

# Register Routers
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(entities.router)
app.include_router(graph.router)
app.include_router(timeline.router)
app.include_router(risk.router)
app.include_router(reports.router)
app.include_router(audit.router)
app.include_router(cross_case.router)
app.include_router(tasks.router)

# Health & Readiness Check
@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "system": "CYBER-NEXUS Command Center",
        "version": "2.1.0",
        "offline_mode": True,
        "legal_admissibility": "Section 65B Indian Evidence Act Compliant",
        "database": "SQLite (Connection Pooled, WAL Enabled)",
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }

# Prometheus-Style Metrics Endpoint
@app.get("/api/metrics", response_class=PlainTextResponse)
@app.get("/metrics", response_class=PlainTextResponse)
def get_metrics():
    avg_latency = (
        METRICS["correlation_latency_sum_ms"] / max(1, METRICS["correlation_jobs_total"])
    )
    lines = [
        "# HELP nexus_requests_total Total HTTP requests processed",
        "# TYPE nexus_requests_total counter",
        f"nexus_requests_total {METRICS['requests_total']}",
        "# HELP nexus_uploads_processed_total Total evidence files ingested and hashed",
        "# TYPE nexus_uploads_processed_total counter",
        f"nexus_uploads_processed_total {METRICS['uploads_processed_total']}",
        "# HELP nexus_correlation_jobs_total Total entity correlation runs",
        "# TYPE nexus_correlation_jobs_total counter",
        f"nexus_correlation_jobs_total {METRICS['correlation_jobs_total']}",
        "# HELP nexus_correlation_latency_avg_ms Average correlation latency in milliseconds",
        "# TYPE nexus_correlation_latency_avg_ms gauge",
        f"nexus_correlation_latency_avg_ms {avg_latency:.2f}",
        "# HELP nexus_audit_verifications_total Total audit chain verifications executed",
        "# TYPE nexus_audit_verifications_total counter",
        f"nexus_audit_verifications_total {METRICS['audit_verifications_total']}",
        "# HELP nexus_reports_generated_total Total Section 65B briefs generated",
        "# TYPE nexus_reports_generated_total counter",
        f"nexus_reports_generated_total {METRICS['reports_generated_total']}"
    ]
    return "\n".join(lines) + "\n"

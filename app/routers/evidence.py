import io
import time
import zipfile
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Case, Evidence, ParseException, User
from app.schemas.schemas import EvidenceResponse, ParseExceptionResponse, ErrorEnvelope
from app.auth.rbac import get_current_user
from app.integrity.vault import store_in_vault
from app.integrity.audit import append_audit_log
from app.parsers.cdr_ipdr import parse_cdr_ipdr
from app.parsers.bank_upi import parse_bank_upi
from app.parsers.eml_parser import parse_eml
from app.parsers.apk_android import parse_apk_android
from app.analytics.correlator import compute_entity_correlations
from app.analytics.risk_scorer import compute_case_risk_scores

router = APIRouter(prefix="/api/cases/{case_id}/evidence", tags=["evidence"])

MAX_ALLOWED_FILE_SIZE = 50 * 1024 * 1024  # 50 MB for single file
MAX_UNCOMPRESSED_ARCHIVE_SIZE = 150 * 1024 * 1024  # 150 MB uncompressed limit

def inspect_archive_safety(file_bytes: bytes, filename: str):
    """Protects against zip-bomb and corrupted archive attacks."""
    if filename.lower().endswith(('.zip', '.apk')):
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                total_uncompressed = 0
                for info in zf.infolist():
                    total_uncompressed += info.file_size
                    if total_uncompressed > MAX_UNCOMPRESSED_ARCHIVE_SIZE:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Archive rejected: Uncompressed size exceeds security threshold ({MAX_UNCOMPRESSED_ARCHIVE_SIZE // (1024*1024)}MB). Possible decompression bomb."
                        )
                # Check compression ratio
                compressed_size = len(file_bytes)
                if compressed_size > 0 and (total_uncompressed / compressed_size) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Archive rejected: Abnormally high compression ratio (> 100:1). Decompression bomb signature detected."
                    )
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {filename} is malformed or not a valid ZIP/APK archive."
            )

@router.get("", response_model=List[EvidenceResponse], responses={404: {"model": ErrorEnvelope}})
def list_case_evidence(
    case_id: str,
    source_type: Optional[str] = Query(None, description="Filter by source type (CDR, BANK, APK, etc.)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Evidence).filter(Evidence.case_id == case_id)
    if source_type:
        query = query.filter(Evidence.source_type == source_type.upper())
    return query.order_by(Evidence.ingested_at.desc()).offset(offset).limit(limit).all()

@router.post("/upload", response_model=EvidenceResponse, responses={400: {"model": ErrorEnvelope}, 404: {"model": ErrorEnvelope}})
async def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    source_type: str = Form("CDR"),  # CDR, IPDR, BANK, UPI, EML, APK, ANDROID
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

    if len(file_bytes) > MAX_ALLOWED_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed upload size ({MAX_ALLOWED_FILE_SIZE // (1024*1024)}MB)."
        )

    # 1. Inspect archive safety (zip-bomb guard)
    inspect_archive_safety(file_bytes, file.filename or "artifact")

    # 2. Forensic Vault Storage + SHA-256 Fingerprint + Read-only filesystem lock
    rel_path, sha256_hash = store_in_vault(case_id, file.filename or "unknown_file", file_bytes)

    # 3. Register Evidence Record
    now = datetime.now(timezone.utc)
    evidence = Evidence(
        case_id=case_id,
        source_type=source_type.upper(),
        file_path=rel_path,
        sha256_original=sha256_hash,
        acquired_at=now,
        ingested_at=now
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # 4. Chained Audit Log with previous hash check
    actor_id = f"{user.username} ({user.badge_number})"
    append_audit_log(
        db=db,
        actor=actor_id,
        action="INGEST_EVIDENCE",
        target_ref=f"evidence:{evidence.evidence_id} [{source_type.upper()} - {file.filename} - SHA256: {sha256_hash[:16]}...]"
    )

    # 5. Fault-Tolerant Row-by-Row Parse Pipeline
    st = source_type.upper()
    try:
        if st in ("CDR", "IPDR"):
            parse_cdr_ipdr(db, case_id, evidence.evidence_id, file_bytes, file.filename or "cdr.csv", source_type=st)
        elif st in ("BANK", "UPI"):
            parse_bank_upi(db, case_id, evidence.evidence_id, file_bytes, file.filename or "bank.csv", source_type=st)
        elif st == "EML":
            parse_eml(db, case_id, evidence.evidence_id, file_bytes, file.filename or "email.eml")
        elif st in ("APK", "ANDROID"):
            parse_apk_android(db, case_id, evidence.evidence_id, file_bytes, file.filename or "app.apk", source_type=st)
        else:
            parse_cdr_ipdr(db, case_id, evidence.evidence_id, file_bytes, file.filename or "generic.csv", source_type="CDR")
    except Exception as parse_err:
        # Never raw 500 — record parse exception cleanly
        db.rollback()
        ex = ParseException(
            evidence_id=evidence.evidence_id,
            row_index=0,
            raw_content=str(parse_err)[:500],
            error_message=f"Parser execution failed: {str(parse_err)}"
        )
        db.add(ex)
        db.commit()

    # 6. Correlation run with timing measurement
    t_start = time.perf_counter()
    compute_entity_correlations(db, case_id, actor=actor_id)
    compute_case_risk_scores(db, case_id)
    t_end = time.perf_counter()

    # Store real measured latency in case metadata
    case.last_activity_at = datetime.now(timezone.utc)
    case.correlation_latency_ms = round((t_end - t_start) * 1000, 2)
    db.commit()

    db.refresh(evidence)
    return evidence

@router.get("/{evidence_id}/exceptions", response_model=List[ParseExceptionResponse], responses={404: {"model": ErrorEnvelope}})
def get_parse_exceptions(case_id: str, evidence_id: str, db: Session = Depends(get_db)):
    return db.query(ParseException).filter(ParseException.evidence_id == evidence_id).order_by(ParseException.row_index.asc()).all()

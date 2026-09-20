from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import AuditLog, Report, User
from app.schemas.schemas import AuditLogResponse
from app.integrity.audit import verify_audit_chain, append_audit_log
from app.auth.rbac import get_current_user
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter(tags=["audit_and_reports"])

@router.get("/api/audit/logs", response_model=List[AuditLogResponse])
def get_audit_logs(db: Session = Depends(get_db)):
    is_valid, broken_id, records = verify_audit_chain(db)
    results = []
    for r in records:
        results.append(AuditLogResponse(
            log_id=r["log_id"],
            actor=r["actor"],
            action=r["action"],
            target_ref=r["target_ref"],
            occurred_at=r["occurred_at"],
            prev_hash=r["prev_hash"],
            row_hash=r["row_hash"],
            is_valid=r["is_valid"]
        ))
    return results

@router.get("/api/audit/verify")
def check_chain_integrity(db: Session = Depends(get_db)):
    is_valid, broken_id, records = verify_audit_chain(db)
    return {
        "chain_valid": is_valid,
        "total_records": len(records),
        "broken_at_log_id": broken_id if not is_valid else None,
        "legal_standard": "Section 65B(4) Indian Evidence Act 1872 / ISO/IEC 27037",
        "status_description": "Cryptographic hash chain is intact and unmanipulated." if is_valid else f"INTEGRITY BREACH DETECTED: Tampered row detected at log_id {broken_id}."
    }

@router.post("/api/audit/simulate-tamper")
def simulate_tamper(
    log_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Simulates adversarial database tampering for forensic evaluation.
    Modifies an audit row's actor or action without recalculating the hash.
    """
    entry = db.query(AuditLog).filter(AuditLog.log_id == log_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found")

    entry.actor = "ADVERSARY_UNAUTHORIZED_EDIT"
    db.commit()

    is_valid, broken_id, _ = verify_audit_chain(db)
    return {
        "message": f"Tamper simulated on log_id {log_id}",
        "chain_valid_now": is_valid,
        "broken_at_log_id": broken_id
    }

@router.get("/api/reports/download/{report_id}")
def download_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report or not Path(report.file_path).exists():
        raise HTTPException(status_code=404, detail="Report file not found")

    filename = Path(report.file_path).name
    media_type = "application/pdf" if report.format == "PDF" else "application/json"
    return FileResponse(
        path=report.file_path,
        filename=filename,
        media_type=media_type
    )

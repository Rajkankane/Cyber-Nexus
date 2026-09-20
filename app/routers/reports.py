from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Report, User
from app.auth.rbac import get_current_user
from app.reports.pdf_generator import generate_case_pdf_brief
from app.reports.json_generator import generate_case_json_brief
from app.integrity.audit import append_audit_log

router = APIRouter(prefix="/api/cases/{case_id}/reports", tags=["reports"])

@router.post("/generate-pdf")
def create_pdf_report(
    case_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    officer_name = f"{user.full_name} (Badge: {user.badge_number})"
    file_path, report_id = generate_case_pdf_brief(db, case_id, generated_by=officer_name)

    append_audit_log(
        db=db,
        actor=f"{user.username} ({user.badge_number})",
        action="GENERATE_SECTION65B_PDF_BRIEF",
        target_ref=f"report:{report_id} [Case: {case_id}]"
    )

    return {
        "report_id": report_id,
        "format": "PDF",
        "file_name": Path(file_path).name,
        "download_url": f"/api/reports/download/{report_id}",
        "status": "COMPLETED"
    }

@router.post("/generate-json")
def create_json_report(
    case_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    officer_name = f"{user.full_name} (Badge: {user.badge_number})"
    file_path, report_id = generate_case_json_brief(db, case_id, generated_by=officer_name)

    append_audit_log(
        db=db,
        actor=f"{user.username} ({user.badge_number})",
        action="GENERATE_JSON_DOSSIER",
        target_ref=f"report:{report_id} [Case: {case_id}]"
    )

    return {
        "report_id": report_id,
        "format": "JSON",
        "file_name": Path(file_path).name,
        "download_url": f"/api/reports/download/{report_id}",
        "status": "COMPLETED"
    }

@router.get("")
def list_reports(case_id: str, db: Session = Depends(get_db)):
    return db.query(Report).filter(Report.case_id == case_id).order_by(Report.generated_at.desc()).all()

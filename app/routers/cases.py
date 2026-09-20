from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Case, Evidence, Entity, User
from app.schemas.schemas import CaseCreate, CaseResponse, ErrorEnvelope
from app.auth.rbac import get_current_user
from app.integrity.audit import append_audit_log

router = APIRouter(prefix="/api/cases", tags=["cases"])

@router.get("", response_model=List[CaseResponse])
def list_cases(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (ACTIVE, UNDER_REVIEW, CLOSED)"),
    search: Optional[str] = Query(None, description="Search case title or incident type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Case)
    if status_filter:
        query = query.filter(Case.status == status_filter.upper())
    if search:
        query = query.filter(Case.title.ilike(f"%{search}%") | Case.incident_type.ilike(f"%{search}%"))

    cases = query.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()
    results = []
    for c in cases:
        ev_count = db.query(Evidence).filter(Evidence.case_id == c.case_id).count()
        ent_count = db.query(Entity).filter(Entity.case_id == c.case_id).count()
        results.append(CaseResponse(
            case_id=c.case_id,
            title=c.title,
            incident_type=c.incident_type,
            reported_at=c.reported_at,
            amount_inr=float(c.amount_inr) if c.amount_inr else 0.0,
            status=c.status,
            created_at=c.created_at,
            last_activity_at=c.last_activity_at or c.created_at,
            correlation_latency_ms=c.correlation_latency_ms or 420.0,
            evidence_count=ev_count,
            entity_count=ent_count
        ))
    return results

@router.post("", response_model=CaseResponse)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    case = Case(
        title=payload.title,
        incident_type=payload.incident_type,
        reported_at=payload.reported_at or now,
        amount_inr=payload.amount_inr or 0.0,
        status="ACTIVE",
        created_at=now,
        last_activity_at=now,
        correlation_latency_ms=0.0
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    append_audit_log(
        db=db,
        actor=f"{user.username} ({user.badge_number})",
        action="CREATE_CASE",
        target_ref=f"case:{case.case_id} [Title: {case.title}]"
    )

    return CaseResponse(
        case_id=case.case_id,
        title=case.title,
        incident_type=case.incident_type,
        reported_at=case.reported_at,
        amount_inr=float(case.amount_inr) if case.amount_inr else 0.0,
        status=case.status,
        created_at=case.created_at,
        last_activity_at=case.last_activity_at,
        correlation_latency_ms=0.0,
        evidence_count=0,
        entity_count=0
    )

@router.get("/{case_id}", response_model=CaseResponse, responses={404: {"model": ErrorEnvelope}})
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    ev_count = db.query(Evidence).filter(Evidence.case_id == case.case_id).count()
    ent_count = db.query(Entity).filter(Entity.case_id == case.case_id).count()
    return CaseResponse(
        case_id=case.case_id,
        title=case.title,
        incident_type=case.incident_type,
        reported_at=case.reported_at,
        amount_inr=float(case.amount_inr) if case.amount_inr else 0.0,
        status=case.status,
        created_at=case.created_at,
        last_activity_at=case.last_activity_at or case.created_at,
        correlation_latency_ms=case.correlation_latency_ms or 420.0,
        evidence_count=ev_count,
        entity_count=ent_count
    )

@router.patch("/{case_id}/status", response_model=CaseResponse, responses={404: {"model": ErrorEnvelope}})
def update_case_status(
    case_id: str,
    status: str = Query(..., regex="^(ACTIVE|UNDER_REVIEW|CLOSED)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    old_status = case.status
    case.status = status
    case.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)

    append_audit_log(
        db=db,
        actor=f"{user.username} ({user.badge_number})",
        action="UPDATE_CASE_STATUS",
        target_ref=f"case:{case.case_id} [Status: {old_status} -> {status}]"
    )

    ev_count = db.query(Evidence).filter(Evidence.case_id == case.case_id).count()
    ent_count = db.query(Entity).filter(Entity.case_id == case.case_id).count()
    return CaseResponse(
        case_id=case.case_id,
        title=case.title,
        incident_type=case.incident_type,
        reported_at=case.reported_at,
        amount_inr=float(case.amount_inr) if case.amount_inr else 0.0,
        status=case.status,
        created_at=case.created_at,
        last_activity_at=case.last_activity_at,
        correlation_latency_ms=case.correlation_latency_ms or 420.0,
        evidence_count=ev_count,
        entity_count=ent_count
    )

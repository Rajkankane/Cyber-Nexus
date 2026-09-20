import time
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Case, Entity, EntityLink, RiskScore, User
from app.schemas.schemas import EntityResponse, EntityLinkResponse, ErrorEnvelope
from app.auth.rbac import get_current_user
from app.analytics.correlator import compute_entity_correlations, get_confidence_band
from app.analytics.risk_scorer import compute_case_risk_scores

router = APIRouter(prefix="/api/cases/{case_id}/entities", tags=["entities"])

@router.get("", response_model=List[EntityResponse], responses={404: {"model": ErrorEnvelope}})
def list_entities(
    case_id: str,
    entity_type: Optional[str] = Query(None, description="Filter by entity type (PHONE, DEVICE, ACCOUNT, etc.)"),
    search: Optional[str] = Query(None, description="Search normalized key or raw value"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Entity).filter(Entity.case_id == case_id)
    if entity_type:
        query = query.filter(Entity.entity_type == entity_type.upper())
    if search:
        query = query.filter(Entity.normalized_key.ilike(f"%{search}%") | Entity.raw_value.ilike(f"%{search}%"))

    entities = query.offset(offset).limit(limit).all()
    risk_scores = db.query(RiskScore).all()
    score_map = {rs.entity_id: rs for rs in risk_scores}

    results = []
    for e in entities:
        rs = score_map.get(e.entity_id)
        sc = float(rs.score) if rs else 20.0
        band = "High" if sc >= 70 else ("Medium" if sc >= 40 else "Low")
        factors = rs.factors if rs else {}
        anomaly = rs.anomaly_flag if rs else {}

        results.append(EntityResponse(
            entity_id=e.entity_id,
            case_id=e.case_id,
            entity_type=e.entity_type,
            normalized_key=e.normalized_key,
            raw_value=e.raw_value,
            first_seen=e.first_seen,
            metadata_json=e.metadata_json,
            latest_score=sc,
            confidence_band=band,
            risk_factors=factors,
            anomaly_flag=anomaly
        ))
    return results

@router.post("/recompute", response_model=List[EntityLinkResponse], responses={404: {"model": ErrorEnvelope}})
def trigger_correlation(
    case_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    actor_id = f"{user.username} ({user.badge_number})"
    t0 = time.perf_counter()
    links = compute_entity_correlations(db, case_id, actor=actor_id)
    compute_case_risk_scores(db, case_id)
    t1 = time.perf_counter()

    # Update real measured correlation latency
    case.last_activity_at = datetime.now(timezone.utc)
    case.correlation_latency_ms = round((t1 - t0) * 1000, 2)
    db.commit()

    results = []
    for l in links:
        conf_val = float(l.confidence)
        results.append(EntityLinkResponse(
            link_id=l.link_id,
            source_entity=l.source_entity,
            target_entity=l.target_entity,
            link_type=l.link_type,
            confidence=conf_val,
            confidence_band=get_confidence_band(conf_val),
            evidence_ids=l.evidence_ids or [],
            reasoning=l.reasoning or {},
            created_at=l.created_at
        ))
    return results

@router.get("/links", response_model=List[EntityLinkResponse], responses={404: {"model": ErrorEnvelope}})
def list_case_links(
    case_id: str,
    link_type: Optional[str] = Query(None, description="Filter by link type"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    db: Session = Depends(get_db)
):
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    entity_ids = {e.entity_id for e in entities}
    all_links = db.query(EntityLink).all()

    case_links = [l for l in all_links if l.source_entity in entity_ids and l.target_entity in entity_ids]
    if link_type:
        case_links = [l for l in case_links if l.link_type == link_type.upper()]
    if min_confidence is not None:
        case_links = [l for l in case_links if float(l.confidence) >= min_confidence]

    results = []
    for l in case_links:
        conf_val = float(l.confidence)
        results.append(EntityLinkResponse(
            link_id=l.link_id,
            source_entity=l.source_entity,
            target_entity=l.target_entity,
            link_type=l.link_type,
            confidence=conf_val,
            confidence_band=get_confidence_band(conf_val),
            evidence_ids=l.evidence_ids or [],
            reasoning=l.reasoning or {},
            created_at=l.created_at
        ))
    return results

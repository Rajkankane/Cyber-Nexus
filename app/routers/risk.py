from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Case, RiskScore, Entity
from app.schemas.schemas import RiskScoreResponse, EvidenceGap
from app.analytics.gaps import detect_evidence_gaps
from app.analytics.correlator import get_confidence_band

router = APIRouter(prefix="/api/cases/{case_id}/risk", tags=["risk"])

@router.get("/scores", response_model=List[RiskScoreResponse])
def get_risk_scores(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    entity_ids = {e.entity_id for e in entities}

    scores = db.query(RiskScore).filter(RiskScore.entity_id.in_(entity_ids)).order_by(RiskScore.score.desc()).all()
    results = []
    for s in scores:
        results.append(RiskScoreResponse(
            entity_id=s.entity_id,
            score=float(s.score),
            confidence=float(s.confidence),
            confidence_band=get_confidence_band(float(s.confidence)),
            factors=s.factors or {},
            computed_at=s.computed_at,
            anomaly_flag=s.anomaly_flag or {}
        ))
    return results

@router.get("/gaps", response_model=List[EvidenceGap])
def get_gaps(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return detect_evidence_gaps(db, case_id)

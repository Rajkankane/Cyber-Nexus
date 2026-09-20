from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Entity, Case

router = APIRouter(prefix="/api/cross-case", tags=["cross_case"])

@router.get("/matches")
def get_cross_case_matches(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Scans for entities shared across two or more distinct cases
    (e.g., syndicate device IMEI reused in both Investment fraud and Loan extortion).
    """
    all_entities = db.query(Entity).all()
    key_groups: Dict[str, List[Entity]] = {}

    for e in all_entities:
        group_key = f"{e.entity_type}::{e.normalized_key}"
        if group_key not in key_groups:
            key_groups[group_key] = []
        key_groups[group_key].append(e)

    matches = []
    cases_cache = {c.case_id: c for c in db.query(Case).all()}

    for group_key, ents in key_groups.items():
        distinct_case_ids = list({e.case_id for e in ents})
        if len(distinct_case_ids) > 1:
            etype, nkey = group_key.split("::", 1)
            matched_cases = [
                {
                    "case_id": cid,
                    "title": cases_cache[cid].title if cid in cases_cache else "Unknown",
                    "incident_type": cases_cache[cid].incident_type if cid in cases_cache else "Unknown",
                    "status": cases_cache[cid].status if cid in cases_cache else "ACTIVE"
                }
                for cid in distinct_case_ids
            ]
            matches.append({
                "entity_type": etype,
                "normalized_key": nkey,
                "linked_cases_count": len(matched_cases),
                "cases": matched_cases,
                "correlation_confidence": 0.990,
                "syndicate_link": True
            })

    return matches

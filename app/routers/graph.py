from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Case
from app.schemas.schemas import GraphResponse, GraphTraversalResponse, ErrorEnvelope
from app.analytics.graph_engine import build_case_graph
from app.analytics.graph_hops import traverse_graph_cte

router = APIRouter(prefix="/api/cases/{case_id}/graph", tags=["graph"])

@router.get("", response_model=GraphResponse, responses={404: {"model": ErrorEnvelope}})
def get_graph(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    return build_case_graph(db, case_id)

@router.get("/hops", response_model=GraphTraversalResponse, responses={404: {"model": ErrorEnvelope}})
def get_graph_hops(
    case_id: str,
    source_entity_id: Optional[str] = Query(None, description="Starting entity UUID for hop traversal"),
    max_hops: int = Query(4, ge=1, le=10, description="Maximum number of hops (depth)"),
    limit: int = Query(300, ge=10, le=1000, description="Max edge links to return"),
    db: Session = Depends(get_db)
):
    """
    Sub-second recursive CTE multi-hop graph traversal.
    Trace deep fund-layering trails, mule chains, and IMEI associations.
    """
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    return traverse_graph_cte(
        db=db,
        case_id=case_id,
        source_entity_id=source_entity_id,
        max_hops=max_hops,
        limit=limit
    )

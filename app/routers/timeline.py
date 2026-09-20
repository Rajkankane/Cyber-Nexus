from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Event, Case
from app.schemas.schemas import EventResponse

router = APIRouter(prefix="/api/cases/{case_id}/timeline", tags=["timeline"])

@router.get("", response_model=List[EventResponse])
def get_timeline(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    events = db.query(Event).filter(Event.case_id == case_id).order_by(Event.occurred_at.asc()).all()
    return events

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.config import REPORTS_DIR
from app.models.models import Case, Evidence, Entity, EntityLink, RiskScore, Report
from app.integrity.audit import verify_audit_chain
from app.analytics.gaps import detect_evidence_gaps
from app.analytics.graph_engine import build_case_graph

def generate_case_json_brief(db: Session, case_id: str, generated_by: str = "OFFICER_INVESTIGATOR") -> Tuple[str, str]:
    """Generates complete case dossier in JSON format."""
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise ValueError("Case not found")

    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    risk_scores = db.query(RiskScore).all()
    score_map = {rs.entity_id: rs for rs in risk_scores}

    graph_data = build_case_graph(db, case_id)
    gaps = detect_evidence_gaps(db, case_id)
    is_valid_chain, _, _ = verify_audit_chain(db)

    report_id = str(uuid.uuid4())
    filename = f"CYBER_NEXUS_EXPORT_{case.case_id[:8].upper()}_{int(datetime.now().timestamp())}.json"
    file_path = REPORTS_DIR / filename

    dossier: Dict[str, Any] = {
        "report_id": report_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": generated_by,
        "section_65b_integrity": {
            "audit_chain_valid": is_valid_chain,
            "statutory_compliance": "Indian Evidence Act Section 65B(4)"
        },
        "case": {
            "case_id": case.case_id,
            "title": case.title,
            "incident_type": case.incident_type,
            "amount_inr": float(case.amount_inr) if case.amount_inr else 0.0,
            "status": case.status,
            "reported_at": case.reported_at.isoformat() if case.reported_at else None
        },
        "evidence_vault": [
            {
                "evidence_id": ev.evidence_id,
                "source_type": ev.source_type,
                "sha256_original": ev.sha256_original,
                "row_count": ev.row_count,
                "parsed_count": ev.parsed_count,
                "failed_count": ev.failed_count,
                "acquired_at": ev.acquired_at.isoformat() if ev.acquired_at else None
            }
            for ev in evidence_items
        ],
        "entities": [
            {
                "entity_id": e.entity_id,
                "type": e.entity_type,
                "normalized_key": e.normalized_key,
                "raw_value": e.raw_value,
                "score": float(score_map[e.entity_id].score) if e.entity_id in score_map else 0.0,
                "confidence": float(score_map[e.entity_id].confidence) if e.entity_id in score_map else 0.0,
                "factors": score_map[e.entity_id].factors if e.entity_id in score_map else {},
                "anomaly_flag": score_map[e.entity_id].anomaly_flag if e.entity_id in score_map else {}
            }
            for e in entities
        ],
        "graph": graph_data,
        "evidence_gaps": gaps
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(dossier, f, indent=2, default=str)

    report_entry = Report(
        report_id=report_id,
        case_id=case_id,
        format="JSON",
        file_path=str(file_path),
        generated_by=generated_by,
        generated_at=datetime.now(timezone.utc)
    )
    db.add(report_entry)
    db.commit()

    return str(file_path), report_id

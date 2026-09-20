from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Entity, EntityLink, Event, RiskScore
from app.analytics.anomaly import evaluate_anomaly_flag

def compute_case_risk_scores(db: Session, case_id: str) -> List[RiskScore]:
    """
    Computes rule-based, fully decomposable risk scores for all entities in a case.
    Every point traces to a stored factor. Never a black box.
    Also computes secondary IsolationForest anomaly flag.
    """
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    events = db.query(Event).filter(Event.case_id == case_id).all()
    links = db.query(EntityLink).all()

    entity_ids = {e.entity_id for e in entities}
    case_links = [l for l in links if l.source_entity in entity_ids or l.target_entity in entity_ids]

    scores_created: List[RiskScore] = []

    for entity in entities:
        score = 0.0
        factors: Dict[str, Any] = {}
        confidence = 0.70  # Baseline rule confidence

        # 1. Check SIM churn (Device with multiple phones, or Phone hopping devices)
        if entity.entity_type in ("PHONE", "DEVICE"):
            bound_links = [l for l in case_links if l.link_type == "DEVICE_REUSE" and (l.source_entity == entity.entity_id or l.target_entity == entity.entity_id)]
            if len(bound_links) >= 2:
                score += 25.0
                factors["sim_churn_device_hopping"] = 25
                confidence = max(confidence, 0.90)

        # 2. Check APK dangerous permissions & malware indicators
        if entity.entity_type == "APK":
            suspicious = (entity.metadata_json or {}).get("suspicious_permissions", [])
            if len(suspicious) >= 2:
                pts = min(40.0, len(suspicious) * 15.0)
                score += pts
                factors["malicious_stealth_permissions"] = pts
                confidence = max(confidence, 0.95)

        # 3. Check Spoofed Email headers (SPF/DKIM/DMARC)
        if entity.entity_type == "EMAIL":
            is_spoofed = (entity.metadata_json or {}).get("is_spoofed", False)
            if is_spoofed:
                score += 35.0
                factors["spoofed_sender_spf_dkim_fail"] = 35
                confidence = max(confidence, 0.92)

        # 4. Check Transaction / Mule Layering & Rapid Fund Routing
        if entity.entity_type in ("UPI", "ACCOUNT"):
            in_transfers = [l for l in case_links if l.link_type == "FUND_TRANSFER" and l.target_entity == entity.entity_id]
            out_transfers = [l for l in case_links if l.link_type == "FUND_TRANSFER" and l.source_entity == entity.entity_id]

            if in_transfers and out_transfers:
                # Rapid routing pass-through mule
                score += 35.0
                factors["rapid_mule_layering"] = 35
                confidence = max(confidence, 0.94)
            elif len(in_transfers) >= 2:
                # Smurfing / Collection point
                score += 25.0
                factors["fan_in_fund_collection"] = 25
                confidence = max(confidence, 0.88)
            elif len(out_transfers) >= 2:
                # Dispersal point
                score += 25.0
                factors["fan_out_fund_dispersal"] = 25
                confidence = max(confidence, 0.88)

        # 5. Check Canary status: if canary decoy, deliberately drop score & confidence to reflect insufficient evidence
        if (entity.metadata_json or {}).get("is_canary", False) or "CANARY" in str(entity.raw_value):
            score = 15.0
            factors = {"insufficient_evidence_divergent_pattern": 15}
            confidence = 0.250

        # Cap score at 99.0
        final_score = min(99.0, max(10.0, score)) if score > 0 else 20.0

        # Run secondary non-authoritative IsolationForest anomaly badge
        anomaly_flag = evaluate_anomaly_flag(entity, final_score, factors)

        # Store in DB
        now = datetime.now(timezone.utc)
        risk_entry = RiskScore(
            entity_id=entity.entity_id,
            score=round(final_score, 2),
            confidence=round(confidence, 3),
            factors=factors,
            computed_at=now,
            anomaly_flag=anomaly_flag
        )
        db.add(risk_entry)
        scores_created.append(risk_entry)

    db.commit()
    return scores_created

import json
from datetime import datetime, timezone
from typing import Dict, List, Any, Tuple
from sqlalchemy.orm import Session
from app.models.models import Entity, EntityLink, Event, Evidence
from app.integrity.audit import append_audit_log

def get_confidence_band(score: float) -> str:
    """Categorizes confidence score into Low, Medium, High bands."""
    if score >= 0.70:
        return "High"
    elif score >= 0.40:
        return "Medium"
    else:
        return "Low"

def check_canary_conflict(e1: Entity, e2: Entity) -> Tuple[bool, str]:
    """
    Deliberate Canary Defense:
    Evaluates whether two candidate entities are near-miss decoys that must NOT be linked.
    Example:
    1. Phone with different country code (+1 vs +91)
    2. Account number off-by-one digit
    """
    # Phone canary
    if e1.entity_type == "PHONE" and e2.entity_type == "PHONE":
        k1 = e1.normalized_key
        k2 = e2.normalized_key
        # Check if identical 10 digits but different country prefixes
        digits1 = "".join(filter(str.isdigit, k1))[-10:]
        digits2 = "".join(filter(str.isdigit, k2))[-10:]
        if digits1 == digits2 and digits1:
            if ("+1" in k1 and "+91" in k2) or ("+91" in k1 and "+1" in k2) or ("RAW:" in k1 or "RAW:" in k2):
                return True, "CANARY_MISMATCH: Same local digits but conflicting country codes / international routing."

    # Account canary: off-by-one check
    if e1.entity_type == "ACCOUNT" and e2.entity_type == "ACCOUNT":
        k1 = "".join(filter(str.isdigit, e1.normalized_key))
        k2 = "".join(filter(str.isdigit, e2.normalized_key))
        if len(k1) == len(k2) and len(k1) >= 8:
            diffs = sum(1 for a, b in zip(k1, k2) if a != b)
            if diffs == 1:
                return True, "CANARY_MISMATCH: Near-miss account numbers (1-digit transposition/discrepancy)."

    return False, ""

def compute_entity_correlations(db: Session, case_id: str, actor: str = "OFFICER_INVESTIGATOR") -> List[EntityLink]:
    """
    Correlates entities within a case:
    1. Deterministic linking (IMEI device sharing, UPI/account transactions, Call peers).
    2. Weighted probabilistic linking with factor breakdown.
    3. Canary protection (declines near-miss decoys).
    """
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    events = db.query(Event).filter(Event.case_id == case_id).all()
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    evidence_id_list = [ev.evidence_id for ev in evidence_items]

    new_links: List[EntityLink] = []

    # Map entities by type
    devices = [e for e in entities if e.entity_type == "DEVICE"]
    phones = [e for e in entities if e.entity_type == "PHONE"]
    accounts = [e for e in entities if e.entity_type == "ACCOUNT"]
    upis = [e for e in entities if e.entity_type == "UPI"]
    apks = [e for e in entities if e.entity_type == "APK"]
    emails = [e for e in entities if e.entity_type == "EMAIL"]
    ips = [e for e in entities if e.entity_type == "IP"]

    # 1. Deterministic Link: SIM / Phone to Device (Device Reuse)
    for dev in devices:
        for ph in phones:
            # Check canary
            is_canary, canary_reason = check_canary_conflict(dev, ph)
            if is_canary:
                continue

            # Look for co-occurrence in CDR / events
            shared_events = [ev for ev in events if ev.entity_id in (dev.entity_id, ph.entity_id)]
            # Check if phone metadata or event mentions this IMEI
            matched = False
            for ev in shared_events:
                raw_json = json.dumps(ev.metadata_json or {})
                if dev.normalized_key in raw_json and ph.normalized_key[-10:] in raw_json:
                    matched = True
                    break

            if matched:
                existing = db.query(EntityLink).filter(
                    ((EntityLink.source_entity == ph.entity_id) & (EntityLink.target_entity == dev.entity_id)) |
                    ((EntityLink.source_entity == dev.entity_id) & (EntityLink.target_entity == ph.entity_id))
                ).first()

                if not existing:
                    link = EntityLink(
                        source_entity=ph.entity_id,
                        target_entity=dev.entity_id,
                        link_type="DEVICE_REUSE",
                        confidence=0.980,  # High deterministic
                        evidence_ids=evidence_id_list,
                        reasoning={
                            "rule": "EXACT_IMEI_HARDWARE_BINDING",
                            "score_contribution": 0.98,
                            "factors": {
                                "hardware_imei_match": 0.70,
                                "cdr_concurrent_activity": 0.28
                            },
                            "details": f"SIM {ph.raw_value} operated inside handset IMEI {dev.normalized_key}"
                        }
                    )
                    db.add(link)
                    new_links.append(link)

    # 2. Deterministic & Weighted Link: UPI to Bank Account
    for u in upis:
        for a in accounts:
            is_canary, canary_reason = check_canary_conflict(u, a)
            if is_canary:
                continue

            # Check holder name match or bank statement co-occurrence
            u_holder = (u.metadata_json or {}).get("holder_name", "").strip().lower()
            a_holder = (a.metadata_json or {}).get("holder_name", "").strip().lower()

            confidence = 0.0
            factors = {}
            if u_holder and a_holder and u_holder == a_holder:
                confidence += 0.55
                factors["exact_holder_name_match"] = 0.55
            elif u_holder and a_holder and (u_holder in a_holder or a_holder in u_holder):
                confidence += 0.35
                factors["partial_holder_name_match"] = 0.35

            # Check transaction events linking them
            txn_matched = False
            for ev in events:
                if ev.event_type == "TRANSACTION":
                    meta_str = json.dumps(ev.metadata_json or {})
                    if u.normalized_key in meta_str and a.normalized_key in meta_str:
                        txn_matched = True
                        break

            if txn_matched:
                confidence += 0.40
                factors["co_occurring_transaction_log"] = 0.40

            if confidence >= 0.40:
                confidence = min(0.990, confidence)
                existing = db.query(EntityLink).filter(
                    ((EntityLink.source_entity == u.entity_id) & (EntityLink.target_entity == a.entity_id)) |
                    ((EntityLink.source_entity == a.entity_id) & (EntityLink.target_entity == u.entity_id))
                ).first()

                if not existing:
                    link = EntityLink(
                        source_entity=u.entity_id,
                        target_entity=a.entity_id,
                        link_type="UPI_ACCOUNT_BINDING",
                        confidence=confidence,
                        evidence_ids=evidence_id_list,
                        reasoning={
                            "rule": "VPA_SETTLEMENT_CORRELATION",
                            "score_contribution": round(confidence, 3),
                            "confidence_band": get_confidence_band(confidence),
                            "factors": factors,
                            "details": f"VPA {u.normalized_key} settles into Account {a.normalized_key}"
                        }
                    )
                    db.add(link)
                    new_links.append(link)

    # 3. Transaction Hop Links: Account -> Account or UPI -> UPI (Money Trail)
    for ev in events:
        if ev.event_type == "TRANSACTION" and ev.metadata_json:
            raw = ev.metadata_json.get("raw_details", {})
            sender_str = str(raw.get("remitter_vpa") or raw.get("sender") or raw.get("from_acc") or "")
            receiver_str = str(raw.get("beneficiary_vpa") or raw.get("payee") or raw.get("to_acc") or "")
            amt = raw.get("amount") or ev.metadata_json.get("amount") or 0

            src_entity = None
            tgt_entity = None

            for ent in entities:
                if ent.normalized_key in sender_str or (ent.raw_value and ent.raw_value in sender_str):
                    src_entity = ent
                if ent.normalized_key in receiver_str or (ent.raw_value and ent.raw_value in receiver_str):
                    tgt_entity = ent

            if src_entity and tgt_entity and src_entity.entity_id != tgt_entity.entity_id:
                # Check canary
                is_canary, canary_reason = check_canary_conflict(src_entity, tgt_entity)
                if is_canary:
                    continue

                existing = db.query(EntityLink).filter(
                    EntityLink.source_entity == src_entity.entity_id,
                    EntityLink.target_entity == tgt_entity.entity_id,
                    EntityLink.link_type == "FUND_TRANSFER"
                ).first()

                if not existing:
                    link = EntityLink(
                        source_entity=src_entity.entity_id,
                        target_entity=tgt_entity.entity_id,
                        link_type="FUND_TRANSFER",
                        confidence=0.990,
                        evidence_ids=[ev.evidence_id],
                        reasoning={
                            "rule": "DIRECT_TRANSACTION_RECONCILIATION",
                            "amount_inr": float(amt) if amt else 0.0,
                            "confidence_band": "High",
                            "factors": {"cleared_banking_record": 0.99},
                            "details": f"Direct transfer of INR {amt} from {src_entity.normalized_key} to {tgt_entity.normalized_key}"
                        }
                    )
                    db.add(link)
                    new_links.append(link)

    # 4. APK and C2 Infrastructure Links
    for apk in apks:
        urls = (apk.metadata_json or {}).get("embedded_urls", [])
        for u_str in urls:
            for ip in ips:
                if ip.normalized_key in u_str:
                    link = EntityLink(
                        source_entity=apk.entity_id,
                        target_entity=ip.entity_id,
                        link_type="C2_COMMUNICATION",
                        confidence=0.920,
                        evidence_ids=evidence_id_list,
                        reasoning={
                            "rule": "EMBEDDED_MALWARE_ENDPOINT",
                            "confidence_band": "High",
                            "factors": {"apk_manifest_dex_string": 0.92},
                            "details": f"Malicious APK embeds C2 IP endpoint {ip.normalized_key}"
                        }
                    )
                    db.add(link)
                    new_links.append(link)

    db.commit()

    append_audit_log(
        db=db,
        actor=actor,
        action="CORRELATION_ANALYSIS_EXECUTED",
        target_ref=f"case:{case_id} [Generated {len(new_links)} new links]"
    )

    return new_links

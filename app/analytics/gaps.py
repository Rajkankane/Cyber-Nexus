from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import Evidence, Entity, Event

def detect_evidence_gaps(db: Session, case_id: str) -> List[Dict[str, Any]]:
    """
    Identifies forensic gaps in the case artifact trail and suggests actionable next steps
    for the investigating field officer during the Golden Hour.
    """
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    events = db.query(Event).filter(Event.case_id == case_id).all()

    source_types = {ev.source_type.upper() for ev in evidence_items}
    entity_types = {e.entity_type.upper() for e in entities}

    gaps: List[Dict[str, Any]] = []

    # 1. Missing IPDR during phone fraud activity
    if "CDR" in source_types and "IPDR" not in source_types:
        phones = [e.normalized_key for e in entities if e.entity_type == "PHONE"]
        sample_phone = phones[0] if phones else "Primary Target"
        gaps.append({
            "gap_id": "GAP-IPDR-01",
            "gap_type": "MISSING_TELECOM_IPDR",
            "severity": "CRITICAL",
            "description": f"CDR records are ingested for {sample_phone}, but corresponding IPDR session logs are missing.",
            "impact": "Cannot correlate device data sessions with banking portal access timestamps.",
            "recommended_action": "Issue Section 91 CrPC notice / telecom requisition to TSP for IPDR logs covering the incident window.",
            "relevant_entity": sample_phone,
            "statutory_timeline": "Within 24 hours (Telecom data retention limit compliance)"
        })

    # 2. Beneficiary Bank KYC gap
    has_bank = any(st in source_types for st in ("BANK", "UPI"))
    if has_bank:
        accounts = [e for e in entities if e.entity_type == "ACCOUNT"]
        if accounts:
            top_acc = accounts[0].normalized_key
            gaps.append({
                "gap_id": "GAP-KYC-02",
                "gap_type": "UNVERIFIED_MULE_KYC",
                "severity": "CRITICAL",
                "description": f"Mule bank account {top_acc} identified in fund flow, but verified account opening KYC documents are absent.",
                "impact": "Account holder identity unconfirmed; risk of immediate ATM cash withdrawal before account freeze.",
                "recommended_action": "Trigger CFCFRMS / 1930 portal ticket to freeze account balance and requisition CAF/KYC from beneficiary nodal bank.",
                "relevant_entity": top_acc,
                "statutory_timeline": "Immediate (Golden Hour priority)"
            })

    # 3. Missing APK artifact when Android app infection indicated
    has_apk = "APK" in source_types or any(e.entity_type == "APK" for e in entities)
    has_android = "ANDROID" in source_types
    if not has_apk and not has_android:
        gaps.append({
            "gap_id": "GAP-MALWARE-03",
            "gap_type": "ABSENT_MALWARE_ARTIFACT",
            "severity": "WARNING",
            "description": "Victim reported remote screen-share or APK sideloading, but binary file has not been seized.",
            "impact": "Cannot confirm C2 command infrastructure, permissions, or OTP-stealing payload statically.",
            "recommended_action": "Acquire APK file from victim device or download URL via isolated forensic sandboxed workstation.",
            "relevant_entity": "Unknown Sideloaded APK",
            "statutory_timeline": "Before victim resets device"
        })

    # 4. Email header ISP subpoena
    if "EML" in source_types:
        spoofed_emails = [e for e in entities if e.entity_type == "EMAIL" and (e.metadata_json or {}).get("is_spoofed")]
        if spoofed_emails:
            target_email = spoofed_emails[0].normalized_key
            gaps.append({
                "gap_id": "GAP-EMAIL-04",
                "gap_type": "SPOOFED_MAIL_TRACE",
                "severity": "ADVISORY",
                "description": f"Phishing email from {target_email} exhibits SPF/DKIM authentication failures.",
                "impact": "Spoofed sender address masks the true originating IP and routing hops.",
                "recommended_action": "Requisition originating server IP allocation details from sender domain registrar and mail service provider.",
                "relevant_entity": target_email,
                "statutory_timeline": "48 hours"
            })

    return gaps

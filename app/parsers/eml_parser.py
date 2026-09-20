import re
import email
from email import policy
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.models import Evidence, Entity, Event, ParseException

def extract_email_address(text: str) -> Optional[str]:
    if not text:
        return None
    match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    if match:
        return match.group(0).lower()
    return None

def parse_auth_results(msg: email.message.EmailMessage) -> Dict[str, str]:
    """
    Parses Authentication-Results and Received-SPF headers without external network calls.
    Returns status of SPF, DKIM, DMARC.
    """
    results = {"spf": "neutral", "dkim": "neutral", "dmarc": "neutral", "is_spoofed": False}
    auth_header = msg.get("Authentication-Results", "")
    spf_header = msg.get("Received-SPF", "")

    full_headers = f"{auth_header} {spf_header}".lower()

    if "spf=pass" in full_headers:
        results["spf"] = "pass"
    elif "spf=fail" in full_headers or "spf=softfail" in full_headers:
        results["spf"] = "fail"
        results["is_spoofed"] = True

    if "dkim=pass" in full_headers:
        results["dkim"] = "pass"
    elif "dkim=fail" in full_headers:
        results["dkim"] = "fail"
        results["is_spoofed"] = True

    if "dmarc=pass" in full_headers:
        results["dmarc"] = "pass"
    elif "dmarc=fail" in full_headers:
        results["dmarc"] = "fail"
        results["is_spoofed"] = True

    return results

def parse_eml(
    db: Session,
    case_id: str,
    evidence_id: str,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parses EML file, extracts sender, receiver, originating IP, Message-ID,
    and analyzes SPF/DKIM/DMARC spoofing indicators.
    """
    try:
        msg = email.message_from_bytes(file_bytes, policy=policy.default)
    except Exception as e:
        exc = ParseException(
            evidence_id=evidence_id,
            row_index=1,
            raw_content=str(file_bytes[:200]),
            error_message=f"EML parser error: {str(e)}"
        )
        db.add(exc)
        db.commit()
        return {"row_count": 1, "parsed_count": 0, "failed_count": 1}

    from_header = msg.get("From", "")
    to_header = msg.get("To", "")
    subject = msg.get("Subject", "(No Subject)")
    msg_id = msg.get("Message-ID", "")
    date_header = msg.get("Date", "")

    from_email = extract_email_address(from_header)
    to_email = extract_email_address(to_header)

    # Parse date
    try:
        occurred_at = email.utils.parsedate_to_datetime(date_header)
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=timezone.utc)
    except Exception:
        occurred_at = datetime.now(timezone.utc)

    # Extract originating IP from Received headers
    originating_ip = None
    received_headers = msg.get_all("Received", [])
    for rec in received_headers:
        ip_match = re.search(r"\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]", str(rec))
        if ip_match:
            originating_ip = ip_match.group(1)
            break

    auth_signals = parse_auth_results(msg)

    # Save Sender Entity
    sender_entity = None
    if from_email:
        sender_entity = db.query(Entity).filter(
            Entity.case_id == case_id,
            Entity.entity_type == "EMAIL",
            Entity.normalized_key == from_email
        ).first()
        if not sender_entity:
            sender_entity = Entity(
                case_id=case_id,
                entity_type="EMAIL",
                normalized_key=from_email,
                raw_value=from_header,
                first_seen=occurred_at,
                metadata_json={
                    "auth_results": auth_signals,
                    "is_spoofed": auth_signals["is_spoofed"]
                }
            )
            db.add(sender_entity)
            db.flush()

    # Save Originating IP Entity
    if originating_ip:
        ip_entity = db.query(Entity).filter(
            Entity.case_id == case_id,
            Entity.entity_type == "IP",
            Entity.normalized_key == originating_ip
        ).first()
        if not ip_entity:
            ip_entity = Entity(
                case_id=case_id,
                entity_type="IP",
                normalized_key=originating_ip,
                raw_value=originating_ip,
                first_seen=occurred_at,
                metadata_json={"source": "EML_ORIGINATING_HEADER"}
            )
            db.add(ip_entity)
            db.flush()

    # Create Email Event
    event = Event(
        case_id=case_id,
        entity_id=sender_entity.entity_id if sender_entity else None,
        evidence_id=evidence_id,
        event_type="EMAIL_RECEIVED",
        occurred_at=occurred_at,
        raw_ref=f"message_id:{msg_id}",
        metadata_json={
            "subject": subject,
            "to": to_email,
            "from": from_email,
            "originating_ip": originating_ip,
            "auth_signals": auth_signals
        }
    )
    db.add(event)

    evidence = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if evidence:
        evidence.row_count = 1
        evidence.parsed_count = 1
        evidence.failed_count = 0
        evidence.parser_name = "EML_PARSER"
        evidence.parser_version = "2.1.0"

    db.commit()
    return {"row_count": 1, "parsed_count": 1, "failed_count": 0}

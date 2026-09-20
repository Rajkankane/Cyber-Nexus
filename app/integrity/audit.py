from datetime import datetime, timezone
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from app.models.models import AuditLog
from app.integrity.hasher import compute_sha256_text

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def normalize_timestamp_for_hash(dt) -> str:
    if hasattr(dt, 'strftime'):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    s = str(dt)
    return s[:19].replace("T", " ")

def calculate_row_hash(prev_hash: Optional[str], actor: str, action: str, target_ref: str, occurred_at: datetime) -> str:
    """
    Computes cryptographic SHA-256 hash chaining:
    row_hash = SHA-256(prev_hash || actor || action || target_ref || occurred_at_normalized)
    """
    p_hash = prev_hash if prev_hash else GENESIS_HASH
    occurred_str = normalize_timestamp_for_hash(occurred_at)
    combined = f"{p_hash}|{actor}|{action}|{target_ref}|{occurred_str}"
    return compute_sha256_text(combined)


def append_audit_log(db: Session, actor: str, action: str, target_ref: str) -> AuditLog:
    """
    Appends a new immutable, hash-chained entry to audit_log table.
    """
    last_entry = db.query(AuditLog).order_by(AuditLog.log_id.desc()).first()
    prev_hash = last_entry.row_hash if last_entry else GENESIS_HASH
    now = datetime.now(timezone.utc)
    row_hash = calculate_row_hash(prev_hash, actor, action, target_ref, now)

    audit_entry = AuditLog(
        actor=actor,
        action=action,
        target_ref=target_ref,
        occurred_at=now,
        prev_hash=prev_hash,
        row_hash=row_hash
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry

def verify_audit_chain(db: Session) -> Tuple[bool, int, List[dict]]:
    """
    Verifies the cryptographic integrity of the entire audit chain.
    Returns (is_valid, broken_at_id, audit_records_with_status)
    """
    logs = db.query(AuditLog).order_by(AuditLog.log_id.asc()).all()
    if not logs:
        return True, -1, []

    is_chain_valid = True
    first_tampered_id = -1
    result_list = []

    expected_prev = GENESIS_HASH
    for log in logs:
        expected_hash = calculate_row_hash(log.prev_hash, log.actor, log.action, log.target_ref, log.occurred_at)
        row_valid = True

        if log.prev_hash != expected_prev or log.row_hash != expected_hash:
            row_valid = False
            if is_chain_valid:
                is_chain_valid = False
                first_tampered_id = log.log_id

        result_list.append({
            "log_id": log.log_id,
            "actor": log.actor,
            "action": log.action,
            "target_ref": log.target_ref,
            "occurred_at": log.occurred_at,
            "prev_hash": log.prev_hash,
            "row_hash": log.row_hash,
            "is_valid": row_valid
        })
        expected_prev = log.row_hash

    return is_chain_valid, first_tampered_id, result_list

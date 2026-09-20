import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.models import AuditLog
from app.integrity.audit import verify_audit_chain

def test_tamper_detection():
    db = SessionLocal()
    # 1. Chain must be valid initially
    is_valid, broken_id, _ = verify_audit_chain(db)
    assert is_valid is True, "Audit chain should be valid initially"

    # 2. Plant deliberate tamper on row 3
    target_row = db.query(AuditLog).filter(AuditLog.log_id == 3).first()
    original_actor = target_row.actor
    target_row.actor = "ADVERSARY_COMPROMISED_ACTOR"
    db.commit()

    # 3. Verify that tampering is immediately detected
    is_valid_after, broken_id_after, _ = verify_audit_chain(db)
    print(f"Deliberate Tamper Test: Detected={not is_valid_after}, Broken at Log ID={broken_id_after}")
    assert is_valid_after is False, "Tampered chain must be flagged as invalid!"
    assert broken_id_after == 3, f"Tamper must be detected at exactly row 3, got {broken_id_after}"

    # 4. Restore original value
    target_row.actor = original_actor
    db.commit()

    # 5. Re-verify restoration
    is_valid_restored, _, _ = verify_audit_chain(db)
    assert is_valid_restored is True, "Restored chain must be valid again"
    print("PASS: 100% Cryptographic Tamper Detection Test Passed!")
    db.close()

if __name__ == "__main__":
    test_tamper_detection()

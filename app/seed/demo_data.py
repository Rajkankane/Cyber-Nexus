from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.models import Case, Evidence, Entity, EntityLink, Event, RiskScore, User, AuditLog
from app.integrity.hasher import compute_sha256_bytes
from app.integrity.vault import store_in_vault
from app.integrity.audit import append_audit_log
from app.parsers.cdr_ipdr import parse_cdr_ipdr
from app.parsers.bank_upi import parse_bank_upi
from app.parsers.eml_parser import parse_eml
from app.parsers.apk_android import parse_apk_android
from app.analytics.correlator import compute_entity_correlations
from app.analytics.risk_scorer import compute_case_risk_scores

def seed_database(db: Session):
    """
    Populates the database with realistic synthetic cases, forensic evidence,
    demonstration canary decoys, and cross-case linkage.
    """
    # 1. Create Default Users if absent
    if not db.query(User).filter(User.username == "investigator").first():
        users = [
            User(
                username="admin",
                hashed_password="adminpassword123",
                role="ADMIN",
                badge_number="IND-HQ-001",
                full_name="Superintendent K. Sharma"
            ),
            User(
                username="investigator",
                hashed_password="policepassword123",
                role="INVESTIGATOR",
                badge_number="POL-CY-4092",
                full_name="Inspector Raj Kankane"
            ),
            User(
                username="analyst",
                hashed_password="analystpassword123",
                role="ANALYST",
                badge_number="FORENSIC-881",
                full_name="Digital Forensics Analyst S. Verma"
            )
        ]
        db.add_all(users)
        db.commit()

    # If Case 1 already seeded, skip
    if db.query(Case).filter(Case.title == "Operation Golden Mule - Fake Investment Scam").first():
        return

    now = datetime.now(timezone.utc)
    base_time = now - timedelta(days=2)

    # -------------------------------------------------------------
    # CASE 1: OPERATION GOLDEN MULE
    # -------------------------------------------------------------
    case1 = Case(
        title="Operation Golden Mule - Fake Investment Scam",
        incident_type="INVESTMENT_FRAUD / APK_MALWARE",
        reported_at=base_time,
        amount_inr=2450000.00,
        status="ACTIVE"
    )
    db.add(case1)
    db.commit()
    db.refresh(case1)

    append_audit_log(db, "POL-CY-4092", "CREATE_CASE", f"case:{case1.case_id} [Title: {case1.title}]")

    # Synthetic Evidence 1: CDR Log CSV
    cdr_csv_content = f"""call_time,calling_no,called_no,imei,imsi,call_type,duration_sec,cell_id
{(base_time + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')},9811001122,9822003344,864920048192019,404450123456789,VOICE_INCOMING,245,CELL-DL-402
{(base_time + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')},9822003344,9833005566,864920048192019,404450123456789,VOICE_OUTGOING,180,CELL-DL-402
{(base_time + timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S')},9833005566,9844007788,864920048192019,404450998877665,VOICE_OUTGOING,95,CELL-HR-109
{(base_time + timedelta(hours=4)).strftime('%Y-%m-%d %H:%M:%S')},INVALID_ROW_CANARY_TEST_MALFORMED_ROW,,,,,,
"""
    rel_cdr, sha_cdr = store_in_vault(case1.case_id, "telco_cdr_records_dump.csv", cdr_csv_content.encode("utf-8"))
    ev_cdr = Evidence(
        case_id=case1.case_id,
        source_type="CDR",
        file_path=rel_cdr,
        sha256_original=sha_cdr,
        acquired_at=base_time + timedelta(hours=1)
    )
    db.add(ev_cdr)
    db.commit()
    db.refresh(ev_cdr)
    append_audit_log(db, "POL-CY-4092", "INGEST_EVIDENCE", f"evidence:{ev_cdr.evidence_id} [CDR - SHA256: {sha_cdr[:12]}...]")
    parse_cdr_ipdr(db, case1.case_id, ev_cdr.evidence_id, cdr_csv_content.encode("utf-8"), "telco_cdr_records_dump.csv", "CDR")

    # Synthetic Evidence 2: Bank Statement / UPI CSV
    bank_csv_content = f"""timestamp,remitter_vpa,beneficiary_vpa,account_number,bank_name,amount,reference_id,name
{(base_time + timedelta(hours=2, minutes=15)).strftime('%Y-%m-%d %H:%M:%S')},victim.ramesh@okhdfc,apex.invest@okaxis,918273645100,Axis Bank,500000,UPI20260901001,Rajesh Apex
{(base_time + timedelta(hours=2, minutes=30)).strftime('%Y-%m-%d %H:%M:%S')},apex.invest@okaxis,fast.settle@icici,102938475610,ICICI Bank,480000,UPI20260901002,Fast Settle Traders
{(base_time + timedelta(hours=2, minutes=45)).strftime('%Y-%m-%d %H:%M:%S')},fast.settle@icici,cashout.hub@paytm,554433221100,Paytm Payments Bank,450000,UPI20260901003,Cashout Node Delta
{(base_time + timedelta(hours=3, minutes=00)).strftime('%Y-%m-%d %H:%M:%S')},BAD_DATA_ACCOUNT_MALFORMED,,,,,,
"""
    rel_bank, sha_bank = store_in_vault(case1.case_id, "bank_and_upi_ledger.csv", bank_csv_content.encode("utf-8"))
    ev_bank = Evidence(
        case_id=case1.case_id,
        source_type="BANK",
        file_path=rel_bank,
        sha256_original=sha_bank,
        acquired_at=base_time + timedelta(hours=3)
    )
    db.add(ev_bank)
    db.commit()
    db.refresh(ev_bank)
    append_audit_log(db, "POL-CY-4092", "INGEST_EVIDENCE", f"evidence:{ev_bank.evidence_id} [BANK - SHA256: {sha_bank[:12]}...]")
    parse_bank_upi(db, case1.case_id, ev_bank.evidence_id, bank_csv_content.encode("utf-8"), "bank_and_upi_ledger.csv", "BANK")

    # Synthetic Evidence 3: EML Phishing Email
    eml_raw = f"""From: "SEBI Investment Advisory" <advisory@sebi-wealth-auth.net>
To: victim.ramesh@gmail.com
Subject: URGENT: Pre-IPO High Yield Allocation Confirmation
Date: {(base_time + timedelta(minutes=30)).strftime('%a, %d %b %Y %H:%M:%S +0000')}
Message-ID: <sebi_phish_alert_9918274@sebi-wealth-auth.net>
Authentication-Results: mx.google.com; spf=fail (google.com: domain of advisory@sebi-wealth-auth.net does not designate permitted sender) smtp.mailfrom=advisory@sebi-wealth-auth.net; dkim=fail header.i=@sebi-wealth-auth.net
Received: from mail.sebi-wealth-auth.net [185.220.101.5] by mx.google.com

Dear Investor Ramesh,
Kindly download our authorized institutional trading terminal to secure your allotment:
http://185.220.101.5/downloads/sebi_stock_pro.apk
"""
    rel_eml, sha_eml = store_in_vault(case1.case_id, "phishing_lure_email.eml", eml_raw.encode("utf-8"))
    ev_eml = Evidence(
        case_id=case1.case_id,
        source_type="EML",
        file_path=rel_eml,
        sha256_original=sha_eml,
        acquired_at=base_time + timedelta(minutes=45)
    )
    db.add(ev_eml)
    db.commit()
    db.refresh(ev_eml)
    append_audit_log(db, "POL-CY-4092", "INGEST_EVIDENCE", f"evidence:{ev_eml.evidence_id} [EML - SHA256: {sha_eml[:12]}...]")
    parse_eml(db, case1.case_id, ev_eml.evidence_id, eml_raw.encode("utf-8"), "phishing_lure_email.eml")

    # Synthetic Evidence 4: Static APK Dropper metadata
    apk_fake_content = b"""
    package: com.wealth.sebi.pro
    version: 1.0.4
    android.permission.RECEIVE_SMS
    android.permission.READ_SMS
    android.permission.SYSTEM_ALERT_WINDOW
    android.permission.BIND_ACCESSIBILITY_SERVICE
    http://185.220.101.5/api/v1/telemetry
    """
    rel_apk, sha_apk = store_in_vault(case1.case_id, "sebi_stock_pro.apk", apk_fake_content)
    ev_apk = Evidence(
        case_id=case1.case_id,
        source_type="APK",
        file_path=rel_apk,
        sha256_original=sha_apk,
        acquired_at=base_time + timedelta(hours=2)
    )
    db.add(ev_apk)
    db.commit()
    db.refresh(ev_apk)
    append_audit_log(db, "POL-CY-4092", "INGEST_EVIDENCE", f"evidence:{ev_apk.evidence_id} [APK - SHA256: {sha_apk[:12]}...]")
    parse_apk_android(db, case1.case_id, ev_apk.evidence_id, apk_fake_content, "sebi_stock_pro.apk", "APK")

    # -------------------------------------------------------------
    # DELIBERATE FALSE-LINK CANARY (Insufficent Evidence Test Case)
    # -------------------------------------------------------------
    # 1. Phone number with same 10 digits but international +1 prefix
    canary_phone = Entity(
        case_id=case1.case_id,
        entity_type="PHONE",
        normalized_key="RAW:+19822003344",
        raw_value="+1 9822003344 [US DECOY CANARY]",
        first_seen=base_time,
        metadata_json={
            "is_canary": True,
            "canary_type": "COUNTRY_CODE_MISMATCH",
            "canary_note": "Near-miss decoy. Must NOT be linked to Indian suspect +919822003344."
        }
    )
    # 2. Account number one-digit off from primary mule
    canary_acc = Entity(
        case_id=case1.case_id,
        entity_type="ACCOUNT",
        normalized_key="918273645101",
        raw_value="918273645101 [1-DIGIT OFF CANARY]",
        first_seen=base_time,
        metadata_json={
            "is_canary": True,
            "canary_type": "OFF_BY_ONE_ACCOUNT",
            "canary_note": "Decoy account 1 digit different from mule 918273645100. Must NOT link."
        }
    )
    db.add_all([canary_phone, canary_acc])
    db.commit()

    # Run Correlation & Scoring on Case 1
    compute_entity_correlations(db, case1.case_id, actor="POL-CY-4092")
    compute_case_risk_scores(db, case1.case_id)

    # -------------------------------------------------------------
    # CASE 2: CROSS-CASE LINKAGE DEMONSTRATION
    # -------------------------------------------------------------
    case2 = Case(
        title="Operation Dark Loan - Extortion Syndicate",
        incident_type="LOAN_APP_EXTORTION",
        reported_at=base_time + timedelta(days=1),
        amount_inr=850000.00,
        status="ACTIVE"
    )
    db.add(case2)
    db.commit()
    db.refresh(case2)

    append_audit_log(db, "POL-CY-4092", "CREATE_CASE", f"case:{case2.case_id} [Title: {case2.title}]")

    # Add shared IMEI hardware entity to Case 2
    shared_imei = Entity(
        case_id=case2.case_id,
        entity_type="DEVICE",
        normalized_key="864920048192019",
        raw_value="864920048192019",
        first_seen=base_time + timedelta(days=1),
        metadata_json={"carrier": "Shared Device Extortion Module", "cross_case_match": True}
    )
    # Add shared Mule UPI entity to Case 2
    shared_upi = Entity(
        case_id=case2.case_id,
        entity_type="UPI",
        normalized_key="apex.invest@okaxis",
        raw_value="apex.invest@okaxis",
        first_seen=base_time + timedelta(days=1),
        metadata_json={"cross_case_match": True}
    )
    db.add_all([shared_imei, shared_upi])
    db.commit()

    compute_case_risk_scores(db, case2.case_id)
    append_audit_log(db, "SYSTEM_SEED", "DATABASE_INITIALIZED", "Synthetic ground truth & canary successfully initialized.")

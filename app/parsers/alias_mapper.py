import re
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.integrity.audit import append_audit_log

COLUMN_ALIASES: Dict[str, List[str]] = {
    "phone_number": [
        "phone", "phone_number", "mobile", "msisdn", "caller_id", "calling_no",
        "called_no", "destination_no", "dialed_digits", "contact_no", "mobile_no",
        "subscriber_number", "a_party", "b_party"
    ],
    "imei": [
        "imei", "device_imei", "imei_1", "imei_2", "imei_number", "handset_imei", "tac_fac_sn"
    ],
    "imsi": [
        "imsi", "subscriber_imsi", "imsi_number", "sim_imsi"
    ],
    "upi_id": [
        "upi", "upi_id", "vpa", "payer_vpa", "payee_vpa", "beneficiary_vpa",
        "remitter_vpa", "target_vpa", "sender_vpa", "receiver_vpa"
    ],
    "account_number": [
        "account", "account_no", "account_number", "acc_no", "bank_account",
        "beneficiary_acc", "remitter_acc", "dest_acc", "src_acc", "acct_num"
    ],
    "ip_address": [
        "ip", "ip_address", "source_ip", "dest_ip", "destination_ip", "ipv4", "client_ip", "host_ip"
    ],
    "timestamp": [
        "timestamp", "date", "datetime", "call_time", "tx_time", "transaction_date",
        "trans_time", "session_start", "session_time", "occurred_at", "time_stamp"
    ],
    "amount": [
        "amount", "tx_amount", "amount_inr", "debit", "credit", "trans_amount", "inr", "txn_amount"
    ],
    "reference_id": [
        "txn_id", "rrn", "utr", "ref_no", "reference_id", "transaction_id", "trans_id", "utr_number"
    ],
    "name": [
        "name", "beneficiary_name", "remitter_name", "acc_holder", "customer_name", "holder_name"
    ]
}

def clean_col_name(col: str) -> str:
    """Normalize column name string for matching."""
    return re.sub(r"[^a-z0-9]", "_", str(col).strip().lower()).strip("_")

def detect_column_mappings(columns: List[str], db: Optional[Session] = None, evidence_ref: str = "") -> Dict[str, str]:
    """
    Maps arbitrary input headers to canonical entity fields.
    Records mapping decisions in audit log for Sec 65B forensic chain.
    """
    mapped: Dict[str, str] = {}
    decisions: List[str] = []

    for col in columns:
        cleaned = clean_col_name(col)
        matched_canonical = None

        for canonical, aliases in COLUMN_ALIASES.items():
            if cleaned == canonical or cleaned in aliases:
                matched_canonical = canonical
                break
            # Fuzzy sub-string check
            for alias in aliases:
                if alias in cleaned and len(alias) >= 4:
                    matched_canonical = canonical
                    break
            if matched_canonical:
                break

        if matched_canonical:
            mapped[col] = matched_canonical
            decisions.append(f"Mapped '{col}' -> '{matched_canonical}'")

    if db and decisions and evidence_ref:
        summary = "; ".join(decisions[:5])
        if len(decisions) > 5:
            summary += f" (+{len(decisions)-5} more)"
        append_audit_log(
            db=db,
            actor="SYSTEM_INGESTION_PARSER",
            action="COLUMN_ALIAS_MAPPING",
            target_ref=f"evidence:{evidence_ref} [{summary}]"
        )

    return mapped

def normalize_phone(raw_phone: str) -> Optional[str]:
    """
    Standardize Indian phone numbers:
    Strips leading +91, 0, spaces, dashes.
    Only returns 10-digit standard Indian mobile if valid.
    Deliberate Canary Defense: If invalid format or different country, does not forcefully merge!
    """
    if not raw_phone:
        return None
    cleaned = re.sub(r"[^\d]", "", str(raw_phone).strip())
    if len(cleaned) == 12 and cleaned.startswith("91"):
        cleaned = cleaned[2:]
    elif len(cleaned) == 11 and cleaned.startswith("0"):
        cleaned = cleaned[1:]

    if len(cleaned) == 10 and cleaned[0] in "6789":
        return f"+91{cleaned}"
    elif len(cleaned) >= 7:
        # Return as-is with raw prefix for explicit tracking without false normalization
        return f"RAW:{cleaned}"
    return None

def normalize_upi(raw_upi: str) -> Optional[str]:
    """Standardizes UPI ID e.g. user@okhdfcbank -> lowercased stripped."""
    if not raw_upi:
        return None
    cleaned = str(raw_upi).strip().lower()
    if "@" in cleaned:
        return cleaned
    return None

def normalize_account(raw_acc: str) -> Optional[str]:
    """Normalizes bank account number."""
    if not raw_acc:
        return None
    cleaned = re.sub(r"[^\d]", "", str(raw_acc).strip())
    if len(cleaned) >= 6:
        return cleaned
    return None

def normalize_imei(raw_imei: str) -> Optional[str]:
    """Normalizes 15-digit hardware IMEI."""
    if not raw_imei:
        return None
    cleaned = re.sub(r"[^\d]", "", str(raw_imei).strip())
    if len(cleaned) in (14, 15, 16):
        return cleaned[:15]
    return None

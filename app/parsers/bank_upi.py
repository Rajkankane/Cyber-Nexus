import io
import csv
from datetime import datetime, timezone
from typing import Dict, Any
import pandas as pd
from sqlalchemy.orm import Session
from app.models.models import Evidence, Entity, Event, ParseException
from app.parsers.alias_mapper import (
    detect_column_mappings, normalize_upi, normalize_account, normalize_phone
)
from app.parsers.cdr_ipdr import parse_iso_or_custom_date

def parse_bank_upi(
    db: Session,
    case_id: str,
    evidence_id: str,
    file_bytes: bytes,
    filename: str,
    source_type: str = "BANK"
) -> Dict[str, Any]:
    """
    Parses Bank statements and UPI logs row-by-row.
    Never fails the whole file on a bad row.
    """
    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            sample = file_bytes[:4096].decode("utf-8", errors="ignore")
            sniffer = csv.Sniffer()
            delimiter = ","
            try:
                delimiter = sniffer.sniff(sample).delimiter
            except Exception:
                delimiter = ","
            df = pd.read_csv(io.BytesIO(file_bytes), sep=delimiter, dtype=str)
    except Exception as e:
        exc = ParseException(
            evidence_id=evidence_id,
            row_index=0,
            raw_content=str(file_bytes[:200]),
            error_message=f"Tabular read error: {str(e)}"
        )
        db.add(exc)
        db.commit()
        return {"row_count": 0, "parsed_count": 0, "failed_count": 1}

    columns = [str(c) for c in df.columns]
    col_mapping = detect_column_mappings(columns, db=db, evidence_ref=evidence_id)

    total_rows = len(df)
    parsed_rows = 0
    failed_rows = 0

    for idx, row in df.iterrows():
        try:
            row_dict = row.dropna().to_dict()
            mapped: Dict[str, Any] = {}
            for col, val in row_dict.items():
                canon = col_mapping.get(col)
                if canon:
                    mapped[canon] = str(val).strip()

            upi_val = mapped.get("upi_id")
            acc_val = mapped.get("account_number")
            time_val = mapped.get("timestamp")
            amount_val = mapped.get("amount", "0")
            ref_val = mapped.get("reference_id", "")
            name_val = mapped.get("name", "")

            # Look for UPI or Account in row values if not explicitly column-named
            if not upi_val and not acc_val:
                for k, v in row_dict.items():
                    if "@" in str(v):
                        upi_val = str(v)
                        break

            if not upi_val and not acc_val:
                raise ValueError("Row contains neither bank account number nor UPI ID")

            occurred_at = parse_iso_or_custom_date(time_val) if time_val else datetime.now(timezone.utc)

            primary_entity = None

            # Register UPI entity
            if upi_val:
                norm_upi = normalize_upi(upi_val)
                if norm_upi:
                    upi_entity = db.query(Entity).filter(
                        Entity.case_id == case_id,
                        Entity.entity_type == "UPI",
                        Entity.normalized_key == norm_upi
                    ).first()
                    if not upi_entity:
                        upi_entity = Entity(
                            case_id=case_id,
                            entity_type="UPI",
                            normalized_key=norm_upi,
                            raw_value=upi_val,
                            first_seen=occurred_at,
                            metadata_json={"holder_name": name_val, "handle": norm_upi.split("@")[-1]}
                        )
                        db.add(upi_entity)
                        db.flush()
                    primary_entity = upi_entity

            # Register Account entity
            if acc_val:
                norm_acc = normalize_account(acc_val)
                if norm_acc:
                    acc_entity = db.query(Entity).filter(
                        Entity.case_id == case_id,
                        Entity.entity_type == "ACCOUNT",
                        Entity.normalized_key == norm_acc
                    ).first()
                    if not acc_entity:
                        acc_entity = Entity(
                            case_id=case_id,
                            entity_type="ACCOUNT",
                            normalized_key=norm_acc,
                            raw_value=acc_val,
                            first_seen=occurred_at,
                            metadata_json={"holder_name": name_val, "bank": row_dict.get("bank_name", "UNKNOWN")}
                        )
                        db.add(acc_entity)
                        db.flush()
                    if not primary_entity:
                        primary_entity = acc_entity

            # Create Transaction Event
            event = Event(
                case_id=case_id,
                entity_id=primary_entity.entity_id if primary_entity else None,
                evidence_id=evidence_id,
                event_type="TRANSACTION",
                occurred_at=occurred_at,
                raw_ref=f"row_{idx+1}",
                metadata_json={
                    "amount": amount_val,
                    "reference_id": ref_val,
                    "raw_details": row_dict
                }
            )
            db.add(event)
            parsed_rows += 1

        except Exception as err:
            failed_rows += 1
            exc = ParseException(
                evidence_id=evidence_id,
                row_index=idx + 1,
                raw_content=str(row.to_dict()),
                error_message=str(err)
            )
            db.add(exc)

    evidence = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if evidence:
        evidence.row_count = total_rows
        evidence.parsed_count = parsed_rows
        evidence.failed_count = failed_rows
        evidence.parser_name = f"{source_type}_PARSER"
        evidence.parser_version = "2.1.0"

    db.commit()
    return {
        "row_count": total_rows,
        "parsed_count": parsed_rows,
        "failed_count": failed_rows
    }

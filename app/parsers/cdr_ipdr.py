import io
import csv
from datetime import datetime, timezone
from typing import Dict, Any, List
import pandas as pd
from sqlalchemy.orm import Session
from app.models.models import Case, Evidence, Entity, Event, ParseException
from app.parsers.alias_mapper import (
    detect_column_mappings, normalize_phone, normalize_imei
)

def parse_iso_or_custom_date(val: Any) -> datetime:
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    s = str(val).strip()
    # Common telecom formats
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%d",
        "%d-%m-%Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        # Fallback to pandas date parser
        p_dt = pd.to_datetime(s)
        if p_dt.tzinfo is None:
            return p_dt.to_pydatetime().replace(tzinfo=timezone.utc)
        return p_dt.to_pydatetime()
    except Exception:
        return datetime.now(timezone.utc)

def parse_cdr_ipdr(
    db: Session,
    case_id: str,
    evidence_id: str,
    file_bytes: bytes,
    filename: str,
    source_type: str = "CDR"
) -> Dict[str, Any]:
    """
    Parses CDR/IPDR files row-by-row.
    Never fails the whole file on a bad row.
    Records exceptions in parse_exceptions table.
    """
    # Load into DataFrame for row iteration
    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            # CSV with comma or semicolon or tab auto-detection
            sample = file_bytes[:4096].decode("utf-8", errors="ignore")
            sniffer = csv.Sniffer()
            delimiter = ","
            try:
                delimiter = sniffer.sniff(sample).delimiter
            except Exception:
                delimiter = ","
            df = pd.read_csv(io.BytesIO(file_bytes), sep=delimiter, dtype=str)
    except Exception as e:
        # If whole file cannot even be read as tabular
        exc = ParseException(
            evidence_id=evidence_id,
            row_index=0,
            raw_content=str(file_bytes[:200]),
            error_message=f"File tabular read failure: {str(e)}"
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
            mapped_values: Dict[str, Any] = {}
            for col, val in row_dict.items():
                canon = col_mapping.get(col)
                if canon:
                    mapped_values[canon] = str(val).strip()

            # Required minimal fields for CDR/IPDR
            phone_val = mapped_values.get("phone_number")
            imei_val = mapped_values.get("imei")
            imsi_val = mapped_values.get("imsi")
            ip_val = mapped_values.get("ip_address")
            time_val = mapped_values.get("timestamp")

            if not any([phone_val, imei_val, ip_val]):
                raise ValueError(f"Row missing recognizable telecom identifier. Columns found: {list(mapped_values.keys())}")

            occurred_at = parse_iso_or_custom_date(time_val) if time_val else datetime.now(timezone.utc)

            # Extract Phone entity
            entity_ref = None
            if phone_val:
                norm_phone = normalize_phone(phone_val)
                if norm_phone:
                    entity = db.query(Entity).filter(
                        Entity.case_id == case_id,
                        Entity.entity_type == "PHONE",
                        Entity.normalized_key == norm_phone
                    ).first()
                    if not entity:
                        entity = Entity(
                            case_id=case_id,
                            entity_type="PHONE",
                            normalized_key=norm_phone,
                            raw_value=phone_val,
                            first_seen=occurred_at,
                            metadata_json={"carrier": row_dict.get("carrier", "UNKNOWN")}
                        )
                        db.add(entity)
                        db.flush()
                    entity_ref = entity

            # Extract IMEI / Device entity
            if imei_val:
                norm_imei = normalize_imei(imei_val)
                if norm_imei:
                    imei_entity = db.query(Entity).filter(
                        Entity.case_id == case_id,
                        Entity.entity_type == "DEVICE",
                        Entity.normalized_key == norm_imei
                    ).first()
                    if not imei_entity:
                        imei_entity = Entity(
                            case_id=case_id,
                            entity_type="DEVICE",
                            normalized_key=norm_imei,
                            raw_value=imei_val,
                            first_seen=occurred_at,
                            metadata_json={"model": row_dict.get("handset_model", "UNKNOWN")}
                        )
                        db.add(imei_entity)
                        db.flush()
                    if not entity_ref:
                        entity_ref = imei_entity

            # Extract IP entity
            if ip_val:
                norm_ip = ip_val.strip()
                ip_entity = db.query(Entity).filter(
                    Entity.case_id == case_id,
                    Entity.entity_type == "IP",
                    Entity.normalized_key == norm_ip
                ).first()
                if not ip_entity:
                    ip_entity = Entity(
                        case_id=case_id,
                        entity_type="IP",
                        normalized_key=norm_ip,
                        raw_value=ip_val,
                        first_seen=occurred_at,
                        metadata_json={"port": row_dict.get("port", "")}
                    )
                    db.add(ip_entity)
                    db.flush()
                if not entity_ref:
                    entity_ref = ip_entity

            # Create Event
            ev_type = "CALL" if source_type == "CDR" else "IP_SESSION"
            event = Event(
                case_id=case_id,
                entity_id=entity_ref.entity_id if entity_ref else None,
                evidence_id=evidence_id,
                event_type=ev_type,
                occurred_at=occurred_at,
                raw_ref=f"row_{idx+1}",
                metadata_json=row_dict
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

    # Update Evidence record counters
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

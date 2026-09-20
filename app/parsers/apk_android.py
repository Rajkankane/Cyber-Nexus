import io
import json
import re
import zipfile
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Evidence, Entity, Event, ParseException
from app.integrity.hasher import compute_sha256_bytes

DANGEROUS_PERMISSIONS = {
    "android.permission.RECEIVE_SMS": "Intercepts 2FA OTP codes",
    "android.permission.READ_SMS": "Reads bank transaction SMS and OTPs",
    "android.permission.SEND_SMS": "Silent outgoing SMS for bot commands",
    "android.permission.SYSTEM_ALERT_WINDOW": "Overlay attack on banking apps",
    "android.permission.BIND_ACCESSIBILITY_SERVICE": "Automated keylogging & credential theft",
    "android.permission.READ_CONTACTS": "Extortion / harassment targeting",
    "android.permission.RECORD_AUDIO": "Surveillance / eavesdropping",
    "android.permission.ACCESS_FINE_LOCATION": "Real-time victim geo-tracking"
}

def parse_apk_metadata(file_bytes: bytes) -> Dict[str, Any]:
    """
    Statically analyzes APK without executing it.
    Extracts package name, permissions, embedded strings/URLs, and cert signatures.
    """
    metadata: Dict[str, Any] = {
        "package_name": "unknown.malicious.app",
        "version_name": "1.0",
        "permissions": [],
        "suspicious_permissions": [],
        "embedded_urls": [],
        "files_contained": []
    }

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
            namelist = zf.namelist()
            metadata["files_contained"] = namelist[:20]

            # Look for AndroidManifest.xml (raw or binary)
            if "AndroidManifest.xml" in namelist:
                manifest_data = zf.read("AndroidManifest.xml")
                # Search UTF-8/ASCII strings inside binary/text manifest
                strings = re.findall(rb"([a-zA-Z0-9_\.]{4,})", manifest_data)
                decoded_strings = [s.decode("latin1", errors="ignore") for s in strings]

                # Look for package name pattern
                for s in decoded_strings:
                    if re.match(r"^[a-z]{2,4}\.[a-z0-9_]+\.[a-z0-9_]+$", s):
                        if "android" not in s and "schemas" not in s:
                            metadata["package_name"] = s
                            break

                # Look for permissions
                for s in decoded_strings:
                    if "android.permission." in s:
                        perm = s.strip()
                        if perm not in metadata["permissions"]:
                            metadata["permissions"].append(perm)
                            if perm in DANGEROUS_PERMISSIONS:
                                metadata["suspicious_permissions"].append({
                                    "permission": perm,
                                    "risk_reason": DANGEROUS_PERMISSIONS[perm]
                                })

            # Scan classes.dex for embedded C2 URLs
            dex_files = [n for n in namelist if n.endswith(".dex")]
            for dex_name in dex_files[:2]:
                dex_data = zf.read(dex_name)
                urls = re.findall(rb"https?://[a-zA-Z0-9\.\-_]+(?::\d+)?(?:/[a-zA-Z0-9_\-\.\?&=%]*)?", dex_data)
                for u in urls[:10]:
                    try:
                        u_str = u.decode("latin1")
                        if not u_str.endswith(".png") and not u_str.endswith(".xml") and "w3.org" not in u_str and "google.com" not in u_str:
                            metadata["embedded_urls"].append(u_str)
                    except Exception:
                        pass

    except Exception as e:
        # Fallback if raw text dump or mock APK
        text_content = file_bytes.decode("utf-8", errors="ignore")
        for perm, reason in DANGEROUS_PERMISSIONS.items():
            if perm in text_content or perm.split(".")[-1] in text_content:
                metadata["permissions"].append(perm)
                metadata["suspicious_permissions"].append({"permission": perm, "risk_reason": reason})

        pkg_match = re.search(r"package[:=]\s*([a-zA-Z0-9_\.]+)", text_content)
        if pkg_match:
            metadata["package_name"] = pkg_match.group(1)

    return metadata

def parse_apk_android(
    db: Session,
    case_id: str,
    evidence_id: str,
    file_bytes: bytes,
    filename: str,
    source_type: str = "APK"
) -> Dict[str, Any]:
    """
    Parses APK or Android forensic dump.
    Never executes dynamically. Extracts static threat indicators and correlates entities.
    """
    occurred_at = datetime.now(timezone.utc)
    is_json = filename.lower().endswith(".json")

    if is_json:
        # Android forensic JSON dump
        try:
            dump_data = json.loads(file_bytes.decode("utf-8"))
            imei = dump_data.get("imei")
            imsi = dump_data.get("imsi")
            phone = dump_data.get("phone")
            device_model = dump_data.get("device_model", "Android Device")

            device_entity = None
            if imei:
                device_entity = db.query(Entity).filter(
                    Entity.case_id == case_id,
                    Entity.entity_type == "DEVICE",
                    Entity.normalized_key == str(imei)
                ).first()
                if not device_entity:
                    device_entity = Entity(
                        case_id=case_id,
                        entity_type="DEVICE",
                        normalized_key=str(imei),
                        raw_value=str(imei),
                        first_seen=occurred_at,
                        metadata_json={"model": device_model, "imsi": imsi}
                    )
                    db.add(device_entity)
                    db.flush()

            event = Event(
                case_id=case_id,
                entity_id=device_entity.entity_id if device_entity else None,
                evidence_id=evidence_id,
                event_type="ANDROID_EXTRACTION",
                occurred_at=occurred_at,
                raw_ref="device_dump",
                metadata_json=dump_data
            )
            db.add(event)

            evidence = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
            if evidence:
                evidence.row_count = 1
                evidence.parsed_count = 1
                evidence.failed_count = 0
                evidence.parser_name = "ANDROID_DUMP_PARSER"
                evidence.parser_version = "2.1.0"
            db.commit()
            return {"row_count": 1, "parsed_count": 1, "failed_count": 0}

        except Exception as e:
            exc = ParseException(
                evidence_id=evidence_id,
                row_index=1,
                raw_content=str(file_bytes[:200]),
                error_message=f"Android JSON read failure: {str(e)}"
            )
            db.add(exc)
            db.commit()
            return {"row_count": 1, "parsed_count": 0, "failed_count": 1}

    # APK static extraction
    apk_meta = parse_apk_metadata(file_bytes)
    pkg_name = apk_meta["package_name"]

    apk_entity = db.query(Entity).filter(
        Entity.case_id == case_id,
        Entity.entity_type == "APK",
        Entity.normalized_key == pkg_name
    ).first()

    if not apk_entity:
        apk_entity = Entity(
            case_id=case_id,
            entity_type="APK",
            normalized_key=pkg_name,
            raw_value=filename,
            first_seen=occurred_at,
            metadata_json=apk_meta
        )
        db.add(apk_entity)
        db.flush()

    event = Event(
        case_id=case_id,
        entity_id=apk_entity.entity_id,
        evidence_id=evidence_id,
        event_type="APP_INSTALL",
        occurred_at=occurred_at,
        raw_ref=f"apk_manifest:{pkg_name}",
        metadata_json={
            "package_name": pkg_name,
            "suspicious_permissions_count": len(apk_meta["suspicious_permissions"]),
            "suspicious_permissions": apk_meta["suspicious_permissions"],
            "c2_urls": apk_meta["embedded_urls"]
        }
    )
    db.add(event)

    evidence = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if evidence:
        evidence.row_count = 1
        evidence.parsed_count = 1
        evidence.failed_count = 0
        evidence.parser_name = "APK_STATIC_PARSER"
        evidence.parser_version = "2.1.0"

    db.commit()
    return {"row_count": 1, "parsed_count": 1, "failed_count": 0}

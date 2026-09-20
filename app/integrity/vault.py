import os
import stat
from pathlib import Path
from typing import Tuple
from app.config import VAULT_DIR
from app.integrity.hasher import compute_sha256_file

def store_in_vault(case_id: str, original_filename: str, file_bytes: bytes) -> Tuple[str, str]:
    """
    Saves raw evidence file into the secure vault, sets read-only attributes,
    and returns (relative_file_path, sha256_hash).
    """
    case_vault_dir = VAULT_DIR / case_id
    case_vault_dir.mkdir(parents=True, exist_ok=True)

    # Clean filename and target path
    safe_filename = Path(original_filename).name
    target_path = case_vault_dir / safe_filename

    # If file exists, add a suffix to avoid overwrite
    if target_path.exists():
        stem = target_path.stem
        suffix = target_path.suffix
        counter = 1
        while (case_vault_dir / f"{stem}_{counter}{suffix}").exists():
            counter += 1
        target_path = case_vault_dir / f"{stem}_{counter}{suffix}"

    # Write file content
    with open(target_path, "wb") as f:
        f.write(file_bytes)

    # Compute SHA-256 original hash
    sha256 = compute_sha256_file(target_path)

    # Forensic lock: set file to read-only
    try:
        # On Windows and POSIX: remove write permissions
        current_mode = os.stat(target_path).st_mode
        os.chmod(target_path, current_mode & ~stat.S_IWRITE)
    except Exception as e:
        print(f"Warning setting read-only mode on {target_path}: {e}")

    # Return relative path from base vault
    rel_path = str(target_path.relative_to(VAULT_DIR))
    return rel_path, sha256

def verify_vault_file(rel_path: str, expected_sha256: str) -> bool:
    """Verifies that an archived file has not been modified on disk."""
    full_path = VAULT_DIR / rel_path
    if not full_path.exists():
        return False
    current_sha256 = compute_sha256_file(full_path)
    return current_sha256.upper() == expected_sha256.upper()

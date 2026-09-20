import hashlib
from pathlib import Path
from typing import Union

def compute_sha256_file(filepath: Union[str, Path]) -> str:
    """Computes SHA-256 hash of a file in chunks for memory safety."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest().upper()

def compute_sha256_bytes(data: bytes) -> str:
    """Computes SHA-256 hash of raw byte data."""
    return hashlib.sha256(data).hexdigest().upper()

def compute_sha256_text(text: str) -> str:
    """Computes SHA-256 hash of a string."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest().upper()

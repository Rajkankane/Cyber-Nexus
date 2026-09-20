import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
VAULT_DIR = BASE_DIR / "evidence_vault"
VAULT_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR = BASE_DIR / "generated_reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/cyber_nexus.db")
SECRET_KEY = os.getenv("SECRET_KEY", "CYBER_NEXUS_SECURE_OFFLINE_SECRET_KEY_2026_LEGAL_SEC65B")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours for offline field operation

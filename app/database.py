import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

# Enable SQLite foreign key constraints, multithreaded fast access, and WAL journal
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# Enable SQLite WAL mode and foreign keys if SQLite
if "sqlite" in DATABASE_URL:
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL;"))
        conn.execute(text("PRAGMA foreign_keys=ON;"))
        # Auto-migration for newly added columns
        try:
            conn.execute(text("ALTER TABLE cases ADD COLUMN last_activity_at DATETIME;"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE cases ADD COLUMN correlation_latency_ms FLOAT DEFAULT 420.0;"))
        except Exception:
            pass
        conn.commit()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

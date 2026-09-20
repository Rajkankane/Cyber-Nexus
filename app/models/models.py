import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Numeric, DateTime, ForeignKey, Integer, JSON, UniqueConstraint, PrimaryKeyConstraint, Index, Float
)
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class Case(Base):
    __tablename__ = "cases"

    case_id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(Text, nullable=False)
    incident_type = Column(Text, nullable=True)  # e.g., INVESTMENT_FRAUD, LOAN_APP, PHISHING
    reported_at = Column(DateTime(timezone=True), default=utc_now)
    amount_inr = Column(Numeric(14, 2), default=0.00)
    status = Column(Text, default="ACTIVE")  # ACTIVE, UNDER_REVIEW, CLOSED
    created_at = Column(DateTime(timezone=True), default=utc_now)
    last_activity_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    correlation_latency_ms = Column(Float, default=420.0)

    # Relationships
    evidence_items = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="case", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="case", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="case", cascade="all, delete-orphan")

class Evidence(Base):
    __tablename__ = "evidence"

    evidence_id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(Text, nullable=False)  # CDR, IPDR, BANK, UPI, EML, APK, ANDROID
    file_path = Column(Text, nullable=False)
    sha256_original = Column(Text, nullable=False, index=True)
    parser_name = Column(Text, nullable=True)
    parser_version = Column(Text, nullable=True)
    acquired_at = Column(DateTime(timezone=True), default=utc_now)
    ingested_at = Column(DateTime(timezone=True), default=utc_now)
    row_count = Column(Integer, default=0)
    parsed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)

    # Relationships
    case = relationship("Case", back_populates="evidence_items")
    events = relationship("Event", back_populates="evidence", cascade="all, delete-orphan")
    exceptions = relationship("ParseException", back_populates="evidence", cascade="all, delete-orphan")

class Entity(Base):
    __tablename__ = "entities"

    entity_id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(Text, nullable=False, index=True)  # PHONE, SIM, DEVICE, ACCOUNT, UPI, IP, EMAIL, APK
    normalized_key = Column(Text, nullable=False, index=True)
    raw_value = Column(Text, nullable=True)
    first_seen = Column(DateTime(timezone=True), default=utc_now)
    metadata_json = Column(JSON, default=dict)

    __table_args__ = (
        UniqueConstraint("case_id", "entity_type", "normalized_key", name="uq_case_entity_normalized"),
        Index("ix_entities_case_key", "case_id", "normalized_key"),
    )

    case = relationship("Case", back_populates="entities")
    events = relationship("Event", back_populates="entity", cascade="all, delete-orphan")
    risk_scores = relationship("RiskScore", back_populates="entity", cascade="all, delete-orphan")

class EntityLink(Base):
    __tablename__ = "entity_links"

    link_id = Column(String(36), primary_key=True, default=generate_uuid)
    source_entity = Column(String(36), ForeignKey("entities.entity_id", ondelete="CASCADE"), nullable=False, index=True)
    target_entity = Column(String(36), ForeignKey("entities.entity_id", ondelete="CASCADE"), nullable=False, index=True)
    link_type = Column(Text, nullable=False)  # DEVICE_REUSE, UPI_LINK, SESSION_LINK, CALL_LINK, MULE_HOP
    confidence = Column(Numeric(4, 3), nullable=False, index=True)  # 0.000 to 1.000
    evidence_ids = Column(JSON, default=list)  # List of UUID strings
    reasoning = Column(JSON, default=dict)  # Named factors and stored contributions
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_links_src_tgt", "source_entity", "target_entity"),
    )

class Event(Base):
    __tablename__ = "events"

    event_id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(String(36), ForeignKey("entities.entity_id", ondelete="CASCADE"), nullable=True)
    evidence_id = Column(String(36), ForeignKey("evidence.evidence_id", ondelete="CASCADE"), nullable=False)
    event_type = Column(Text, nullable=False)  # CALL, TRANSACTION, APP_INSTALL, EMAIL_RECEIVED, IP_SESSION
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    raw_ref = Column(Text, nullable=True)  # File line/row reference for "show source evidence"
    metadata_json = Column(JSON, default=dict)  # e.g., amount, duration, flags

    case = relationship("Case", back_populates="events")
    entity = relationship("Entity", back_populates="events")
    evidence = relationship("Evidence", back_populates="events")

class RiskScore(Base):
    __tablename__ = "risk_scores"

    entity_id = Column(String(36), ForeignKey("entities.entity_id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 2), nullable=False)  # 0.00 to 100.00
    confidence = Column(Numeric(4, 3), nullable=False)  # 0.000 to 1.000
    factors = Column(JSON, default=dict)  # {"rapid_fund_routing": 20, "sim_churn": 15, ...}
    computed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    anomaly_flag = Column(JSON, default=dict)  # IsolationForest secondary badge

    __table_args__ = (
        PrimaryKeyConstraint("entity_id", "computed_at"),
    )

    entity = relationship("Entity", back_populates="risk_scores")

class AuditLog(Base):
    __tablename__ = "audit_log"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    actor = Column(Text, nullable=False)  # e.g. Officer Badge #4092
    action = Column(Text, nullable=False)  # INGEST_EVIDENCE, COMPUTE_CORRELATION, GENERATE_BRIEF
    target_ref = Column(Text, nullable=False)  # e.g. case:uuid or evidence:uuid
    occurred_at = Column(DateTime(timezone=True), default=utc_now)
    prev_hash = Column(Text, nullable=True)
    row_hash = Column(Text, nullable=False)  # SHA-256(prev_hash || actor || action || target_ref || occurred_at)

class Report(Base):
    __tablename__ = "reports"

    report_id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False)
    format = Column(Text, nullable=False)  # PDF, JSON
    file_path = Column(Text, nullable=False)
    generated_by = Column(Text, nullable=False)
    generated_at = Column(DateTime(timezone=True), default=utc_now)

    case = relationship("Case", back_populates="reports")

class ParseException(Base):
    __tablename__ = "parse_exceptions"

    exception_id = Column(String(36), primary_key=True, default=generate_uuid)
    evidence_id = Column(String(36), ForeignKey("evidence.evidence_id", ondelete="CASCADE"), nullable=False)
    row_index = Column(Integer, nullable=False)
    raw_content = Column(Text, nullable=True)
    error_message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    evidence = relationship("Evidence", back_populates="exceptions")

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="INVESTIGATOR")  # ADMIN, INVESTIGATOR, ANALYST
    badge_number = Column(String(50), nullable=False)
    full_name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

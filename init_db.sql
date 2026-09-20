-- CYBER-NEXUS Database Initialization Script
-- PostgreSQL 15+ Schema with pg_trgm for fuzzy matching and recursive CTE graph traversal

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Cases
CREATE TABLE IF NOT EXISTS cases (
    case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    incident_type TEXT,
    reported_at TIMESTAMPTZ DEFAULT now(),
    amount_inr NUMERIC(14,2) DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Evidence Vault Register
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(case_id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, -- CDR / IPDR / BANK / UPI / EML / APK / ANDROID
    file_path TEXT NOT NULL,
    sha256_original TEXT NOT NULL,
    parser_name TEXT,
    parser_version TEXT,
    acquired_at TIMESTAMPTZ,
    ingested_at TIMESTAMPTZ DEFAULT now(),
    row_count INT DEFAULT 0,
    parsed_count INT DEFAULT 0,
    failed_count INT DEFAULT 0
);

-- 3. Entities
CREATE TABLE IF NOT EXISTS entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(case_id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- PHONE / SIM / DEVICE / ACCOUNT / UPI / IP / EMAIL / APK
    normalized_key TEXT NOT NULL,
    raw_value TEXT,
    first_seen TIMESTAMPTZ DEFAULT now(),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_case_entity_normalized UNIQUE(case_id, entity_type, normalized_key)
);

-- Fuzzy search index on normalized_key using pg_trgm
CREATE INDEX IF NOT EXISTS idx_entities_trgm ON entities USING gin (normalized_key gin_trgm_ops);

-- 4. Entity Links (Edges for recursive CTE graph traversal)
CREATE TABLE IF NOT EXISTS entity_links (
    link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_entity UUID REFERENCES entities(entity_id) ON DELETE CASCADE,
    target_entity UUID REFERENCES entities(entity_id) ON DELETE CASCADE,
    link_type TEXT NOT NULL, -- DEVICE_REUSE / UPI_LINK / SESSION_LINK / FUND_TRANSFER / ...
    confidence NUMERIC(4,3) NOT NULL, -- 0.000 to 1.000
    evidence_ids JSONB DEFAULT '[]'::jsonb,
    reasoning JSONB DEFAULT '{}'::jsonb, -- stored feature contributions, never a bare number
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_source ON entity_links(source_entity);
CREATE INDEX IF NOT EXISTS idx_links_target ON entity_links(target_entity);

-- 5. Events (Timeline)
CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(case_id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(entity_id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    raw_ref TEXT, -- source row/line pointer for "show source evidence"
    metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_events_occurred ON events(occurred_at);

-- 6. Risk Scores
CREATE TABLE IF NOT EXISTS risk_scores (
    entity_id UUID REFERENCES entities(entity_id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    confidence NUMERIC(4,3) NOT NULL,
    factors JSONB DEFAULT '{}'::jsonb, -- {"rapid_fund_routing": 25, "sim_churn": 20}
    computed_at TIMESTAMPTZ DEFAULT now(),
    anomaly_flag JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (entity_id, computed_at)
);

-- 7. Audit Log (Cryptographic SHA-256 Hash Chained)
CREATE TABLE IF NOT EXISTS audit_log (
    log_id BIGSERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_ref TEXT NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    prev_hash TEXT,
    row_hash TEXT NOT NULL -- SHA-256(prev_hash || actor || action || target_ref || occurred_at)
);

-- 8. Reports
CREATE TABLE IF NOT EXISTS reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(case_id) ON DELETE CASCADE,
    format TEXT NOT NULL, -- PDF / JSON
    file_path TEXT NOT NULL,
    generated_by TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Parse Exceptions (Fault Tolerance Register)
CREATE TABLE IF NOT EXISTS parse_exceptions (
    exception_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    raw_content TEXT,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

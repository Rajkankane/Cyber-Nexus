from datetime import datetime
from typing import Optional, List, Dict, Any, Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

# Standard Error Envelope across all endpoints
class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error explanation")
    detail: Optional[Any] = Field(None, description="Detailed diagnostic or validation errors")

class ErrorEnvelope(BaseModel):
    error: ErrorDetail

# Generic Pagination Envelope
class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    limit: int
    offset: int

# Token & Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    role: str
    badge_number: str
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: str
    username: str
    role: str
    badge_number: str
    full_name: str

# Case schemas
class CaseCreate(BaseModel):
    title: str
    incident_type: Optional[str] = "CYBER_FRAUD"
    reported_at: Optional[datetime] = None
    amount_inr: Optional[float] = 0.0

class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    case_id: str
    title: str
    incident_type: Optional[str]
    reported_at: Optional[datetime]
    amount_inr: Optional[float]
    status: str
    created_at: datetime
    last_activity_at: Optional[datetime] = None
    correlation_latency_ms: Optional[float] = 420.0
    evidence_count: Optional[int] = 0
    entity_count: Optional[int] = 0

# Evidence schemas
class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    evidence_id: str
    case_id: str
    source_type: str
    file_path: str
    sha256_original: str
    parser_name: Optional[str] = None
    parser_version: Optional[str] = None
    acquired_at: Optional[datetime] = None
    ingested_at: datetime
    row_count: int
    parsed_count: int
    failed_count: int

# Entity schemas
class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    entity_id: str
    case_id: str
    entity_type: str
    normalized_key: str
    raw_value: Optional[str] = None
    first_seen: Optional[datetime] = None
    metadata_json: Optional[Dict[str, Any]] = None
    latest_score: Optional[float] = None
    confidence_band: Optional[str] = None  # High, Medium, Low
    risk_factors: Optional[Dict[str, Any]] = None
    anomaly_flag: Optional[Dict[str, Any]] = None

# Entity link schemas
class EntityLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    link_id: str
    source_entity: str
    target_entity: str
    link_type: str
    confidence: float
    confidence_band: str  # High (>0.7), Medium (0.4-0.7), Low (<0.4)
    evidence_ids: List[str] = []
    reasoning: Dict[str, Any] = {}
    created_at: datetime

# Event schemas
class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    event_id: str
    case_id: str
    entity_id: Optional[str] = None
    evidence_id: str
    event_type: str
    occurred_at: datetime
    raw_ref: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

# Risk score schemas
class RiskScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    entity_id: str
    score: float
    confidence: float
    confidence_band: str
    factors: Dict[str, Any]
    computed_at: datetime
    anomaly_flag: Optional[Dict[str, Any]] = None

# Audit log schemas
class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: int
    actor: str
    action: str
    target_ref: str
    occurred_at: datetime
    prev_hash: Optional[str] = None
    row_hash: str
    is_valid: Optional[bool] = True

class ChainVerificationResponse(BaseModel):
    chain_valid: bool
    total_records: int
    broken_at_log_id: Optional[int] = None
    legal_standard: str
    status_description: str

# Parse Exception schema
class ParseExceptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    exception_id: str
    evidence_id: str
    row_index: int
    raw_content: Optional[str] = None
    error_message: str
    created_at: datetime

# Graph schemas
class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # PHONE, ACCOUNT, UPI, etc.
    score: float
    confidence_band: str
    is_chokepoint: bool = False
    is_canary: bool = False
    raw_value: Optional[str] = None
    cluster: Optional[str] = "Cluster-1"
    centrality: Optional[float] = 0.0
    in_degree: Optional[int] = 0
    out_degree: Optional[int] = 0
    metadata: Dict[str, Any] = {}

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    confidence: float
    confidence_band: str
    reasoning: Dict[str, Any] = {}
    evidence_ids: List[str] = []

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    clusters_count: int
    chokepoints: List[str]

# Recursive CTE Hop Schemas
class GraphHopEdge(BaseModel):
    hop_level: int
    source_id: str
    source_label: str
    target_id: str
    target_label: str
    link_type: str
    confidence: float
    direction: str  # OUTBOUND, INBOUND

class GraphTraversalResponse(BaseModel):
    case_id: str
    source_entity_id: Optional[str] = None
    max_hops: int
    total_hops_found: int
    traversal_time_ms: float
    hops: List[GraphHopEdge]

# Background Task schemas
class TaskResponse(BaseModel):
    task_id: str
    task_type: str
    status: str  # PENDING, RUNNING, COMPLETED, FAILED
    progress: int  # 0 to 100
    message: str
    result: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

# Evidence Gap schema
class EvidenceGap(BaseModel):
    gap_id: str
    gap_type: str
    severity: str  # CRITICAL, WARNING, ADVISORY
    description: str
    recommended_action: str
    relevant_entity: Optional[str] = None
    time_window: Optional[str] = None

# Report schema
class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    report_id: str
    case_id: str
    format: str
    file_path: str
    file_name: Optional[str] = None
    download_url: Optional[str] = None
    generated_by: str
    generated_at: datetime
    status: Optional[str] = "COMPLETED"

export interface Case {
  case_id: string;
  title: string;
  incident_type: string | null;
  reported_at: string | null;
  amount_inr: number;
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'CLOSED' | string;
  created_at: string;
  last_activity_at?: string;
  correlation_latency_ms?: number;
  evidence_count: number;
  entity_count: number;
}

export interface Evidence {
  evidence_id: string;
  case_id: string;
  source_type: 'CDR' | 'IPDR' | 'BANK' | 'UPI' | 'EML' | 'APK' | 'ANDROID';
  file_path: string;
  sha256_original: string;
  parser_name: string | null;
  parser_version: string | null;
  acquired_at: string | null;
  ingested_at: string;
  row_count: number;
  parsed_count: number;
  failed_count: number;
}

export interface Entity {
  entity_id: string;
  case_id: string;
  entity_type: 'PHONE' | 'SIM' | 'DEVICE' | 'ACCOUNT' | 'UPI' | 'IP' | 'EMAIL' | 'APK';
  normalized_key: string;
  raw_value: string | null;
  first_seen: string | null;
  metadata_json?: Record<string, any>;
  latest_score?: number;
  confidence_band?: 'High' | 'Medium' | 'Low';
  risk_factors?: Record<string, number>;
  anomaly_flag?: {
    is_anomalous: boolean;
    badge_text: string;
    anomaly_score: number;
    model: string;
    disclaimer: string;
  };
}

export interface EntityLink {
  link_id: string;
  source_entity: string;
  target_entity: string;
  link_type: string;
  confidence: number;
  confidence_band: 'High' | 'Medium' | 'Low';
  evidence_ids: string[];
  reasoning: {
    rule?: string;
    score_contribution?: number;
    factors?: Record<string, any>;
    details?: string;
    amount_inr?: number;
    [key: string]: any;
  };
  created_at: string;
}

export interface Event {
  event_id: string;
  case_id: string;
  entity_id: string | null;
  evidence_id: string;
  event_type: 'CALL' | 'TRANSACTION' | 'APP_INSTALL' | 'EMAIL_RECEIVED' | 'IP_SESSION' | 'ANDROID_EXTRACTION';
  occurred_at: string;
  raw_ref: string | null;
  metadata_json?: Record<string, any>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  score: number;
  confidence_band: string;
  is_chokepoint: boolean;
  is_canary: boolean;
  raw_value?: string;
  cluster: string;
  centrality: number;
  in_degree: number;
  out_degree: number;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  confidence_band: string;
  reasoning: Record<string, any>;
  evidence_ids: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters_count: number;
  chokepoints: string[];
}

export interface GraphHopEdge {
  hop_level: number;
  source_id: string;
  source_label: string;
  target_id: string;
  target_label: string;
  link_type: string;
  confidence: number;
  direction: string;
}

export interface GraphTraversalResponse {
  case_id: string;
  source_entity_id: string | null;
  max_hops: number;
  total_hops_found: number;
  traversal_time_ms: number;
  hops: GraphHopEdge[];
}

export interface EvidenceGap {
  gap_id: string;
  gap_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  description: string;
  impact?: string;
  recommended_action: string;
  relevant_entity?: string;
  statutory_timeline?: string;
}

export interface AuditLogEntry {
  log_id: number;
  actor: string;
  action: string;
  target_ref: string;
  occurred_at: string;
  prev_hash: string | null;
  row_hash: string;
  is_valid: boolean;
}

export interface ParseException {
  exception_id: string;
  evidence_id: string;
  row_index: number;
  raw_content: string | null;
  error_message: string;
  created_at: string;
}

export interface CrossCaseMatch {
  entity_type: string;
  normalized_key: string;
  linked_cases_count: number;
  cases: Array<{
    case_id: string;
    title: string;
    incident_type: string;
    status: string;
  }>;
  correlation_confidence: number;
  syndicate_link: boolean;
}

export interface BackgroundTask {
  task_id: string;
  task_type: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message: string;
  result?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

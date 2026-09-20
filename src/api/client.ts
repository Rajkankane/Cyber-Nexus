import type {
  Case, Evidence, Entity, EntityLink, Event, GraphData,
  EvidenceGap, AuditLogEntry, ParseException, CrossCaseMatch,
  GraphTraversalResponse, BackgroundTask
} from '../types';

const BASE_URL = ''; // Relative path leverages Vite proxy to http://localhost:8000

export const api = {
  // Cases
  async getCases(status?: string, search?: string): Promise<Case[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}/api/cases${qs}`);
    if (!res.ok) throw new Error('Failed to fetch cases');
    return res.json();
  },

  async getCase(caseId: string): Promise<Case> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}`);
    if (!res.ok) throw new Error('Failed to fetch case detail');
    return res.json();
  },

  async createCase(title: string, incidentType: string, amount: number): Promise<Case> {
    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        incident_type: incidentType,
        amount_inr: amount
      })
    });
    if (!res.ok) throw new Error('Failed to create case');
    return res.json();
  },

  async updateCaseStatus(caseId: string, status: string): Promise<Case> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/status?status=${status}`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Failed to update case status');
    return res.json();
  },

  // Evidence
  async getEvidence(caseId: string, sourceType?: string): Promise<Evidence[]> {
    const qs = sourceType ? `?source_type=${sourceType}` : '';
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/evidence${qs}`);
    if (!res.ok) throw new Error('Failed to fetch evidence');
    return res.json();
  },

  async uploadEvidence(caseId: string, file: File, sourceType: string): Promise<Evidence> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', sourceType);

    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/evidence/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || errData?.detail || 'Failed to upload evidence');
    }
    return res.json();
  },

  async getParseExceptions(caseId: string, evidenceId: string): Promise<ParseException[]> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/evidence/${evidenceId}/exceptions`);
    if (!res.ok) throw new Error('Failed to fetch parse exceptions');
    return res.json();
  },

  // Entities & Correlation
  async getEntities(caseId: string, entityType?: string, search?: string): Promise<Entity[]> {
    const params = new URLSearchParams();
    if (entityType && entityType !== 'ALL') params.append('entity_type', entityType);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/entities${qs}`);
    if (!res.ok) throw new Error('Failed to fetch entities');
    return res.json();
  },

  async recomputeCorrelations(caseId: string): Promise<EntityLink[]> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/entities/recompute`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to recompute correlations');
    return res.json();
  },

  async getEntityLinks(caseId: string): Promise<EntityLink[]> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/entities/links`);
    if (!res.ok) throw new Error('Failed to fetch links');
    return res.json();
  },

  // Graph
  async getGraph(caseId: string): Promise<GraphData> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/graph`);
    if (!res.ok) throw new Error('Failed to fetch graph');
    return res.json();
  },

  async getGraphHops(caseId: string, sourceEntityId?: string, maxHops: number = 4): Promise<GraphTraversalResponse> {
    const params = new URLSearchParams({ max_hops: String(maxHops) });
    if (sourceEntityId) params.append('source_entity_id', sourceEntityId);
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/graph/hops?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to traverse graph hops');
    return res.json();
  },

  // Timeline
  async getTimeline(caseId: string): Promise<Event[]> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/timeline`);
    if (!res.ok) throw new Error('Failed to fetch timeline');
    return res.json();
  },

  // Risk & Gaps
  async getEvidenceGaps(caseId: string): Promise<EvidenceGap[]> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/risk/gaps`);
    if (!res.ok) throw new Error('Failed to fetch evidence gaps');
    return res.json();
  },

  // Reports
  async generatePdfBrief(caseId: string): Promise<{ download_url: string; file_name: string }> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/reports/generate-pdf`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to generate PDF brief');
    return res.json();
  },

  async generateJsonBrief(caseId: string): Promise<{ download_url: string; file_name: string }> {
    const res = await fetch(`${BASE_URL}/api/cases/${caseId}/reports/generate-json`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to generate JSON brief');
    return res.json();
  },

  // Audit
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch(`${BASE_URL}/api/audit/logs`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  async verifyAuditChain(): Promise<{ chain_valid: boolean; broken_at_log_id: number | null; total_records: number; status_description: string }> {
    const res = await fetch(`${BASE_URL}/api/audit/verify`);
    if (!res.ok) throw new Error('Failed to verify chain');
    return res.json();
  },

  async simulateTamper(logId: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/audit/simulate-tamper?log_id=${logId}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to simulate tamper');
    return res.json();
  },

  // Cross-case
  async getCrossCaseMatches(): Promise<CrossCaseMatch[]> {
    const res = await fetch(`${BASE_URL}/api/cross-case/matches`);
    if (!res.ok) throw new Error('Failed to fetch cross-case matches');
    return res.json();
  },

  // Background Tasks
  async getTasks(): Promise<BackgroundTask[]> {
    const res = await fetch(`${BASE_URL}/api/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async getTask(taskId: string): Promise<BackgroundTask> {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`);
    if (!res.ok) throw new Error('Failed to fetch task');
    return res.json();
  }
};

import { http } from "./http";
import { AuditEvent, AuditFilters } from "../types";

export interface AuditReportResponse {
  generatedAt: string;
  format: "json" | "html";
  filters: AuditFilters;
  summary: {
    totalEvents: number;
    uniqueActors: number;
    uniqueActions: number;
    actions: Record<string, number>;
    roles: Record<string, number>;
    entityTypes: Record<string, number>;
  };
  events: AuditEvent[];
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  summary?: AuditReportResponse["summary"];
}

export interface HashVerificationResponse {
  found: boolean;
  matchedEntityType?: "document" | "audit_event";
  integrityStatus?: string;
  document?: {
    documentId: string;
    caseId: string | null;
    filename: string;
    uploadedTimestamp: string;
    sha256Hash: string;
  };
  auditEvent?: {
    eventId: string;
    action: string;
    actorUsername: string;
    actorRole: string;
    entityType: string | null;
    entityId: string | null;
    timestamp: string;
    hashValue: string;
  };
}

function normalizeEvent(event: any): AuditEvent {
  return {
    ...event,
    actorUsername: event.actorUsername ?? event.actor_username,
    actorRole: event.actorRole ?? event.actor_role,
    actionType: event.actionType ?? event.action_type,
    entityType: event.entityType ?? event.entity_type,
    entityId: event.entityId ?? event.entity_id,
    sourceIp: event.sourceIp ?? event.source_ip,
    sessionId: event.sessionId ?? event.session_id,
    previousHash: event.previousHash ?? event.previous_hash,
    hashChain: event.hashChain ?? event.hash_chain,
  };
}

function toQueryString(filters: AuditFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function downloadBlob(url: string, filename: string): Promise<void> {
  const response = await http.get(url, { responseType: "blob" });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export const auditService = {
  async listEvents(filters: AuditFilters = {}): Promise<AuditEventsResponse> {
    const response = await http.get(`/api/v1/audit/events${toQueryString(filters)}`);
    return { ...response.data, events: (response.data.events ?? []).map(normalizeEvent) } as AuditEventsResponse;
  },
  async downloadJson(filters: AuditFilters = {}): Promise<void> {
    await downloadBlob(`/api/v1/audit/reports/json${toQueryString(filters)}`, "scfca-audit-report.json");
  },
  async downloadHtml(filters: AuditFilters = {}): Promise<void> {
    await downloadBlob(`/api/v1/audit/reports/html${toQueryString(filters)}`, "scfca-audit-report.html");
  },
  async verifyHash(hash: string): Promise<HashVerificationResponse> {
    const response = await http.post("/api/v1/audit/hash/verify", { hash });
    return response.data as HashVerificationResponse;
  }
};

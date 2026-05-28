import { http } from "./http";
import { AuditEvent, DashboardSummary, Ticket } from "../types";
import { listCases, listDocuments, listTickets } from "./scfcaData";

export const dashboardService = {
  async getDashboardData(options: { includeAudit?: boolean; includeOperational?: boolean } = {}): Promise<{ summary: DashboardSummary; audit: AuditEvent[]; tickets: Ticket[] }> {
    const includeAudit = Boolean(options.includeAudit);
    const includeOperational = options.includeOperational !== false;
    const casesRequest = includeOperational ? listCases() : Promise.resolve([]);
    const documentsRequest = includeOperational ? listDocuments() : Promise.resolve([]);
    const auditRequest = includeAudit ? http.get("/api/v1/audit/events?limit=5") : Promise.resolve({ data: { events: [] } });
    const ticketsRequest = includeOperational ? listTickets() : Promise.resolve([]);
    const [casesResult, documentsResult, auditResult, ticketsResult] = await Promise.allSettled([
      casesRequest,
      documentsRequest,
      auditRequest,
      ticketsRequest
    ]);

    const cases = casesResult.status === "fulfilled" ? casesResult.value : [];
    const documents = documentsResult.status === "fulfilled" ? documentsResult.value : [];
    const auditRaw =
      auditResult.status === "fulfilled" && Array.isArray(auditResult.value.data?.events)
        ? auditResult.value.data.events
        : [];
    const tickets = ticketsResult.status === "fulfilled" ? ticketsResult.value : [];

    const registeredAssets = cases.reduce((sum, item) => sum + (item.holdings?.length ?? 0), 0);

    return {
      summary: {
        totalCases: cases.length,
        registeredAssets: registeredAssets || documents.length,
        pendingTickets: tickets.filter((ticket) => ticket.status !== "approved" && ticket.status !== "rejected").length,
        approvedTickets: tickets.filter((ticket) => ticket.status === "approved").length
      },
      audit: auditRaw.map((event: any): AuditEvent => ({
        id: event.id,
        timestamp: event.timestamp,
        actor: event.actorUsername ?? event.actor ?? "unknown",
        action: event.actionType ?? event.action ?? "unknown",
        date: event.date,
        actorUsername: event.actorUsername,
        actorRole: event.actorRole,
        actionType: event.actionType,
        entityType: event.entityType,
        entityId: event.entityId,
        description: event.description,
        status: event.status,
        result: event.result,
        sourceIp: event.sourceIp,
        sessionId: event.sessionId,
        previousHash: event.previousHash,
        hashChain: event.hashChain
      })),
      tickets
    };
  }
};

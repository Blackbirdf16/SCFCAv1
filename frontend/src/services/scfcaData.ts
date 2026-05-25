import { http } from "./http";
import { AssetItem, CaseItem, DocumentItem, Ticket, TicketType } from "../types";

export function getCsrfToken(): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("scfca_csrf="));
  if (!cookie) return null;
  return decodeURIComponent(cookie.substring("scfca_csrf=".length));
}

export async function listCases(): Promise<CaseItem[]> {
  const response = await http.get("/api/v1/cases/");
  return response.data?.cases ?? [];
}

export async function listTickets(): Promise<Ticket[]> {
  const response = await http.get("/api/v1/tickets/");
  return response.data?.tickets ?? [];
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const response = await http.get("/api/v1/documents/");
  return response.data?.documents ?? [];
}

export async function createTicket(payload: {
  caseId: string;
  ticketType: TicketType;
  description: string;
  linkedDocumentIds?: string[];
  proposedCaseId?: string;
  assignedHandler?: string;
}): Promise<Ticket> {
  const csrf = getCsrfToken();
  const response = await http.post(
    "/api/v1/tickets/",
    { ...payload, linkedDocumentIds: payload.linkedDocumentIds ?? [] },
    { headers: csrf ? { "x-csrf-token": csrf } : undefined }
  );
  return response.data?.ticket;
}

export async function approveTicket(ticketId: string): Promise<Ticket> {
  const csrf = getCsrfToken();
  const response = await http.post(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}/approve`,
    {},
    { headers: csrf ? { "x-csrf-token": csrf } : undefined }
  );
  return response.data?.ticket;
}

export async function rejectTicket(ticketId: string): Promise<Ticket> {
  const csrf = getCsrfToken();
  const response = await http.post(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}/reject`,
    {},
    { headers: csrf ? { "x-csrf-token": csrf } : undefined }
  );
  return response.data?.ticket;
}

export async function assignTicket(ticketId: string, assignedTo: string): Promise<Ticket> {
  const csrf = getCsrfToken();
  const response = await http.patch(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}/assign`,
    { assignedTo },
    { headers: csrf ? { "x-csrf-token": csrf } : undefined }
  );
  return response.data?.ticket;
}

export async function registerDocument(payload: {
  name: string;
  docType?: string;
  hash: string;
  createdAt: string;
  caseId?: string;
  walletRef?: string;
}): Promise<DocumentItem> {
  const csrf = getCsrfToken();
  const response = await http.post("/api/v1/documents/", payload, {
    headers: csrf ? { "x-csrf-token": csrf } : undefined
  });
  return response.data?.document;
}

export async function uploadDocument(payload: FormData): Promise<DocumentItem> {
  const csrf = getCsrfToken();
  const response = await http.post("/api/v1/documents/upload", payload, {
    headers: csrf ? { "x-csrf-token": csrf } : undefined
  });
  return response.data?.document;
}

export function assetsFromCases(cases: CaseItem[]): AssetItem[] {
  return cases.flatMap((caseItem) =>
    (caseItem.holdings ?? []).map((holding, index) => ({
      id: `${caseItem.id}-ASSET-${index + 1}`,
      caseId: caseItem.id,
      walletRef: caseItem.walletRef,
      symbol: holding.symbol,
      balance: holding.balance,
      network: "Recorded in case asset ledger",
      status: "active" as const,
      assetType: "coin" as const
    }))
  );
}

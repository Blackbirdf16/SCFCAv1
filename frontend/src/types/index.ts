export type Role = "regular" | "administrator" | "auditor";

export interface User {
  username: string;
  role: Role;
  token?: string;
}

export interface UserProfile {
  fullName: string;
  nickname: string;
}

export interface ChatMessage {
  id: string;
  timestamp: string;
  author: string;
  role: Role;
  text: string;
}

export type TicketType =
  // Thesis-required
  | "transfer_request"
  | "conversion_request"
  | "reassignment_request"
  | "administrative_metadata_update"
  | "case_creation_request"
  // Legacy (kept for backwards compatibility)
  | "custody_change"
  | "release_request";

export type TicketStatus = "pending_review" | "awaiting_second_approval" | "approved" | "rejected";

export type TicketApprovalDecision = "approved" | "rejected";

export interface TicketApprovalEvent {
  stage: 1 | 2;
  decision: TicketApprovalDecision;
  decidedBy: string;
  decidedAt: string;
}
export type AssetStatus = "active" | "pending" | "inactive";

export type CustodyActionType = "transfer_request" | "custody_movement" | "release_request";
export type CustodyActionStatus = "requested" | "in_review" | "approved" | "rejected" | "executed" | "cancelled";
export type AssetType = "coin" | "stablecoin" | "token" | "other";

export interface CaseItem {
  id: string;
  walletRef: string;
  title: string;
  handler: string;
  custodyStatus: "open" | "in_review" | "closed";
  holdings: Holding[];
  summary?: string;
  restrictedNotes?: string;
}

export interface Holding {
  symbol: string;
  balance: number;
}

export interface AssetItem {
  id: string;
  symbol: string;
  network: string;
  status: AssetStatus;
  walletRef?: string;
  balance?: number;
  assetType?: AssetType;
  protocol?: string;
  caseId?: string;
}

export interface CustodyAction {
  id: string;
  createdAt: string;
  type: CustodyActionType;
  status: CustodyActionStatus;
  requestedBy?: string;
  walletRef: string;
  symbol: string;
  amount: number;
  network?: string;
  protocol?: string;
  destination?: string;
  caseId?: string;
  notes?: string;
}

export interface Ticket {
  id: string;
  caseId: string;
  ticketType: TicketType;
  description: string;
  status: TicketStatus;
  linkedDocumentIds?: string[];
  approvalHistory?: TicketApprovalEvent[];
  createdBy?: string;
  assignedTo?: string;
  proposedCaseId?: string;
  assignedHandler?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  date?: string;
  actorUsername?: string;
  actorRole?: Role;
  actionType?: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string;
  status?: string;
  result?: string;
  sourceIp?: string | null;
  sessionId?: string | null;
  previousHash?: string | null;
  hashChain?: string | null;
}

export interface AuditFilters {
  date_from?: string;
  date_to?: string;
  actor?: string;
  role?: string;
  action?: string;
  entity_type?: string;
  case_id?: string;
  ticket_id?: string;
  q?: string;
  limit?: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  hash: string;
  createdAt: string;
  caseId?: string;
  walletRef?: string;
  uploadedBy?: string;
  docType?: string;
}

export interface DashboardSummary {
  totalCases: number;
  registeredAssets: number;
  pendingTickets: number;
  approvedTickets: number;
}
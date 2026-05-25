import { AssetItem, CaseItem, CustodyAction, DocumentItem, Ticket, TicketStatus, TicketType, UserProfile } from "../types";
import { demoAssets, demoCases, demoCustodyActions, demoDocuments, demoTickets } from "./data";

function coerceToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

function normalizeTicketType(value: unknown): TicketType {
  if (
    value === "transfer_request" ||
    value === "conversion_request" ||
    value === "reassignment_request" ||
    value === "administrative_metadata_update" ||
    value === "case_creation_request" ||
    value === "custody_change" ||
    value === "release_request"
  ) {
    return value;
  }

  const text = coerceToText(value).toLowerCase();
  if (text.includes("case_creation") || text.includes("case creation")) return "case_creation_request";
  if (text.includes("transfer")) return "transfer_request";
  if (text.includes("convert") || text.includes("conversion")) return "conversion_request";
  if (text.includes("reassign") || text.includes("reassignment")) return "reassignment_request";
  if (text.includes("metadata")) return "administrative_metadata_update";
  if (text.includes("release")) return "release_request";
  return "custody_change";
}

function normalizeTicketStatus(value: unknown): TicketStatus {
  if (value === "pending_review" || value === "awaiting_second_approval" || value === "approved" || value === "rejected") {
    return value;
  }

  const text = coerceToText(value).toLowerCase();
  if (text === "pending") return "pending_review";
  if (text === "in_review") return "pending_review";
  if (text === "approved") return "approved";
  if (text === "rejected") return "rejected";
  return "pending_review";
}

function normalizeTickets(value: unknown): Ticket[] {
  if (!Array.isArray(value)) return demoTickets;

  return value
    .filter(Boolean)
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      const legacyType = item.type;
      const ticketType = normalizeTicketType(item.ticketType ?? legacyType);

      const legacyDescription = typeof legacyType === "string" && legacyType ? legacyType : "";
      const description = typeof item.description === "string" && item.description.trim() ? item.description : legacyDescription;

      return {
        id: coerceToText(item.id),
        caseId: coerceToText(item.caseId),
        ticketType,
        description,
        status: normalizeTicketStatus(item.status),
        linkedDocumentIds: Array.isArray(item.linkedDocumentIds) ? (item.linkedDocumentIds as string[]) : [],
        approvalHistory: Array.isArray(item.approvalHistory) ? (item.approvalHistory as any) : [],
        createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined,
        assignedTo: typeof item.assignedTo === "string" ? item.assignedTo : undefined
      } satisfies Ticket;
    })
    .filter((t) => Boolean(t.id) && Boolean(t.caseId));
}

function loadFromStorage<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

const KEYS = {
  cases: "scfca_poc_cases",
  assets: "scfca_poc_assets",
  tickets: "scfca_poc_tickets",
  documents: "scfca_poc_documents",
  custodyActions: "scfca_poc_custody_actions",
  profilePrefix: "scfca_poc_profile_"
} as const;

export const pocStore = {
  getCases(): CaseItem[] {
    const raw = loadFromStorage(KEYS.cases, demoCases);
    if (!Array.isArray(raw) || raw.length === 0) return demoCases;

    // Demo store migration: refresh old seeded cases so new fields
    // (summary/restrictedNotes) and investigation-style titles show up.
    const looksLikeOldSeed = raw.some(
      (c) => c && typeof c.title === "string" && c.title.toLowerCase().startsWith("seized asset case")
    );
    const missingNewFields = raw.some((c) => {
      if (!c || typeof c.id !== "string" || !c.id.startsWith("SCFCA-CASE-")) return false;
      return typeof (c as any).summary !== "string";
    });

    if (looksLikeOldSeed || missingNewFields) {
      saveToStorage(KEYS.cases, demoCases);
      return demoCases;
    }

    return raw;
  },
  setCases(cases: CaseItem[]) {
    saveToStorage(KEYS.cases, cases);
  },

  getAssets(): AssetItem[] {
    const raw = loadFromStorage(KEYS.assets, demoAssets);
    if (!Array.isArray(raw) || raw.length === 0) return demoAssets;

    const cases = loadFromStorage(KEYS.cases, demoCases);
    const knownWalletRefs = new Set(
      cases
        .map((c) => (typeof c.walletRef === "string" ? c.walletRef.toUpperCase() : ""))
        .filter(Boolean)
    );

    // Demo store migration: if stored assets don't match any known custody wallets,
    // refresh to current seed so regular users (e.g. alice) see example holdings.
    const hasAnyKnownWallet = raw.some((a) => a && typeof a.walletRef === "string" && knownWalletRefs.has(a.walletRef.toUpperCase()));
    if (raw.length > 0 && !hasAnyKnownWallet) {
      saveToStorage(KEYS.assets, demoAssets);
      return demoAssets;
    }

    return raw;
  },
  setAssets(assets: AssetItem[]) {
    saveToStorage(KEYS.assets, assets);
  },

  getTickets(): Ticket[] {
    const raw = loadFromStorage(KEYS.tickets, demoTickets);
    const normalized = normalizeTickets(raw);

    // Demo store migration: if stored tickets refer to cases that no longer exist
    // (e.g. older demo IDs like C-100/C-101), fall back to the current demo seed.
    const cases = loadFromStorage(KEYS.cases, demoCases);
    const knownCaseIds = new Set(cases.map((c) => c.id));
    const hasAnyKnownCase = normalized.some((t) => knownCaseIds.has(t.caseId));
    if (normalized.length > 0 && !hasAnyKnownCase) {
      saveToStorage(KEYS.tickets, demoTickets);
      return demoTickets;
    }

    return normalized;
  },
  setTickets(tickets: Ticket[]) {
    saveToStorage(KEYS.tickets, tickets);
  },

  getDocuments(): DocumentItem[] {
    const raw = loadFromStorage(KEYS.documents, demoDocuments);
    const cases = loadFromStorage(KEYS.cases, demoCases);
    const knownCaseIds = new Set(cases.map((c) => c.id));

    const hasAnyKnownCase = Array.isArray(raw) && raw.some((d) => d && typeof d.caseId === "string" && knownCaseIds.has(d.caseId));
    if (Array.isArray(raw) && raw.length > 0 && !hasAnyKnownCase) {
      saveToStorage(KEYS.documents, demoDocuments);
      return demoDocuments;
    }

    return raw;
  },
  setDocuments(documents: DocumentItem[]) {
    saveToStorage(KEYS.documents, documents);
  },

  getProfile(username: string): UserProfile {
    const key = `${KEYS.profilePrefix}${(username || "").trim().toLowerCase()}`;
    return loadFromStorage<UserProfile>(key, { fullName: "", nickname: "" });
  },
  setProfile(username: string, profile: UserProfile) {
    const key = `${KEYS.profilePrefix}${(username || "").trim().toLowerCase()}`;
    saveToStorage(key, profile);
  },

  getCustodyActions(): CustodyAction[] {
    const raw = loadFromStorage(KEYS.custodyActions, demoCustodyActions);
    if (!Array.isArray(raw) || raw.length === 0) return demoCustodyActions;

    const cases = loadFromStorage(KEYS.cases, demoCases);
    const knownWalletRefs = new Set(
      cases
        .map((c) => (typeof c.walletRef === "string" ? c.walletRef.toUpperCase() : ""))
        .filter(Boolean)
    );

    const hasAnyKnownWallet = raw.some((a) => a && typeof a.walletRef === "string" && knownWalletRefs.has(a.walletRef.toUpperCase()));
    if (raw.length > 0 && !hasAnyKnownWallet) {
      saveToStorage(KEYS.custodyActions, demoCustodyActions);
      return demoCustodyActions;
    }

    return raw;
  },
  setCustodyActions(actions: CustodyAction[]) {
    saveToStorage(KEYS.custodyActions, actions);
  }
};

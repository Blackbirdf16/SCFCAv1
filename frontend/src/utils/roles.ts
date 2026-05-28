import { Role } from "../types";

export function canApproveTickets(role: Role): boolean {
  return role === "administrator";
}

export function isReadOnlyRole(role: Role): boolean {
  return role === "auditor";
}

export function canCreateTickets(role: Role): boolean {
  return role === "regular";
}

export function canUploadDocuments(role: Role): boolean {
  return role === "regular" || role === "administrator";
}

export function canViewAudit(role: Role): boolean {
  return role === "auditor";
}

import { useEffect, useMemo, useState } from "react";
import FormContainer from "../components/FormContainer";
import RoleGuard from "../components/RoleGuard";
import StatusBadge from "../components/StatusBadge";
import TableWrapper from "../components/TableWrapper";
import { useAuth } from "../hooks/useAuth";
import {
  approveTicket as approveTicketApi,
  assignTicket as assignTicketApi,
  createTicket as createTicketApi,
  listCases,
  listDocuments,
  listTickets,
  rejectTicket as rejectTicketApi
} from "../services/scfcaData";
import { CaseItem, DocumentItem, Ticket, TicketType } from "../types";
import { canApproveTickets, canCreateTickets, isReadOnlyRole } from "../utils/roles";

const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  transfer_request: "Transfer request",
  conversion_request: "Conversion request",
  reassignment_request: "Reassignment request",
  administrative_metadata_update: "Administrative metadata update",
  case_creation_request: "Case creation request",
  custody_change: "Custody change",
  release_request: "Release request",
};

const CASE_CREATION_HANDLERS = [
  "alice",
  "mark",
  "john",
];

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [caseId, setCaseId] = useState("");
  const [ticketType, setTicketType] = useState<TicketType | "">("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [proposedCaseId, setProposedCaseId] = useState("");
  const [assignedHandler, setAssignedHandler] = useState("");

  const [assignTicketId, setAssignTicketId] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    void refreshTicketData();
  }, []);

  const refreshTicketData = async () => {
    try {
      const [ticketItems, caseItems, documentItems] = await Promise.all([listTickets(), listCases(), listDocuments()]);
      setTickets(ticketItems);
      setCases(caseItems);
      setDocuments(documentItems);
    } catch (err) {
      console.error(err);
      setError("Unable to load tickets from the backend.");
    }
  };

  const canApprove = user ? canApproveTickets(user.role) : false;
  const canCreate = user ? canCreateTickets(user.role) : false;
  const readOnly = user ? isReadOnlyRole(user.role) : true;

  const assignedCaseIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(cases.map((c) => c.id));
  }, [cases, user]);

  const visibleTickets = tickets;

  const ticketRows = useMemo(() => {
    const caseById = new Map(cases.map((c) => [c.id, c] as const));
    const docsById = new Map(documents.map((d) => [d.id, d] as const));

    return visibleTickets.map((ticket) => {
      const relatedCase = caseById.get(ticket.caseId);
      const walletRef = relatedCase?.walletRef;

      const explicitDocIds = Array.isArray(ticket.linkedDocumentIds) ? ticket.linkedDocumentIds : [];
      const linkedDocs = explicitDocIds.length
        ? explicitDocIds
            .map((id) => docsById.get(id))
            .filter((d): d is DocumentItem => Boolean(d))
        : documents.filter((d) => (d.caseId ?? "") === ticket.caseId);

      const approvalHistory = Array.isArray(ticket.approvalHistory) ? ticket.approvalHistory : [];
      const approvals = approvalHistory.filter((e) => e.decision === "approved");

      return {
        ticket,
        relatedCase,
        walletRef,
        linkedDocs,
        approvalHistory,
        approvals
      };
    });
  }, [cases, documents, visibleTickets]);

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!user) return;
    if (readOnly || !canCreate) {
      setError("Your role is read-only and cannot create tickets.");
      return;
    }
    if (!ticketType || !description.trim()) return;

    if (ticketType === "case_creation_request") {
      if (user.role !== "administrator") {
        setError("Only administrators can request case creation.");
        return;
      }

      const normalizedProposedCaseId = proposedCaseId.trim().toUpperCase();
      if (!normalizedProposedCaseId) {
        setError("Proposed case ID is required.");
        return;
      }

      if (!assignedHandler) {
        setError("Assigned handler is required.");
        return;
      }

      if (!CASE_CREATION_HANDLERS.includes(assignedHandler)) {
        setError("Assigned handler must be handler1/handler2/handler3.");
        return;
      }

      try {
        await createTicketApi({
          caseId: normalizedProposedCaseId,
          proposedCaseId: normalizedProposedCaseId,
          assignedHandler,
          ticketType,
          description: description.trim(),
          linkedDocumentIds: []
        });
        await refreshTicketData();
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.detail ?? "Ticket creation failed.");
        return;
      }
      setProposedCaseId("");
      setAssignedHandler("");
      setTicketType("");
      setDescription("");
      return;
    }

    if (!caseId) return;

    const normalizedCaseId = caseId.trim().toUpperCase();
    const relatedCase = cases.find((c) => c.id === normalizedCaseId);
    if (!relatedCase) {
      setError("Unknown custody case ID. Tickets must be linked to an existing case.");
      return;
    }
    if (user.role === "regular" && !assignedCaseIds.has(normalizedCaseId)) {
      setError("Regular users can only open tickets for assigned custody cases.");
      return;
    }

    try {
      await createTicketApi({
        caseId: normalizedCaseId,
        ticketType,
        description: description.trim(),
        linkedDocumentIds: []
      });
      await refreshTicketData();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? "Ticket creation failed.");
      return;
    }
    setCaseId("");
    setTicketType("");
    setDescription("");
  };

  const approveTicket = async (id: string) => {
    setError("");
    if (!user) return;
    if (!canApprove) return;
    try {
      await approveTicketApi(id);
      await refreshTicketData();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? "Approval failed.");
    }
  };

  const rejectTicket = async (id: string) => {
    setError("");
    if (!user) return;
    if (!canApprove) return;
    try {
      await rejectTicketApi(id);
      await refreshTicketData();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? "Rejection failed.");
    }
  };

  const assignTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canApprove) return;
    if (!assignTicketId || !assignTo) return;
    try {
      await assignTicketApi(assignTicketId, assignTo);
      await refreshTicketData();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? "Assignment failed.");
      return;
    }
    setAssignTicketId("");
    setAssignTo("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TableWrapper title="Ticket List">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-2">Ticket ID</th>
                  <th className="py-2">Case ID</th>
                  <th className="py-2">Wallet Ref</th>
                  <th className="py-2">Ticket Type</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Linked Docs</th>
                  <th className="py-2">Creator</th>
                  <th className="py-2">Current Status</th>
                  <th className="py-2">Approval History</th>
                  <th className="py-2">Assigned</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ticketRows.map(({ ticket, walletRef, linkedDocs, approvalHistory, approvals }) => (
                  <tr key={ticket.id} className="border-b border-slate-800 align-top">
                    <td className="py-2 whitespace-nowrap">{ticket.id}</td>
                    <td className="py-2 whitespace-nowrap">{ticket.caseId}</td>
                    <td className="py-2 font-mono text-xs text-slate-300 whitespace-nowrap">{walletRef ?? "—"}</td>
                    <td className="py-2 whitespace-nowrap">{TICKET_TYPE_LABELS[ticket.ticketType]}</td>
                    <td className="py-2 text-slate-200 max-w-[360px]">
                      <div className="truncate" title={ticket.description}>{ticket.description}</div>
                    </td>
                    <td className="py-2">
                      {linkedDocs.length ? (
                        <div className="text-xs text-slate-300 space-y-1">
                          {linkedDocs.slice(0, 2).map((d) => (
                            <div key={d.id} className="font-mono">{d.id} <span className="text-slate-500">({d.name})</span></div>
                          ))}
                          {linkedDocs.length > 2 ? (
                            <div className="text-slate-500">+{linkedDocs.length - 2} more</div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-300 whitespace-nowrap">{ticket.createdBy ?? "—"}</td>
                    <td className="py-2">
                      <div className="space-y-1">
                        <StatusBadge status={ticket.status} />
                        <div className="text-xs text-slate-500">Approvals: {approvals.length}/2</div>
                        {ticket.status === "awaiting_second_approval" ? (
                          <div className="text-xs text-slate-500">First approval complete</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2">
                      {approvalHistory.length ? (
                        <div className="text-xs text-slate-300 space-y-1">
                          {approvalHistory
                            .slice(0, 3)
                            .map((e, idx) => (
                              <div key={`${ticket.id}-${idx}`}>
                                <span className="text-slate-500">S{e.stage}</span> {e.decision} by <span className="font-mono">{e.decidedBy}</span>
                                <span className="text-slate-500"> @ {e.decidedAt}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-300 whitespace-nowrap">{ticket.assignedTo ?? "—"}</td>
                    <td className="py-2 whitespace-nowrap">
                      {canApprove ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 disabled:opacity-40"
                            onClick={() => approveTicket(ticket.id)}
                            disabled={ticket.status === "approved" || ticket.status === "rejected"}
                          >
                            {approvals.length === 0 ? "Approve 1" : "Approve 2"}
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 disabled:opacity-40"
                            onClick={() => rejectTicket(ticket.id)}
                            disabled={ticket.status === "approved" || ticket.status === "rejected"}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Read-only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWrapper>
      </div>

      <div className="space-y-6">
        {user && canCreate && !readOnly ? (
          <FormContainer title="Create Ticket">
            <form className="space-y-3" onSubmit={createTicket}>
              {ticketType === "case_creation_request" ? (
                <>
                  <input
                    value={proposedCaseId}
                    onChange={(e) => setProposedCaseId(e.target.value)}
                    placeholder="Proposed case ID (e.g., SCFCA-CASE-2026-0051)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <select
                    value={assignedHandler}
                    onChange={(e) => setAssignedHandler(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  >
                    <option value="" disabled>Select assigned handler</option>
                    {CASE_CREATION_HANDLERS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </>
              ) : (
                <input
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder={user.role === "regular" ? "Assigned case ID" : "Case ID"}
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
              )}
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as TicketType)}
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              >
                <option value="" disabled>Select ticket type</option>
                <option value="transfer_request">Transfer request</option>
                <option value="conversion_request">Conversion request</option>
                <option value="reassignment_request">Reassignment request</option>
                <option value="administrative_metadata_update">Administrative metadata update</option>
                {user.role === "administrator" ? (
                  <option value="case_creation_request">Case creation request</option>
                ) : null}
                <option value="custody_change">Custody change</option>
                <option value="release_request">Release request</option>
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (what action is requested, what assets/scope, why)"
                rows={4}
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              {error ? <p className="text-xs text-rose-300">{error}</p> : null}
              <button className="accent-button w-full py-2" type="submit">Create</button>
              {user.role === "regular" ? (
                <p className="text-xs text-slate-500">Regular users can only open tickets for assigned custody cases.</p>
              ) : null}
              {user.role === "administrator" && ticketType === "case_creation_request" ? (
                <p className="text-xs text-slate-500">This ticket requests case creation only; it does not create a case yet.</p>
              ) : null}
            </form>
          </FormContainer>
        ) : (
          <FormContainer title="Create Ticket">
            <p className="text-sm text-slate-400">Ticket creation is restricted for this role.</p>
          </FormContainer>
        )}

        <RoleGuard
          allow={["administrator"]}
          fallback={
            <FormContainer title="Approval Workflow">
              <p className="text-sm text-slate-400">Only administrators can approve/reject or assign tickets.</p>
            </FormContainer>
          }
        >
          <FormContainer title="Approval Workflow">
            <p className="text-sm text-slate-300">Custody tickets require two distinct administrator approvals before final approval.</p>
            <div className="mt-2 text-xs text-slate-500 space-y-1">
              <div><span className="font-semibold">pending review</span>: no approvals recorded</div>
              <div><span className="font-semibold">awaiting second approval</span>: first approval complete</div>
              <div><span className="font-semibold">approved</span>: second approval recorded</div>
              <div><span className="font-semibold">rejected</span>: rejected at any stage</div>
            </div>
          </FormContainer>

          <FormContainer title="Assign Ticket (PoC)">
            <form className="space-y-3" onSubmit={assignTicket}>
              <input
                value={assignTicketId}
                onChange={(e) => setAssignTicketId(e.target.value)}
                placeholder="Ticket ID (e.g. T-201)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                placeholder="Assign to (operator/team)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <button className="accent-button w-full py-2" type="submit">Assign</button>
            </form>
          </FormContainer>
        </RoleGuard>
      </div>
    </div>
  );
}

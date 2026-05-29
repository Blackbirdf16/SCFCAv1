import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import FormContainer from "../components/FormContainer";
import RoleGuard from "../components/RoleGuard";
import StatusBadge from "../components/StatusBadge";
import TableWrapper from "../components/TableWrapper";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/auth";
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
import { canApproveTickets, canCreateTickets } from "../utils/roles";

const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  transfer_request: "Transfer request",
  conversion_request: "Conversion request",
  reassignment_request: "Reassignment request",
  administrative_metadata_update: "Administrative metadata update",
  case_creation_request: "Case creation request",
  custody_change: "Custody change",
  release_request: "Release request"
};

const CUSTODY_REQUEST_TYPES: TicketType[] = [
  "transfer_request",
  "conversion_request",
  "reassignment_request",
  "administrative_metadata_update"
];

const CLOSED_TICKET_STATUSES = new Set<string>(["approved", "rejected", "closed"]);

function isClosedTicket(ticket: Ticket) {
  return CLOSED_TICKET_STATUSES.has(ticket.status);
}

function latestDecisionTime(ticket: Ticket) {
  return ticket.approvalHistory?.[0]?.decidedAt ?? "";
}

export default function Tickets() {
  const location = useLocation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [assignTicketId, setAssignTicketId] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [createCaseId, setCreateCaseId] = useState("");
  const [createTicketType, setCreateTicketType] = useState<TicketType>("transfer_request");
  const [createDescription, setCreateDescription] = useState("");
  const [linkedDocumentIds, setLinkedDocumentIds] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role === "auditor") return;
    void refreshTicketData();
  }, [user?.role]);

  useEffect(() => {
    if (!createCaseId && cases.length > 0) {
      setCreateCaseId(cases[0].id);
    }
  }, [cases, createCaseId]);

  const refreshTicketData = async () => {
    try {
      const [ticketItems, caseItems, documentItems] = await Promise.all([listTickets(), listCases(), listDocuments()]);
      setTickets(ticketItems);
      setCases(caseItems);
      setDocuments(documentItems);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load tickets from the backend.");
    }
  };

  const canApprove = user ? canApproveTickets(user.role) : false;
  const canCreate = user ? canCreateTickets(user.role) : false;
  const isClosedView = location.pathname.startsWith("/tickets/approvals");
  const isCreateView = location.pathname.startsWith("/tickets/create");

  const visibleTickets = useMemo(() => {
    const filtered = tickets.filter((ticket) => (isClosedView ? isClosedTicket(ticket) : !isClosedTicket(ticket)));
    if (!isClosedView) return filtered;

    return filtered
      .map((ticket, index) => ({ ticket, index }))
      .sort((a, b) => {
        const timeCompare = latestDecisionTime(b.ticket).localeCompare(latestDecisionTime(a.ticket));
        return timeCompare || a.index - b.index;
      })
      .map(({ ticket }) => ticket);
  }, [isClosedView, tickets]);

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

  const recentOpenTickets = useMemo(() => {
    return tickets.filter((ticket) => !isClosedTicket(ticket)).slice(0, 5);
  }, [tickets]);

  const createTicket = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setCreateSuccess("");
    if (!canCreate) return;

    const normalizedCaseId = createCaseId.trim().toUpperCase();
    if (!normalizedCaseId) {
      setError("Select an assigned case before creating a ticket.");
      return;
    }
    const description = createDescription.trim();
    if (!description) {
      setError("Describe the requested custody change.");
      return;
    }

    const linkedIds = linkedDocumentIds
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setCreateBusy(true);
    try {
      const ticket = await createTicketApi({
        caseId: normalizedCaseId,
        ticketType: createTicketType,
        description,
        linkedDocumentIds: linkedIds
      });
      await refreshTicketData();
      setCreateDescription("");
      setLinkedDocumentIds("");
      setCreateSuccess(ticket?.id ? `Created ticket ${ticket.id}.` : "Ticket created.");
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? "Ticket creation failed.");
    } finally {
      setCreateBusy(false);
    }
  };

  const approveTicket = async (id: string) => {
    setError("");
    if (!user) return;
    if (!canApprove) return;
    try {
      const password = window.prompt("Confirm administrator password");
      if (!password) {
        setError("Administrator password confirmation is required.");
        return;
      }
      const reauthToken = await authService.reauth(password);
      await approveTicketApi(id, reauthToken);
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
      const password = window.prompt("Confirm administrator password");
      if (!password) {
        setError("Administrator password confirmation is required.");
        return;
      }
      const reauthToken = await authService.reauth(password);
      await rejectTicketApi(id, reauthToken);
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
      const password = window.prompt("Confirm administrator password");
      if (!password) {
        setError("Administrator password confirmation is required.");
        return;
      }
      const reauthToken = await authService.reauth(password);
      await assignTicketApi(assignTicketId, assignTo, reauthToken);
      await refreshTicketData();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? "Assignment failed.");
      return;
    }
    setAssignTicketId("");
    setAssignTo("");
  };

  if (user?.role === "auditor") {
    return (
      <div className="panel p-5 text-sm text-slate-300">
        Operational ticket details are not available to auditors. Use Audit Events for ticket metadata and governance review.
      </div>
    );
  }

  if (isCreateView) {
    if (!canCreate) {
      return (
        <div className="panel p-5 text-sm text-slate-300">
          Only assigned case handlers can create custody request tickets. Administrators review and decide tickets through the approval workflow.
        </div>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FormContainer title="Create Ticket-Based Custody Request">
            <form className="space-y-4" onSubmit={createTicket}>
              {error ? <div className="text-xs text-rose-300">{error}</div> : null}
              {createSuccess ? <div className="text-xs text-emerald-300">{createSuccess}</div> : null}
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Assigned case</span>
                <select
                  value={createCaseId}
                  onChange={(event) => setCreateCaseId(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                >
                  {cases.map((caseItem) => (
                    <option key={caseItem.id} value={caseItem.id}>
                      {caseItem.id} - {caseItem.walletRef}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Request type</span>
                <select
                  value={createTicketType}
                  onChange={(event) => setCreateTicketType(event.target.value as TicketType)}
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                >
                  {CUSTODY_REQUEST_TYPES.map((type) => (
                    <option key={type} value={type}>{TICKET_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Description</span>
                <textarea
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="Describe the requested change, scope, asset references, and reason."
                  className="min-h-32 w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Linked document IDs</span>
                <input
                  value={linkedDocumentIds}
                  onChange={(event) => setLinkedDocumentIds(event.target.value)}
                  placeholder="Optional, comma-separated document IDs"
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
              </label>
              <button className="accent-button w-full py-2" type="submit" disabled={createBusy || cases.length === 0}>
                {createBusy ? "Creating..." : "Create Ticket"}
              </button>
              {cases.length === 0 ? (
                <p className="text-xs text-slate-500">No assigned cases are available for ticket creation.</p>
              ) : null}
            </form>
          </FormContainer>
        </div>

        <div className="space-y-6">
          <FormContainer title="Ticket-Based Custody Requests">
            <div className="space-y-2 text-sm text-slate-400">
              <p>Transfer, conversion, reassignment, and administrative metadata changes are submitted as tickets.</p>
              <p>Administrators approve or reject requests. This form does not sign transactions, touch private keys, or broadcast to a blockchain.</p>
            </div>
          </FormContainer>

          <TableWrapper title="Recent Open Tickets">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-2">Ticket</th>
                  <th className="py-2">Case</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOpenTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-slate-800">
                    <td className="py-2">{ticket.id}</td>
                    <td className="py-2">{ticket.caseId}</td>
                    <td className="py-2"><StatusBadge status={ticket.status} /></td>
                  </tr>
                ))}
                {recentOpenTickets.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={3}>No open tickets returned by the backend.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrapper>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <TableWrapper title={isClosedView ? "Closed Tickets" : "Ticket List"}>
          {error ? <div className="text-xs text-rose-300 mb-3">{error}</div> : null}
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
                  {!isClosedView ? <th className="py-2">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {ticketRows.map(({ ticket, walletRef, linkedDocs, approvalHistory, approvals }) => (
                  <tr key={ticket.id} className="border-b border-slate-800 align-top">
                    <td className="py-2 whitespace-nowrap">{ticket.id}</td>
                    <td className="py-2 whitespace-nowrap">{ticket.caseId}</td>
                    <td className="py-2 font-mono text-xs text-slate-300 whitespace-nowrap">{walletRef ?? "-"}</td>
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
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-300 whitespace-nowrap">{ticket.createdBy ?? "-"}</td>
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
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-300 whitespace-nowrap">{ticket.assignedTo ?? "-"}</td>
                    {!isClosedView ? (
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
                    ) : null}
                  </tr>
                ))}
                {ticketRows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={isClosedView ? 10 : 11}>
                      {isClosedView ? "No closed tickets returned by the backend." : "No open tickets returned by the backend."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </TableWrapper>
      </div>

      {isClosedView ? (
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
      ) : null}
    </div>
  );
}

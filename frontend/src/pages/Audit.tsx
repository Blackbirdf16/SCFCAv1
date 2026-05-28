import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { canViewAudit } from "../utils/roles";
import { HashVerificationResponse, auditService } from "../services/audit";
import { AuditEvent, AuditFilters } from "../types";

type AuditTab = "all" | "case" | "user" | "export";

const AUDIT_PAGE_SIZE = 15;
const initialFilters: AuditFilters = {};
const tabTitles: Record<AuditTab, string> = {
  all: "All Audit Events",
  case: "Case Audit Report",
  user: "User Activity Report",
  export: "Export Reports",
};

function actorName(event: AuditEvent): string {
  return event.actorUsername || event.actor;
}

function actionName(event: AuditEvent): string {
  return event.actionType || event.action;
}

function roleName(event: AuditEvent): string {
  return event.actorRole || "unknown";
}

function entityName(event: AuditEvent): string {
  return event.entityType || "—";
}

function entityId(event: AuditEvent): string {
  return event.entityId || "—";
}

function eventSortKey(event: AuditEvent): string {
  return event.timestamp || event.date || "";
}

function isCaseReportEvent(event: AuditEvent): boolean {
  const action = actionName(event);
  const entityType = (event.entityType || "").toLowerCase();
  return entityType === "case" || entityType === "ticket" || entityType === "custody_action" || action.includes("case") || action.includes("custody");
}

function isUserReportEvent(event: AuditEvent): boolean {
  return ["login_event", "logout_event", "chat_message_posted", "report_generated", "administrative_action"].includes(actionName(event));
}

function FilterField(props: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={props.className}>
      <label htmlFor={props.id} className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function TabButton(props: { tab: AuditTab; activeTab: AuditTab; onSelect: (tab: AuditTab) => void }) {
  const isActive = props.activeTab === props.tab;
  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.tab)}
      className={`rounded-xl px-4 py-3 text-left text-sm transition ${isActive ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40" : "text-slate-300 hover:bg-slate-800/70"}`}
    >
      {tabTitles[props.tab]}
    </button>
  );
}

function AuditSummaryCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-50">{props.value}</div>
    </div>
  );
}

function AuditEventsTable(props: { events: AuditEvent[] }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-[1400px] w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-400">
            <th className="px-4 py-3">Event ID</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Entity</th>
            <th className="px-4 py-3">Entity ID</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Source IP</th>
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">Hash</th>
          </tr>
        </thead>
        <tbody>
          {props.events.map((event) => (
            <tr key={event.id} className="border-b border-slate-900/80 hover:bg-slate-800/30">
              <td className="px-4 py-3 font-mono text-xs text-cyan-200">{event.id}</td>
              <td className="px-4 py-3 text-slate-300">{event.date ?? event.timestamp.slice(0, 10)}</td>
              <td className="px-4 py-3 text-slate-300">{event.timestamp}</td>
              <td className="px-4 py-3 font-medium text-slate-100">{actorName(event)}</td>
              <td className="px-4 py-3 text-slate-300">{roleName(event)}</td>
              <td className="px-4 py-3 text-slate-100">{actionName(event)}</td>
              <td className="px-4 py-3 text-slate-300">{entityName(event)}</td>
              <td className="px-4 py-3 text-slate-300">{entityId(event)}</td>
              <td className="px-4 py-3 text-slate-300">
                <div className="max-w-[420px] leading-6">{event.description ?? "—"}</div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-200">
                  {event.status ?? event.result ?? "success"}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-300">{event.sourceIp ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{event.sessionId ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{event.hashChain ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Audit() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AuditTab>("all");
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(initialFilters);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<{ totalEvents: number; uniqueActors: number; uniqueActions: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState("");
  const [hashResult, setHashResult] = useState<HashVerificationResponse | null>(null);
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await auditService.listEvents(filters);
        setEvents(data.events ?? []);
        setSummary(
          data.summary
            ? {
                totalEvents: data.summary.totalEvents,
                uniqueActors: data.summary.uniqueActors,
                uniqueActions: data.summary.uniqueActions,
              }
            : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load audit events.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [filters]);

  const visibleEvents = useMemo(() => {
    const sortedEvents = [...events].sort((a, b) => eventSortKey(b).localeCompare(eventSortKey(a)) || b.id.localeCompare(a.id));
    const sortedCaseEvents = sortedEvents.filter(isCaseReportEvent);
    const sortedUserEvents = sortedEvents.filter(isUserReportEvent);

    switch (activeTab) {
      case "case":
        return sortedCaseEvents;
      case "user":
        return sortedUserEvents;
      default:
        return sortedEvents;
    }
  }, [activeTab, events]);

  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, filters]);

  const applyFilters = () => {
    setCurrentPage(0);
    setFilters({ ...draftFilters });
  };
  const clearFilters = () => {
    setCurrentPage(0);
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
  };

  const downloadReport = async (format: "json" | "html") => {
    try {
      if (format === "json") {
        await auditService.downloadJson(filters);
      } else {
        await auditService.downloadHtml(filters);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to download ${format.toUpperCase()} report.`);
    }
  };

  const verifyHash = async () => {
    const value = hashInput.trim();
    if (!value) {
      setHashResult(null);
      return;
    }
    setHashLoading(true);
    setHashError(null);
    setError(null);
    try {
      setHashResult(await auditService.verifyHash(value));
    } catch (err) {
      setHashResult(null);
      setHashError(err instanceof Error ? err.message : "Unable to verify hash.");
    } finally {
      setHashLoading(false);
    }
  };

  if (!user || !canViewAudit(user.role)) {
    return <div className="panel p-5 text-sm text-slate-300">Audit Events are restricted to auditor users.</div>;
  }

  const totalVisible = visibleEvents.length;
  const distinctActors = new Set(events.map(actorName)).size;
  const distinctActions = new Set(events.map(actionName)).size;
  const tabHeading = tabTitles[activeTab];
  const totalPages = Math.max(1, Math.ceil(totalVisible / AUDIT_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pageStart = safePage * AUDIT_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + AUDIT_PAGE_SIZE, totalVisible);
  const pagedEvents = visibleEvents.slice(pageStart, pageEnd);
  const canGoNewer = safePage > 0;
  const canGoOlder = pageEnd < totalVisible;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">Auditability / SCFCA</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">Auditor dashboard</h1>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              This view shows a complete trail of custody activity, internal communication, approvals, report generation, and role-based access events. It is read-only for auditors and designed to evidence institutional governance during the thesis defense.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <AuditSummaryCard label="Events" value={summary?.totalEvents ?? events.length} />
            <AuditSummaryCard label="Actors" value={summary?.uniqueActors ?? distinctActors} />
            <AuditSummaryCard label="Actions" value={summary?.uniqueActions ?? distinctActions} />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <FilterField id="audit-search" label="Search" className="xl:col-span-2">
            <input
              id="audit-search"
              value={draftFilters.q ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, q: e.target.value }))}
              placeholder="Actor, action, entity, details, hash"
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
          </FilterField>
          <FilterField id="audit-date-from" label="From">
            <input
              id="audit-date-from"
              type="date"
              value={draftFilters.date_from ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, date_from: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
          </FilterField>
          <FilterField id="audit-date-to" label="To">
            <input
              id="audit-date-to"
              type="date"
              value={draftFilters.date_to ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, date_to: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
          </FilterField>
          <FilterField id="audit-actor" label="Actor">
            <input
              id="audit-actor"
              value={draftFilters.actor ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, actor: e.target.value }))}
              placeholder="carol, bob, alice"
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
          </FilterField>
          <FilterField id="audit-role" label="Role">
            <select
              id="audit-role"
              value={draftFilters.role ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, role: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            >
              <option value="">Any</option>
              <option value="regular">regular</option>
              <option value="administrator">administrator</option>
              <option value="auditor">auditor</option>
            </select>
          </FilterField>
          <FilterField id="audit-action" label="Action">
            <input
              id="audit-action"
              value={draftFilters.action ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, action: e.target.value }))}
              placeholder="login, ticket_approved, report_generated"
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
          </FilterField>
          <FilterField id="audit-entity" label="Entity">
            <input
              id="audit-entity"
              value={draftFilters.entity_type ?? ""}
              onChange={(e) => setDraftFilters((current) => ({ ...current, entity_type: e.target.value }))}
              placeholder="case, ticket, document"
              className="w-full rounded-xl border border-slate-700 bg-dark px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
          </FilterField>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button type="button" onClick={applyFilters} className="accent-button px-4 py-2 text-sm">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700/70"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-2">
        <div className="grid gap-2 md:grid-cols-4">
          {(Object.keys(tabTitles) as AuditTab[]).map((tab) => (
            <TabButton key={tab} tab={tab} activeTab={activeTab} onSelect={setActiveTab} />
          ))}
        </div>
      </section>

      {error ? <div className="panel border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {user.role === "auditor" ? (
        <section className="panel p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Hash Verification</h2>
            <p className="mt-1 text-sm text-slate-400">
              Paste a document SHA-256 hash or audit event hash to verify whether it exists in the database-backed evidence trail.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <textarea
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              placeholder="Paste document hash or audit hash"
              rows={3}
              className="min-w-0 rounded-xl border border-slate-700 bg-dark px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
            />
            <button type="button" onClick={() => void verifyHash()} className="accent-button px-4 py-2 text-sm" disabled={hashLoading}>
              {hashLoading ? "Verifying..." : "Verify Hash"}
            </button>
          </div>
          {hashError ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{hashError}</div> : null}
          {hashResult ? (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/50 p-4 text-sm text-slate-300">
              <dl className="grid gap-2 md:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Found</dt>
                  <dd className="font-mono text-slate-100">{String(hashResult.found)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Matched entity type</dt>
                  <dd className="font-mono text-slate-100">{hashResult.matchedEntityType ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Matched entity ID</dt>
                  <dd className="font-mono text-slate-100">
                    {hashResult.document?.documentId ?? hashResult.auditEvent?.eventId ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Integrity status</dt>
                  <dd className="font-mono text-slate-100">{hashResult.integrityStatus ?? "—"}</dd>
                </div>
              </dl>

              {hashResult.document ? (
                <dl className="mt-4 grid gap-2 md:grid-cols-2">
                  <div><dt className="text-slate-500">Document ID</dt><dd className="font-mono">{hashResult.document.documentId}</dd></div>
                  <div><dt className="text-slate-500">Case ID</dt><dd className="font-mono">{hashResult.document.caseId ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Filename</dt><dd>{hashResult.document.filename}</dd></div>
                  <div><dt className="text-slate-500">Uploaded timestamp</dt><dd>{hashResult.document.uploadedTimestamp}</dd></div>
                  <div className="md:col-span-2"><dt className="text-slate-500">Hash value</dt><dd className="break-all font-mono text-xs">{hashResult.document.sha256Hash}</dd></div>
                </dl>
              ) : null}

              {hashResult.auditEvent ? (
                <dl className="mt-4 grid gap-2 md:grid-cols-2">
                  <div><dt className="text-slate-500">Event ID</dt><dd className="font-mono">{hashResult.auditEvent.eventId}</dd></div>
                  <div><dt className="text-slate-500">Action</dt><dd>{hashResult.auditEvent.action}</dd></div>
                  <div><dt className="text-slate-500">Actor</dt><dd>{hashResult.auditEvent.actorUsername} ({hashResult.auditEvent.actorRole})</dd></div>
                  <div><dt className="text-slate-500">Timestamp/date</dt><dd>{hashResult.auditEvent.timestamp}</dd></div>
                  <div><dt className="text-slate-500">Entity</dt><dd>{hashResult.auditEvent.entityType ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Entity ID</dt><dd className="font-mono">{hashResult.auditEvent.entityId ?? "—"}</dd></div>
                  <div className="md:col-span-2"><dt className="text-slate-500">Hash value</dt><dd className="break-all font-mono text-xs">{hashResult.auditEvent.hashValue}</dd></div>
                </dl>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "export" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="panel p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">{tabHeading}</h2>
              <p className="mt-1 text-sm text-slate-400">Download the current filtered audit view in JSON or HTML for thesis review and archival evidence.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void downloadReport("json")} className="accent-button px-4 py-2 text-sm">
                Download JSON
              </button>
              <button type="button" onClick={() => void downloadReport("html")} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700/70">
                Download HTML
              </button>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="font-semibold text-slate-100">Current filter state</div>
              <pre className="mt-3 overflow-auto text-xs text-slate-400">{JSON.stringify(filters, null, 2)}</pre>
            </div>
          </div>

          <div className="panel p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-50">Why this matters</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>Auditors can verify who acted, what was touched, when it happened, and whether the action succeeded or was rejected.</p>
              <p>Hash chaining provides a tamper-evident trail for the demo, while the report export makes the evidence portable for thesis defense materials.</p>
            </div>
          </div>

        </section>
      ) : (
        <section className="panel overflow-hidden p-0">
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">{tabHeading}</h2>
                <p className="text-sm text-slate-400">
                  {loading
                    ? "Loading audit events…"
                    : totalVisible > 0
                      ? `Showing ${pageStart + 1}-${pageEnd} of ${totalVisible} audit events`
                      : "No audit events available."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                  disabled={!canGoNewer || loading}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Newer / Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                  disabled={!canGoOlder || loading}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Older / Next
                </button>
                <span className="px-2 text-xs text-slate-400">Page {safePage + 1}</span>
                <button type="button" onClick={() => void downloadReport("json")} className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-700/70">
                  JSON
                </button>
                <button type="button" onClick={() => void downloadReport("html")} className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-700/70">
                  HTML
                </button>
              </div>
            </div>
          </div>

          <AuditEventsTable events={loading ? [] : pagedEvents} />
          {!loading && visibleEvents.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400">No audit events available.</div>
          ) : null}
        </section>
      )}
    </div>
  );
}

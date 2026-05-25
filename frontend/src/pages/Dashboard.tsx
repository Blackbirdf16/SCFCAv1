import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import TableWrapper from "../components/TableWrapper";
import { dashboardService } from "../services/dashboard";
import { useAuth } from "../hooks/useAuth";
import { AuditEvent, DashboardSummary, Ticket } from "../types";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary>({
    totalCases: 0,
    registeredAssets: 0,
    pendingTickets: 0,
    approvedTickets: 0
  });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const data = await dashboardService.getDashboardData();
      setSummary(data.summary);
      setAuditEvents(data.audit);
      setTickets(data.tickets);
    };
    void load();
  }, []);

  const username = user?.username ?? "demo";
  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const hasAssets = summary.registeredAssets > 0;
  const hasTickets = summary.pendingTickets + summary.approvedTickets > 0;

  // Role-based dashboard metrics
  let metricsSection = null;
  if (user?.role === "regular") {
    // Case handler: show assigned cases, assets, tickets
    metricsSection = (
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Assigned Cases</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{summary.totalCases}</div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Assets</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{summary.registeredAssets}</div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Tickets</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {summary.pendingTickets + summary.approvedTickets}
          </div>
        </div>
      </div>
    );
  } else if (user?.role === "administrator") {
    // Admin: show governance metrics (stubbed for now)
    metricsSection = (
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Pending Approvals</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{summary.pendingTickets}</div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Case Creation Requests</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">0</div>
        </div>
      </div>
    );
  } else if (user?.role === "auditor") {
    // Auditor: show audit/report metrics (stubbed for now)
    metricsSection = (
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Audit Events</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{auditEvents.length}</div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Reports</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">0</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="panel p-5 xl:col-span-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-700/70 border border-slate-600/40 flex items-center justify-center text-slate-100 font-semibold">
              {initials || "U"}
            </div>
            <div className="min-w-0">
              <div className="text-slate-100 font-semibold truncate">{username}</div>
              <div className="text-xs text-slate-400">
                Role: <span className="text-slate-200 font-semibold">{user?.role ?? "unknown"}</span>
              </div>
            </div>
            <div className="ml-auto hidden sm:block">
              <StatusBadge status="closed" />
            </div>
          </div>

          {metricsSection}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="accent-button px-3 py-2 text-sm"
              onClick={() => navigate("/assets")}
            >
              Register Asset
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-slate-600/60 bg-slate-700/30 hover:bg-slate-700/50 transition"
              onClick={() => navigate("/tickets")}
            >
              Create Ticket
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-slate-600/60 bg-slate-700/30 hover:bg-slate-700/50 transition"
              onClick={() => navigate("/cases")}
            >
              View Cases
            </button>
          </div>
        </section>

        <section className="xl:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Total Cases" value={summary.totalCases} />
            <KpiCard title="Registered Assets" value={summary.registeredAssets} />
            <KpiCard title="Pending Tickets" value={summary.pendingTickets} />
            <KpiCard title="Approved Tickets" value={summary.approvedTickets} />
          </div>
        </section>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-100">Get Started</h3>
          <div className="text-xs text-slate-400">Next steps for custody workflow</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="panel p-5">
            <div className="flex items-start gap-4">
              <div className="h-7 w-7 rounded-full bg-slate-700/70 border border-slate-600/40 flex items-center justify-center text-xs font-semibold text-slate-100">
                1
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">Authentication</div>
                <div className="text-xs text-slate-400 mt-1">Signed in and ready to operate</div>
                <div className="mt-3">
                  <StatusBadge status="approved" />
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-start gap-4">
              <div className="h-7 w-7 rounded-full bg-slate-700/70 border border-slate-600/40 flex items-center justify-center text-xs font-semibold text-slate-100">
                2
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-100">Asset Registry</div>
                <div className="text-xs text-slate-400 mt-1">Register custody assets for cases</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge status={hasAssets ? "approved" : "pending"} />
                  <button
                    type="button"
                    className="accent-button px-3 py-2 text-sm"
                    onClick={() => navigate("/assets")}
                  >
                    {hasAssets ? "View" : "Register"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-start gap-4">
              <div className="h-7 w-7 rounded-full bg-slate-700/70 border border-slate-600/40 flex items-center justify-center text-xs font-semibold text-slate-100">
                3
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-100">Ticket Workflow</div>
                <div className="text-xs text-slate-400 mt-1">Open and approve custody requests</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge status={hasTickets ? "approved" : "pending"} />
                  <button
                    type="button"
                    className="accent-button px-3 py-2 text-sm"
                    onClick={() => navigate("/tickets")}
                  >
                    {hasTickets ? "View" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-sm text-slate-300">Estimated Balance</div>
            <div className="mt-2 text-4xl font-bold text-slate-100">
              0.00 <span className="text-base font-semibold text-slate-400">BTC</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Registry assets: <span className="text-slate-200 font-semibold">{summary.registeredAssets}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              className="accent-button px-3 py-2 text-sm"
              onClick={() => navigate("/assets")}
            >
              Deposit
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-slate-600/60 bg-slate-700/30 hover:bg-slate-700/50 transition"
              onClick={() => navigate("/tickets")}
            >
              Withdraw
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-slate-600/60 bg-slate-700/30 hover:bg-slate-700/50 transition"
              onClick={() => navigate("/cases")}
            >
              Cash In
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <TableWrapper title="Recent Activity">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2">Timestamp</th>
                <th className="py-2">Actor</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id} className="border-b border-slate-800">
                  <td className="py-2">{event.timestamp}</td>
                  <td className="py-2">{event.actor}</td>
                  <td className="py-2">{event.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>

        <TableWrapper title="Open Tickets">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2">Ticket ID</th>
                <th className="py-2">Case</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-slate-800">
                  <td className="py-2">{ticket.id}</td>
                  <td className="py-2">{ticket.caseId}</td>
                  <td className="py-2">
                    <StatusBadge status={ticket.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      </div>
    </div>
  );
}

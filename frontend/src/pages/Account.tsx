import { NavLink, useLocation } from "react-router-dom";
import FormContainer from "../components/FormContainer";
import RoleGuard from "../components/RoleGuard";
import { useAuth } from "../hooks/useAuth";
import { pocStore } from "../services/pocStore";
import { listCases, listTickets } from "../services/scfcaData";

type AccountSection = "identification" | "security-statement" | "reports";

function downloadJson(filename: string, payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function resolveSection(pathname: string): AccountSection {
  if (pathname.startsWith("/account/security-statement")) return "security-statement";
  if (pathname.startsWith("/account/reports")) return "reports";
  return "identification";
}

export default function Account() {
  const { user } = useAuth();
  const location = useLocation();
  const section = resolveSection(location.pathname);

  const profile = user ? pocStore.getProfile(user.username) : null;

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Account</h1>
            <p className="mt-1 text-sm text-slate-400">Operator identification, security statement, and reporting.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <NavLink
              to="/account/identification"
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md border transition ${
                  isActive
                    ? "border-slate-500/40 bg-dark-card/60 text-slate-100"
                    : "border-slate-700/50 bg-slate-700/10 text-slate-300 hover:bg-slate-700/20 hover:text-slate-100"
                }`
              }
            >
              Identification
            </NavLink>
            <NavLink
              to="/account/security-statement"
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md border transition ${
                  isActive
                    ? "border-slate-500/40 bg-dark-card/60 text-slate-100"
                    : "border-slate-700/50 bg-slate-700/10 text-slate-300 hover:bg-slate-700/20 hover:text-slate-100"
                }`
              }
            >
              Security Statement
            </NavLink>
            <NavLink
              to="/account/reports"
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md border transition ${
                  isActive
                    ? "border-slate-500/40 bg-dark-card/60 text-slate-100"
                    : "border-slate-700/50 bg-slate-700/10 text-slate-300 hover:bg-slate-700/20 hover:text-slate-100"
                }`
              }
            >
              Reports
            </NavLink>
          </div>
        </div>
      </div>

      {section === "identification" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FormContainer title="Identification">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Username</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{user?.username ?? "—"}</div>
                  <div className="mt-2 text-xs text-slate-500">Used for attribution in audit trails and approval history (PoC).</div>
                </div>
                <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Role</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{user?.role ?? "—"}</div>
                  <div className="mt-2 text-xs text-slate-500">Determines visibility and approval permissions.</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Profile Attribution</div>
                <div className="mt-2 text-sm text-slate-200">
                  <div>
                    <span className="text-slate-400">Full name:</span> {profile?.fullName?.trim() ? profile.fullName : "—"}
                  </div>
                  <div>
                    <span className="text-slate-400">Nickname:</span> {profile?.nickname?.trim() ? profile.nickname : "—"}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">These fields are demo-only preferences stored locally in your browser.</div>
              </div>
            </FormContainer>
          </div>

          <div className="space-y-6">
            <FormContainer title="Notes">
              <div className="text-sm text-slate-300 space-y-2">
                <p>This PoC intentionally avoids storing credentials or sensitive identity attributes.</p>
                <p className="text-slate-400 text-xs">Use Settings → Profile to edit your local display fields.</p>
              </div>
            </FormContainer>
          </div>
        </div>
      ) : null}

      {section === "security-statement" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FormContainer title="Security Statement">
              <div className="space-y-3 text-sm text-slate-200">
                <p className="text-slate-300">
                  SCFCA is a thesis-oriented proof of concept. It models institutional custody workflows (cases, tickets, documents,
                  and approvals) without executing blockchain transactions, signing, or handling real private keys.
                </p>
                <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Operating Assumptions (PoC)</div>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-300">
                    <li>No real custody execution: actions are workflow records only.</li>
                    <li>Role-based separation: administrator and auditor roles are read-only / approval-focused as defined.</li>
                    <li>Traceability: approvals record who approved (and when) for stage 1 and stage 2.</li>
                    <li>Evidence attachments: documents can be linked to custody cases and tickets.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Limitations</div>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-300">
                    <li>Business records are served by the backend APIs; localStorage is limited to browser profile preferences.</li>
                    <li>Authentication is PoC and intended for demonstration only.</li>
                  </ul>
                </div>
              </div>
            </FormContainer>
          </div>

          <div className="space-y-6">
            <FormContainer title="Controls (Modeled)">
              <div className="text-sm text-slate-300 space-y-2">
                <div className="rounded-md border border-slate-700/50 bg-dark-card/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Two-admin approval</div>
                  <div className="mt-1 text-sm text-slate-200">Custody tickets require two distinct administrator approvals.</div>
                </div>
                <div className="rounded-md border border-slate-700/50 bg-dark-card/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Document evidence</div>
                  <div className="mt-1 text-sm text-slate-200">Documents provide supporting artifacts for tickets/cases.</div>
                </div>
              </div>
            </FormContainer>
          </div>
        </div>
      ) : null}

      {section === "reports" ? (
        <RoleGuard
          allow={["administrator", "auditor"]}
          fallback={
            <FormContainer title="Reports">
              <p className="text-sm text-slate-400">Reports are available to administrators and auditors only.</p>
            </FormContainer>
          }
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <FormContainer title="Reports">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Custody Case Summary</div>
                    <div className="mt-2 text-sm text-slate-200">Exports custody case IDs, wallet references, and statuses (PoC).</div>
                    <button
                      type="button"
                      className="accent-button mt-3 px-3 py-2 text-sm"
                      onClick={async () => {
                        const cases = await listCases();
                        downloadJson(`scfca_cases_${new Date().toISOString().slice(0, 10)}.json`, { cases });
                      }}
                    >
                      Download
                    </button>
                  </div>

                  <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Ticket Workflow Export</div>
                    <div className="mt-2 text-sm text-slate-200">Exports ticket approval history and current workflow states (PoC).</div>
                    <button
                      type="button"
                      className="accent-button mt-3 px-3 py-2 text-sm"
                      onClick={async () => {
                        const tickets = await listTickets();
                        downloadJson(`scfca_tickets_${new Date().toISOString().slice(0, 10)}.json`, { tickets });
                      }}
                    >
                      Download
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Report Notes</div>
                  <div className="mt-2 text-sm text-slate-300 space-y-1">
                    <div>Exports are generated from backend API responses.</div>
                    <div className="text-xs text-slate-500">No PII is transmitted to external services in this PoC.</div>
                  </div>
                </div>
              </FormContainer>
            </div>

            <div className="space-y-6">
              <FormContainer title="Audit Readiness">
                <div className="text-sm text-slate-300 space-y-2">
                  <p>Reports focus on traceability: case linkage, wallet references, and approval provenance.</p>
                  <p className="text-xs text-slate-500">Use Audit view for system-wide event review.</p>
                </div>
              </FormContainer>
            </div>
          </div>
        </RoleGuard>
      ) : null}
    </div>
  );
}

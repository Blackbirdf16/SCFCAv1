import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FormContainer from "../components/FormContainer";
import StatusBadge from "../components/StatusBadge";
import TableWrapper from "../components/TableWrapper";
import { CaseItem } from "../types";
import { createCase, listCases } from "../services/scfcaData";
import { useAuth } from "../hooks/useAuth";

export default function Cases() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [title, setTitle] = useState("");
  const [handler, setHandler] = useState("");
  const [walletRef, setWalletRef] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreateCase = user?.role === "administrator";

  useEffect(() => {
    if (!user) return;
    if (user?.role === "auditor") {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    listCases()
      .then((items) => {
        if (!mounted) return;
        setCases(items);
        setLoadError("");
      })
      .catch((error) => {
        console.error(error);
        if (mounted) setLoadError("Unable to load custody cases from the backend.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const onCreateCase = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    const walletValue = walletRef.trim().toUpperCase();
    if (!walletValue) {
      setCreateError("Wallet reference is required.");
      return;
    }

    try {
      const created = await createCase({
        walletRef: walletValue,
        title: title.trim() ? title.trim() : undefined,
        assignedHandler: handler.trim() ? handler.trim() : undefined
      });
      const refreshed = await listCases();
      setCases(refreshed);
      setWalletRef("");
      setTitle("");
      setHandler("");
      setCreateSuccess(created?.id ? `Created case ${created.id}.` : "Case created.");
    } catch (error: any) {
      const message = error?.response?.data?.detail ?? "Unable to create custody case.";
      setCreateError(String(message));
    }
  };

  const coinsSummary = (item: CaseItem) => {
    const symbols = (item.holdings ?? []).map((h) => h.symbol);
    if (symbols.length > 0) return symbols.join(", ");
    return "-";
  };

  if (user?.role === "auditor") {
    return (
      <div className="panel p-5 text-sm text-slate-300">
        Operational case details are not available to auditors. Use Audit Events for case identifiers, actions, status, and timestamps.
      </div>
    );
  }

  return (
    <div className={canCreateCase ? "grid gap-6 lg:grid-cols-3" : "space-y-6"}>
      <div className={canCreateCase ? "lg:col-span-2" : undefined}>
        <TableWrapper title="Wallet Custody Cases">
          {loadError ? <div className="text-xs text-rose-300 mb-3">{loadError}</div> : null}
          {user?.role === "regular" ? (
            <div className="text-xs text-slate-400 mb-3">
              Scoped view: showing only custody cases assigned to <span className="text-slate-200 font-semibold">{user.username}</span>.
            </div>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2">Case ID</th>
                <th className="py-2">Wallet Ref</th>
                <th className="py-2">Title</th>
                <th className="py-2">Handler</th>
                <th className="py-2">Custody Status</th>
                <th className="py-2">Coins</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/40"
                  onClick={() => navigate(`/cases/details?caseId=${encodeURIComponent(item.id)}`)}
                >
                  <td className="py-2">{item.id}</td>
                  <td className="py-2 font-mono text-xs text-slate-300">{item.walletRef}</td>
                  <td className="py-2">{item.title}</td>
                  <td className="py-2">{item.handler}</td>
                  <td className="py-2"><StatusBadge status={item.custodyStatus} /></td>
                  <td className="py-2 text-slate-300">{coinsSummary(item)}</td>
                </tr>
              ))}
              {!loading && cases.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-400" colSpan={6}>No cases returned by the backend.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrapper>
      </div>

      {canCreateCase ? (
        <div className="space-y-6">
          <FormContainer title="Create Wallet Custody Case">
            <form className="space-y-3" onSubmit={onCreateCase}>
              <input
                value={walletRef}
                onChange={(e) => setWalletRef(e.target.value.toUpperCase())}
                placeholder="Wallet reference (e.g. WLT-XXXX)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Custody case title"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                placeholder="Assigned handler / responsible account"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <button className="accent-button w-full py-2" type="submit">Create</button>
              {createError ? <p className="text-xs text-rose-300">{createError}</p> : null}
              {createSuccess ? <p className="text-xs text-emerald-300">{createSuccess}</p> : null}
            </form>
          </FormContainer>
        </div>
      ) : null}
    </div>
  );
}

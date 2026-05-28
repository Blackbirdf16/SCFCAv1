import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FormContainer from "../components/FormContainer";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import TableWrapper from "../components/TableWrapper";
import { AssetItem, CaseItem, Ticket, TicketType } from "../types";
import { assetsFromCases, listCases, listTickets } from "../services/scfcaData";
import { useAuth } from "../hooks/useAuth";

type AssetsView = "all" | "holdings" | "transfers";

const CUSTODY_TICKET_TYPES: TicketType[] = [
  "transfer_request",
  "conversion_request",
  "reassignment_request",
  "administrative_metadata_update",
  "custody_change",
  "release_request"
];

const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  transfer_request: "Transfer request",
  conversion_request: "Conversion request",
  reassignment_request: "Reassignment request",
  administrative_metadata_update: "Administrative metadata update",
  case_creation_request: "Case creation request",
  custody_change: "Custody change",
  release_request: "Release request"
};

const CLOSED_TICKET_STATUSES = new Set<string>(["approved", "rejected", "closed"]);

function isCustodyRequestTicket(ticket: Ticket) {
  return CUSTODY_TICKET_TYPES.includes(ticket.ticketType);
}

export default function Assets({ view = "all" }: { view?: AssetsView }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadError, setLoadError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role === "auditor") return;

    let mounted = true;
    Promise.all([listCases(), listTickets()])
      .then(([caseItems, ticketItems]) => {
        if (!mounted) return;
        setCases(caseItems);
        setAssets(assetsFromCases(caseItems));
        setTickets(ticketItems);
        setLoadError("");
      })
      .catch((error) => {
        console.error(error);
        if (mounted) setLoadError("Unable to load asset holdings and custody tickets from the backend.");
      });
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const visibleCases = useMemo(() => {
    if (!user || user.role === "auditor") return [];
    if (user.role === "regular") return cases.filter((c) => c.handler === user.username);
    return cases;
  }, [cases, user]);

  const visibleCaseIds = useMemo(() => new Set(visibleCases.map((item) => item.id)), [visibleCases]);

  const assignedWalletRefs = useMemo(() => {
    const set = new Set<string>();
    for (const c of visibleCases) set.add(c.walletRef.toUpperCase());
    return set;
  }, [visibleCases]);

  const caseByWalletRef = useMemo(() => {
    const map = new Map<string, CaseItem>();
    for (const item of visibleCases) {
      map.set(item.walletRef.toUpperCase(), item);
    }
    return map;
  }, [visibleCases]);

  const caseById = useMemo(() => {
    const map = new Map<string, CaseItem>();
    for (const item of visibleCases) {
      map.set(item.id, item);
    }
    return map;
  }, [visibleCases]);

  const visibleAssets = useMemo(() => {
    if (!user || user.role === "auditor") return [];
    if (user.role === "regular") {
      return assets.filter((a) => a.walletRef && assignedWalletRefs.has(a.walletRef.toUpperCase()));
    }
    return assets;
  }, [assignedWalletRefs, assets, user]);

  const visibleCustodyTickets = useMemo(() => {
    return tickets
      .filter(isCustodyRequestTicket)
      .filter((ticket) => (visibleCaseIds.size ? visibleCaseIds.has(ticket.caseId) : user?.role === "administrator"))
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [tickets, user?.role, visibleCaseIds]);

  const walletsMonitored = useMemo(() => {
    const wallets = new Set<string>();
    for (const asset of visibleAssets) {
      if (asset.walletRef) wallets.add(asset.walletRef);
    }
    return wallets.size;
  }, [visibleAssets]);

  const pendingRegistry = useMemo(() => visibleAssets.filter((asset) => asset.status === "pending").length, [visibleAssets]);

  const unlinkedHoldings = useMemo(() => {
    return visibleAssets.filter((asset) => {
      if (!asset.walletRef) return true;
      const related = caseByWalletRef.get(asset.walletRef.toUpperCase());
      return !related;
    }).length;
  }, [caseByWalletRef, visibleAssets]);

  const openCustodyTickets = useMemo(
    () => visibleCustodyTickets.filter((ticket) => !CLOSED_TICKET_STATUSES.has(ticket.status)).length,
    [visibleCustodyTickets]
  );
  const pendingTickets = useMemo(
    () => visibleCustodyTickets.filter((ticket) => ticket.status === "pending_review").length,
    [visibleCustodyTickets]
  );
  const secondApprovalTickets = useMemo(
    () => visibleCustodyTickets.filter((ticket) => ticket.status === "awaiting_second_approval").length,
    [visibleCustodyTickets]
  );

  const showHoldings = view === "all" || view === "holdings";
  const showRequests = view === "all" || view === "transfers";

  const kpis = useMemo(() => {
    if (view === "transfers") {
      return [
        { title: "Custody Request Tickets", value: visibleCustodyTickets.length },
        { title: "Pending Review", value: pendingTickets },
        { title: "Awaiting Second Approval", value: secondApprovalTickets },
        { title: "Closed Requests", value: visibleCustodyTickets.length - openCustodyTickets }
      ];
    }

    return [
      { title: "Registered Holdings", value: visibleAssets.length },
      { title: "Wallets Monitored", value: walletsMonitored },
      { title: "Pending Registry Items", value: pendingRegistry },
      { title: "Open Custody Tickets", value: openCustodyTickets }
    ];
  }, [
    openCustodyTickets,
    pendingRegistry,
    pendingTickets,
    secondApprovalTickets,
    view,
    visibleAssets.length,
    visibleCustodyTickets.length,
    walletsMonitored
  ]);

  const groupedWallets = useMemo(() => {
    const byWallet = new Map<string, AssetItem[]>();
    const unlinked: AssetItem[] = [];

    for (const asset of visibleAssets) {
      const walletRef = asset.walletRef?.toUpperCase();
      if (!walletRef) {
        unlinked.push(asset);
        continue;
      }

      if (!caseByWalletRef.get(walletRef)) {
        unlinked.push(asset);
        continue;
      }

      const existing = byWallet.get(walletRef) ?? [];
      existing.push(asset);
      byWallet.set(walletRef, existing);
    }

    const wallets = Array.from(byWallet.entries())
      .map(([walletRef, walletAssets]) => ({
        walletRef,
        caseItem: caseByWalletRef.get(walletRef),
        assets: walletAssets
      }))
      .sort((a, b) => a.walletRef.localeCompare(b.walletRef));

    return { wallets, unlinked };
  }, [caseByWalletRef, visibleAssets]);

  const formatQty = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return "-";
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (abs >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 10 });
  };

  const getRelatedCase = (asset: AssetItem): CaseItem | undefined => {
    const explicit = asset.caseId ? caseById.get(asset.caseId.toUpperCase()) : undefined;
    if (explicit) return explicit;
    if (!asset.walletRef) return undefined;
    return caseByWalletRef.get(asset.walletRef.toUpperCase());
  };

  const protocolNetworkLabel = (item: { protocol?: string; network?: string }) => {
    const protocol = item.protocol?.trim();
    const network = item.network?.trim();
    if (protocol && network && network !== "-") return `${protocol} / ${network}`;
    if (network && network !== "-") return network;
    if (protocol) return protocol;
    return "-";
  };

  if (user?.role === "auditor") {
    return (
      <div className="panel p-5 text-sm text-slate-300">
        Asset and custody operations are not available to auditors. Use Audit Events for oversight metadata and evidence review.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} title={kpi.title} value={kpi.value} />
        ))}
      </div>

      {loadError ? <div className="panel p-4 text-xs text-rose-300">{loadError}</div> : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          {showHoldings ? (
            <TableWrapper title="Holdings Overview">
              <div className="mb-3 text-xs text-slate-400">
                Wallet-linked asset balances recorded on custody cases. This view is metadata only and does not execute blockchain actions.
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="py-2">Asset</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Balance</th>
                    <th className="py-2">Protocol / Network</th>
                    <th className="py-2">Wallet Ref</th>
                    <th className="py-2">Custody</th>
                    <th className="py-2">Case</th>
                    <th className="py-2">Registry</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedWallets.wallets.map(({ walletRef, caseItem, assets: walletAssets }) => (
                    <Fragment key={walletRef}>
                      <tr className="border-b border-slate-800 bg-slate-900/40">
                        <td className="py-3" colSpan={8}>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="font-mono text-xs text-slate-200">{walletRef}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-300">
                              <span>Case</span>
                              <span className="font-mono text-slate-200">{caseItem?.id ?? "-"}</span>
                              {caseItem?.custodyStatus ? <StatusBadge status={caseItem.custodyStatus} /> : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {walletAssets.map((item) => {
                        const related = getRelatedCase(item);
                        return (
                          <tr key={item.id} className="border-b border-slate-800">
                            <td className="py-2 font-semibold text-slate-100">{item.symbol}</td>
                            <td className="py-2 text-slate-200">{item.assetType ?? "-"}</td>
                            <td className="py-2 tabular-nums text-slate-200">{formatQty(item.balance)}</td>
                            <td className="py-2 text-slate-200">{protocolNetworkLabel(item)}</td>
                            <td className="py-2 font-mono text-xs text-slate-300">{item.walletRef ?? "-"}</td>
                            <td className="py-2">{related ? <StatusBadge status={related.custodyStatus} /> : "-"}</td>
                            <td className="py-2 font-mono text-xs text-slate-300">{related?.id ?? item.caseId ?? "-"}</td>
                            <td className="py-2"><StatusBadge status={item.status} /></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                  {groupedWallets.wallets.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={8}>No holdings returned by the backend.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrapper>
          ) : null}

          {showHoldings ? (
            <TableWrapper title={`Exceptions / Unlinked Holdings (${unlinkedHoldings})`}>
              <div className="mb-3 text-xs text-slate-400">
                Holdings without a wallet reference or without a known custody case mapping.
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="py-2">Asset</th>
                    <th className="py-2">Balance</th>
                    <th className="py-2">Protocol / Network</th>
                    <th className="py-2">Wallet Ref</th>
                    <th className="py-2">Case</th>
                    <th className="py-2">Registry</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedWallets.unlinked.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800">
                      <td className="py-2 font-semibold text-slate-100">{item.symbol}</td>
                      <td className="py-2 tabular-nums text-slate-200">{formatQty(item.balance)}</td>
                      <td className="py-2 text-slate-200">{protocolNetworkLabel(item)}</td>
                      <td className="py-2 font-mono text-xs text-slate-300">{item.walletRef ?? "-"}</td>
                      <td className="py-2 font-mono text-xs text-slate-300">{item.caseId ?? "-"}</td>
                      <td className="py-2"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                  {groupedWallets.unlinked.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={6}>No unlinked holdings found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrapper>
          ) : null}

          {showRequests ? (
            <TableWrapper title="Ticket-Based Custody Requests">
              <div className="mb-3 text-xs text-slate-400">
                Transfer, conversion, reassignment, and metadata changes are initiated as tickets and reviewed by administrators.
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="py-2">Ticket ID</th>
                    <th className="py-2">Case ID</th>
                    <th className="py-2">Request Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Creator</th>
                    <th className="py-2">Assigned</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustodyTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-800 align-top">
                      <td className="py-2 whitespace-nowrap">{ticket.id}</td>
                      <td className="py-2 whitespace-nowrap">{ticket.caseId}</td>
                      <td className="py-2 whitespace-nowrap">{TICKET_TYPE_LABELS[ticket.ticketType]}</td>
                      <td className="py-2"><StatusBadge status={ticket.status} /></td>
                      <td className="py-2 text-slate-300 whitespace-nowrap">{ticket.createdBy ?? "-"}</td>
                      <td className="py-2 text-slate-300 whitespace-nowrap">{ticket.assignedTo ?? "-"}</td>
                      <td className="py-2 max-w-[360px] text-slate-200">
                        <div className="truncate" title={ticket.description}>{ticket.description}</div>
                      </td>
                    </tr>
                  ))}
                  {visibleCustodyTickets.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-400" colSpan={7}>No custody request tickets returned by the backend.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrapper>
          ) : null}
        </div>

        <div className="space-y-6">
          <FormContainer title="Ticket-Based Custody Requests">
            <p className="text-sm text-slate-300">
              Custody changes are requested through tickets. The Assets page shows recorded case data and request status only.
            </p>
            {user?.role === "regular" ? (
              <button type="button" className="accent-button w-full py-2 text-sm" onClick={() => navigate("/tickets/create")}>
                Create Ticket
              </button>
            ) : (
              <p className="text-sm text-slate-400">
                Administrators review and approve tickets, but do not initiate custody request tickets from this view.
              </p>
            )}
          </FormContainer>

          <FormContainer title="PoC Scope Note">
            <div className="space-y-2 text-sm text-slate-400">
              <p>No transfer, conversion, signing, private-key operation, or blockchain broadcast is performed by this interface.</p>
              <p>Asset balances are custody-case metadata. Operational changes remain governed by ticket review and audit logging.</p>
            </div>
          </FormContainer>
        </div>
      </div>
    </div>
  );
}

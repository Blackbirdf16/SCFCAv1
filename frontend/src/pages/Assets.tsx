import { Fragment, useEffect, useMemo, useState } from "react";
import FormContainer from "../components/FormContainer";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import TableWrapper from "../components/TableWrapper";
import { AssetItem, AssetStatus, AssetType, CaseItem, CustodyAction } from "../types";
import { assetsFromCases, listCases } from "../services/scfcaData";
import { useAuth } from "../hooks/useAuth";
import { isReadOnlyRole } from "../utils/roles";

type AssetsView = "all" | "holdings" | "transfers";

export default function Assets({ view = "all" }: { view?: AssetsView }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [actions] = useState<CustodyAction[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [assetError, setAssetError] = useState("");
  const { user } = useAuth();

  const [registerWalletRef, setRegisterWalletRef] = useState("");
  const [registerCaseId, setRegisterCaseId] = useState("");
  const [registerSymbol, setRegisterSymbol] = useState("");
  const [registerAssetType, setRegisterAssetType] = useState<AssetType>("coin");
  const [registerNetwork, setRegisterNetwork] = useState("");
  const [registerProtocol, setRegisterProtocol] = useState("");
  const [registerStatus, setRegisterStatus] = useState<AssetStatus>("pending");
  const [registerBalance, setRegisterBalance] = useState<string>("");

  const [transferWalletRef, setTransferWalletRef] = useState("");
  const [transferCaseId, setTransferCaseId] = useState("");
  const [transferSymbol, setTransferSymbol] = useState("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferNetwork, setTransferNetwork] = useState("");
  const [transferProtocol, setTransferProtocol] = useState("");
  const [transferDestination, setTransferDestination] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const [movementWalletRef, setMovementWalletRef] = useState("");
  const [movementCaseId, setMovementCaseId] = useState("");
  const [movementSymbol, setMovementSymbol] = useState("");
  const [movementAmount, setMovementAmount] = useState<string>("");
  const [movementNetwork, setMovementNetwork] = useState("");
  const [movementProtocol, setMovementProtocol] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  const [releaseWalletRef, setReleaseWalletRef] = useState("");
  const [releaseCaseId, setReleaseCaseId] = useState("");
  const [releaseSymbol, setReleaseSymbol] = useState("");
  const [releaseAmount, setReleaseAmount] = useState<string>("");
  const [releaseNetwork, setReleaseNetwork] = useState("");
  const [releaseProtocol, setReleaseProtocol] = useState("");
  const [releaseDestination, setReleaseDestination] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    listCases()
      .then((caseItems) => {
        if (!mounted) return;
        setCases(caseItems);
        setAssets(assetsFromCases(caseItems));
        setAssetError("");
      })
      .catch((error) => {
        console.error(error);
        if (mounted) setAssetError("Unable to load asset holdings from backend custody cases.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const caseByWalletRef = useMemo(() => {
    const map = new Map<string, CaseItem>();
    for (const item of cases) {
      map.set(item.walletRef.toUpperCase(), item);
    }
    return map;
  }, [cases]);

  const caseById = useMemo(() => {
    const map = new Map<string, CaseItem>();
    for (const item of cases) {
      map.set(item.id, item);
    }
    return map;
  }, [cases]);

  const visibleCases = useMemo(() => {
    if (!user) return [];
    if (user.role === "regular") return cases.filter((c) => c.handler === user.username);
    return cases;
  }, [cases, user]);

  const assignedWalletRefs = useMemo(() => {
    if (!user) return new Set<string>();
    const set = new Set<string>();
    for (const c of visibleCases) set.add(c.walletRef.toUpperCase());
    return set;
  }, [user, visibleCases]);

  const visibleAssets = useMemo(() => {
    if (!user) return [];
    if (user.role === "regular") {
      return assets.filter((a) => a.walletRef && assignedWalletRefs.has(a.walletRef.toUpperCase()));
    }
    return assets;
  }, [assignedWalletRefs, assets, user]);

  const visibleActions = useMemo(() => {
    if (!user) return [];
    if (user.role === "regular") {
      return actions.filter((a) => assignedWalletRefs.has(a.walletRef.toUpperCase()) && (a.requestedBy ?? "") === user.username);
    }
    return actions;
  }, [actions, assignedWalletRefs, user]);

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

  const openActions = useMemo(() => {
    return visibleActions.filter((a) => a.status === "requested" || a.status === "in_review").length;
  }, [visibleActions]);

  const showHoldings = view === "all" || view === "holdings";
  const showTransfers = view === "all" || view === "transfers";

  const requestedActions = useMemo(() => visibleActions.filter((a) => a.status === "requested").length, [visibleActions]);
  const inReviewActions = useMemo(() => visibleActions.filter((a) => a.status === "in_review").length, [visibleActions]);

  const kpis = useMemo(() => {
    if (view === "holdings") {
      return [
        { title: "Registered Holdings", value: assets.length },
        { title: "Wallets Monitored", value: walletsMonitored },
        { title: "Pending Registry Items", value: pendingRegistry },
        { title: "Unlinked Holdings", value: unlinkedHoldings }
      ];
    }

    if (view === "transfers") {
      return [
        { title: "Visible Actions", value: visibleActions.length },
        { title: "Open Custody Actions", value: openActions },
        { title: "Requested", value: requestedActions },
        { title: "In review", value: inReviewActions }
      ];
    }

    return [
      { title: "Registered Holdings", value: assets.length },
      { title: "Wallets Monitored", value: walletsMonitored },
      { title: "Pending Registry Items", value: pendingRegistry },
      { title: "Open Custody Actions", value: openActions }
    ];
  }, [
    assets.length,
    inReviewActions,
    openActions,
    pendingRegistry,
    requestedActions,
    unlinkedHoldings,
    visibleActions.length,
    view,
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
    if (value === undefined || Number.isNaN(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (abs >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 10 });
  };

  const onRegisterHolding = (event: React.FormEvent) => {
    event.preventDefault();

    const walletRef = registerWalletRef.trim().toUpperCase();
    const symbol = registerSymbol.trim().toUpperCase();
    if (!walletRef || !symbol) return;

    const balance = registerBalance.trim() ? Number(registerBalance) : undefined;
    if (registerBalance.trim() && (balance === undefined || Number.isNaN(balance))) return;

    const caseId = registerCaseId.trim() ? registerCaseId.trim().toUpperCase() : undefined;

    setAssetError("Asset registration is read from PostgreSQL-backed custody cases in this phase.");
    setRegisterWalletRef("");
    setRegisterCaseId("");
    setRegisterSymbol("");
    setRegisterAssetType("coin");
    setRegisterNetwork("");
    setRegisterProtocol("");
    setRegisterStatus("pending");
    setRegisterBalance("");
  };

  const appendAction = (action: Omit<CustodyAction, "id" | "createdAt">) => {
    void action;
    setAssetError("Custody action creation is handled through PostgreSQL-backed tickets.");
  };

  const onSubmitTransferRequest = (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || isReadOnlyRole(user.role)) return;

    const walletRef = transferWalletRef.trim().toUpperCase();
    const symbol = transferSymbol.trim().toUpperCase();
    const amount = transferAmount.trim() ? Number(transferAmount) : Number.NaN;
    if (!walletRef || !symbol || Number.isNaN(amount) || amount <= 0) return;

    appendAction({
      type: "transfer_request",
      status: "requested",
      requestedBy: user.username,
      walletRef,
      caseId: transferCaseId.trim() ? transferCaseId.trim().toUpperCase() : undefined,
      symbol,
      amount,
      network: transferNetwork.trim() ? transferNetwork.trim() : undefined,
      protocol: transferProtocol.trim() ? transferProtocol.trim() : undefined,
      destination: transferDestination.trim() ? transferDestination.trim() : undefined,
      notes: transferNotes.trim() ? transferNotes.trim() : "PoC request (no signing/execution)"
    });

    setTransferWalletRef("");
    setTransferCaseId("");
    setTransferSymbol("");
    setTransferAmount("");
    setTransferNetwork("");
    setTransferProtocol("");
    setTransferDestination("");
    setTransferNotes("");
  };

  const onSubmitCustodyMovement = (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || isReadOnlyRole(user.role)) return;

    const walletRef = movementWalletRef.trim().toUpperCase();
    const symbol = movementSymbol.trim().toUpperCase();
    const amount = movementAmount.trim() ? Number(movementAmount) : Number.NaN;
    if (!walletRef || !symbol || Number.isNaN(amount) || amount <= 0) return;

    appendAction({
      type: "custody_movement",
      status: "requested",
      requestedBy: user.username,
      walletRef,
      caseId: movementCaseId.trim() ? movementCaseId.trim().toUpperCase() : undefined,
      symbol,
      amount,
      network: movementNetwork.trim() ? movementNetwork.trim() : undefined,
      protocol: movementProtocol.trim() ? movementProtocol.trim() : undefined,
      notes: movementNotes.trim() ? movementNotes.trim() : "PoC custody movement (internal)"
    });

    setMovementWalletRef("");
    setMovementCaseId("");
    setMovementSymbol("");
    setMovementAmount("");
    setMovementNetwork("");
    setMovementProtocol("");
    setMovementNotes("");
  };

  const onSubmitReleaseRequest = (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || isReadOnlyRole(user.role)) return;

    const walletRef = releaseWalletRef.trim().toUpperCase();
    const symbol = releaseSymbol.trim().toUpperCase();
    const amount = releaseAmount.trim() ? Number(releaseAmount) : Number.NaN;
    if (!walletRef || !symbol || Number.isNaN(amount) || amount <= 0) return;

    appendAction({
      type: "release_request",
      status: "requested",
      requestedBy: user.username,
      walletRef,
      caseId: releaseCaseId.trim() ? releaseCaseId.trim().toUpperCase() : undefined,
      symbol,
      amount,
      network: releaseNetwork.trim() ? releaseNetwork.trim() : undefined,
      protocol: releaseProtocol.trim() ? releaseProtocol.trim() : undefined,
      destination: releaseDestination.trim() ? releaseDestination.trim() : undefined,
      notes: releaseNotes.trim() ? releaseNotes.trim() : "PoC release request (no signing/execution)"
    });

    setReleaseWalletRef("");
    setReleaseCaseId("");
    setReleaseSymbol("");
    setReleaseAmount("");
    setReleaseNetwork("");
    setReleaseProtocol("");
    setReleaseDestination("");
    setReleaseNotes("");
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
    if (protocol && network && network !== "—") return `${protocol} • ${network}`;
    if (network && network !== "—") return network;
    if (protocol) return protocol;
    return "—";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} title={kpi.title} value={kpi.value} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          {showHoldings ? (
          <TableWrapper title="Operational Wallet Holdings">
            <div className="text-xs text-slate-400 mb-3">
              Wallet-linked overview for custody operations (PoC only; no signing, no transaction execution).
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
                {groupedWallets.wallets.map(({ walletRef, caseItem, assets: walletAssets }) => {
                  const custodyStatus = caseItem?.custodyStatus;
                  const caseId = caseItem?.id;

                  return (
                    <Fragment key={walletRef}>
                      <tr key={`${walletRef}-header`} className="border-b border-slate-800 bg-slate-900/40">
                        <td className="py-3" colSpan={8}>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="font-mono text-xs text-slate-200">{walletRef}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-300">
                              <span>Case</span>
                              <span className="font-mono text-slate-200">{caseId ?? "—"}</span>
                              {custodyStatus ? <StatusBadge status={custodyStatus} /> : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {walletAssets.map((item) => {
                        const related = getRelatedCase(item);
                        return (
                          <tr key={item.id} className="border-b border-slate-800">
                            <td className="py-2 font-semibold text-slate-100">{item.symbol}</td>
                            <td className="py-2 text-slate-200">{item.assetType ?? "—"}</td>
                            <td className="py-2 tabular-nums text-slate-200">{formatQty(item.balance)}</td>
                            <td className="py-2 text-slate-200">{protocolNetworkLabel(item)}</td>
                            <td className="py-2 font-mono text-xs text-slate-300">{item.walletRef ?? "—"}</td>
                            <td className="py-2">{related ? <StatusBadge status={related.custodyStatus} /> : "—"}</td>
                            <td className="py-2 font-mono text-xs text-slate-300">{related?.id ?? item.caseId ?? "—"}</td>
                            <td className="py-2"><StatusBadge status={item.status} /></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </TableWrapper>
          ) : null}

          {showHoldings ? (
          <TableWrapper title={`Exceptions / Unlinked Holdings (${unlinkedHoldings})`}>
            <div className="text-xs text-slate-400 mb-3">
              Assets without a wallet reference or without a known custody case mapping.
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
                    <td className="py-2 font-mono text-xs text-slate-300">{item.walletRef ?? "—"}</td>
                    <td className="py-2 font-mono text-xs text-slate-300">{item.caseId ?? "—"}</td>
                    <td className="py-2"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
          ) : null}

          {showTransfers ? (
          <TableWrapper title="Custody Action Queue (PoC)">
            <div className="text-xs text-slate-400 mb-3">
              Demo-safe workflow records only. No blockchain calls, no signing, no execution.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-2">Action</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Requested By</th>
                  <th className="py-2">Wallet Ref</th>
                  <th className="py-2">Asset</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Protocol / Network</th>
                  <th className="py-2">Case</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleActions.slice(0, 12).map((action) => (
                  <tr key={action.id} className="border-b border-slate-800">
                    <td className="py-2 text-slate-200">{action.type.replace("_", " ")}</td>
                    <td className="py-2"><StatusBadge status={action.status} /></td>
                    <td className="py-2 text-slate-300">{action.requestedBy ?? "—"}</td>
                    <td className="py-2 font-mono text-xs text-slate-300">{action.walletRef}</td>
                    <td className="py-2 font-semibold text-slate-100">{action.symbol}</td>
                    <td className="py-2 tabular-nums text-slate-200">{formatQty(action.amount)}</td>
                    <td className="py-2 text-slate-200">{protocolNetworkLabel(action)}</td>
                    <td className="py-2 font-mono text-xs text-slate-300">{action.caseId ?? "—"}</td>
                    <td className="py-2 text-slate-400">{action.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
          ) : null}
        </div>

        <div className="space-y-6">
          {showHoldings ? (
          <FormContainer title="Register / Update Holding (PoC)">
            <form className="space-y-3" onSubmit={onRegisterHolding}>
              {assetError ? <p className="text-xs text-rose-300">{assetError}</p> : null}
              <input
                value={registerWalletRef}
                onChange={(e) => setRegisterWalletRef(e.target.value)}
                placeholder="Wallet reference (required)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={registerCaseId}
                onChange={(e) => setRegisterCaseId(e.target.value)}
                placeholder="Related case ID (optional)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={registerSymbol}
                  onChange={(e) => setRegisterSymbol(e.target.value.toUpperCase())}
                  placeholder="Asset symbol (e.g. BTC)"
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
                <select
                  value={registerAssetType}
                  onChange={(e) => setRegisterAssetType(e.target.value as AssetType)}
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                >
                  <option value="coin">coin</option>
                  <option value="stablecoin">stablecoin</option>
                  <option value="token">token</option>
                  <option value="other">other</option>
                </select>
              </div>
              <input
                value={registerBalance}
                onChange={(e) => setRegisterBalance(e.target.value)}
                placeholder="Amount / balance (optional)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                inputMode="decimal"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={registerProtocol}
                  onChange={(e) => setRegisterProtocol(e.target.value)}
                  placeholder="Protocol (optional, e.g. ERC-20)"
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
                <input
                  value={registerNetwork}
                  onChange={(e) => setRegisterNetwork(e.target.value)}
                  placeholder="Network (optional, e.g. Ethereum)"
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
              </div>
              <select
                value={registerStatus}
                onChange={(e) => setRegisterStatus(e.target.value as AssetStatus)}
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              >
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <button className="accent-button w-full py-2" type="submit">Register Holding</button>
              <p className="text-xs text-slate-500">
                Note: holdings shown here are loaded from PostgreSQL-backed custody cases.
              </p>
            </form>
          </FormContainer>
          ) : null}

          {showTransfers ? (
            user && !isReadOnlyRole(user.role) ? (
              <FormContainer title="Transfer & Custody Actions (Demo Safe)">
                <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-200">Transfer request</p>
                <p className="text-xs text-slate-500 mb-3">Creates an approval-style record only. No signing, no chain execution.</p>
                <form className="space-y-3" onSubmit={onSubmitTransferRequest}>
                  <input
                    value={transferWalletRef}
                    onChange={(e) => setTransferWalletRef(e.target.value)}
                    placeholder="Wallet reference (required)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <input
                    value={transferCaseId}
                    onChange={(e) => setTransferCaseId(e.target.value)}
                    placeholder="Related case ID (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={transferSymbol}
                      onChange={(e) => setTransferSymbol(e.target.value.toUpperCase())}
                      placeholder="Asset symbol"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                    <input
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={transferProtocol}
                      onChange={(e) => setTransferProtocol(e.target.value)}
                      placeholder="Protocol (optional)"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                    <input
                      value={transferNetwork}
                      onChange={(e) => setTransferNetwork(e.target.value)}
                      placeholder="Network (optional)"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                  </div>
                  <input
                    value={transferDestination}
                    onChange={(e) => setTransferDestination(e.target.value)}
                    placeholder="Destination (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <input
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <button className="accent-button w-full py-2" type="submit">Create Transfer Request</button>
                </form>
              </div>

              <div className="border-t border-slate-800 pt-5">
                <p className="text-xs font-semibold tracking-wide text-slate-200">Custody movement / custody change</p>
                <p className="text-xs text-slate-500 mb-3">Operational record only (internal movement / control change).</p>
                <form className="space-y-3" onSubmit={onSubmitCustodyMovement}>
                  <input
                    value={movementWalletRef}
                    onChange={(e) => setMovementWalletRef(e.target.value)}
                    placeholder="Wallet reference (required)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <input
                    value={movementCaseId}
                    onChange={(e) => setMovementCaseId(e.target.value)}
                    placeholder="Related case ID (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={movementSymbol}
                      onChange={(e) => setMovementSymbol(e.target.value.toUpperCase())}
                      placeholder="Asset symbol"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                    <input
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={movementProtocol}
                      onChange={(e) => setMovementProtocol(e.target.value)}
                      placeholder="Protocol (optional)"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                    <input
                      value={movementNetwork}
                      onChange={(e) => setMovementNetwork(e.target.value)}
                      placeholder="Network (optional)"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                  </div>
                  <input
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="Movement notes (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <button className="accent-button w-full py-2" type="submit">Create Custody Movement</button>
                </form>
              </div>

              <div className="border-t border-slate-800 pt-5">
                <p className="text-xs font-semibold tracking-wide text-slate-200">Release request</p>
                <p className="text-xs text-slate-500 mb-3">Creates a release request record only. No signing, no execution.</p>
                <form className="space-y-3" onSubmit={onSubmitReleaseRequest}>
                  <input
                    value={releaseWalletRef}
                    onChange={(e) => setReleaseWalletRef(e.target.value)}
                    placeholder="Wallet reference (required)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <input
                    value={releaseCaseId}
                    onChange={(e) => setReleaseCaseId(e.target.value)}
                    placeholder="Related case ID (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={releaseSymbol}
                      onChange={(e) => setReleaseSymbol(e.target.value.toUpperCase())}
                      placeholder="Asset symbol"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                    <input
                      value={releaseAmount}
                      onChange={(e) => setReleaseAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={releaseProtocol}
                      onChange={(e) => setReleaseProtocol(e.target.value)}
                      placeholder="Protocol (optional)"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                    <input
                      value={releaseNetwork}
                      onChange={(e) => setReleaseNetwork(e.target.value)}
                      placeholder="Network (optional)"
                      className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                    />
                  </div>
                  <input
                    value={releaseDestination}
                    onChange={(e) => setReleaseDestination(e.target.value)}
                    placeholder="Destination (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <input
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                  />
                  <button className="accent-button w-full py-2" type="submit">Create Release Request</button>
                </form>
              </div>
              </div>
            </FormContainer>
            ) : (
              <FormContainer title="Transfer & Custody Actions (Demo Safe)">
                <p className="text-sm text-slate-400">Custody actions are restricted for auditor/read-only roles.</p>
              </FormContainer>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

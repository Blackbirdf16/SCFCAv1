import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FormContainer from "../components/FormContainer";
import StatusBadge from "../components/StatusBadge";
import { assetsFromCases, listCases, listDocuments, listTickets, uploadDocument } from "../services/scfcaData";
import { useAuth } from "../hooks/useAuth";
import { AssetItem, CaseItem, DocumentItem, Ticket } from "../types";
import { canUploadDocuments, isReadOnlyRole } from "../utils/roles";

export default function CaseDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user || user.role === "auditor") return;

    let mounted = true;
    Promise.all([listCases(), listDocuments(), listTickets()])
      .then(([caseItems, documentItems, ticketItems]) => {
        if (!mounted) return;
        setCases(caseItems);
        setDocuments(documentItems);
        setTickets(ticketItems);
        setAssets(assetsFromCases(caseItems));
      })
      .catch((error) => {
        console.error(error);
        if (mounted) setUploadError("Unable to load case details from the backend.");
      });
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const visibleCases = cases;

  const selectedCaseId = searchParams.get("caseId");

  useEffect(() => {
    if (!visibleCases.length) return;
    if (selectedCaseId && visibleCases.some((c) => c.id === selectedCaseId)) return;

    const nextId = visibleCases[0].id;
    setSearchParams({ caseId: nextId }, { replace: true });
  }, [selectedCaseId, setSearchParams, visibleCases]);

  const selected = useMemo(() => {
    if (!selectedCaseId) return null;
    return visibleCases.find((c) => c.id === selectedCaseId) ?? null;
  }, [selectedCaseId, visibleCases]);

  const visibleTickets = tickets;
  const visibleDocuments = documents;

  const linkedAssets = useMemo(() => {
    if (!selected) return [];
    return assets.filter((a) => a.walletRef && a.walletRef === selected.walletRef);
  }, [assets, selected]);

  const linkedTickets = useMemo(() => {
    if (!selected) return [];
    return visibleTickets.filter((t) => t.caseId === selected.id);
  }, [selected, visibleTickets]);

  const linkedDocuments = useMemo(() => {
    if (!selected) return [];
    return visibleDocuments.filter((d) => (d.caseId && d.caseId === selected.id) || (d.walletRef && d.walletRef === selected.walletRef));
  }, [selected, visibleDocuments]);

  const canViewRestricted = useMemo(() => {
    if (!user || !selected) return false;
    if (user.role === "administrator") return true;
    if (user.role === "regular") return true;
    return false;
  }, [selected, user]);

  const canUploadForSelected = useMemo(() => {
    if (!user || !selected) return false;
    if (isReadOnlyRole(user.role) || !canUploadDocuments(user.role)) return false;
    if (user.role === "administrator") return true;
    return user.role === "regular";
  }, [selected, user]);

  const downloadDocument = (docId: string) => {
    window.open(`http://127.0.0.1:8000/api/v1/documents/${encodeURIComponent(docId)}/download`, "_blank");
  };

  const onUploadSupportingPdf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError("");
    if (!user || !selected) return;
    if (!canUploadForSelected) {
      setUploadError("You do not have permission to upload supporting documents for this case.");
      return;
    }

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("supportingPdf") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setUploadError("Select a PDF file to upload.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF documents are allowed.");
      return;
    }

    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("caseId", selected.id);
      payload.append("walletRef", selected.walletRef);
      payload.append("file", file);

      const doc = await uploadDocument(payload);
      if (doc && doc.id) {
        setDocuments(await listDocuments());
        if (fileInput) fileInput.value = "";
      }
    } catch (err: any) {
      console.error(err);
      setUploadError("Upload failed. Check backend status and permissions.");
    } finally {
      setUploading(false);
    }
  };

  if (user?.role === "auditor") {
    return (
      <div className="panel p-5 text-sm text-slate-300">
        Operational case details are not available to auditors. Use Audit Events for case references, ticket references, action status, and timestamps.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Case Details</h1>
        <button className="accent-button px-3 py-2 text-sm" type="button" onClick={() => navigate("/cases")}>Back to Case List</button>
      </div>

      <FormContainer title="Custody Case Details">
        {selected ? (
          <div className="text-sm space-y-4 text-slate-200">
            <div className="space-y-2">
              <p><span className="text-slate-400">Case ID:</span> {selected.id}</p>
              <p><span className="text-slate-400">Wallet reference:</span> <span className="font-mono text-xs text-slate-300">{selected.walletRef}</span></p>
              <p><span className="text-slate-400">Investigation name:</span> {selected.title}</p>
              <p><span className="text-slate-400">Assigned handler:</span> {selected.handler}</p>
              <p><span className="text-slate-400">Custody status:</span> <StatusBadge status={selected.custodyStatus} /></p>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Case description</div>
              <p className="text-sm text-slate-300">{selected.summary ?? "—"}</p>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Restricted personal data / notes</div>
              {canViewRestricted ? (
                <p className="text-sm text-slate-300">{selected.restrictedNotes ?? "—"}</p>
              ) : (
                <p className="text-sm text-slate-500">Restricted. Visible only to the assigned case handler and administrators.</p>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Linked assets / coin balances</div>
              {linkedAssets.length > 0 ? (
                <div className="space-y-2">
                  {linkedAssets.map((a) => (
                    <div key={a.id} className="rounded-md border border-slate-700/50 bg-dark-card/30 px-3 py-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">{a.symbol}</div>
                        <div className="text-xs text-slate-400">{a.network} · {a.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-100">{a.balance ?? 0}</div>
                        <div className="text-xs text-slate-400"><StatusBadge status={a.status} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No linked assets found for this wallet reference.</p>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Linked tickets</div>
              {linkedTickets.length > 0 ? (
                <div className="space-y-2">
                  {linkedTickets.map((t) => (
                    <div key={t.id} className="rounded-md border border-slate-700/50 bg-dark-card/30 px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{t.ticketType.replace(/_/g, " ")}</div>
                        <div className="text-xs text-slate-400">{t.id} · Case {t.caseId}</div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No tickets linked to this case.</p>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Supporting documents</div>
              {linkedDocuments.length > 0 ? (
                <div className="space-y-2">
                  {linkedDocuments.map((d) => (
                    <div key={d.id} className="rounded-md border border-slate-700/50 bg-dark-card/30 px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">{d.name}</div>
                        <div className="text-xs text-slate-400">{d.docType ? `${d.docType} · ` : ""}{d.id} · {d.createdAt}</div>
                      </div>
                      {canViewRestricted ? (
                        <button type="button" className="accent-button px-3 py-1 text-xs" onClick={() => downloadDocument(d.id)}>
                          Download
                        </button>
                      ) : (
                        <div className="text-xs text-slate-500">Restricted</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No documents linked to this case/wallet reference.</p>
              )}
            </div>

            {canUploadForSelected ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Upload supporting PDF</div>
                <form className="space-y-2" onSubmit={onUploadSupportingPdf}>
                  <input
                    name="supportingPdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="w-full text-sm text-slate-300"
                  />
                  {uploadError ? <div className="text-xs text-rose-300">{uploadError}</div> : null}
                  <button className="accent-button w-full py-2 text-sm" type="submit" disabled={uploading}>
                    {uploading ? "Uploading…" : "Upload PDF"}
                  </button>
                  <p className="text-xs text-slate-500">Contents are restricted to the assigned handler and administrators.</p>
                </form>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No case selected. Go back to the case list and pick one.</p>
        )}
      </FormContainer>
    </div>
  );
}

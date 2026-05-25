import { FormEvent, useEffect, useMemo, useState } from "react";
import FormContainer from "../components/FormContainer";
import TableWrapper from "../components/TableWrapper";
import { useAuth } from "../hooks/useAuth";
import { listCases, listDocuments, registerDocument as registerDocumentMetadata } from "../services/scfcaData";
import { CaseItem, DocumentItem } from "../types";
import { canUploadDocuments, isReadOnlyRole } from "../utils/roles";

export default function Documents() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("");
  const [hash, setHash] = useState("");
  const [caseId, setCaseId] = useState("");
  const [walletRef, setWalletRef] = useState("");
  const [verificationResult, setVerificationResult] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    Promise.all([listDocuments(), listCases()])
      .then(([documentItems, caseItems]) => {
        if (!mounted) return;
        setDocuments(documentItems);
        setCases(caseItems);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setError("Unable to load document metadata from the backend.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const assignedCaseIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(cases.map((c) => c.id));
  }, [cases, user]);

  const visibleDocuments = documents;

  const canViewContent = (doc: DocumentItem): boolean => {
    if (!user) return false;
    if (user.role === "administrator") return true;
    if (user.role === "auditor") return false;
    return !!doc.caseId && assignedCaseIds.has(doc.caseId);
  };

  const downloadDocument = (docId: string) => {
    window.open(`http://127.0.0.1:8000/api/v1/documents/${encodeURIComponent(docId)}/download`, "_blank");
  };

  const registerDocument = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!user) return;

    const canUpload = canUploadDocuments(user.role);
    const readOnly = isReadOnlyRole(user.role);
    if (readOnly || !canUpload) {
      setError("Your role is read-only and cannot upload documents.");
      return;
    }
    if (!name || !hash) return;
    if (!name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF documents are allowed.");
      return;
    }

    const normalizedCaseId = caseId ? caseId.trim().toUpperCase() : "";
    if (user.role === "regular") {
      if (!normalizedCaseId) {
        setError("Regular users must link uploads to an assigned custody case.");
        return;
      }
      if (!assignedCaseIds.has(normalizedCaseId)) {
        setError("Regular users can only upload documents for assigned custody cases.");
        return;
      }
    }

    setBusy(true);
    try {
      const doc = await registerDocumentMetadata({
        name,
        docType: docType || undefined,
        hash,
        createdAt: new Date().toISOString().slice(0, 10),
        caseId: normalizedCaseId || undefined,
        walletRef: walletRef ? walletRef.toUpperCase() : undefined
      });

      if (doc && doc.id) {
        setDocuments(await listDocuments());
        setName("");
        setDocType("");
        setHash("");
        setCaseId("");
        setWalletRef("");
      }
    } catch (err: any) {
      console.error(err);
      setError("Register failed. Check backend status and permissions.");
    } finally {
      setBusy(false);
    }
  };

  const verifyIntegrity = () => {
    if (!hash) {
      setVerificationResult("Provide a hash to verify integrity.");
      return;
    }
    const exists = documents.some((item) => item.hash === hash);
    setVerificationResult(exists ? "Integrity verified: matching hash found." : "No matching hash found.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TableWrapper title="Registered Documents">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2">Document ID</th>
                <th className="py-2">Case ID</th>
                <th className="py-2">Wallet Ref</th>
                <th className="py-2">Type</th>
                <th className="py-2">Name</th>
                <th className="py-2">Hash</th>
                <th className="py-2">Created</th>
                <th className="py-2">Uploaded By</th>
                <th className="py-2">Access</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-800">
                  <td className="py-2">{doc.id}</td>
                  <td className="py-2">{doc.caseId ?? "—"}</td>
                  <td className="py-2 font-mono text-xs text-slate-300">{doc.walletRef ?? "—"}</td>
                  <td className="py-2">{doc.docType ?? "—"}</td>
                  <td className="py-2">{doc.name}</td>
                  <td className="py-2">{doc.hash}</td>
                  <td className="py-2">{doc.createdAt}</td>
                  <td className="py-2 text-slate-300">{doc.uploadedBy ?? "—"}</td>
                  <td className="py-2">
                    {canViewContent(doc) ? (
                      <button className="accent-button px-3 py-1 text-xs" type="button" onClick={() => downloadDocument(doc.id)}>
                        Download
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Restricted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      </div>

      <div className="space-y-6">
        {user && !isReadOnlyRole(user.role) ? (
          <FormContainer title="Upload/Register Document">
            <form className="space-y-3" onSubmit={registerDocument}>
              <input
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder={user.role === "regular" ? "Assigned case ID (required)" : "Case ID (optional)"}
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={walletRef}
                onChange={(e) => setWalletRef(e.target.value)}
                placeholder="Wallet reference (optional)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                placeholder="Document type (optional)"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Document name"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              <input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Document hash"
                className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
              />
              {error ? <div className="text-xs text-rose-300">{error}</div> : null}
              <button className="accent-button w-full py-2" type="submit" disabled={busy}>
                {busy ? "Registering…" : "Register"}
              </button>
              {user.role === "regular" ? (
                <p className="text-xs text-slate-500">Regular users can upload only for assigned cases.</p>
              ) : null}
            </form>
          </FormContainer>
        ) : (
          <FormContainer title="Upload/Register Document">
            <p className="text-sm text-slate-400">Document upload is restricted for this role.</p>
          </FormContainer>
        )}

        <FormContainer title="Integrity Verification">
          <button className="accent-button w-full py-2" type="button" onClick={verifyIntegrity}>
            Verify Current Hash
          </button>
          {verificationResult && <p className="text-sm text-slate-300">{verificationResult}</p>}
        </FormContainer>
      </div>
    </div>
  );
}

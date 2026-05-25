import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import FormContainer from "../components/FormContainer";
import { useAuth } from "../hooks/useAuth";
import { pocStore } from "../services/pocStore";
import { listDocuments, listTickets } from "../services/scfcaData";
import type { UserProfile } from "../types";

type SettingsSection = "profile" | "privacy";

function resolveSection(pathname: string): SettingsSection {
  if (pathname.startsWith("/settings/privacy")) return "privacy";
  return "profile";
}

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

function initialsFor(profile: UserProfile | null, fallback: string): string {
  const base = profile?.nickname?.trim() || profile?.fullName?.trim() || fallback;
  const parts = base.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase()).join("");
  return initials || "U";
}

export default function Settings() {
  const { user } = useAuth();
  const location = useLocation();
  const section = resolveSection(location.pathname);

  const username = user?.username ?? "demo";

  const storedProfile = useMemo(() => (user ? pocStore.getProfile(user.username) : { fullName: "", nickname: "" }), [user]);
  const [fullName, setFullName] = useState(storedProfile.fullName);
  const [nickname, setNickname] = useState(storedProfile.nickname);
  const [savedMessage, setSavedMessage] = useState<string>("");

  useEffect(() => {
    setFullName(storedProfile.fullName);
    setNickname(storedProfile.nickname);
  }, [storedProfile.fullName, storedProfile.nickname]);

  const profile: UserProfile = { fullName, nickname };

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    pocStore.setProfile(user.username, {
      fullName: fullName.trim(),
      nickname: nickname.trim()
    });

    setSavedMessage("Profile saved locally (PoC).");
    setTimeout(() => setSavedMessage(""), 2000);
  };

  const downloadPersonalData = async () => {
    const [visibleTickets, visibleDocuments] = user ? await Promise.all([listTickets(), listDocuments()]) : [[], []];
    const tickets = user ? visibleTickets.filter((ticket) => (ticket.createdBy ?? "") === user.username) : [];
    const documents = user ? visibleDocuments.filter((document) => (document.uploadedBy ?? "") === user.username) : [];

    downloadJson(`scfca_personal_data_${new Date().toISOString().slice(0, 10)}.json`, {
      generatedAt: new Date().toISOString(),
      principal: user ? { username: user.username, role: user.role } : null,
      profile: user ? pocStore.getProfile(user.username) : null,
      tickets,
      documents
    });
  };

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Settings</h1>
            <p className="mt-1 text-sm text-slate-400">Profile preferences and privacy actions (demo-only).</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <NavLink
              to="/settings/profile"
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md border transition ${
                  isActive
                    ? "border-slate-500/40 bg-dark-card/60 text-slate-100"
                    : "border-slate-700/50 bg-slate-700/10 text-slate-300 hover:bg-slate-700/20 hover:text-slate-100"
                }`
              }
            >
              Profile
            </NavLink>
            <NavLink
              to="/settings/privacy"
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md border transition ${
                  isActive
                    ? "border-slate-500/40 bg-dark-card/60 text-slate-100"
                    : "border-slate-700/50 bg-slate-700/10 text-slate-300 hover:bg-slate-700/20 hover:text-slate-100"
                }`
              }
            >
              Privacy
            </NavLink>
          </div>
        </div>
      </div>

      {section === "profile" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FormContainer title="Profile">
              <div className="flex items-center gap-4 rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                <div className="h-12 w-12 rounded-full bg-slate-700/70 border border-slate-600/40 flex items-center justify-center text-slate-100 font-semibold">
                  {initialsFor(storedProfile, username)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">Avatar (placeholder)</div>
                  <div className="text-xs text-slate-400">This PoC does not upload/store real images.</div>
                </div>
              </div>

              <form className="space-y-3" onSubmit={saveProfile}>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname"
                  className="w-full rounded-md border border-slate-700 bg-dark px-3 py-2"
                />

                <button className="accent-button w-full py-2" type="submit">Save</button>
                {savedMessage ? <p className="text-xs text-emerald-300">{savedMessage}</p> : null}
              </form>
            </FormContainer>
          </div>

          <div className="space-y-6">
            <FormContainer title="Preview">
              <div className="text-sm text-slate-300 space-y-2">
                <div>
                  <span className="text-slate-400">Username:</span> {user?.username ?? "—"}
                </div>
                <div>
                  <span className="text-slate-400">Full name:</span> {profile.fullName.trim() ? profile.fullName : "—"}
                </div>
                <div>
                  <span className="text-slate-400">Nickname:</span> {profile.nickname.trim() ? profile.nickname : "—"}
                </div>
              </div>
            </FormContainer>
          </div>
        </div>
      ) : null}

      {section === "privacy" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FormContainer title="Privacy">
              <div className="rounded-lg border border-slate-700/50 bg-dark-card/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Download personal data</div>
                <div className="mt-2 text-sm text-slate-200">
                  Exports your local profile preferences and backend-visible tickets/documents attributed to your username (PoC).
                </div>
                <button
                  type="button"
                  className="accent-button mt-3 px-3 py-2 text-sm"
                  onClick={downloadPersonalData}
                >
                  Download
                </button>
                <div className="mt-2 text-xs text-slate-500">Generated in-browser; no external transmission.</div>
              </div>
            </FormContainer>
          </div>

          <div className="space-y-6">
            <FormContainer title="Notes">
              <div className="text-sm text-slate-300 space-y-2">
                <p>Settings are demo-only and stored in localStorage.</p>
                <p className="text-xs text-slate-500">Clear your browser storage to reset.</p>
              </div>
            </FormContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";

function titleFromPath(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/cases")) return "Cases";
  if (pathname.startsWith("/assets")) return "Assets";
  if (pathname.startsWith("/tickets")) return "Tickets";
  if (pathname.startsWith("/audit")) return "Audit";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/help")) return "Help / Chat";
  return "SCFCA";
}

function deriveUid(seed: string): string {
  let hash = 0;
  for (const ch of seed) {
    const cp = ch.codePointAt(0) ?? 0;
    hash = Math.trunc(hash * 31 + cp);
    hash = hash % 2147483647;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const uid = useMemo(() => {
    const seed = `${user?.username ?? "demo"}:${user?.role ?? "unknown"}:${user?.token ?? ""}`;
    return deriveUid(seed);
  }, [user?.role, user?.token, user?.username]);

  return (
    <header className="h-16 px-6 flex items-center gap-4 theme-panel" style={{ borderBottom: "1px solid var(--scfca-border)" }}>
      <div className="flex items-baseline gap-3 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight theme-text truncate">{titleFromPath(location.pathname)}</h2>
        <div className="hidden lg:block text-xs theme-muted">Institutional custody PoC</div>
      </div>

      <div className="flex-1 hidden md:block">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases, wallet refs, documents…"
          className="w-full max-w-xl px-3 py-2 text-sm transition theme-card"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <button type="button" className="px-3 py-2 text-sm border transition theme-card theme-text" onClick={() => navigate("/help/chat")}>
            Help
          </button>
          <button type="button" className="px-3 py-2 text-sm border transition theme-card theme-text" onClick={() => navigate("/help/chat")}>
            Chat
          </button>
        </div>

        <div className="text-right leading-tight">
          <div className="text-sm font-semibold theme-text">{user?.username ?? "demo"}</div>
          <div className="text-[11px] theme-muted">
            <span>UID </span>
            <span className="font-mono">{uid}</span>
            <span className="mx-1">·</span>
            <span>{user?.role ?? "unknown"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
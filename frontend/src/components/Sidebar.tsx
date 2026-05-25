import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Role } from "../types";

interface NavItem {
  label: string;
  path: string;
  roles: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL_ROLES: Role[] = ["regular", "administrator", "auditor"];

const dashboardItem: NavItem = { label: "Dashboard", path: "/dashboard", roles: ALL_ROLES };

const navGroups: NavGroup[] = [
  {
    label: "Cases",
    items: [
      { label: "Case List", path: "/cases", roles: ALL_ROLES },
      { label: "Case Details", path: "/cases/details", roles: ALL_ROLES }
    ]
  },
  {
    label: "Assets",
    items: [
      { label: "Overview", path: "/assets", roles: ALL_ROLES },
      { label: "Wallet Holdings", path: "/assets/holdings", roles: ALL_ROLES },
      { label: "Transfers", path: "/assets/transfers", roles: ALL_ROLES }
    ]
  },
  {
    label: "Tickets",
    items: [
      { label: "Open Tickets", path: "/tickets/open", roles: ALL_ROLES },
      { label: "Approvals", path: "/tickets/approvals", roles: ["administrator"] }
    ]
  },
  {
    label: "Audit",
    items: [{ label: "Audit Events", path: "/audit", roles: ["administrator", "auditor"] }]
  },
  {
    label: "Documents",
    items: [
      { label: "Registered Documents", path: "/documents/registered", roles: ALL_ROLES },
      { label: "Integrity Verification", path: "/documents/integrity", roles: ALL_ROLES }
    ]
  },
  {
    label: "Account",
    items: [
      { label: "Identification", path: "/account/identification", roles: ALL_ROLES },
      { label: "Security Statement", path: "/account/security-statement", roles: ALL_ROLES },
      { label: "Reports", path: "/account/reports", roles: ["administrator", "auditor"] }
    ]
  },
  {
    label: "Settings",
    items: [
      { label: "Profile", path: "/settings/profile", roles: ALL_ROLES },
      { label: "Privacy", path: "/settings/privacy", roles: ALL_ROLES }
    ]
  },
  {
    label: "Help / Chat",
    items: [{ label: "Help / Chat", path: "/help/chat", roles: ALL_ROLES }]
  }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role;

  const visibleGroups = useMemo(() => {
    if (!role) return [];
    return navGroups
      .map((group) => ({
        label: group.label,
        items: group.items.filter((item) => item.roles.includes(role))
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  const isDashboardVisible = Boolean(role) && dashboardItem.roles.includes(role as Role);

  const initialExpanded = useMemo(() => {
    const expandedState: Record<string, boolean> = {};
    for (const group of navGroups) {
      expandedState[group.label] = group.items.some((item) => location.pathname.startsWith(item.path));
    }
    return expandedState;
  }, [location.pathname]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => initialExpanded);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const group of navGroups) {
        const isActive = group.items.some((item) => location.pathname.startsWith(item.path));
        if (isActive) next[group.label] = true;
      }
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-64 flex flex-col py-6 px-4 theme-panel" style={{ borderRightWidth: 1 }}>
      <div className="mb-6">
        <div className="theme-text text-2xl font-semibold tracking-tight">SCFCA</div>
        <p className="text-xs theme-muted mt-1">Secure Custody Framework</p>
      </div>
      <nav className="flex-1">
        {isDashboardVisible ? (
          <NavLink
            to={dashboardItem.path}
            className={({ isActive }) =>
              `block py-2 px-4 rounded-lg mb-3 font-medium transition border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 ${
                isActive
                  ? "theme-card theme-text"
                  : "theme-text hover:bg-[color-mix(in_srgb,var(--scfca-card)_72%,transparent)]"
              }`
            }
          >
            {dashboardItem.label}
          </NavLink>
        ) : null}

        <div className="space-y-1">
          {visibleGroups.map((group) => {
            const isGroupActive = group.items.some((item) => location.pathname.startsWith(item.path));
            const isOpen = Boolean(expanded[group.label]);

            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center justify-between py-2 px-4 rounded-lg transition border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 ${
                    isGroupActive
                      ? "theme-card theme-text"
                      : "theme-text hover:bg-[color-mix(in_srgb,var(--scfca-card)_72%,transparent)]"
                  }`}
                >
                  <span className="text-sm font-medium">{group.label}</span>
                  <span
                    className={`w-4 text-center theme-muted text-xs transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`}
                  >
                    ▸
                  </span>
                </button>

                {isOpen ? (
                  <div className="mt-1 ml-3 pl-3 space-y-0.5 theme-border" style={{ borderLeftWidth: 1 }}>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `block py-1.5 px-3 rounded-md text-sm transition border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 ${
                            isActive
                              ? "theme-card theme-text"
                              : "theme-text hover:bg-[color-mix(in_srgb,var(--scfca-card)_72%,transparent)]"
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>
      <div className="pt-4 text-xs theme-text theme-border" style={{ borderTopWidth: 1 }}>
        <div className="mb-2">
          Signed in as <span className="theme-accent font-semibold">{user?.username ?? "demo"}</span>
        </div>
        <div className="mb-3">
          Role <span className="theme-text font-semibold">{user?.role ?? "N/A"}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full py-2 border transition theme-card theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

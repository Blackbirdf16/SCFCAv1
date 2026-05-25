import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Cases from "../pages/Cases";
import CaseDetails from "../pages/CaseDetails";
import Assets from "../pages/Assets";
import Tickets from "../pages/Tickets";
import Audit from "../pages/Audit";
import Documents from "../pages/Documents";
import Account from "../pages/Account";
import Settings from "../pages/Settings";
import PlaceholderPage from "../pages/PlaceholderPage";
import Chat from "../pages/Chat";
import { useAuth } from "../hooks/useAuth";

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <DashboardLayout />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/details" element={<CaseDetails />} />

        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/holdings" element={<Assets view="holdings" />} />
        <Route path="/assets/transfers" element={<Assets view="transfers" />} />

        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/open" element={<Tickets />} />
        <Route path="/tickets/approvals" element={<Tickets />} />

        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/registered" element={<Documents />} />
        <Route path="/documents/integrity" element={<Documents />} />

        <Route
          path="/account/identification"
          element={<Account />}
        />
        <Route
          path="/account/security-statement"
          element={<Account />}
        />
        <Route
          path="/account/reports"
          element={<Account />}
        />

        <Route
          path="/settings/profile"
          element={<Settings />}
        />
        <Route
          path="/settings/privacy"
          element={<Settings />}
        />

        <Route
          path="/help/chat"
          element={<Chat />}
        />

        <Route path="/audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

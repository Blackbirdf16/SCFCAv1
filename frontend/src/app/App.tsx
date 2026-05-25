import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import AppRoutes from "./routes";
import "../styles/tailwind.css";
import { AuthProvider, useAuth } from "../hooks/useAuth";

function ThemeSync() {
  const { user } = useAuth();

  useEffect(() => {
    const roleClass =
      user?.role === "administrator"
        ? "theme-administrator"
        : user?.role === "auditor"
          ? "theme-auditor"
          : "theme-regular";

    document.body.classList.remove("theme-regular", "theme-administrator", "theme-auditor");
    document.body.classList.add(roleClass);

    return () => {
      document.body.classList.remove(roleClass);
    };
  }, [user?.role]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ThemeSync />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;

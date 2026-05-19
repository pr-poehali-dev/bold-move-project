import { useState, useEffect } from "react";
import { setCrmToken } from "./admin/crm/crmApi";
import { useAuth, hasPermission } from "@/context/AuthContext";
import type { Theme } from "./admin/crm/themeContext";
import { AdminPanelLoadingScreen, AdminPanelAccessScreen } from "./AdminPanelAccess";
import { TrialBanner } from "./admin/TrialBanner";
import CrmPanel from "./admin/crm/CrmPanel";


const ALLOWED_ROLES = ["installer", "company", "manager"];

export default function CrmPage() {
  const { user, token: authToken, loading, logout: authLogout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [crmReady, setCrmReady]   = useState(false);
  const [theme]                   = useState<Theme>("dark");

  const initialOrderId = new URLSearchParams(window.location.search).get("order")
    ? Number(new URLSearchParams(window.location.search).get("order"))
    : null;

  const hasAccess =
    !!user &&
    !!authToken &&
    user.approved &&
    (user.is_master || ALLOWED_ROLES.includes(user.role));

  const canCrm = hasPermission(user, "crm_view");

  useEffect(() => {
    if (hasAccess && authToken) {
      setCrmToken(authToken);
      setCrmReady(true);
    } else {
      setCrmReady(false);
    }
  }, [hasAccess, authToken]);

  const logout = () => {
    setCrmToken(null);
    authLogout();
  };

  if (loading) return <AdminPanelLoadingScreen />;

  if (!hasAccess) {
    return (
      <AdminPanelAccessScreen
        user={user}
        showLogin={showLogin}
        setShowLogin={setShowLogin}
        logout={logout}
      />
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", background: "#07070f", color: "#fff" }}>
      {user.role === "company" && <TrialBanner user={user} isDark={true} />}

      <div className="flex-1 overflow-hidden">
        {canCrm
          ? crmReady
            ? <CrmPanel
                theme={theme}
                initialOrderId={initialOrderId}
                initialTab={(new URLSearchParams(window.location.search).get("crm_tab") as "analytics" | "clients" | "orders" | "calendar" | "kanban" | null) ?? undefined}
              />
            : <div className="flex items-center justify-center h-full">
                <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
          : <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <p className="text-sm font-semibold text-white/60">Нет доступа к CRM</p>
              <p className="text-xs text-white/30">Обратитесь к администратору компании</p>
            </div>
        }
      </div>
    </div>
  );
}
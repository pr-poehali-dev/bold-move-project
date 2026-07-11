import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { setCrmToken } from "./admin/crm/crmApi";
import { AdminPanelLoadingScreen, AdminPanelAccessScreen } from "./AdminPanelAccess";
import UserDropdown from "@/components/UserDropdown";
import ProfileModal from "@/components/ProfileModal";
import QuickAccessBar from "@/components/QuickAccessBar";
import BugReportPanel from "./admin/bug-report/BugReportPanel";

export default function BugReportPage() {
  const { user, token: authToken, loading, logout: authLogout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigate = useNavigate();

  const hasAccess = !!user && !!authToken && user.approved;

  useEffect(() => {
    if (hasAccess && authToken) setCrmToken(authToken);
  }, [hasAccess, authToken]);

  const logout = () => { setCrmToken(null); authLogout(); };

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

  const navBtn = (label: string, icon: string, path: string, active = false) => (
    <button onClick={() => navigate(path)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-white/[0.08]"
      style={{
        background: active ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#fb923c" : "rgba(255,255,255,0.7)",
      }}>
      <Icon name={icon} size={12} /> {label}
    </button>
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", background: "#07070f", color: "#fff" }}>
      {/* Шапка */}
      <header className="shrink-0 flex items-center h-12 px-4 md:px-6 border-b border-white/[0.05] bg-[#0d0d14]/80 backdrop-blur-xl z-30">
        <span className="font-montserrat font-black text-sm tracking-wide">
          Баг<span style={{ color: "#f97316" }}>-репорт</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <nav className="hidden md:flex items-center gap-1">
            {navBtn("Агент", "Bot", "/")}
            {navBtn("CRM", "ClipboardList", "/crm")}
            {navBtn("Построитель", "Layers", "/plan")}
            {navBtn("Баг-репорт", "Bug", "/bug-report", true)}
          </nav>
          {user ? <UserDropdown onShowProfile={() => setShowProfileModal(true)} /> : null}
        </div>
      </header>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <BugReportPanel />
      </div>

      <QuickAccessBar />
      <ProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
}

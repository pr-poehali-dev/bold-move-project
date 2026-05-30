import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QuickAccessBar from "@/components/QuickAccessBar";
import { setCrmToken } from "./admin/crm/crmApi";
import { useAuth, hasPermission } from "@/context/AuthContext";
import type { AgentSubTab } from "./admin/types";
import type { Theme } from "./admin/crm/themeContext";

import { buildMainTabs, MainTab } from "./AdminPanelDropdowns";
import { AdminPanelLoadingScreen, AdminPanelAccessScreen } from "./AdminPanelAccess";
import { AdminPanelHeader } from "./AdminPanelHeader";
import { AdminPanelContent } from "./AdminPanelContent";
import { TrialBanner } from "./admin/TrialBanner";


// Роли с доступом к /company
const ALLOWED_ROLES = ["installer", "company", "manager"];

export default function AdminPanel() {
  const { user, token: authToken, loading, logout: authLogout } = useAuth();
  const navigate = useNavigate();

  // Редирект /company?tab=crm → /crm
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "crm") {
      navigate("/crm", { replace: true });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const [showLogin, setShowLogin] = useState(false);
  const LS_AGENT_TAB_KEY = "admin_agent_tab";
  const [agentTab, setAgentTabRaw] = useState<AgentSubTab>(
    (localStorage.getItem(LS_AGENT_TAB_KEY) as AgentSubTab | null) ?? "prices"
  );
  const setAgentTab = (tab: AgentSubTab) => { setAgentTabRaw(tab); localStorage.setItem(LS_AGENT_TAB_KEY, tab); };
  const [newItemHint, setNewItemHint] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const hasAccess =
    !!user &&
    !!authToken &&
    user.approved &&
    (user.is_master || ALLOWED_ROLES.includes(user.role));

  const canAgent = hasPermission(user, "agent_view");
  const hasTeam  = (user?.role === "company" || !!user?.is_master) && !user?.is_demo;
  const mainTabs = buildMainTabs(false, canAgent, hasTeam);

  const agentPerms = {
    prices:      { view: hasPermission(user, "prices_view"),      edit: hasPermission(user, "prices_edit") },
    rules:       { view: hasPermission(user, "rules_view"),       edit: hasPermission(user, "rules_edit") },
    prompt:      { view: hasPermission(user, "prompt_view"),      edit: hasPermission(user, "prompt_edit") },
    faq:         { view: hasPermission(user, "faq_view"),         edit: hasPermission(user, "faq_edit") },
    corrections: { view: hasPermission(user, "corrections_view"), edit: hasPermission(user, "corrections_edit") },
  } as const;

  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get("tab") as MainTab | null;
  const LS_TAB_KEY = "admin_main_tab";
  const savedTab = localStorage.getItem(LS_TAB_KEY) as MainTab | null;
  const [mainTab, setMainTab] = useState<MainTab>(urlTab ?? savedTab ?? "agent");

  useEffect(() => {
    if (loading || !user) return;
    const allowed = buildMainTabs(
      false,
      hasPermission(user, "agent_view"),
      user.role === "company" || !!user.is_master,
    );
    const preferred = urlTab ?? savedTab;
    const firstTab = allowed[0]?.id ?? "agent";
    const target = preferred && allowed.find(t => t.id === preferred) ? preferred : firstTab;
    setMainTab(target as MainTab);
  }, [loading, user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const safeSetMainTab = (tab: MainTab) => {
    const allowed = mainTabs.map(t => t.id);
    const next = allowed.includes(tab) ? tab : (mainTabs[0]?.id ?? "agent");
    setMainTab(next);
    localStorage.setItem(LS_TAB_KEY, next);
  };

  useEffect(() => {
    if (hasAccess && authToken) {
      setCrmToken(authToken);
    }
  }, [hasAccess, authToken]);

  const handleItemAdded = (name: string) => {
    setNewItemHint(name);
    setMainTab("agent");
    setAgentTab("rules");
    setTimeout(() => setNewItemHint(null), 6000);
  };

  const logout = () => {
    setCrmToken(null);
    authLogout();
  };

  // ── Экран загрузки ──
  if (loading) return <AdminPanelLoadingScreen />;

  // ── Нет доступа ──
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

  const isDark = theme === "dark";
  const headerBg     = isDark ? "#0b0b11" : "#ffffff";
  const headerBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const headerText   = isDark ? "#ffffff" : "#0f1623";

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden"
      style={{ background: isDark ? "#07070f" : "#eef0f6", color: headerText }}>

      {user.role === "company" && <TrialBanner user={user} isDark={isDark} />}
      <AdminPanelHeader
        user={user}
        isDark={isDark}
        mainTab={mainTab}
        mainTabs={mainTabs}
        headerBg={headerBg}
        headerBorder={headerBorder}
        headerText={headerText}
        toggleTheme={toggleTheme}
        safeSetMainTab={safeSetMainTab}
        logout={logout}
      />

      <AdminPanelContent
        mainTab={mainTab}
        canAgent={canAgent}
        hasTeam={hasTeam}
        isDark={isDark}
        agentTab={agentTab}
        setAgentTab={setAgentTab}
        agentPerms={agentPerms}
        authToken={authToken}
        newItemHint={newItemHint}
        handleItemAdded={handleItemAdded}
        user={user}
        mainTabsLength={mainTabs.length}
      />
      <QuickAccessBar />
    </div>
  );
}
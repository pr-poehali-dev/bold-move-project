import { useState, useEffect } from "react";
import { setCrmToken } from "./admin/crm/crmApi";
import { useAuth, hasPermission } from "@/context/AuthContext";
import type { AgentSubTab } from "./admin/types";
import type { Theme } from "./admin/crm/themeContext";

import { buildMainTabs, MainTab } from "./AdminPanelDropdowns";
import { AdminPanelLoadingScreen, AdminPanelAccessScreen } from "./AdminPanelAccess";
import { AdminPanelHeader } from "./AdminPanelHeader";
import { AdminPanelContent } from "./AdminPanelContent";

// Роли с доступом к /company
const ALLOWED_ROLES = ["installer", "company", "manager"];

export default function AdminPanel() {
  const { user, token: authToken, loading, logout: authLogout } = useAuth();

  const [crmReady,  setCrmReady]  = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const initialOrderId = new URLSearchParams(window.location.search).get("order")
    ? Number(new URLSearchParams(window.location.search).get("order"))
    : null;
  const [agentTab, setAgentTab] = useState<AgentSubTab>("prices");
  const [newItemHint, setNewItemHint] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // Признак: текущий пользователь имеет доступ к /company
  const hasAccess =
    !!user &&
    !!authToken &&
    user.approved &&
    (user.is_master || ALLOWED_ROLES.includes(user.role));

  // Права на вкладки
  const canCrm   = hasPermission(user, "crm_view");
  const canAgent = hasPermission(user, "agent_view");
  const hasTeam  = user?.role === "company" || !!user?.is_master;
  const mainTabs = buildMainTabs(canCrm, canAgent, hasTeam);

  // Права агента
  const agentPerms = {
    prices:      { view: hasPermission(user, "prices_view"),      edit: hasPermission(user, "prices_edit") },
    rules:       { view: hasPermission(user, "rules_view"),       edit: hasPermission(user, "rules_edit") },
    prompt:      { view: hasPermission(user, "prompt_view"),      edit: hasPermission(user, "prompt_edit") },
    faq:         { view: hasPermission(user, "faq_view"),         edit: hasPermission(user, "faq_edit") },
    corrections: { view: hasPermission(user, "corrections_view"), edit: hasPermission(user, "corrections_edit") },
  } as const;

  // mainTab — из URL-параметра ?tab=... или первая доступная
  const urlTab = new URLSearchParams(window.location.search).get("tab") as MainTab | null;
  const [mainTab, setMainTab] = useState<MainTab>(urlTab ?? "crm");

  useEffect(() => {
    if (loading || !user) return;
    const allowed = buildMainTabs(
      hasPermission(user, "crm_view"),
      hasPermission(user, "agent_view"),
      user.role === "company" || !!user.is_master,
    );
    const target = urlTab && allowed.find(t => t.id === urlTab) ? urlTab : allowed[0]?.id ?? "crm";
    setMainTab(target);
  }, [loading, user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const safeSetMainTab = (tab: MainTab) => {
    const allowed = mainTabs.map(t => t.id);
    if (allowed.includes(tab)) { setMainTab(tab); return; }
    setMainTab(mainTabs[0]?.id ?? "crm");
  };

  useEffect(() => {
    if (hasAccess && authToken) {
      setCrmToken(authToken);
      setCrmReady(true);
    } else {
      setCrmReady(false);
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
        canCrm={canCrm}
        canAgent={canAgent}
        hasTeam={hasTeam}
        crmReady={crmReady}
        isDark={isDark}
        theme={theme}
        agentTab={agentTab}
        setAgentTab={setAgentTab}
        agentPerms={agentPerms}
        authToken={authToken}
        newItemHint={newItemHint}
        handleItemAdded={handleItemAdded}
        user={user}
        initialOrderId={initialOrderId}
        mainTabsLength={mainTabs.length}
      />
    </div>
  );
}

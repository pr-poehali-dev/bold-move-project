import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabCorrections from "./admin/TabCorrections";
import CrmPanel from "./admin/crm/CrmPanel";
import { setCrmToken } from "./admin/crm/crmApi";
import TeamPanel from "./admin/team/TeamPanel";
import OwnAgentTeaser from "./admin/own-agent/OwnAgentTeaser";
import OwnAgentEditor from "./admin/own-agent/OwnAgentEditor";
import { useAuth, hasPermission } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import type { AgentSubTab } from "./admin/types";
import type { Theme } from "./admin/crm/themeContext";

// Роли с доступом к /company
const ALLOWED_ROLES = ["installer", "company", "manager"];

type MainTab = "crm" | "agent" | "team" | "own-agent";

const AGENT_TABS: { id: AgentSubTab; label: string; icon: string }[] = [
  { id: "prices",      label: "Цены",            icon: "Tag" },
  { id: "rules",       label: "Правила расчёта", icon: "SlidersHorizontal" },
  { id: "prompt",      label: "Промпт",          icon: "BrainCircuit" },
  { id: "faq",         label: "База знаний",     icon: "Database" },
  { id: "corrections", label: "Обучение",        icon: "GraduationCap" },
];

interface TabConfig { id: MainTab; icon: string; label: string; }

const buildMainTabs = (canCrm: boolean, canAgent: boolean, hasTeam: boolean): TabConfig[] => [
  ...(canCrm   ? [{ id: "crm"       as MainTab, icon: "LayoutDashboard", label: "CRM"        }] : []),
  ...(canAgent ? [{ id: "agent"     as MainTab, icon: "BrainCircuit",    label: "Агент"      }] : []),
  ...(hasTeam  ? [{ id: "team"      as MainTab, icon: "Users",           label: "Команда"    }] : []),
  ...(hasTeam  ? [{ id: "own-agent" as MainTab, icon: "Bot",             label: "Свой агент" }] : []),
];

function MobileTabMenu({ mainTab, isDark, tabs, onSelect }: {
  mainTab: MainTab; isDark: boolean; tabs: TabConfig[];
  onSelect: (t: MainTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = tabs.find(t => t.id === mainTab) ?? tabs[0];

  // Нет доступных вкладок — ничего не рендерим
  if (!active) return <div className="flex-1" />;

  return (
    <div className="flex sm:hidden flex-1 relative">
      {/* Кнопка текущего таба */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition"
        style={{ background: "#7c3aed22", color: "#a78bfa", border: "1px solid #7c3aed40" }}>
        <Icon name={active.icon} size={13} />
        {active.label}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={11} />
      </button>

      {/* Дропдаун */}
      {open && (
        <>
          {/* Оверлей */}
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-[91] rounded-xl overflow-hidden min-w-[160px]"
            style={{
              background: isDark ? "#0e0e1c" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid #e5e7eb",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
            {tabs.map((tb, i) => (
              <button key={tb.id}
                onClick={() => { onSelect(tb.id); setOpen(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] font-semibold transition text-left"
                style={{
                  background: tb.id === mainTab ? "#7c3aed22" : "transparent",
                  color: tb.id === mainTab ? "#a78bfa" : isDark ? "rgba(255,255,255,0.6)" : "#374151",
                  borderTop: i > 0 ? (isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f3f4f6") : "none",
                }}>
                <Icon name={tb.icon} size={14} />
                {tb.label}
                {tb.id === mainTab && <Icon name="Check" size={11} className="ml-auto" style={{ color: "#a78bfa" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

  // Права на вкладки — пересчитываются после загрузки user
  const canCrm   = hasPermission(user, "crm_view");
  const canAgent = hasPermission(user, "agent_view");
  const hasTeam  = user?.role === "company" || !!user?.is_master;
  const mainTabs = buildMainTabs(canCrm, canAgent, hasTeam);

  // Права агента — какие подвкладки видны и редактируемы
  const agentPerms = {
    prices:      { view: hasPermission(user, "prices_view"),      edit: hasPermission(user, "prices_edit") },
    rules:       { view: hasPermission(user, "rules_view"),       edit: hasPermission(user, "rules_edit") },
    prompt:      { view: hasPermission(user, "prompt_view"),      edit: hasPermission(user, "prompt_edit") },
    faq:         { view: hasPermission(user, "faq_view"),         edit: hasPermission(user, "faq_edit") },
    corrections: { view: hasPermission(user, "corrections_view"), edit: hasPermission(user, "corrections_edit") },
  } as const;

  // mainTab — всегда первая доступная вкладка, пересчитывается при смене user
  const [mainTab, setMainTab] = useState<MainTab>("crm");

  useEffect(() => {
    if (loading || !user) return;
    const allowed = buildMainTabs(
      hasPermission(user, "crm_view"),
      hasPermission(user, "agent_view"),
      user.role === "company" || !!user.is_master,
    );
    // Всегда переключаемся на первый доступный таб после загрузки
    setMainTab(allowed[0]?.id ?? "crm");
  }, [loading, user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Безопасное переключение — только в разрешённые табы
  const safeSetMainTab = (tab: MainTab) => {
    const allowed = mainTabs.map(t => t.id);
    if (allowed.includes(tab)) { setMainTab(tab); return; }
    setMainTab(mainTabs[0]?.id ?? "crm");
  };

  // Прокидываем токен залогиненного пользователя в CRM
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

  // Загрузка профиля
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Нет доступа — экран входа/отказа
  if (!hasAccess) {
    const isWrongRole = !!user && !user.is_master && !ALLOWED_ROLES.includes(user.role);
    const isPending   = !!user && !user.approved;

    return (
      <>
        <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-violet-600/20 flex items-center justify-center">
                <Icon name="ShieldCheck" size={24} className="text-violet-400" />
              </div>
              <div>
                <div className="text-white font-black text-xl tracking-tight">MOS<span className="text-violet-400">POTOLKI</span></div>
                <div className="text-white/30 text-xs">Панель администратора</div>
              </div>
            </div>

            <div className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>

              {!user && (
                <>
                  <div className="text-sm font-semibold text-white/70 text-center">
                    Войдите в свой аккаунт
                  </div>
                  <div className="text-[11px] text-white/40 text-center -mt-2 leading-snug">
                    Доступ к панели открыт для монтажников, компаний и менеджеров
                  </div>
                  <button onClick={() => setShowLogin(true)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                    style={{ background: "#7c3aed" }}>
                    Войти
                  </button>
                </>
              )}

              {isPending && (
                <>
                  <div className="rounded-xl px-3.5 py-3 text-xs text-amber-300/85 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                    <Icon name="Clock" size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-bold mb-0.5">Заявка на проверке</div>
                      <div className="text-amber-300/65">Доступ откроется после одобрения. Обычно 1–24 часа.</div>
                    </div>
                  </div>
                  <button onClick={logout}
                    className="w-full py-2.5 rounded-xl text-xs font-medium transition"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    Выйти
                  </button>
                </>
              )}

              {isWrongRole && !isPending && (
                <>
                  <div className="rounded-xl px-3.5 py-3 text-xs text-red-300/85 bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                    <Icon name="ShieldX" size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-bold mb-0.5">Нет доступа к панели</div>
                      <div className="text-red-300/65">Доступ открыт только для ролей: монтажник, компания, менеджер. Сменить роль можно в профиле.</div>
                    </div>
                  </div>
                  <button onClick={logout}
                    className="w-full py-2.5 rounded-xl text-xs font-medium transition"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    Выйти
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {showLogin && (
          <AuthModal
            onClose={() => setShowLogin(false)}
            onSuccess={() => setShowLogin(false)}
            onPending={() => setShowLogin(false)}
            defaultTab="login"
          />
        )}
      </>
    );
  }

  const isDark = theme === "dark";
  const headerBg = isDark ? "#0b0b11" : "#ffffff";
  const headerBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const headerText = isDark ? "#ffffff" : "#0f1623";

  const masterToken = localStorage.getItem("mp_master_token");
  const masterName  = localStorage.getItem("mp_master_name") || "Мастер";

  const exitImpersonate = () => {
    localStorage.setItem("mp_user_token", masterToken!);
    localStorage.removeItem("mp_master_token");
    localStorage.removeItem("mp_master_name");
    window.location.href = "/whitelabel";
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden"
      style={{ background: isDark ? "#07070f" : "#eef0f6", color: headerText }}>

      {/* ── Баннер режима просмотра (мастер смотрит чужой аккаунт) ── */}
      {masterToken && (
        <div className="flex items-center justify-between px-3 py-2 text-xs gap-2"
          style={{ background: "#92400e", borderBottom: "1px solid #b45309" }}>

          {/* Левая часть */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon name="Eye" size={13} style={{ color: "#fde68a", flexShrink: 0 }} />
            {/* Мобиле: только имя */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={{ background: "#d97706", color: "#0a0a14" }}>
                {(user?.name || user?.email || "?")[0].toUpperCase()}
              </div>
              <span className="font-black truncate" style={{ color: "#fff" }}>
                {user?.name || user?.email?.split("@")[0]}
              </span>
              {/* email и теги — только на десктопе */}
              {user?.email && user?.name && (
                <span className="hidden sm:inline" style={{ color: "#fbbf24" }}>{user.email}</span>
              )}
            </div>
            <span className="hidden sm:inline px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0"
              style={{ background: "rgba(0,0,0,0.25)", color: "#fde68a" }}>
              ID #{user?.id}
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0"
              style={{ background: "rgba(0,0,0,0.25)", color: "#fde68a" }}>
              {user?.role === "company" ? "Компания" : user?.role === "manager" ? "Менеджер" : user?.role || "—"}
            </span>
          </div>

          {/* Кнопка возврата */}
          <button onClick={exitImpersonate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition hover:opacity-80 whitespace-nowrap flex-shrink-0"
            style={{ background: "rgba(0,0,0,0.30)", color: "#fde68a", border: "1px solid rgba(253,230,138,0.3)" }}>
            <Icon name="LogOut" size={11} />
            <span className="hidden sm:inline">← Вернуться как {masterName}</span>
            <span className="sm:hidden">{masterName}</span>
          </button>
        </div>
      )}

      {/* ── Шапка (десктоп: 2 строки, мобиле: 1 строка) ── */}

      {/* Строка 1: логотип + юзер + выход */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 flex-shrink-0 transition-colors duration-300"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>

        {/* Левая часть: назад + иконка */}
        <a href={(() => { const ownerId = user?.has_own_agent ? user.id : user?.company_id; return ownerId ? `/?c=${ownerId}` : "/"; })()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80 flex-shrink-0"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: isDark ? "rgba(255,255,255,0.45)" : "#374151", border: `1px solid ${headerBorder}` }}>
          <Icon name="ArrowLeft" size={12} />
          <span className="hidden sm:inline">В бот</span>
        </a>
        <Icon name="BrainCircuit" size={18} className="text-violet-400 flex-shrink-0" />

        {/* Мобиле: активный таб + дропдаун */}
        <MobileTabMenu
          mainTab={mainTab}
          isDark={isDark}
          tabs={mainTabs}
          onSelect={safeSetMainTab}
        />

        {/* Десктоп: название */}
        <span className="font-semibold hidden sm:block flex-1" style={{ color: headerText }}>Панель управления</span>

        {/* Правая часть */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <button onClick={toggleTheme}
            className="p-1.5 rounded-xl transition"
            style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", border: `1px solid ${headerBorder}`, color: isDark ? "rgba(255,255,255,0.5)" : "#374151" }}>
            <Icon name={isDark ? "Sun" : "Moon"} size={13} />
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: user?.is_master ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)", border: `1px solid ${user?.is_master ? "rgba(239,68,68,0.25)" : "rgba(124,58,237,0.25)"}` }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: user?.is_master ? "#ef4444" : "#7c3aed" }}>
              {(user?.name || user?.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-semibold" style={{ color: user?.is_master ? "#fca5a5" : "#c4b5fd" }}>
                {user?.name || user?.email?.split("@")[0] || "—"}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: user?.is_master ? "#ef4444" : "#7c3aed" }}>
                {user?.is_master ? "Мастер" : user?.role === "company" ? "Компания" : user?.role === "manager" ? "Менеджер" : user?.role === "installer" ? "Монтажник" : user?.role || "—"}
              </span>
            </div>
          </div>
          <button onClick={logout} className="p-1.5 transition"
            style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#374151" }}>
            <Icon name="LogOut" size={15} />
          </button>
        </div>
      </div>

      {/* Строка 2: главные табы — только на десктопе */}
      <div className="hidden sm:flex items-end gap-1 pt-2 flex-shrink-0 overflow-x-auto transition-colors duration-300 px-4"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}`, scrollbarWidth: "none" }}>
        {mainTabs.map(tb => (
          <button key={tb.id} onClick={() => safeSetMainTab(tb.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition whitespace-nowrap flex-shrink-0 ${
              mainTab === tb.id
                ? isDark ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500" : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600"
                : isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-800"
            }`}>
            <Icon name={tb.icon} size={14} />
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── CRM ── */}
      {mainTab === "crm" && canCrm && (
        <div className="flex-1 overflow-hidden">
          {crmReady
            ? <CrmPanel theme={theme} initialOrderId={initialOrderId} />
            : <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          }
        </div>
      )}

      {/* ── Команда ── */}
      {mainTab === "team" && hasTeam && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TeamPanel isDark={isDark} />
        </div>
      )}

      {/* ── Свой агент ── */}
      {mainTab === "own-agent" && hasTeam && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {user?.has_own_agent
            ? <OwnAgentEditor isDark={isDark} />
            : <OwnAgentTeaser isDark={isDark} />}
        </div>
      )}

      {/* ── Управление агентом ── */}
      {mainTab === "agent" && canAgent && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Суб-вкладки — только с правом view */}
          <div className="px-4 flex gap-0.5 pt-2 overflow-x-auto flex-shrink-0"
            style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb"}` }}>
            {AGENT_TABS.filter(t => agentPerms[t.id].view).map(t => (
              <button key={t.id} onClick={() => setAgentTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
                  agentTab === t.id
                    ? isDark
                      ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
                      : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800"
                }`}>
                <Icon name={t.icon} size={13} />
                {t.label}
                {!agentPerms[t.id].edit && (
                  <Icon name="Eye" size={10} className="ml-0.5 opacity-50" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full">
            {agentTab === "prices"      && agentPerms.prices.view      && <TabPrices      token={authToken} onItemAdded={handleItemAdded} isDark={isDark} readOnly={!agentPerms.prices.edit} />}
            {agentTab === "rules"       && agentPerms.rules.view       && <TabRules       token={authToken} hint={newItemHint} isDark={isDark} readOnly={!agentPerms.rules.edit} />}
            {agentTab === "prompt"      && agentPerms.prompt.view      && <TabPrompt      token={authToken} isDark={isDark} readOnly={!agentPerms.prompt.edit} />}
            {agentTab === "faq"         && agentPerms.faq.view         && <TabFaq         token={authToken} isDark={isDark} readOnly={!agentPerms.faq.edit} />}
            {agentTab === "corrections" && agentPerms.corrections.view && <TabCorrections token={authToken} isDark={isDark} readOnly={!agentPerms.corrections.edit} />}
          </div>
        </div>
      )}

      {/* ── Нет доступа ни к одной вкладке ── */}
      {!loading && mainTabs.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
            <Icon name="ShieldOff" size={22} className="text-red-400" />
          </div>
          <p className={`text-sm font-semibold ${isDark ? "text-white/60" : "text-gray-500"}`}>Нет доступа ни к одному разделу</p>
          <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>Обратитесь к администратору компании для получения прав</p>
        </div>
      )}
    </div>
  );
}
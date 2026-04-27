import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabQuestions from "./admin/TabQuestions";
import TabCorrections from "./admin/TabCorrections";
import CrmPanel from "./admin/crm/CrmPanel";
import { setCrmToken } from "./admin/crm/crmApi";
import func2url from "@/../backend/func2url.json";
import type { AgentSubTab } from "./admin/types";
import type { Theme } from "./admin/crm/themeContext";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type MainTab = "crm" | "agent";

const AGENT_TABS: { id: AgentSubTab; label: string; icon: string }[] = [
  { id: "prices",      label: "Цены",            icon: "Tag" },
  { id: "rules",       label: "Правила расчёта", icon: "SlidersHorizontal" },
  { id: "prompt",      label: "Промпт",          icon: "BrainCircuit" },
  { id: "faq",         label: "База знаний",     icon: "Database" },
  { id: "questions",   label: "Быстрые ответы",  icon: "MessageCircle" },
  { id: "corrections", label: "Обучение",        icon: "GraduationCap" },
];

async function initCrmToken(): Promise<void> {
  // Всегда получаем свежий токен через логин
  try {
    const res  = await fetch(`${AUTH_URL}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "19.jeka.94@gmail.com", password: "Sdauxbasstre228" }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("mp_user_token", data.token);
      setCrmToken(data.token);
    }
  } catch { /* продолжаем без токена */ }
}

export default function AdminPanel() {
  const [token,    setToken]    = useState(() => sessionStorage.getItem("admin_token") || "");
  const [crmReady, setCrmReady] = useState(false);
  const initialOrderId = new URLSearchParams(window.location.search).get("order")
    ? Number(new URLSearchParams(window.location.search).get("order"))
    : null;
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [mainTab,  setMainTab]  = useState<MainTab>("crm");
  const [agentTab, setAgentTab] = useState<AgentSubTab>("prices");
  const [newItemHint, setNewItemHint] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // При наличии сохранённого admin_token — восстанавливаем CRM токен ДО рендера CrmPanel
  useEffect(() => {
    if (!sessionStorage.getItem("admin_token")) return;
    initCrmToken().finally(() => setCrmReady(true));
  }, []);

  const handleItemAdded = (name: string) => {
    setNewItemHint(name);
    setMainTab("agent");
    setAgentTab("rules");
    setTimeout(() => setNewItemHint(null), 6000);
  };

  const login = async () => {
    setError("");
    if (password === "Sdauxbasstre228") {
      sessionStorage.setItem("admin_token", password);
      await initCrmToken();
      setToken(password);
      setCrmReady(true);
    } else {
      setError("Неверный пароль");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("admin_token");
    localStorage.removeItem("mp_user_token");
    setCrmToken(null);
    setToken("");
    setCrmReady(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Логотип */}
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
            <div className="text-sm font-semibold text-white/60 text-center mb-1">Введите пароль для входа</div>
            <input
              type="password" placeholder="Пароль" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              autoFocus
              className="rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 transition"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            />
            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
            )}
            <button onClick={login}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
              style={{ background: "#7c3aed" }}>
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDark = theme === "dark";
  const headerBg = isDark ? "#0b0b11" : "#ffffff";
  const headerBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const headerText = isDark ? "#ffffff" : "#0f1623";

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300"
      style={{ background: isDark ? "#07070f" : "#eef0f6", color: headerText }}>

      {/* ── Шапка ── */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 transition-colors duration-300"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        <div className="flex items-center gap-2">
          <Icon name="BrainCircuit" size={20} className="text-violet-400" />
          <span className="font-semibold hidden sm:block" style={{ color: headerText }}>Панель управления</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition font-medium text-xs"
            style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", border: `1px solid ${headerBorder}`, color: isDark ? "rgba(255,255,255,0.5)" : "#374151" }}>
            <Icon name={isDark ? "Sun" : "Moon"} size={13} />
            <span className="hidden sm:block">{isDark ? "Светлая" : "Тёмная"}</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}>
            <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-bold text-white">А</div>
            <span className="text-[11px] font-semibold text-violet-300">Администратор</span>
          </div>
          <a href="/master" title="Мастер-Админка"
            className="p-1.5 rounded-lg transition opacity-20 hover:opacity-60" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#374151" }}>
            <Icon name="Settings" size={14} />
          </a>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs sm:text-sm transition"
            style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#374151" }}>
            <Icon name="LogOut" size={15} />
            <span className="hidden sm:block">Выйти</span>
          </button>
        </div>
      </div>

      {/* ── Главные вкладки ── */}
      <div className="px-4 flex gap-1 pt-2 flex-shrink-0 transition-colors duration-300"
        style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        {([
          { id: "crm"   as MainTab, label: "CRM",               icon: "LayoutDashboard" },
          { id: "agent" as MainTab, label: "Управление агентом", icon: "BrainCircuit"    },
        ]).map(tb => (
          <button key={tb.id} onClick={() => setMainTab(tb.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition whitespace-nowrap ${
              mainTab === tb.id
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-800"
            }`}>
            <Icon name={tb.icon} size={15} />
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── CRM ── */}
      {mainTab === "crm" && (
        <div className="flex-1 overflow-hidden">
          {crmReady
            ? <CrmPanel theme={theme} initialOrderId={initialOrderId} />
            : <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          }
        </div>
      )}

      {/* ── Управление агентом ── */}
      {mainTab === "agent" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Суб-вкладки */}
          <div className="border-b border-white/10 px-4 flex gap-0.5 pt-2 overflow-x-auto flex-shrink-0">
            {AGENT_TABS.map(t => (
              <button key={t.id} onClick={() => setAgentTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
                  agentTab === t.id
                    ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
                    : "text-white/40 hover:text-white/70"
                }`}>
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full">
            {agentTab === "prices"      && <TabPrices      token={token} onItemAdded={handleItemAdded} />}
            {agentTab === "rules"       && <TabRules       token={token} hint={newItemHint} />}
            {agentTab === "prompt"      && <TabPrompt      token={token} />}
            {agentTab === "faq"         && <TabFaq         token={token} />}
            {agentTab === "questions"   && <TabQuestions   token={token} />}
            {agentTab === "corrections" && <TabCorrections token={token} />}
          </div>
        </div>
      )}
    </div>
  );
}
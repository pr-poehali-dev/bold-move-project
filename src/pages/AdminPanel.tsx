import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./admin/api";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabQuestions from "./admin/TabQuestions";
import TabCorrections from "./admin/TabCorrections";
import CrmPanel from "./admin/crm/CrmPanel";
import { setCrmToken } from "./admin/crm/crmApi";
import func2url from "@/../backend/func2url.json";
import type { AdminTab } from "./admin/types";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "crm",         label: "CRM",              icon: "LayoutDashboard" },
  { id: "prices",      label: "Цены",             icon: "Tag" },
  { id: "rules",       label: "Правила расчёта",  icon: "SlidersHorizontal" },
  { id: "prompt",      label: "Промпт",           icon: "BrainCircuit" },
  { id: "faq",         label: "База знаний",      icon: "Database" },
  { id: "questions",   label: "Быстрые ответы",   icon: "MessageCircle" },
  { id: "corrections", label: "Обучение",         icon: "GraduationCap" },
];

async function initCrmToken(): Promise<void> {
  const authToken = localStorage.getItem("mp_user_token");
  if (authToken) {
    setCrmToken(authToken);
    return;
  }
  try {
    const res  = await fetch(`${AUTH_URL}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "19.jeka.94@gmail.com", password: "Sdauxbasstre228" }),
    });
    const data = await res.json();
    if (data.token) { localStorage.setItem("mp_user_token", data.token); setCrmToken(data.token); }
  } catch { /* продолжаем без токена */ }
}

export default function AdminPanel() {
  const [token,    setToken]    = useState(() => sessionStorage.getItem("admin_token") || "");
  const [crmReady, setCrmReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [tab,      setTab]      = useState<AdminTab>("crm");
  const [newItemHint, setNewItemHint] = useState<string | null>(null);

  // При наличии сохранённого admin_token — восстанавливаем CRM токен ДО рендера CrmPanel
  useEffect(() => {
    if (!sessionStorage.getItem("admin_token")) return;
    initCrmToken().finally(() => setCrmReady(true));
  }, []);

  const handleItemAdded = (name: string) => {
    setNewItemHint(name);
    setTab("rules");
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

  return (
    <div className="min-h-screen bg-[#0b0b11] text-white">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="BrainCircuit" size={20} className="text-violet-400" />
          <span className="font-semibold">Управление AI</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Шестерёнка → Мастер-Админка (едва заметна) */}
          <a href="/master" title="Мастер-Админка"
            className="p-1.5 rounded-lg transition opacity-20 hover:opacity-60"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="Settings" size={14} />
          </a>
          <button onClick={logout} className="text-white/40 hover:text-white/70 flex items-center gap-1.5 text-sm transition">
            <Icon name="LogOut" size={16} /> Выйти
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 flex gap-1 pt-2 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-t-lg transition whitespace-nowrap ${
              tab === t.id
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/50 hover:text-white/80"
            }`}>
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "crm" ? "p-4" : "p-4 max-w-6xl mx-auto"}>
        {tab === "crm" && (crmReady
          ? <CrmPanel />
          : <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        )}
        {tab === "prices"      && <TabPrices      token={token} onItemAdded={handleItemAdded} />}
        {tab === "rules"       && <TabRules       token={token} hint={newItemHint} />}
        {tab === "prompt"      && <TabPrompt      token={token} />}
        {tab === "faq"         && <TabFaq         token={token} />}
        {tab === "questions"   && <TabQuestions   token={token} />}
        {tab === "corrections" && <TabCorrections token={token} />}
      </div>
    </div>
  );
}
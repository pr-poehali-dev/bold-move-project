import { useState } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./admin/api";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabQuestions from "./admin/TabQuestions";
import TabCorrections from "./admin/TabCorrections";
import CrmPanel from "./admin/crm/CrmPanel";
import type { AdminTab } from "./admin/types";

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "crm",         label: "CRM",              icon: "LayoutDashboard" },
  { id: "prices",      label: "Цены",             icon: "Tag" },
  { id: "rules",       label: "Правила расчёта",  icon: "SlidersHorizontal" },
  { id: "prompt",      label: "Промпт",           icon: "BrainCircuit" },
  { id: "faq",         label: "База знаний",      icon: "Database" },
  { id: "questions",   label: "Быстрые ответы",   icon: "MessageCircle" },
  { id: "corrections", label: "Обучение",         icon: "GraduationCap" },
];

export default function AdminPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem("admin_token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<AdminTab>("crm");
  const [newItemHint, setNewItemHint] = useState<string | null>(null);

  const handleItemAdded = (name: string) => {
    setNewItemHint(name);
    setTab("rules");
    setTimeout(() => setNewItemHint(null), 6000);
  };

  const login = async () => {
    setError("");
    if (password === "Sdauxbasstre228") {
      sessionStorage.setItem("admin_token", password);
      setToken(password);
    } else {
      setError("Неверный пароль");
    }
  };

  const logout = () => { sessionStorage.removeItem("admin_token"); setToken(""); };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center">
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="ShieldCheck" size={22} className="text-violet-400" />
            <span className="text-white font-semibold text-lg">Вход для администратора</span>
          </div>
          <input
            type="password" placeholder="Пароль" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500 transition"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={login} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2.5 font-medium transition">
            Войти
          </button>
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
        <button onClick={logout} className="text-white/40 hover:text-white/70 flex items-center gap-1.5 text-sm transition">
          <Icon name="LogOut" size={16} /> Выйти
        </button>
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
        {tab === "crm"         && <CrmPanel />}
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
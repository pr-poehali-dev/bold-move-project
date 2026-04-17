import { useState } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./admin/api";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabQuestions from "./admin/TabQuestions";
import TabCorrections from "./admin/TabCorrections";
import TabRequests from "./admin/TabRequests";
import type { AdminTab } from "./admin/types";

const OPERATOR_TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "requests",    label: "Обращения",        icon: "MessageSquare" },
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
  const [clientName, setClientName] = useState(() => sessionStorage.getItem("client_name") || "");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<AdminTab>("requests");
  const [newItemHint, setNewItemHint] = useState<string | null>(null);

  // Клиентская сессия — стабильный ID из sessionStorage
  const [clientSessionId] = useState(() => {
    let sid = sessionStorage.getItem("client_session_id");
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem("client_session_id", sid); }
    return sid;
  });

  const handleItemAdded = (name: string) => {
    setNewItemHint(name);
    setTab("rules");
    setTimeout(() => setNewItemHint(null), 6000);
  };

  const loginOperator = async () => {
    setError("");
    const r = await apiFetch("login", { method: "POST", body: JSON.stringify({ password }) });
    if (r.ok) { sessionStorage.setItem("admin_token", password); setToken(password); setTab("requests"); }
    else setError("Неверный пароль");
  };

  const enterAsClient = () => {
    const name = clientName.trim();
    if (!name) { setError("Введите ваше имя"); return; }
    sessionStorage.setItem("client_name", name);
    setToken("__client__");
    setTab("requests");
  };

  const logout = () => {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("client_name");
    setToken("");
    setClientName("");
  };

  const isOperator = token !== "__client__";

  // ── Экран входа ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col gap-4">

          {/* Клиентский вход */}
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="MessageSquare" size={20} className="text-violet-400" />
              <span className="text-white font-semibold">Написать Юре</span>
            </div>
            <p className="text-white/40 text-sm">Оставьте запрос на изменение — ответим и сделаем.</p>
            <input
              type="text"
              placeholder="Ваше имя"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && enterAsClient()}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500 transition"
            />
            {error && !token && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={enterAsClient} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2.5 font-medium transition">
              Открыть чат
            </button>
          </div>

          {/* Оператор */}
          <details className="bg-[#13131f] border border-white/10 rounded-2xl overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer text-white/40 text-sm flex items-center gap-2 hover:text-white/60 transition list-none">
              <Icon name="ShieldCheck" size={15} />
              Вход для оператора
            </summary>
            <div className="px-6 pb-5 flex flex-col gap-3">
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loginOperator()}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500 transition"
              />
              <button onClick={loginOperator} className="bg-white/10 hover:bg-white/15 text-white rounded-lg py-2.5 font-medium transition">
                Войти
              </button>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ── Клиентский вид — только чат ───────────────────────────────────────────
  if (!isOperator) {
    return (
      <div className="min-h-screen bg-[#0b0b11] text-white">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="MessageSquare" size={18} className="text-violet-400" />
            <span className="font-medium text-white/80">Обращения к Юре</span>
          </div>
          <button onClick={logout} className="text-white/40 hover:text-white/70 flex items-center gap-1.5 text-sm transition">
            <Icon name="LogOut" size={15} /> Выйти
          </button>
        </div>
        <div className="p-4 max-w-2xl mx-auto">
          <TabRequests
            token=""
            isOperator={false}
            clientName={clientName || sessionStorage.getItem("client_name") || "Клиент"}
            clientSessionId={clientSessionId}
          />
        </div>
      </div>
    );
  }

  // ── Оператор — полная панель ──────────────────────────────────────────────
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
        {OPERATOR_TABS.map(t => (
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

      <div className="p-4 max-w-6xl mx-auto">
        {tab === "requests"    && <TabRequests    token={token} isOperator={true} />}
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

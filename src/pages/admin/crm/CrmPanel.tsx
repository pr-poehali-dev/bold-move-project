import { useState, useMemo, useEffect } from "react";
import Icon from "@/components/ui/icon";
import CrmAnalytics from "./CrmAnalytics";
import CrmClients from "./CrmClients";
import CrmOrders from "./CrmOrders";
import CrmCalendar from "./CrmCalendar";
import CrmKanban from "./CrmKanban";
import { ThemeContext, DARK, LIGHT, type Theme } from "./themeContext";
import { crmFetch, Client } from "./crmApi";

type CrmTab = "analytics" | "clients" | "orders" | "calendar" | "kanban";

const CRM_TABS: { id: CrmTab; label: string; icon: string }[] = [
  { id: "orders",    label: "Заказы",    icon: "Layers" },
  { id: "clients",   label: "Клиенты",   icon: "Users" },
  { id: "kanban",    label: "Канбан",    icon: "Kanban" },
  { id: "calendar",  label: "Календарь", icon: "CalendarDays" },
  { id: "analytics", label: "Аналитика", icon: "BarChart2" },
];

export default function CrmPanel() {
  const [tab, setTab]         = useState<CrmTab>("orders");
  const [theme, setTheme]     = useState<Theme>("dark");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClients = () => {
    setLoading(true);
    crmFetch("clients").then(d => {
      setClients((Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    });
  };

  const updateClientStatus = (id: number, status: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const removeClient = (id: number) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  useEffect(() => { loadClients(); }, []);

  const ctx = useMemo(() => ({
    ...(theme === "dark" ? DARK : LIGHT),
    toggle: () => setTheme(t => t === "dark" ? "light" : "dark"),
  }), [theme]);

  const t = ctx;

  return (
    <ThemeContext.Provider value={ctx}>
      <div className="min-h-screen -m-4 p-0 transition-colors duration-300"
        style={{ background: t.bg }}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-3.5"
          style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
              <Icon name="LayoutDashboard" size={17} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight" style={{ color: t.text }}>CRM — Натяжные потолки</div>
              <div className="text-[10px]" style={{ color: t.textMute }}>от заявки до завершённого заказа</div>
            </div>
          </div>

          {/* Переключатель темы */}
          <button onClick={ctx.toggle}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl transition font-medium text-xs"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }}>
            <Icon name={theme === "dark" ? "Sun" : "Moon"} size={14} />
            {theme === "dark" ? "Светлая" : "Тёмная"}
          </button>
        </div>

        {/* Навигация */}
        <div className="flex gap-0.5 px-6 py-2.5 overflow-x-auto"
          style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          {CRM_TABS.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition whitespace-nowrap font-medium border"
                style={active ? {
                  background: "#7c3aed18",
                  color: "#a78bfa",
                  borderColor: "#7c3aed35",
                } : {
                  color: t.textSub,
                  borderColor: "transparent",
                  background: "transparent",
                }}>
                <Icon name={tb.icon} size={14} />
                {tb.label}
              </button>
            );
          })}
        </div>

        {/* Контент */}
        <div className="p-6">
          {tab === "analytics" && <CrmAnalytics />}
          {tab === "clients"   && <CrmClients />}
          {tab === "orders"    && <CrmOrders    clients={clients} loading={loading} onStatusChange={updateClientStatus} onClientRemoved={removeClient} onReload={loadClients} />}
          {tab === "calendar"  && <CrmCalendar />}
          {tab === "kanban"    && <CrmKanban    clients={clients} loading={loading} onStatusChange={updateClientStatus} onClientRemoved={removeClient} onReload={loadClients} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
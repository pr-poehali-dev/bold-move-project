import { useState, useMemo, useEffect } from "react";
import Icon from "@/components/ui/icon";
import CrmAnalytics from "./CrmAnalytics";
import CrmClients from "./CrmClients";
import CrmOrders from "./CrmOrders";
import CrmCalendar from "./CrmCalendar";
import CrmKanban from "./CrmKanban";
import { ThemeContext, DARK, LIGHT, type Theme } from "./themeContext";
import { crmFetch, Client } from "./crmApi";

const LS_KANBAN_ENABLED = "crm_kanban_board_enabled";

type CrmTab = "analytics" | "clients" | "orders" | "calendar" | "kanban";

const FIXED_TABS: { id: CrmTab; label: string; icon: string }[] = [
  { id: "orders",    label: "Заказы",    icon: "Layers" },
  { id: "clients",   label: "Клиенты",   icon: "Users" },
  { id: "calendar",  label: "Календарь", icon: "CalendarDays" },
  { id: "analytics", label: "Аналитика", icon: "BarChart2" },
];

export default function CrmPanel({ theme, initialOrderId }: { theme: Theme; initialOrderId?: number | null }) {
  const [tab, setTab]               = useState<CrmTab>("orders");
  const [clients, setClients]       = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [kanbanEnabled, setKanbanEnabled] = useState<boolean>(
    () => localStorage.getItem(LS_KANBAN_ENABLED) === "true"
  );

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

  const enableKanban = () => {
    localStorage.setItem(LS_KANBAN_ENABLED, "true");
    setKanbanEnabled(true);
    setTab("kanban");
  };

  const disableKanban = () => {
    localStorage.removeItem(LS_KANBAN_ENABLED);
    setKanbanEnabled(false);
    if (tab === "kanban") setTab("orders");
  };

  const ctx = useMemo(() => ({
    ...(theme === "dark" ? DARK : LIGHT),
    toggle: () => {},
  }), [theme]);

  const t = ctx;

  return (
    <ThemeContext.Provider value={ctx}>
      <div className="flex flex-col h-full transition-colors duration-300"
        style={{ background: t.bg }}>

        {/* Навигация */}
        <div className="flex items-center gap-0.5 px-2 sm:px-6 py-2.5 overflow-x-auto"
          style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>

          {/* Фиксированные вкладки */}
          {FIXED_TABS.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm rounded-xl transition whitespace-nowrap font-medium border"
                style={active ? {
                  background: "#7c3aed18", color: "#a78bfa", borderColor: "#7c3aed35",
                } : {
                  color: t.textSub, borderColor: "transparent", background: "transparent",
                }}>
                <Icon name={tb.icon} size={14} />
                {tb.label}
              </button>
            );
          })}

          {/* Вкладка Канбан — если включена */}
          {kanbanEnabled && (
            <button onClick={() => setTab("kanban")}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm rounded-xl transition whitespace-nowrap font-medium border"
              style={tab === "kanban" ? {
                background: "#7c3aed18", color: "#a78bfa", borderColor: "#7c3aed35",
              } : {
                color: t.textSub, borderColor: "transparent", background: "transparent",
              }}>
              <Icon name="Kanban" size={14} />
              Канбан
            </button>
          )}

          {/* Разделитель */}
          <div className="flex-1" />

          {/* Промо-блок — только на десктопе */}
          {!kanbanEnabled && (
            <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 rounded-xl"
              style={{ background: "linear-gradient(135deg,#7c3aed12,#06b6d412)", border: `1px dashed #7c3aed40` }}>
              <Icon name="Kanban" size={14} style={{ color: "#a78bfa" }} className="flex-shrink-0" />
              <span className="text-xs whitespace-nowrap" style={{ color: t.textMute }}>
                Добавить новый канбан? <span style={{ color: t.textSub }}>(например для потенциальных клиентов)</span>
              </span>
              <button onClick={enableKanban}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap hover:opacity-90"
                style={{ background: "#7c3aed", color: "#fff" }}>
                <Icon name="Plus" size={12} /> Добавить
              </button>
            </div>
          )}

          {/* Кнопка канбана на мобиле */}
          {!kanbanEnabled && (
            <button onClick={enableKanban}
              className="flex sm:hidden items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap flex-shrink-0"
              style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed35" }}>
              <Icon name="Plus" size={13} />
              Канбан
            </button>
          )}

        </div>

        {/* Контент */}
        <div className="p-2 sm:p-6">
          {tab === "analytics" && <CrmAnalytics />}
          {tab === "clients"   && <CrmClients />}
          {tab === "orders"    && <CrmOrders clients={clients} loading={loading} onStatusChange={updateClientStatus} onClientRemoved={removeClient} onReload={loadClients} initialOrderId={initialOrderId} />}
          {tab === "calendar"  && <CrmCalendar />}
          {tab === "kanban"    && <CrmKanban clients={[]} loading={false} onStatusChange={() => {}} onClientRemoved={() => {}} onReload={() => {}} onRemoveBoard={disableKanban} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
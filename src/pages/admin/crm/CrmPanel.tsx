import { useState, useMemo, useEffect } from "react";
import Icon from "@/components/ui/icon";
import CrmAnalytics from "./CrmAnalytics";
import CrmClients from "./CrmClients";
import CrmOrders from "./CrmOrders";
import CrmCalendar from "./CrmCalendar";
import CrmKanban from "./CrmKanban";
import { ThemeContext, DARK, LIGHT, type Theme } from "./themeContext";
import { crmFetch, Client } from "./crmApi";
import { useAuth, hasPermission, type Permissions } from "@/context/AuthContext";

const LS_KANBAN_ENABLED = "crm_kanban_board_enabled";

type CrmTab = "analytics" | "clients" | "orders" | "calendar" | "kanban";

// Все возможные табы с привязкой к новым правам
const ALL_TABS: { id: CrmTab; label: string; icon: string; perm?: keyof Permissions }[] = [
  { id: "orders",    label: "Заказы",    icon: "Layers" },
  { id: "clients",   label: "Клиенты",   icon: "Users",       perm: "clients_view"  },
  { id: "calendar",  label: "Календарь", icon: "CalendarDays", perm: "calendar_view" },
  { id: "analytics", label: "Аналитика", icon: "BarChart2",    perm: "analytics_view"},
];

export default function CrmPanel({ theme, initialOrderId }: { theme: Theme; initialOrderId?: number | null }) {
  const { user } = useAuth();

  // Права пользователя — новая система
  const canClientsView  = hasPermission(user, "clients_view");
  const canClientsEdit  = hasPermission(user, "clients_edit");
  const canOrdersEdit   = hasPermission(user, "orders_edit");
  const canKanban       = hasPermission(user, "kanban_view");
  const canKanbanEdit   = hasPermission(user, "kanban_edit");
  const canCalendar     = hasPermission(user, "calendar_view");
  const canCalendarEdit = hasPermission(user, "calendar_edit");
  const canAnalytics    = hasPermission(user, "analytics_view");
  const canFinance      = hasPermission(user, "finance_view");
  const canFilesEdit    = hasPermission(user, "files_edit");

  // Поля в карточке
  const canFieldContacts = hasPermission(user, "field_contacts");
  const canFieldAddress  = hasPermission(user, "field_address");
  const canFieldDates    = hasPermission(user, "field_dates");
  const canFieldFinance  = hasPermission(user, "field_finance");
  const canFieldNotes    = hasPermission(user, "field_notes");
  const canFieldFiles    = hasPermission(user, "field_files");
  const canFieldCancel   = hasPermission(user, "field_cancel");

  // Доступные фиксированные табы
  const visibleTabs = ALL_TABS.filter(tb => !tb.perm || hasPermission(user, tb.perm));

  const [tab, setTab]               = useState<CrmTab>("orders");
  const [clients, setClients]       = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [calendarOpenId, setCalendarOpenId] = useState<number | null>(null);

  const handleCalendarSelectClient = (id: number) => {
    setCalendarOpenId(id);
    setTab("orders");
  };
  const [kanbanEnabled, setKanbanEnabled] = useState<boolean>(
    () => canKanban && localStorage.getItem(LS_KANBAN_ENABLED) === "true"
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

          {/* Фиксированные вкладки (фильтрованные по правам) */}
          {visibleTabs.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-xl transition whitespace-nowrap font-medium border"
                style={active ? {
                  background: "#7c3aed18", color: "#a78bfa", borderColor: "#7c3aed35",
                } : {
                  color: t.textSub, borderColor: "transparent", background: "transparent",
                }}>
                <Icon name={tb.icon} size={15} />
                <span className="hidden sm:inline">{tb.label}</span>
              </button>
            );
          })}

          {/* Вкладка Канбан — если включена и есть право */}
          {kanbanEnabled && canKanban && (
            <button onClick={() => setTab("kanban")}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-xl transition whitespace-nowrap font-medium border"
              style={tab === "kanban" ? {
                background: "#7c3aed18", color: "#a78bfa", borderColor: "#7c3aed35",
              } : {
                color: t.textSub, borderColor: "transparent", background: "transparent",
              }}>
              <Icon name="Kanban" size={15} />
              <span className="hidden sm:inline">Канбан</span>
            </button>
          )}

          {/* Разделитель */}
          <div className="flex-1" />

          {/* Промо-блок канбана — только если есть право и канбан ещё не включён */}
          {!kanbanEnabled && canKanban && (
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
          {!kanbanEnabled && canKanban && (
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
          {tab === "analytics" && canAnalytics && <CrmAnalytics />}
          {tab === "clients"   && canClientsView && (
            <CrmClients
              canEdit={canClientsEdit}
              canFinance={canFinance}
              canFiles={canFilesEdit}
              canFieldContacts={canFieldContacts}
              canFieldAddress={canFieldAddress}
              canFieldDates={canFieldDates}
              canFieldFinance={canFieldFinance}
              canFieldNotes={canFieldNotes}
              canFieldFiles={canFieldFiles}
              canFieldCancel={canFieldCancel}
            />
          )}
          {tab === "orders" && (
            <CrmOrders
              clients={clients} loading={loading}
              onStatusChange={updateClientStatus}
              onClientRemoved={removeClient}
              onReload={loadClients}
              initialOrderId={calendarOpenId ?? initialOrderId}
              canEdit={canClientsEdit}
              canOrdersEdit={canOrdersEdit}
              canFinance={canFinance}
              canFiles={canFilesEdit}
              canFieldContacts={canFieldContacts}
              canFieldAddress={canFieldAddress}
              canFieldDates={canFieldDates}
              canFieldFinance={canFieldFinance}
              canFieldNotes={canFieldNotes}
              canFieldFiles={canFieldFiles}
              canFieldCancel={canFieldCancel}
            />
          )}
          {tab === "calendar" && canCalendar && <CrmCalendar onSelectClient={handleCalendarSelectClient} canEdit={canCalendarEdit} />}
          {tab === "kanban"   && canKanban   && <CrmKanban clients={[]} loading={false} onStatusChange={() => {}} onClientRemoved={() => {}} onReload={() => {}} onRemoveBoard={disableKanban} canEdit={canKanbanEdit} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
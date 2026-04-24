import { useState } from "react";
import Icon from "@/components/ui/icon";
import CrmDashboard from "./CrmDashboard";
import CrmAnalytics from "./CrmAnalytics";
import CrmClients from "./CrmClients";
import CrmOrders from "./CrmOrders";
import CrmCalendar from "./CrmCalendar";
import CrmKanban from "./CrmKanban";

type CrmTab = "dashboard" | "analytics" | "clients" | "orders" | "calendar" | "kanban";

const CRM_TABS: { id: CrmTab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Дашборд",   icon: "LayoutDashboard" },
  { id: "analytics", label: "Аналитика", icon: "BarChart2" },
  { id: "clients",   label: "Клиенты",   icon: "Users" },
  { id: "orders",    label: "Заказы",    icon: "ShoppingBag" },
  { id: "calendar",  label: "Календарь", icon: "CalendarDays" },
  { id: "kanban",    label: "Канбан",    icon: "Kanban" },
];

export default function CrmPanel() {
  const [tab, setTab] = useState<CrmTab>("dashboard");

  return (
    <div className="min-h-screen bg-[#0b0b11] -m-4 p-0">
      {/* Шапка CRM */}
      <div className="bg-[#0d0d1a] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center">
            <Icon name="LayoutDashboard" size={18} className="text-violet-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">CRM — Натяжные потолки</div>
            <div className="text-xs text-white/30">Управление клиентами и заказами</div>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="bg-[#0d0d1a] border-b border-white/10 px-4 flex gap-1 overflow-x-auto">
        {CRM_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm transition whitespace-nowrap border-b-2 ${
              tab === t.id
                ? "border-violet-500 text-violet-300 bg-violet-600/10"
                : "border-transparent text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}>
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="p-6 max-w-7xl mx-auto">
        {tab === "dashboard" && <CrmDashboard />}
        {tab === "analytics" && <CrmAnalytics />}
        {tab === "clients"   && <CrmClients />}
        {tab === "orders"    && <CrmOrders />}
        {tab === "calendar"  && <CrmCalendar />}
        {tab === "kanban"    && <CrmKanban />}
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#080812] -m-4 p-0">
      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Icon name="LayoutDashboard" size={17} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Simple Store Manager</div>
            <div className="text-[10px] text-white/30">Управляй бизнесом с умом</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/8 text-white/70 hover:text-white text-xs rounded-xl transition">
            <Icon name="UserPlus" size={13} /> Добавить клиента
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-xl transition font-medium shadow-lg shadow-violet-900/30">
            <Icon name="Plus" size={13} /> Добавить заказ
          </button>
        </div>
      </div>

      {/* Навигация */}
      <div className="flex gap-1 px-6 py-2 border-b border-white/[0.06] overflow-x-auto">
        {CRM_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition whitespace-nowrap font-medium ${
              tab === t.id
                ? "bg-violet-600/15 text-violet-300 border border-violet-500/25"
                : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
            }`}>
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="p-6">
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

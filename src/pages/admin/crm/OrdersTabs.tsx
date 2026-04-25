import { Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, OrdersTabId } from "./ordersTypes";

export function OrdersTabs({ allClients, activeTab, onSelect }: {
  allClients: Client[];
  activeTab: OrdersTabId;
  onSelect: (id: OrdersTabId) => void;
}) {
  const t = useTheme();

  const getTabClients = (tab: typeof ORDERS_TABS[number]) =>
    allClients.filter(c => tab.statuses.includes(c.status));

  return (
    <div className="flex gap-2 flex-wrap">
      {ORDERS_TABS.map(tab => {
        const clients  = getTabClients(tab);
        const revenue  = clients.reduce((s, c) => s + (Number(c.contract_sum) || 0), 0);
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onSelect(tab.id)}
            className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition flex-1 min-w-0"
            style={{
              background: isActive ? tab.color + "15" : t.surface,
              border: `1px solid ${isActive ? tab.color + "45" : t.border}`,
            }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: tab.color + "20" }}>
              <Icon name={tab.icon} size={13} style={{ color: tab.color }} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold" style={{ color: isActive ? tab.color : "#fff" }}>{tab.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: tab.color + "20", color: tab.color }}>{clients.length}</span>
              </div>
              {revenue > 0 && (
                <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: isActive ? tab.color : "#a3a3a3" }}>
                  {revenue.toLocaleString("ru-RU")} ₽
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
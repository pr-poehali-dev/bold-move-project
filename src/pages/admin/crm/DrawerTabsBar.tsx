import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";

export type DrawerTabId = "client" | "orders" | "estimate" | "plan" | "touches" | "analytics";

interface Props {
  t: ThemeCtx;
  drawerTab: DrawerTabId;
  setDrawerTab: (tab: DrawerTabId) => void;
  ordersCount: number;
  unreadTouches?: number;
  setPdfModalOpen: (v: boolean) => void;
}

export function DrawerTabsBar({ t, drawerTab, setDrawerTab, ordersCount, unreadTouches = 0, setPdfModalOpen }: Props) {
  const badgeFor: Record<string, number> = {
    orders: ordersCount,
    touches: unreadTouches,
  };
  return (
    <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}`, scrollbarWidth: "none" }}>
      {([
        { id: "client",   label: "Клиент",   icon: "User" },
        { id: "orders",   label: "Заявки",   icon: "ClipboardList" },
        { id: "touches",  label: "Касания",  icon: "MessagesSquare" },
        { id: "estimate", label: "Смета",    icon: "FileSpreadsheet" },
        { id: "plan",     label: "Чертежи",  icon: "LayoutDashboard" },
        { id: "analytics",label: "Аналитика",icon: "Sparkles" },
      ] as const).map((tab: { id: string; label: string; icon: string }) => {
        const active = drawerTab === tab.id;
        const badge = badgeFor[tab.id] || 0;
        return (
          <button key={tab.id} onClick={() => setDrawerTab(tab.id as DrawerTabId)}
            className="relative flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold rounded-xl transition whitespace-nowrap flex-shrink-0"
            style={active
              ? { color: "#fff", background: "#7c3aed", boxShadow: "0 2px 10px rgba(124,58,237,0.4)" }
              : { color: t.textSub, background: t.surface2, border: `1px solid ${t.border}` }}>
            <Icon name={tab.icon} size={14} /> {tab.label}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white"
                style={{ background: "#ef4444", border: `2px solid ${t.surface}`, lineHeight: 1 }}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        );
      })}
      {/* Кнопка PDF — всегда справа */}
      <div className="flex-1" />
      <button
        onClick={() => setPdfModalOpen(true)}
        className="flex items-center justify-center p-2 rounded-xl transition hover:opacity-80 active:scale-[0.97] flex-shrink-0"
        style={{ color: t.textMute, background: t.surface2, border: `1px solid ${t.border}` }}
        title="Настройки PDF"
      >
        <Icon name="Share2" size={14} />
      </button>
    </div>
  );
}
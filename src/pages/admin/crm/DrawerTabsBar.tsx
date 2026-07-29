import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";

export type DrawerTabId = "client" | "orders" | "estimate" | "plan" | "touches" | "analytics";

interface Props {
  t: ThemeCtx;
  drawerTab: DrawerTabId;
  setDrawerTab: (tab: DrawerTabId) => void;
  ordersCount: number;
  hasProject: boolean;
  setPdfModalOpen: (v: boolean) => void;
}

export function DrawerTabsBar({ t, drawerTab, setDrawerTab, ordersCount, hasProject, setPdfModalOpen }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}`, scrollbarWidth: "none" }}>
      {([
        { id: "client",   label: "Клиент",   icon: "User" },
        { id: "touches",  label: "Касания",  icon: "MessagesSquare" },
        { id: "analytics",label: "Аналитика",icon: "Sparkles" },
        { id: "orders",   label: `Заявки (${ordersCount})`, icon: "ClipboardList" },
        { id: "estimate", label: "Смета",    icon: "FileSpreadsheet" },
        ...(hasProject ? [{ id: "plan", label: "Чертежи", icon: "LayoutDashboard" }] : []),
      ] as const).map((tab: { id: string; label: string; icon: string }) => {
        const active = drawerTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setDrawerTab(tab.id as DrawerTabId)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold rounded-xl transition whitespace-nowrap flex-shrink-0"
            style={active
              ? { color: "#fff", background: "#7c3aed", boxShadow: "0 2px 10px rgba(124,58,237,0.4)" }
              : { color: t.textSub, background: t.surface2, border: `1px solid ${t.border}` }}>
            <Icon name={tab.icon} size={14} /> {tab.label}
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

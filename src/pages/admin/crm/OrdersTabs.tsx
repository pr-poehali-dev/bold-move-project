import { useState, useRef, useEffect } from "react";
import { Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, CustomOrdersTab } from "./ordersTypes";

const PRESET_COLORS = [
  "#8b5cf6","#a78bfa","#6366f1","#3b82f6","#06b6d4",
  "#10b981","#f59e0b","#f97316","#ef4444","#ec4899",
  "#64748b","#e2e8f0",
];

interface TabDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  statuses: readonly string[];
  emptyText: string;
}

interface Props {
  allClients: Client[];
  activeTab: string;
  onSelect: (id: string) => void;
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  hiddenTabs: Set<string>;
  customTabs: CustomOrdersTab[];
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDeleteTab: (id: string) => void;
  onAddTab: () => void;
}

function TabSettingsPopup({ tab, tabLabels, tabColors, onSaveLabel, onSaveColor, onDelete, onClose }: {
  tab: TabDef;
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [labelVal, setLabelVal] = useState(tabLabels[tab.id] || tab.label);
  const [editing, setEditing] = useState(false);
  const currentColor = tabColors[tab.id] || tab.color;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const commitLabel = () => {
    const v = labelVal.trim();
    if (v) onSaveLabel(tab.id, v);
    setEditing(false);
  };

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-50 rounded-xl shadow-2xl overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}`, minWidth: 210 }}
      onClick={e => e.stopPropagation()}>

      {/* Название */}
      <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
        <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: t.textMute }}>Название</div>
        <div className="flex items-center gap-1.5">
          <input
            value={labelVal}
            onChange={e => setLabelVal(e.target.value)}
            onFocus={() => setEditing(true)}
            onKeyDown={e => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") { setLabelVal(tabLabels[tab.id] || tab.label); setEditing(false); } }}
            className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{ background: t.surface2, border: `1px solid ${editing ? "#7c3aed60" : t.border}`, color: t.text }}
          />
          {editing && (
            <button onClick={commitLabel}
              className="px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "#7c3aed", color: "#fff" }}>ОК</button>
          )}
        </div>
      </div>

      {/* Цвет */}
      <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
        <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: t.textMute }}>Цвет</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => onSaveColor(tab.id, c)}
              className="w-5 h-5 rounded-full transition hover:scale-125 flex-shrink-0"
              style={{ background: c, outline: currentColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
          ))}
          <label className="w-5 h-5 rounded-full overflow-hidden cursor-pointer flex items-center justify-center transition hover:scale-125"
            style={{ border: `2px dashed ${t.border}` }}>
            <input type="color" defaultValue={currentColor} className="opacity-0 w-0 h-0"
              onChange={e => onSaveColor(tab.id, e.target.value)} />
            <Icon name="Plus" size={10} style={{ color: t.textMute }} />
          </label>
        </div>
      </div>

      {/* Удалить */}
      <button
        onClick={() => {
          if (!window.confirm(`Удалить таб «${tabLabels[tab.id] || tab.label}»?`)) return;
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition hover:bg-red-500/10"
        style={{ color: "#f87171" }}>
        <Icon name="Trash2" size={12} /> Удалить таб
      </button>
    </div>
  );
}

export function OrdersTabs({
  allClients, activeTab, onSelect,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
}: Props) {
  const t = useTheme();
  const [openPopup, setOpenPopup] = useState<string | null>(null);

  const defaultTabs: TabDef[] = ORDERS_TABS
    .filter(tab => !hiddenTabs.has(tab.id))
    .map(tab => ({
      id: tab.id,
      label: tabLabels[tab.id] || tab.label,
      icon: tab.icon,
      color: tabColors[tab.id] || tab.color,
      statuses: tab.statuses,
      emptyText: tab.emptyText,
    }));

  const customTabsMapped: TabDef[] = customTabs.map(tab => ({
    id: tab.id,
    label: tabLabels[tab.id] || tab.label,
    icon: tab.icon,
    color: tabColors[tab.id] || tab.color,
    statuses: tab.statuses,
    emptyText: tab.emptyText,
  }));

  const allTabs = [...defaultTabs, ...customTabsMapped];

  const getRevenue = (tab: TabDef) =>
    allClients.filter(c => tab.statuses.includes(c.status)).reduce((s, c) => s + (Number(c.contract_sum) || 0), 0);

  const getCount = (tab: TabDef) =>
    allClients.filter(c => tab.statuses.includes(c.status)).length;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {allTabs.map(tab => {
          const count    = getCount(tab);
          const revenue  = getRevenue(tab);
          const isActive = activeTab === tab.id;
          const isOpen   = openPopup === tab.id;

          return (
            <div key={tab.id} className="relative group/tab flex-1 min-w-0">
              <button
                onClick={() => onSelect(tab.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition"
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
                    <span className="text-xs font-bold truncate" style={{ color: isActive ? tab.color : "#fff" }}>{tab.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: tab.color + "20", color: tab.color }}>{count}</span>
                  </div>
                  {revenue > 0 && (
                    <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: isActive ? tab.color : "#a3a3a3" }}>
                      {revenue.toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                </div>
              </button>

              {/* Шестерёнка */}
              <button
                onClick={e => { e.stopPropagation(); setOpenPopup(isOpen ? null : tab.id); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover/tab:opacity-100 transition hover:bg-white/10"
                style={{ color: t.textMute }}>
                <Icon name="Settings2" size={11} />
              </button>

              {/* Попап */}
              {isOpen && (
                <TabSettingsPopup
                  tab={tab}
                  tabLabels={tabLabels}
                  tabColors={tabColors}
                  onSaveLabel={onSaveLabel}
                  onSaveColor={onSaveColor}
                  onDelete={() => { onDeleteTab(tab.id); setOpenPopup(null); if (activeTab === tab.id) onSelect(allTabs[0]?.id || "leads"); }}
                  onClose={() => setOpenPopup(null)}
                />
              )}
            </div>
          );
        })}

        {/* Кнопка добавить таб */}
        <button onClick={onAddTab}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition flex-shrink-0 hover:bg-violet-500/10"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#a78bfa" }}>
          <Icon name="Plus" size={13} />
        </button>
      </div>
    </div>
  );
}

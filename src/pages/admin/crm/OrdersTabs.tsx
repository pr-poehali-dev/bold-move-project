import { useState, useRef, useEffect, useCallback } from "react";
import { Client, crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, CustomOrdersTab } from "./ordersTypes";

const PRESET_COLORS = [
  "#8b5cf6","#a78bfa","#6366f1","#3b82f6","#06b6d4",
  "#10b981","#f59e0b","#f97316","#ef4444","#ec4899",
  "#64748b","#e2e8f0",
];

export interface Substatus {
  id: number;
  parent_status: string;
  label: string;
  color: string;
  position: number;
}

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
  substatuses: Substatus[];
  onSubstatusesChange: (list: Substatus[]) => void;
}

function TabSettingsPopup({ tab, tabLabels, tabColors, onSaveLabel, onSaveColor, onDelete, onClose, popupPos, substatuses, onSubstatusesChange }: {
  tab: TabDef;
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDelete: () => void;
  onClose: () => void;
  popupPos?: { top: number; left: number };
  substatuses: Substatus[];
  onSubstatusesChange: (list: Substatus[]) => void;
}) {
  const t = useTheme();
  const [labelVal, setLabelVal] = useState(tabLabels[tab.id] || tab.label);
  const [editing, setEditing] = useState(false);
  const currentColor = tabColors[tab.id] || tab.color;
  const ref = useRef<HTMLDivElement>(null);

  // Подстатусы этого таба (parent_status = tab.id)
  const mySubstatuses = substatuses.filter(s => s.parent_status === tab.id);

  // Состояние нового подстатуса
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#a78bfa");
  const [adding, setAdding] = useState(false);

  // Редактирование существующего
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");

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

  const posStyle = popupPos
    ? { position: "fixed" as const, top: popupPos.top, left: popupPos.left, zIndex: 9999 }
    : { position: "absolute" as const, left: 0, top: "100%", marginTop: 4, zIndex: 50 };

  const addSubstatus = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const data = await crmFetch("substatuses", {
      method: "POST",
      body: JSON.stringify({ parent_status: tab.id, label, color: newColor }),
    }) as { id: number; position: number };
    const newSub: Substatus = { id: data.id, parent_status: tab.id, label, color: newColor, position: data.position };
    onSubstatusesChange([...substatuses, newSub]);
    setNewLabel("");
    setNewColor("#a78bfa");
    setAdding(false);
  };

  const deleteSubstatus = async (id: number) => {
    await crmFetch("substatuses", { method: "DELETE" }, { id: String(id) });
    onSubstatusesChange(substatuses.filter(s => s.id !== id));
  };

  const startEdit = (s: Substatus) => {
    setEditingSubId(s.id);
    setEditLabel(s.label);
    setEditColor(s.color);
  };

  const saveEdit = async (id: number) => {
    const label = editLabel.trim();
    if (!label) return;
    await crmFetch("substatuses", {
      method: "PUT",
      body: JSON.stringify({ label, color: editColor }),
    }, { id: String(id) });
    onSubstatusesChange(substatuses.map(s => s.id === id ? { ...s, label, color: editColor } : s));
    setEditingSubId(null);
  };

  return (
    <div ref={ref} className="rounded-xl shadow-2xl overflow-hidden"
      style={{ ...posStyle, background: t.surface, border: `1px solid ${t.border}`, minWidth: 240, maxWidth: 300 }}
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

      {/* Подстатусы */}
      <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: t.textMute }}>Подстатусы</div>
          <button onClick={() => setAdding(a => !a)}
            className="text-[10px] font-semibold flex items-center gap-0.5 transition"
            style={{ color: "#a78bfa" }}>
            <Icon name="Plus" size={10} /> Добавить
          </button>
        </div>

        {/* Список */}
        <div className="flex flex-col gap-1">
          {mySubstatuses.map(s => (
            <div key={s.id}>
              {editingSubId === s.id ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: editColor }} />
                  <input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(s.id); if (e.key === "Escape") setEditingSubId(null); }}
                    autoFocus
                    className="flex-1 text-xs rounded px-1.5 py-0.5 focus:outline-none"
                    style={{ background: t.surface2, border: `1px solid #7c3aed60`, color: t.text }}
                  />
                  <div className="flex gap-0.5">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className="w-3.5 h-3.5 rounded-full transition hover:scale-110 flex-shrink-0"
                        style={{ background: c, outline: editColor === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
                    ))}
                  </div>
                  <button onClick={() => saveEdit(s.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "#7c3aed", color: "#fff" }}>ОК</button>
                  <button onClick={() => setEditingSubId(null)}>
                    <Icon name="X" size={10} style={{ color: t.textMute }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group/sub px-1 py-0.5 rounded hover:bg-white/5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 text-xs truncate" style={{ color: t.text }}>{s.label}</span>
                  <button onClick={() => startEdit(s)}
                    className="opacity-0 group-hover/sub:opacity-100 transition p-0.5 rounded"
                    style={{ color: t.textMute }}>
                    <Icon name="Pencil" size={10} />
                  </button>
                  <button onClick={() => deleteSubstatus(s.id)}
                    className="opacity-0 group-hover/sub:opacity-100 transition p-0.5 rounded"
                    style={{ color: "#f87171" }}>
                    <Icon name="Trash2" size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {mySubstatuses.length === 0 && !adding && (
            <div className="text-[10px] py-1" style={{ color: t.textMute }}>Нет подстатусов</div>
          )}
        </div>

        {/* Форма добавления */}
        {adding && (
          <div className="mt-2 flex flex-col gap-1.5">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addSubstatus(); if (e.key === "Escape") setAdding(false); }}
              autoFocus
              placeholder="Название подстатуса"
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none w-full"
              style={{ background: t.surface2, border: `1px solid #7c3aed60`, color: t.text }}
            />
            <div className="flex items-center gap-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className="w-4 h-4 rounded-full transition hover:scale-110 flex-shrink-0"
                  style={{ background: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={addSubstatus}
                className="flex-1 py-1 rounded-lg text-xs font-semibold"
                style={{ background: "#7c3aed", color: "#fff" }}>Добавить</button>
              <button onClick={() => setAdding(false)}
                className="px-2 py-1 rounded-lg text-xs"
                style={{ background: t.surface2, color: t.textMute }}>Отмена</button>
            </div>
          </div>
        )}
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

export function useSubstatuses() {
  const [substatuses, setSubstatuses] = useState<Substatus[]>([]);

  const load = useCallback(async () => {
    const data = await crmFetch("substatuses") as Substatus[];
    setSubstatuses(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { substatuses, setSubstatuses };
}

export function OrdersTabs({
  allClients, activeTab, onSelect,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
  substatuses, onSubstatusesChange,
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

  const gearRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  const openTab = (tabId: string) => {
    const btn = gearRefs.current[tabId];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPopupPos({ top: rect.bottom + 6, left: rect.left });
    setOpenPopup(tabId);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {allTabs.map(tab => {
          const count    = getCount(tab);
          const revenue  = getRevenue(tab);
          const isActive = activeTab === tab.id;
          const isOpen   = openPopup === tab.id;

          return (
            <div key={tab.id} className="relative group/tab flex-shrink-0" style={{ minWidth: 130 }}>
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
                    <span className="text-xs font-bold truncate" style={{ color: isActive ? tab.color : t.text }}>{tab.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: tab.color + "20", color: tab.color }}>{count}</span>
                  </div>
                  {revenue > 0 && (
                    <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: isActive ? tab.color : t.textSub }}>
                      {revenue.toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                </div>
              </button>

              {/* Шестерёнка */}
              <button
                ref={(el: HTMLButtonElement | null) => { gearRefs.current[tab.id] = el; }}
                onClick={e => { e.stopPropagation(); if (isOpen) { setOpenPopup(null); } else { openTab(tab.id); } }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover/tab:opacity-100 transition"
                style={{ color: t.textMute }}
                onMouseEnter={e => (e.currentTarget.style.background = t.surface2)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <Icon name="Settings2" size={11} />
              </button>

              {/* Попап */}
              {isOpen && popupPos && (
                <TabSettingsPopup
                  tab={tab}
                  tabLabels={tabLabels}
                  tabColors={tabColors}
                  onSaveLabel={onSaveLabel}
                  onSaveColor={onSaveColor}
                  popupPos={popupPos}
                  onDelete={() => { onDeleteTab(tab.id); setOpenPopup(null); if (activeTab === tab.id) onSelect(allTabs[0]?.id || "leads"); }}
                  onClose={() => setOpenPopup(null)}
                  substatuses={substatuses}
                  onSubstatusesChange={onSubstatusesChange}
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

import { useState, useRef, useEffect } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { PRESET_COLORS, Substatus, TabDef } from "./ordersTabsShared";

export function TabSettingsPopup({
  tab, tabLabels, tabColors, onSaveLabel, onSaveColor, onDelete, onClose, popupPos,
  statusLabels, statusColors, onSaveStatusLabel, onSaveStatusColor,
  substatuses, onSubstatusesChange,
}: {
  tab: TabDef;
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDelete: () => void;
  onClose: () => void;
  popupPos?: { top: number; left: number };
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  onSaveStatusLabel: (status: string, val: string) => void;
  onSaveStatusColor: (status: string, color: string) => void;
  substatuses: Substatus[];
  onSubstatusesChange: (list: Substatus[]) => void;
}) {
  const t = useTheme();
  const [labelVal, setLabelVal] = useState(tabLabels[tab.id] || tab.label);
  const [editing, setEditing] = useState(false);
  const currentColor = tabColors[tab.id] || tab.color;
  const ref = useRef<HTMLDivElement>(null);

  // Реальные этапы (статусы) этого таба — редактируются, только если их больше одного
  // (leads/working содержат по одному статусу — делить там нечего)
  const myStatuses = tab.statuses.length > 1 ? tab.statuses : [];

  // Редактирование названия/цвета этапа
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");

  // Свои (кастомные) этапы этого таба — хранятся в БД (order_substatuses, parent_status = tab.id)
  const mySubstatuses = substatuses.filter(s => s.parent_status === tab.id);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#a78bfa");
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [subLabel, setSubLabel] = useState("");
  const [subColor, setSubColor] = useState("#a78bfa");

  const addSubstatus = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const data = await crmFetch("substatuses", {
      method: "POST",
      body: JSON.stringify({ parent_status: tab.id, label, color: newColor }),
    }) as { id: number; position: number };
    onSubstatusesChange([...substatuses, { id: data.id, parent_status: tab.id, label, color: newColor, position: data.position }]);
    setNewLabel("");
    setNewColor("#a78bfa");
    setAdding(false);
  };

  const deleteSubstatus = async (id: number) => {
    await crmFetch("substatuses", { method: "DELETE" }, { id: String(id) });
    onSubstatusesChange(substatuses.filter(s => s.id !== id));
  };

  const startEditSub = (s: Substatus) => {
    setEditingSubId(s.id);
    setSubLabel(s.label);
    setSubColor(s.color);
  };

  const saveEditSub = async (id: number) => {
    const label = subLabel.trim();
    if (!label) return;
    await crmFetch("substatuses", { method: "PUT", body: JSON.stringify({ label, color: subColor }) }, { id: String(id) });
    onSubstatusesChange(substatuses.map(s => s.id === id ? { ...s, label, color: subColor } : s));
    setEditingSubId(null);
  };

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
    ? {
        position: "fixed" as const,
        top: popupPos.top,
        left: popupPos.left,
        zIndex: 9999,
        maxHeight: `calc(100dvh - ${popupPos.top + 8}px)`,
        overflowY: "auto" as const,
      }
    : { position: "absolute" as const, left: 0, top: "100%", marginTop: 4, zIndex: 50 };

  const startEditStatus = (s: string) => {
    setEditingStatus(s);
    setEditLabel(statusLabels[s] || STATUS_LABELS[s] || s);
    setEditColor(statusColors[s] || STATUS_COLORS[s] || "#8b5cf6");
  };

  const saveEditStatus = (s: string) => {
    const label = editLabel.trim();
    if (label) onSaveStatusLabel(s, label);
    onSaveStatusColor(s, editColor);
    setEditingStatus(null);
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
            style={{ background: t.surface2, border: `1px solid ${editing ? t.accent + "60" : t.border}`, color: t.text }}
          />
          {editing && (
            <button onClick={commitLabel}
              className="px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: t.accent, color: "#fff" }}>ОК</button>
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

      {/* Этапы — реальные подстатусы заявки внутри этого таба (только название/цвет) */}
      {myStatuses.length > 0 && (
        <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: t.textMute }}>Этапы</div>

          <div className="flex flex-col gap-1">
            {myStatuses.map(s => {
              const label = statusLabels[s] || STATUS_LABELS[s] || s;
              const color = statusColors[s] || STATUS_COLORS[s] || "#8b5cf6";
              return (
                <div key={s}>
                  {editingStatus === s ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: editColor }} />
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEditStatus(s); if (e.key === "Escape") setEditingStatus(null); }}
                        autoFocus
                        className="flex-1 text-xs rounded px-1.5 py-0.5 focus:outline-none"
                        style={{ background: t.surface2, border: `1px solid ${t.accent}60`, color: t.text }}
                      />
                      <div className="flex gap-0.5">
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setEditColor(c)}
                            className="w-3.5 h-3.5 rounded-full transition hover:scale-110 flex-shrink-0"
                            style={{ background: c, outline: editColor === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
                        ))}
                      </div>
                      <button onClick={() => saveEditStatus(s)}
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: "#7c3aed", color: "#fff" }}>ОК</button>
                      <button onClick={() => setEditingStatus(null)}>
                        <Icon name="X" size={10} style={{ color: t.textMute }} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/sub px-1 py-0.5 rounded hover:bg-white/5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="flex-1 text-xs truncate" style={{ color: t.text }}>{label}</span>
                      <button onClick={() => startEditStatus(s)}
                        className="opacity-0 group-hover/sub:opacity-100 transition p-0.5 rounded"
                        style={{ color: t.textMute }}>
                        <Icon name="Pencil" size={10} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Свои этапы — произвольные подстатусы, которые можно добавлять и удалять */}
      <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: t.textMute }}>Свои этапы</div>
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-0.5 text-[10px] font-semibold transition hover:opacity-80"
              style={{ color: t.accent }}>
              <Icon name="Plus" size={11} /> Добавить этап
            </button>
          )}
        </div>

        {mySubstatuses.length === 0 && !adding && (
          <div className="text-[10px]" style={{ color: t.textMute }}>Пока нет своих этапов</div>
        )}

        <div className="flex flex-col gap-1">
          {mySubstatuses.map(s => (
            <div key={s.id}>
              {editingSubId === s.id ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: subColor }} />
                  <input
                    value={subLabel}
                    onChange={e => setSubLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEditSub(s.id); if (e.key === "Escape") setEditingSubId(null); }}
                    autoFocus
                    className="flex-1 text-xs rounded px-1.5 py-0.5 focus:outline-none min-w-0"
                    style={{ background: t.surface2, border: `1px solid ${t.accent}60`, color: t.text }}
                  />
                  <div className="flex gap-0.5">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setSubColor(c)}
                        className="w-3.5 h-3.5 rounded-full transition hover:scale-110 flex-shrink-0"
                        style={{ background: c, outline: subColor === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
                    ))}
                  </div>
                  <button onClick={() => saveEditSub(s.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                    style={{ background: "#7c3aed", color: "#fff" }}>ОК</button>
                  <button onClick={() => setEditingSubId(null)} className="flex-shrink-0">
                    <Icon name="X" size={10} style={{ color: t.textMute }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group/sub px-1 py-0.5 rounded hover:bg-white/5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 text-xs truncate" style={{ color: t.text }}>{s.label}</span>
                  <button onClick={() => startEditSub(s)}
                    className="opacity-0 group-hover/sub:opacity-100 transition p-0.5 rounded flex-shrink-0"
                    style={{ color: t.textMute }}>
                    <Icon name="Pencil" size={10} />
                  </button>
                  <button onClick={() => { if (window.confirm(`Удалить этап «${s.label}»?`)) deleteSubstatus(s.id); }}
                    className="opacity-0 group-hover/sub:opacity-100 transition p-0.5 rounded flex-shrink-0"
                    style={{ color: "#f87171" }}>
                    <Icon name="Trash2" size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {adding && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: newColor }} />
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addSubstatus(); if (e.key === "Escape") { setAdding(false); setNewLabel(""); } }}
                autoFocus
                placeholder="Название этапа"
                className="flex-1 text-xs rounded px-1.5 py-1 focus:outline-none min-w-0"
                style={{ background: t.surface2, border: `1px solid ${t.accent}60`, color: t.text }}
              />
            </div>
            <div className="flex flex-wrap gap-0.5">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className="w-3.5 h-3.5 rounded-full transition hover:scale-110 flex-shrink-0"
                  style={{ background: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={addSubstatus}
                className="flex-1 text-[11px] py-1 rounded font-semibold"
                style={{ background: t.accent, color: "#fff" }}>Добавить</button>
              <button onClick={() => { setAdding(false); setNewLabel(""); }}
                className="text-[11px] px-2 py-1 rounded" style={{ color: t.textMute }}>Отмена</button>
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

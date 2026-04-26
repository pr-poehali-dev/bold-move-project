import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { KANBAN_COLS, LS_LABELS } from "./kanbanTypes";

const PRESET_COLORS = [
  "#8b5cf6", "#a78bfa", "#6366f1", "#3b82f6", "#06b6d4",
  "#10b981", "#f59e0b", "#f97316", "#ef4444", "#ec4899",
  "#64748b", "#ffffff",
];

interface Props {
  hiddenCols: Set<string>;
  colLabels: Record<string, string>;
  colColors: Record<string, string>;
  onToggleHide: (colId: string) => void;
  onSaveLabel: (colId: string, val: string) => void;
  onResetLabel: (colId: string) => void;
  onSaveColor: (colId: string, color: string) => void;
  onResetColor: (colId: string) => void;
  onClose: () => void;
}

export default function KanbanColSettings({
  hiddenCols, colLabels, colColors,
  onToggleHide, onSaveLabel, onResetLabel,
  onSaveColor, onResetColor, onClose,
}: Props) {
  const t = useTheme();
  const [editingLabel, setEditingLabel] = useState<{ id: string; val: string } | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

  const getLabel = (col: typeof KANBAN_COLS[number]) => colLabels[col.id] || col.label;
  const getColor = (col: typeof KANBAN_COLS[number]) => colColors[col.id] || col.color;

  const handleSave = (colId: string, val: string) => {
    onSaveLabel(colId, val);
    setEditingLabel(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => { onClose(); setEditingLabel(null); setColorPickerId(null); }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-sm font-bold" style={{ color: t.text }}>Настройка колонок</span>
          <button onClick={() => { onClose(); setEditingLabel(null); setColorPickerId(null); }}
            className="p-1.5 rounded-lg transition hover:bg-white/5" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Список колонок */}
        <div className="divide-y" style={{ borderColor: t.border2 }}>
          {KANBAN_COLS.map(col => {
            const isHidden = hiddenCols.has(col.id);
            const isEditing = editingLabel?.id === col.id;
            const color = getColor(col);
            const isColorPicking = colorPickerId === col.id;

            return (
              <div key={col.id}>
                <div className="flex items-center gap-3 px-5 py-3">

                  {/* Кружок-цвет — кликабельный */}
                  <button
                    onClick={() => setColorPickerId(isColorPicking ? null : col.id)}
                    title="Изменить цвет"
                    className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-1 transition hover:scale-110"
                    style={{ background: color, ringColor: color, ringOffsetColor: t.surface }} />

                  {/* Название */}
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingLabel.val}
                      onChange={e => setEditingLabel({ id: col.id, val: e.target.value })}
                      onBlur={() => handleSave(col.id, editingLabel.val)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleSave(col.id, editingLabel.val);
                        if (e.key === "Escape") setEditingLabel(null);
                      }}
                      className="flex-1 text-sm rounded-lg px-2 py-1 focus:outline-none"
                      style={{ background: t.surface2, border: `1px solid #7c3aed40`, color: t.text }}
                    />
                  ) : (
                    <button
                      className="flex-1 text-left text-sm flex items-center gap-1.5 group/lbl"
                      style={{ color: isHidden ? t.textMute : t.text }}
                      onClick={() => setEditingLabel({ id: col.id, val: getLabel(col) })}>
                      <span>{getLabel(col)}</span>
                      <Icon name="Pencil" size={11} className="opacity-0 group-hover/lbl:opacity-40 transition" style={{ color: t.textMute }} />
                    </button>
                  )}

                  {/* Сброс названия */}
                  {colLabels[col.id] && (
                    <button onClick={() => onResetLabel(col.id)}
                      className="p-1 rounded transition hover:opacity-60"
                      style={{ color: t.textMute }} title="Сбросить название">
                      <Icon name="RotateCcw" size={11} />
                    </button>
                  )}

                  {/* Тогл видимости */}
                  <button onClick={() => onToggleHide(col.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg transition"
                    style={{ color: isHidden ? t.textMute : color, background: isHidden ? "transparent" : color + "15" }}
                    title={isHidden ? "Показать" : "Скрыть"}>
                    <Icon name={isHidden ? "EyeOff" : "Eye"} size={14} />
                  </button>
                </div>

                {/* Пикер цвета */}
                {isColorPicking && (
                  <div className="px-5 pb-3">
                    <div className="flex flex-wrap gap-2 p-3 rounded-xl" style={{ background: t.surface2 }}>
                      {PRESET_COLORS.map(c => (
                        <button key={c} onClick={() => { onSaveColor(col.id, c); setColorPickerId(null); }}
                          className="w-6 h-6 rounded-full transition hover:scale-110 flex-shrink-0"
                          style={{
                            background: c,
                            outline: color === c ? `2px solid ${c}` : "none",
                            outlineOffset: 2,
                          }} />
                      ))}
                      {/* Произвольный цвет */}
                      <label className="w-6 h-6 rounded-full overflow-hidden cursor-pointer flex-shrink-0 transition hover:scale-110"
                        style={{ border: `2px dashed ${t.border}` }} title="Свой цвет">
                        <input type="color" defaultValue={color} className="opacity-0 w-0 h-0"
                          onChange={e => onSaveColor(col.id, e.target.value)} />
                        <Icon name="Plus" size={12} style={{ color: t.textMute, margin: "2px auto" }} />
                      </label>
                      {/* Сброс */}
                      {colColors[col.id] && (
                        <button onClick={() => { onResetColor(col.id); setColorPickerId(null); }}
                          title="Сбросить цвет"
                          className="w-6 h-6 rounded-full flex items-center justify-center transition hover:scale-110"
                          style={{ background: t.border, color: t.textMute }}>
                          <Icon name="RotateCcw" size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-5 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <p className="text-[11px]" style={{ color: t.textMute }}>
            Кружок — цвет · Название — переименовать · Глаз — скрыть колонку
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { KANBAN_COLS, LS_LABELS } from "./kanbanTypes";

interface Props {
  hiddenCols: Set<string>;
  colLabels: Record<string, string>;
  onToggleHide: (colId: string) => void;
  onSaveLabel: (colId: string, val: string) => void;
  onResetLabel: (colId: string) => void;
  onClose: () => void;
}

export default function KanbanColSettings({ hiddenCols, colLabels, onToggleHide, onSaveLabel, onResetLabel, onClose }: Props) {
  const t = useTheme();
  const [editingLabel, setEditingLabel] = useState<{ id: string; val: string } | null>(null);

  const getLabel = (col: typeof KANBAN_COLS[number]) => colLabels[col.id] || col.label;

  const handleSave = (colId: string, val: string) => {
    onSaveLabel(colId, val);
    setEditingLabel(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => { onClose(); setEditingLabel(null); }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-sm font-bold" style={{ color: t.text }}>Настройка колонок</span>
          <button onClick={() => { onClose(); setEditingLabel(null); }}
            className="p-1.5 rounded-lg transition hover:bg-white/5" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Список колонок */}
        <div className="divide-y" style={{ borderColor: t.border2 }}>
          {KANBAN_COLS.map(col => {
            const isHidden = hiddenCols.has(col.id);
            const isEditing = editingLabel?.id === col.id;
            return (
              <div key={col.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />

                {/* Название — кликабельное для переименования */}
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
                  style={{ color: isHidden ? t.textMute : col.color, background: isHidden ? "transparent" : col.color + "15" }}
                  title={isHidden ? "Показать" : "Скрыть"}>
                  <Icon name={isHidden ? "EyeOff" : "Eye"} size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        <div className="px-5 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <p className="text-[11px]" style={{ color: t.textMute }}>
            Нажми на название для переименования · Скрытые колонки не влияют на данные
          </p>
        </div>
      </div>
    </div>
  );
}

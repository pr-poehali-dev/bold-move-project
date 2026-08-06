import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { EVENT_TYPE_LABELS } from "./crmApi";
import { resolveEventColor, saveSyncedColors, loadSyncedColors, TYPE_TO_COL } from "./syncedCols";

const PRESET_COLORS = [
  "#8b5cf6", "#a78bfa", "#6366f1", "#3b82f6", "#06b6d4",
  "#10b981", "#f59e0b", "#f97316", "#ef4444", "#ec4899",
  "#64748b", "#ffffff",
];

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

// Настройка цветов типов событий календаря (Замер/Монтаж/Оплата/Звонок/Другое).
// Цвета — общие с колонками канбана/воронки (см. syncedCols.ts), поэтому смена
// цвета здесь отражается и в канбане, и наоборот.
export default function CalendarColorSettings({ onClose, onChanged }: Props) {
  const t = useTheme();
  const [colorPickerType, setColorPickerType] = useState<string | null>(null);
  const [, forceRerender] = useState(0);

  const saveColor = (eventType: string, color: string) => {
    const colId = TYPE_TO_COL[eventType] || "new";
    const next = { ...loadSyncedColors(), [colId]: color };
    saveSyncedColors(next);
    forceRerender(v => v + 1);
    onChanged();
  };

  const resetColor = (eventType: string) => {
    const colId = TYPE_TO_COL[eventType] || "new";
    const next = { ...loadSyncedColors() };
    delete next[colId];
    saveSyncedColors(next);
    forceRerender(v => v + 1);
    onChanged();
  };

  const hasCustom = (eventType: string) => {
    const colId = TYPE_TO_COL[eventType] || "new";
    return !!loadSyncedColors()[colId];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => { onClose(); setColorPickerType(null); }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-sm font-bold" style={{ color: t.text }}>Цвета типов событий</span>
          <button onClick={() => { onClose(); setColorPickerType(null); }}
            className="p-1.5 rounded-lg transition hover:bg-white/5" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="divide-y" style={{ borderColor: t.border2 }}>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, label]) => {
            const color = resolveEventColor(k);
            const isPicking = colorPickerType === k;
            return (
              <div key={k}>
                <div className="flex items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => setColorPickerType(isPicking ? null : k)}
                    title="Изменить цвет"
                    className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-1 transition hover:scale-110"
                    style={{ background: color, ringColor: color, ringOffsetColor: t.surface }} />
                  <span className="flex-1 text-sm" style={{ color: t.text }}>{label}</span>
                  {hasCustom(k) && (
                    <button onClick={() => resetColor(k)}
                      className="p-1 rounded transition hover:opacity-60"
                      style={{ color: t.textMute }} title="Сбросить цвет">
                      <Icon name="RotateCcw" size={11} />
                    </button>
                  )}
                </div>
                {isPicking && (
                  <div className="px-5 pb-3">
                    <div className="flex flex-wrap gap-2 p-3 rounded-xl" style={{ background: t.surface2 }}>
                      {PRESET_COLORS.map(c => (
                        <button key={c} onClick={() => { saveColor(k, c); setColorPickerType(null); }}
                          className="w-6 h-6 rounded-full transition hover:scale-110 flex-shrink-0"
                          style={{
                            background: c,
                            outline: color === c ? `2px solid ${c}` : "none",
                            outlineOffset: 2,
                          }} />
                      ))}
                      <label className="w-6 h-6 rounded-full overflow-hidden cursor-pointer flex-shrink-0 transition hover:scale-110"
                        style={{ border: `2px dashed ${t.border}` }} title="Свой цвет">
                        <input type="color" defaultValue={color} className="opacity-0 w-0 h-0"
                          onChange={e => saveColor(k, e.target.value)} />
                        <Icon name="Plus" size={12} style={{ color: t.textMute, margin: "2px auto" }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <p className="text-[11px]" style={{ color: t.textMute }}>
            Цвета общие с Канбаном — изменение здесь применится и там
          </p>
        </div>
      </div>
    </div>
  );
}

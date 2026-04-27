import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";

const ALL_STATUSES = [...LEAD_STATUSES, ...ORDER_STATUSES];

export function BulkBar({ count, onChangeStatus, onDelete, onExport, onClear }: {
  count: number;
  onChangeStatus: (s: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const t = useTheme();
  const barBg = t.theme === "dark" ? "#1e1b4b" : "#4c1d95";
  const barBorder = t.theme === "dark" ? "#4c1d95" : "#6d28d9";
  const btnBg = t.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)";
  const btnBorder = t.theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.3)";
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl"
      style={{ background: barBg, border: `1px solid ${barBorder}`, minWidth: 420 }}>
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#7c3aed" }}>{count}</div>
        <span className="text-sm font-medium text-white">выбрано</span>
      </div>

      {/* Сменить статус */}
      <div className="relative">
        <button onClick={() => setStatusOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-white"
          style={{ background: btnBg, border: `1px solid ${btnBorder}` }}>
          <Icon name="RefreshCw" size={12} /> Статус <Icon name="ChevronDown" size={11} />
        </button>
        {statusOpen && (
          <div className="absolute bottom-full mb-2 left-0 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[180px]"
            style={{ background: barBg, border: `1px solid ${barBorder}` }}>
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => { onChangeStatus(s); setStatusOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition"
                style={{ color: STATUS_COLORS[s] }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Экспорт CSV */}
      <button onClick={onExport}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-white"
        style={{ background: btnBg, border: `1px solid ${btnBorder}` }}>
        <Icon name="Download" size={12} /> CSV
      </button>

      {/* Удалить */}
      <button onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-red-400"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <Icon name="Trash2" size={12} /> Удалить
      </button>

      {/* Закрыть */}
      <button onClick={onClear} className="ml-auto text-white/60 hover:text-white transition">
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}

export function DeleteConfirm({ count, onConfirm, onCancel }: {
  count: number; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.12)" }}>
          <Icon name="Trash2" size={22} style={{ color: "#ef4444" }} />
        </div>
        <h3 className="text-base font-bold text-center mb-2" style={{ color: t.text }}>Удалить {count} клиент{count > 4 ? "ов" : count > 1 ? "а" : "а"}?</h3>
        <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>Это действие нельзя отменить</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
            style={{ background: "#ef4444" }}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
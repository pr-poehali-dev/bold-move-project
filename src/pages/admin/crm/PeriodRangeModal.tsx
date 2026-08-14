import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { CustomRange } from "./analyticsFilters";

interface Props {
  initial?: CustomRange | null;
  onApply: (range: CustomRange) => void;
  onClose: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Быстрые пресеты — чтобы добавить новый, достаточно дописать сюда строку. */
const PRESETS: { label: string; calc: () => CustomRange }[] = [
  {
    label: "Последние 30 дней",
    calc: () => {
      const to = new Date();
      const from = new Date(Date.now() - 29 * 864e5);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    },
  },
  {
    label: "Прошлый месяц",
    calc: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0);
      const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { from: f(from), to: f(to) };
    },
  },
  {
    label: "С начала года",
    calc: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() }),
  },
];

export default function PeriodRangeModal({ initial, onApply, onClose }: Props) {
  const t = useTheme();
  const [from, setFrom] = useState(initial?.from || todayISO());
  const [to,   setTo]   = useState(initial?.to   || todayISO());

  const invalid = !from || !to || new Date(from) > new Date(to);

  const inputStyle = {
    background: t.surface2,
    color: t.text,
    border: `1px solid ${t.border}`,
    colorScheme: t.theme,
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" onClick={e => e.stopPropagation()}
        style={{ background: t.surface, border: `1px solid ${t.border}` }}>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="CalendarRange" size={16} style={{ color: t.accentLight }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>Выбрать период</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:opacity-70">
            <Icon name="X" size={16} style={{ color: t.textMute }} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <button key={p.label}
              onClick={() => { const r = p.calc(); setFrom(r.from); setTo(r.to); }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80"
              style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>Дата начала</label>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>Дата окончания</label>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
          </div>
        </div>

        {invalid && (
          <div className="mt-3 text-xs" style={{ color: "#f87171" }}>
            Дата начала должна быть раньше даты окончания
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-80"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
          <button disabled={invalid} onClick={() => onApply({ from, to })}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
            style={{ background: t.accent, color: "#fff" }}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useTheme } from "./themeContext";
import type { Substatus } from "./ordersTabsShared";

interface Props {
  /** Текущий выбранный подстатус (объект или null, если не выбран) */
  active: Substatus | undefined;
  /** Все подстатусы, доступные для текущего этапа воронки (parent_status уже отфильтрован снаружи) */
  options: Substatus[];
  /** Запасной бейдж, если подстатусов для этапа нет вообще — просто текст без клика */
  fallbackLabel: string;
  fallbackColor: string;
  onSelect: (id: number) => void;
}

// Компактный бейдж статуса/подстатуса + выпадающий список вариантов по клику.
// Используется и в списке заявок (OrdersClientCard), и на карточках Kanban —
// единая логика, чтобы смена подстатуса работала одинаково в обоих местах.
export function SubstatusPicker({ active, options, fallbackLabel, fallbackColor, onSelect }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Нет вариантов для выбора — просто статичный бейдж, как раньше.
  if (options.length === 0) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
        style={{ background: fallbackColor + "20", color: fallbackColor }}>
        {fallbackLabel}
      </span>
    );
  }

  const label = active?.label || fallbackLabel;
  const color = active?.color || fallbackColor;

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Изменить подстатус"
        className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold transition hover:opacity-80"
        style={active
          ? { background: color, color: "#fff" }
          : { background: color + "20", color }}>
        {label}
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 rounded-xl overflow-hidden shadow-lg min-w-[160px]"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {options.map(s => {
            const isActive = active?.id === s.id;
            return (
              <button key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] font-medium transition hover:opacity-80"
                style={{
                  background: isActive ? s.color + "20" : "transparent",
                  color: isActive ? s.color : t.textSub,
                }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

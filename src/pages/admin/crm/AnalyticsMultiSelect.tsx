import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Props {
  /** Выбранные значения. Пустой массив = «все» */
  values: string[];
  onChange: (v: string[]) => void;
  options: { id: string; label: string }[];
  /** Подпись, когда ничего не выбрано (режим «все») */
  allLabel: string;
  icon?: string;
  /** Одиночный выбор — для фильтров, где множественность не нужна */
  single?: boolean;
  /** Доп. кнопка внизу попапа (например «Выбрать период») */
  footer?: { label: string; icon?: string; onClick: () => void; active?: boolean };
}

/** Фильтр аналитики со скруглённым попапом в стиле темы и множественным выбором.
 *  Пустой массив значений трактуется как «все» — так фильтр остаётся простым. */
export default function AnalyticsMultiSelect({ values, onChange, options, allLabel, icon, single, footer }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = values.length > 0;
  const selectable = options.filter(o => o.id !== "");

  const label = !active
    ? allLabel
    : values.length === 1
      ? (options.find(o => o.id === values[0])?.label ?? allLabel)
      : `Выбрано: ${values.length}`;

  const toggle = (id: string) => {
    if (single) { onChange(values[0] === id ? [] : [id]); setOpen(false); return; }
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
        style={active
          ? { background: t.accent + "1F", color: t.accentLight, border: `1px solid ${t.accent}55` }
          : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
        {icon && <Icon name={icon} size={12} />}
        <span className="max-w-[160px] truncate">{label}</span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={12} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-40 w-60 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {/* «Все» — сброс выбора */}
            <button onClick={() => { onChange([]); if (single) setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
              style={{ background: !active ? t.accent + "1F" : "transparent", color: !active ? t.accentLight : t.textSub }}>
              <span className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                style={{ border: `1px solid ${!active ? t.accent : t.border}`, background: !active ? t.accent : "transparent" }}>
                {!active && <Icon name="Check" size={10} style={{ color: "#fff" }} />}
              </span>
              {allLabel}
            </button>

            {selectable.map(o => {
              const on = values.includes(o.id);
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                  style={{ background: on ? t.accent + "1F" : "transparent", color: on ? t.accentLight : t.textSub }}>
                  <span className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                    style={{ border: `1px solid ${on ? t.accent : t.border}`, background: on ? t.accent : "transparent" }}>
                    {on && <Icon name="Check" size={10} style={{ color: "#fff" }} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>

          {footer && (
            <div className="p-1.5" style={{ borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => { footer.onClick(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                style={footer.active
                  ? { background: t.accent + "1F", color: t.accentLight }
                  : { background: t.surface2, color: t.textSub }}>
                {footer.icon && <Icon name={footer.icon} size={12} />}
                {footer.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { mondayWeekStart } from "./calendarUtils";

// Быстрый фильтр по периоду — та же кнопка-попап, что и у фильтра по ответственному
// (см. OrdersAssigneeFilter), только вместо роли/сотрудника выбирается готовый
// диапазон дат. По какому именно полю даты фильтровать — решает вызывающий код
// через проп dateField (для «Замеров» — дата замера, для «Монтажей» — дата монтажа
// и т.д.), сам компонент об этом не знает.
export type PeriodFilterValue = "all" | "today" | "week" | "first_half" | "second_half" | "month";

export const PERIOD_FILTER_OPTIONS: { id: PeriodFilterValue; label: string; icon: string }[] = [
  { id: "all",         label: "Все даты",       icon: "CalendarDays" },
  { id: "today",       label: "Сегодня",        icon: "CalendarCheck" },
  { id: "week",        label: "Текущая неделя", icon: "CalendarRange" },
  { id: "first_half",  label: "С 1 по 15",      icon: "CalendarClock" },
  { id: "second_half", label: "С 16 по 31",     icon: "CalendarClock" },
  { id: "month",       label: "Весь месяц",     icon: "Calendar" },
];

function inSelectedPeriod(iso: string | null | undefined, period: PeriodFilterValue): boolean {
  if (period === "all") return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();

  if (period === "today") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  if (period === "week") {
    // Текущая рабочая неделя: понедельник 00:00 — пятница 23:59:59 (без выходных)
    const monday = mondayWeekStart(now);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    return d.getTime() >= monday.getTime() && d.getTime() <= friday.getTime();
  }
  // "month" и половины месяца считаем внутри ТЕКУЩЕГО календарного месяца
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (!sameMonth) return false;
  if (period === "month") return true;
  const day = d.getDate();
  return period === "first_half" ? day <= 15 : day >= 16;
}

export function applyPeriodFilter(list: Client[], period: PeriodFilterValue, dateField: keyof Client): Client[] {
  if (period === "all") return list;
  return list.filter(c => inSelectedPeriod(c[dateField] as string | null | undefined, period));
}

interface Props {
  /** Заявки, по которым считаем счётчики (уже отфильтрованные остальными фильтрами) */
  pool: Client[];
  /** По какому полю даты фильтровать — задаётся вызывающей вкладкой */
  dateField: keyof Client;
  value: PeriodFilterValue;
  onChange: (v: PeriodFilterValue) => void;
}

const COLOR = "#06b6d4";

export default function OrdersPeriodFilter({ pool, dateField, value, onChange }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = value !== "all";
  const current = PERIOD_FILTER_OPTIONS.find(o => o.id === value) ?? PERIOD_FILTER_OPTIONS[0];
  const countFor = (period: PeriodFilterValue) => applyPeriodFilter(pool, period, dateField).length;

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
        style={{
          background: active ? COLOR : t.surface,
          borderColor: active ? COLOR : t.border,
          color: active ? "#fff" : t.textSub,
        }}>
        <Icon name={current.icon} size={13} />
        <span className="max-w-[190px] truncate">{current.label}</span>
        {active && (
          <span onClick={e => { e.stopPropagation(); onChange("all"); }}
            className="ml-0.5 opacity-70 hover:opacity-100" title="Сбросить">
            <Icon name="X" size={12} />
          </span>
        )}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={12} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[220px] rounded-xl overflow-hidden shadow-2xl"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="px-3 py-2 max-h-[280px] overflow-y-auto">
            <div className="flex flex-col gap-1">
              {PERIOD_FILTER_OPTIONS.map(o => (
                <button key={o.id}
                  onClick={() => { onChange(o.id); setOpen(false); }}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition"
                  style={{
                    background: value === o.id ? COLOR + "22" : "transparent",
                    color: value === o.id ? COLOR : t.textSub,
                  }}>
                  <span className="flex items-center gap-1.5">
                    <Icon name={o.icon} size={12} />
                    {o.label}
                  </span>
                  <span className="font-bold flex-shrink-0">{countFor(o.id)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
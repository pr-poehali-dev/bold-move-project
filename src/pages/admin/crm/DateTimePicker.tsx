import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS_RU   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function parseValue(v: string | null | undefined): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Кнопка прокрутки для скролл-столбца времени
function ScrollColumn({ items, selected, onSelect }: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const t = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(selected);
    if (idx >= 0) el.scrollTop = idx * 36 - 36;
  }, [selected, items]);

  return (
    <div ref={ref} className="overflow-y-auto h-[180px]" style={{ scrollbarWidth: "none", width: 52 }}>
      {items.map(v => (
        <div key={v}
          onClick={() => onSelect(v)}
          className="flex items-center justify-center text-sm font-semibold cursor-pointer rounded-xl transition"
          style={{
            height: 36, minHeight: 36,
            background: selected === v ? "#7c3aed" : "transparent",
            color: selected === v ? "#fff" : t.textMute,
          }}>
          {pad(v)}
        </div>
      ))}
    </div>
  );
}

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface Props {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

export function DateTimePickerPopup({ value, onChange, onClose, anchorRect }: Props) {
  const t = useTheme();
  const initial = parseValue(value);
  const [viewYear,  setViewYear]  = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selDate,   setSelDate]   = useState<Date>(initial);
  const [hour,      setHour]      = useState(initial.getHours());
  const [minute,    setMinute]    = useState(initial.getMinutes());
  const popRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Позиция попапа
  const popStyle: React.CSSProperties = { position: "fixed", zIndex: 9999 };
  if (anchorRect) {
    const top = anchorRect.bottom + 6;
    const left = Math.min(anchorRect.left, window.innerWidth - 380);
    popStyle.top = top; popStyle.left = Math.max(8, left);
  }

  // Дни в месяце
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=вс
  const offsetDays = (firstDay + 6) % 7; // смещение до пн
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const selStr   = `${selDate.getFullYear()}-${selDate.getMonth()}-${selDate.getDate()}`;

  const cells: { day: number; month: "prev" | "cur" | "next" }[] = [];
  for (let i = 0; i < offsetDays; i++) cells.push({ day: prevDays - offsetDays + 1 + i, month: "prev" });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, month: "cur" });
  while (cells.length % 7 !== 0) { cells.push({ day: cells.length - daysInMonth - offsetDays + 1, month: "next" }); }

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, hour, minute);
    setSelDate(d);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleSave = () => {
    const result = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), hour, minute);
    onChange(toIso(result));
    onClose();
  };

  const handleDelete = () => { onChange(null); onClose(); };

  const handleToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelDate(now);
    setHour(now.getHours());
    setMinute(now.getMinutes());
  };

  return createPortal(
    <div ref={popRef}
      className="rounded-2xl shadow-2xl overflow-hidden select-none"
      style={{
        ...popStyle,
        background: t.surface,
        border: `1px solid ${t.border}`,
        width: 360,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>

      <div className="flex">
        {/* Левая часть — календарь */}
        <div className="flex-1 p-4">

          {/* Навигация месяца */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition" style={{ color: t.textMute }}>
              <Icon name="ChevronLeft" size={14} />
            </button>
            <span className="text-sm font-bold" style={{ color: t.text }}>
              {MONTHS_RU[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition" style={{ color: t.textMute }}>
              <Icon name="ChevronRight" size={14} />
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_RU.map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide py-1"
                style={{ color: d === "Сб" || d === "Вс" ? "#a78bfa" : t.textMute }}>
                {d}
              </div>
            ))}
          </div>

          {/* Ячейки */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((c, i) => {
              const isCur  = c.month === "cur";
              const dateStr = `${viewYear}-${viewMonth}-${c.day}`;
              const isToday = isCur && dateStr === todayStr;
              const isSel   = isCur && dateStr === selStr;
              const isWe    = (i % 7) >= 5;
              return (
                <button key={i}
                  onClick={() => isCur && selectDay(c.day)}
                  disabled={!isCur}
                  className="flex items-center justify-center text-xs font-semibold rounded-xl transition"
                  style={{
                    height: 32,
                    background: isSel ? "#7c3aed" : isToday ? "rgba(124,58,237,0.15)" : "transparent",
                    color: isSel ? "#fff"
                      : !isCur ? t.textMute + "40"
                      : isToday ? "#a78bfa"
                      : isWe ? "#a78bfa"
                      : t.text,
                    border: isToday && !isSel ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                    cursor: isCur ? "pointer" : "default",
                  }}>
                  {c.day}
                </button>
              );
            })}
          </div>

          {/* Футер */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
            <button onClick={handleDelete}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:bg-red-500/10"
              style={{ color: "#ef4444" }}>
              Удалить
            </button>
            <button onClick={handleToday}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:bg-white/5"
              style={{ color: "#a78bfa" }}>
              Сегодня
            </button>
          </div>
        </div>

        {/* Правая часть — время */}
        <div className="flex flex-col" style={{ borderLeft: `1px solid ${t.border}`, width: 116 }}>
          {/* Заголовок */}
          <div className="text-center text-xs font-bold py-3 px-2" style={{ color: t.textMute, borderBottom: `1px solid ${t.border}` }}>
            {pad(hour)} : {pad(minute)}
          </div>

          {/* Колонки часы / минуты */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden py-2 pl-2">
              <div className="text-[9px] uppercase font-bold text-center mb-1" style={{ color: t.textMute }}>Час</div>
              <ScrollColumn items={HOURS} selected={hour} onSelect={setHour} />
            </div>
            <div className="w-px self-stretch my-2" style={{ background: t.border }} />
            <div className="flex-1 overflow-hidden py-2 pr-2">
              <div className="text-[9px] uppercase font-bold text-center mb-1" style={{ color: t.textMute }}>Мин</div>
              <ScrollColumn items={MINUTES} selected={minute} onSelect={setMinute} />
            </div>
          </div>

          {/* Кнопка Сохранить */}
          <button onClick={handleSave}
            className="mx-2 mb-3 py-2 rounded-xl text-xs font-bold transition"
            style={{ background: "#7c3aed", color: "#fff" }}>
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
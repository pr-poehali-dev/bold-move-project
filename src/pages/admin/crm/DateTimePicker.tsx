import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { toMoscowIso } from "./timeMoscow";

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS_RU   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function pad(n: number) { return String(n).padStart(2, "0"); }

// Возвращает Date, у которой ЛОКАЛЬНЫЕ компоненты (getHours/getDate…) равны
// МОСКОВСКИМ компонентам исходного момента. Так пикер показывает и редактирует
// именно московское время, независимо от часового пояса устройства.
function parseValue(v: string | null | undefined): Date {
  const src = v ? new Date(v) : new Date();
  const base = isNaN(src.getTime()) ? new Date() : src;
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const p = dtf.formatToParts(base);
  const g = (t: string) => Number(p.find(x => x.type === t)?.value);
  return new Date(g("year"), g("month") - 1, g("day"), g("hour") === 24 ? 0 : g("hour"), g("minute"));
}


// Ширина одной колонки (час/мин) в блоке времени. Задана здесь единым
// источником правды и используется и в ScrollColumn, и в контейнере-обёртке —
// чтобы контейнер никогда не оказывался УЖЕ содержимого (иначе браузер молча
// обрезает цифры сбоку — именно так выглядел баг «время не влезает»).
const TIME_COL_W = 44;

// Кнопка прокрутки для скролл-столбца времени
function ScrollColumn({ items, selected, onSelect, compact }: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  compact?: boolean;
}) {
  const t = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const rowH = compact ? 28 : 32;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(selected);
    if (idx >= 0) el.scrollTop = idx * rowH - rowH;
  }, [selected, items, rowH]);

  // flex:1 + minHeight:0 — стандартный CSS-приём «прокручиваемая область внутри
  // flex-колонки фиксированной высоты» (высоту задаёт родитель через colH).
  // БЕЗ minHeight:0 браузер по умолчанию растягивает flex-элемент под весь его
  // контент (все 24 часа/60 минут разом, без прокрутки) — именно так и раздуло
  // модалку в прошлый раз.
  return (
    <div ref={ref} className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none", width: TIME_COL_W, minHeight: 0 }}>
      {items.map(v => (
        <div key={v}
          onClick={() => onSelect(v)}
          className="flex items-center justify-center text-sm font-semibold cursor-pointer rounded-xl transition"
          style={{
            height: rowH, minHeight: rowH,
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

interface InnerProps {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  /** Скрыть кнопку «Удалить» в футере (напр. когда поле обязательное к заполнению) */
  hideDelete?: boolean;
  /** Показывать кнопку «Сохранить» справа снизу (для standalone-режима внутри своей модалки) */
  showSaveButton?: boolean;
  onSaveClick?: () => void;
  /** Уменьшенные отступы — для встраивания в компактные модалки (напр. DrawerCloseConfirm) */
  compact?: boolean;
}

// ── Внутренности пикера (календарь + колонки часы/минуты) — без portal и без
// собственного позиционирования. Переиспользуется и во всплывающем попапе
// (DateTimePickerPopup), и как встроенный виджет внутри других модалок.
export function DateTimePickerInner({ value, onChange, hideDelete, showSaveButton, onSaveClick, compact }: InnerProps) {
  const t = useTheme();
  const initial = parseValue(value);
  const [viewYear,  setViewYear]  = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selDate,   setSelDate]   = useState<Date>(initial);
  const [hour,      setHour]      = useState(initial.getHours());
  const [minute,    setMinute]    = useState(initial.getMinutes());

  // Реальная высота блока календаря (левая часть) — колонки часов/минут справа
  // подгоняются РОВНО под неё, чтобы модалка не растягивалась под весь список
  // (0..23 / 0..59), а время оставалось прокручиваемым окошком той же высоты,
  // что и календарь слева (сколько бы недель ни было в текущем месяце).
  const calRef = useRef<HTMLDivElement>(null);
  const [colH, setColH] = useState(160);
  useLayoutEffect(() => {
    if (calRef.current) setColH(calRef.current.offsetHeight);
    // Пересчитываем только когда реально может измениться число строк
    // календаря — смена месяца (недель в сетке 4-6) или compact-режим.
  }, [viewYear, viewMonth, compact]);

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

  const emitChange = (d: Date, h: number, m: number) => {
    onChange(toMoscowIso(d.getFullYear(), d.getMonth(), d.getDate(), h, m));
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day, hour, minute);
    setSelDate(d);
    if (!showSaveButton) emitChange(d, hour, minute);
  };

  const changeHour = (h: number) => {
    setHour(h);
    if (!showSaveButton) emitChange(selDate, h, minute);
  };
  const changeMinute = (m: number) => {
    setMinute(m);
    if (!showSaveButton) emitChange(selDate, hour, m);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDelete = () => onChange(null);

  // Быстрый выбор дня (Сегодня/Завтра/+2 дня) — время оставляем текущим,
  // просто сдвигаем дату на offsetDays от «сейчас».
  const handleQuickDay = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelDate(d);
    setHour(d.getHours());
    setMinute(d.getMinutes());
    if (!showSaveButton) emitChange(d, d.getHours(), d.getMinutes());
  };

  const handleSave = () => {
    emitChange(selDate, hour, minute);
    onSaveClick?.();
  };

  return (
    <div className="flex">
      {/* Левая часть — календарь. minWidth:0 — обязателен для flex-1, иначе блок
          не сжимается уже своего содержимого и выталкивает время (114px) за
          границы попапа — это и была причина обрезки цифр времени. ref — чтобы
          измерить реальную высоту и подогнать под неё колонки времени справа. */}
      <div ref={calRef} className={compact ? "flex-1 p-3" : "flex-1 p-4"} style={{ minWidth: 0 }}>

        {/* Навигация месяца */}
        <div className={`flex items-center justify-between ${compact ? "mb-2" : "mb-3"}`}>
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
                  height: compact ? 28 : 32,
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

        {/* Футер — быстрый выбор дня ровной сеткой в 3 колонки (никогда не
            переносится вразнобой), «Удалить» — отдельной строкой сверху, если
            разрешено, чтобы не толкаться с быстрым выбором в одной строке. */}
        <div className={compact ? "mt-2 pt-2" : "mt-3 pt-3"} style={{ borderTop: `1px solid ${t.border}` }}>
          {!hideDelete && (
            <button onClick={handleDelete}
              className="w-full text-xs font-semibold text-left px-2 py-1.5 mb-1 rounded-lg transition hover:bg-red-500/10"
              style={{ color: "#ef4444" }}>
              Удалить
            </button>
          )}
          <div className="grid grid-cols-3 gap-1">
            <button onClick={() => handleQuickDay(0)}
              className="text-xs font-semibold rounded-lg transition hover:bg-white/5 text-center"
              style={{ color: "#a78bfa", padding: compact ? "5px 4px" : "6px 8px" }}>
              Сегодня
            </button>
            <button onClick={() => handleQuickDay(1)}
              className="text-xs font-semibold rounded-lg transition hover:bg-white/5 text-center"
              style={{ color: "#a78bfa", padding: compact ? "5px 4px" : "6px 8px" }}>
              Завтра
            </button>
            <button onClick={() => handleQuickDay(2)}
              className="text-xs font-semibold rounded-lg transition hover:bg-white/5 text-center"
              style={{ color: "#a78bfa", padding: compact ? "5px 4px" : "6px 8px" }}>
              +2 дня
            </button>
          </div>
        </div>
      </div>

      {/* Правая часть — время. Ширина = ровно 2 колонки + разделитель + отступы,
          flex: "none" не даёт блоку сжаться уже своего содержимого (та самая
          причина обрезки цифр — раньше ширина была меньше суммы колонок).
          height: colH — ЖЁСТКО равна измеренной высоте календаря слева, чтобы
          список часов/минут оставался прокручиваемым окошком той же высоты, а
          не разворачивался во весь рост (0..23 / 0..59) и не раздувал модалку. */}
      <div className="flex flex-col" style={{ borderLeft: `1px solid ${t.border}`, width: TIME_COL_W * 2 + 25, height: colH, flex: "none" }}>
        {/* Заголовок */}
        <div className={`text-center text-xs font-bold ${compact ? "py-1.5" : "py-2"} px-2`} style={{ color: t.textMute, borderBottom: `1px solid ${t.border}`, flex: "none" }}>
          {pad(hour)} : {pad(minute)}
        </div>

        {/* Колонки часы / минуты — умещаются РОВНО в оставшуюся высоту (colH минус
            заголовок и кнопка «Сохранить»), прокручиваются, если список не влезает. */}
        <div className="flex justify-center overflow-hidden" style={{ flex: "1 1 0", minHeight: 0 }}>
          <div className="flex flex-col py-2 pl-1.5" style={{ flex: "none" }}>
            <div className="text-[9px] uppercase font-bold text-center mb-1" style={{ color: t.textMute, flex: "none" }}>Час</div>
            <ScrollColumn items={HOURS} selected={hour} onSelect={changeHour} compact={compact} />
          </div>
          <div className="w-px self-stretch my-2" style={{ background: t.border, flex: "none" }} />
          <div className="flex flex-col py-2 pr-1.5" style={{ flex: "none" }}>
            <div className="text-[9px] uppercase font-bold text-center mb-1" style={{ color: t.textMute, flex: "none" }}>Мин</div>
            <ScrollColumn items={MINUTES} selected={minute} onSelect={changeMinute} compact={compact} />
          </div>
        </div>

        {/* Кнопка Сохранить — только в standalone-режиме (в попапе сохранение мгновенное по клику) */}
        {showSaveButton && (
          <button onClick={handleSave}
            className="mx-2 mb-2 py-2 rounded-xl text-xs font-bold transition"
            style={{ background: "#7c3aed", color: "#fff", flex: "none" }}>
            Сохранить
          </button>
        )}
      </div>
    </div>
  );
}

// Ширина всплывающего попапа — подобрана впритык под compact-версию пикера
// (календарь + 2 колонки времени), без лишнего пустого места по бокам.
const POPUP_W = 320;

interface Props {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

export function DateTimePickerPopup({ value, onChange, onClose, anchorRect }: Props) {
  const t = useTheme();
  const popRef = useRef<HTMLDivElement>(null);
  // Реальная высота попапа после рендера — нужна, чтобы решить, разворачивать
  // его вниз или вверх от точки клика (иначе на низких полях кнопка «Сохранить»
  // уезжает за нижний край экрана и её не видно).
  const [popH, setPopH] = useState(380);

  // Закрытие по клику вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    if (popRef.current) setPopH(popRef.current.offsetHeight);
  }, []);

  // Позиция попапа: снизу от поля, если там достаточно места, иначе — сверху.
  // Всегда прижимаем к границам экрана, чтобы попап целиком помещался на видимой области.
  const popStyle: React.CSSProperties = { position: "fixed", zIndex: 9999 };
  if (anchorRect) {
    const margin = 6;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const openUp = spaceBelow < popH + margin && anchorRect.top > popH + margin;
    const top = openUp ? anchorRect.top - popH - margin : anchorRect.bottom + margin;
    const left = Math.min(anchorRect.left, window.innerWidth - POPUP_W - 8);
    popStyle.top = Math.max(8, Math.min(top, window.innerHeight - popH - 8));
    popStyle.left = Math.max(8, left);
  }

  const handleChange = (iso: string | null) => { onChange(iso); onClose(); };

  return createPortal(
    <div ref={popRef}
      className="rounded-2xl shadow-2xl overflow-hidden select-none"
      style={{
        ...popStyle,
        background: t.surface,
        border: `1px solid ${t.border}`,
        width: POPUP_W,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
      <DateTimePickerInner value={value} onChange={handleChange} compact />
    </div>,
    document.body
  );
}
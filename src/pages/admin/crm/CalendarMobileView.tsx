import { useState, useRef } from "react";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { CalEvent, MONTH_NAMES, DAY_NAMES } from "./calendarTypes";
import { EVENT_TYPE_LABELS } from "./crmApi";
import { loadSyncedColors } from "./syncedCols";
import { KANBAN_COLS } from "./kanbanTypes";

// Получаем цвет для типа события из цветов канбана/воронки
function getEventColor(event: CalEvent): string {
  const syncedColors = loadSyncedColors();
  const typeToColId: Record<string, string> = {
    measure: "measures",
    install: "installs",
    call:    "working",
    payment: "done",
    other:   "new",
  };
  const colId = typeToColId[event.event_type] || "new";
  if (syncedColors[colId]) return syncedColors[colId];
  const col = KANBAN_COLS.find(c => c.id === colId);
  return col?.color || event.color || "#8b5cf6";
}

interface Props {
  year: number;
  month: number;
  events: CalEvent[];
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onAddEvent: (iso: string) => void;
  onEditEvent: (e: CalEvent) => void;
  onToday: () => void;
  onSelectClient?: (id: number) => void;
}

export function CalendarMobileView({
  year, month, events, selectedDay,
  onSelectDay, onPrevMonth, onNextMonth,
  onAddEvent, onEditEvent, onToday, onSelectClient,
}: Props) {
  const t = useTheme();
  const today = new Date();

  // Свайп по месяцу
  const touchStartX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50)  onPrevMonth();
    if (dx < -50) onNextMonth();
  };

  // Строим сетку месяца
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // пн=0
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; cur: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) {
    const prev = new Date(year, month - 1, 0);
    cells.push({ day: prev.getDate() - firstDow + 1 + i, cur: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true });
  const remain = (7 - cells.length % 7) % 7;
  for (let d = 1; d <= remain; d++) cells.push({ day: d, cur: false });

  // События для дня
  const eventsForDay = (day: number, cur: boolean) => {
    if (!cur) return [];
    return events.filter(e => {
      const d = new Date(e.start_time);
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    });
  };

  // Дни с событиями для активного месяца — список снизу
  const displayDay   = selectedDay ?? today.getDate();
  const dayEvents    = eventsForDay(displayDay, true);
  const isToday      = (d: number) => today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const fmtDayHeader = (day: number) => {
    const d = new Date(year, month - 1, day);
    const dow = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][d.getDay()];
    return `${day} ${MONTH_NAMES[month - 1].toLowerCase()}, ${dow}`;
  };

  // Ближайшие события (для режима "список")
  const [listMode, setListMode] = useState(false);

  const upcomingEvents = [...events]
    .filter(e => new Date(e.start_time) >= new Date(year, month - 1, 1))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Группировка по дням для списка
  const groupedEvents: { date: string; day: number; dow: string; items: CalEvent[] }[] = [];
  for (const e of upcomingEvents) {
    const d = new Date(e.start_time);
    const key = d.toDateString();
    const existing = groupedEvents.find(g => g.date === key);
    if (existing) {
      existing.items.push(e);
    } else {
      const dayNames = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
      groupedEvents.push({ date: key, day: d.getDate(), dow: dayNames[d.getDay()], items: [e] });
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 140px)", minHeight: 500 }}>

      {/* ── Шапка ── */}
      <div className="flex items-center justify-between px-2 py-2 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={onPrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition active:opacity-60"
            style={{ color: t.textSub, background: t.surface2 }}>
            <Icon name="ChevronLeft" size={16} />
          </button>
          <button onClick={onNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition active:opacity-60"
            style={{ color: t.textSub, background: t.surface2 }}>
            <Icon name="ChevronRight" size={16} />
          </button>
          <span className="text-base font-bold ml-1" style={{ color: t.text }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToday}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            Сегодня
          </button>
          <button
            onClick={() => setListMode(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition"
            style={{ background: listMode ? "#7c3aed20" : t.surface2, color: listMode ? "#a78bfa" : t.textSub }}>
            <Icon name={listMode ? "CalendarDays" : "List"} size={15} />
          </button>
          <button
            onClick={() => onAddEvent(`${year}-${String(month).padStart(2,"0")}-${String(displayDay).padStart(2,"0")}T10:00`)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-white transition"
            style={{ background: "#7c3aed" }}>
            <Icon name="Plus" size={16} />
          </button>
        </div>
      </div>

      {!listMode ? (
        <>
          {/* ── Мини-сетка месяца ── */}
          <div
            className="flex-shrink-0 px-1 pb-2"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}>

            {/* Дни недели */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold py-1"
                  style={{ color: d === "Сб" || d === "Вс" ? "#ef4444" : t.textMute }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Ячейки */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((cell, idx) => {
                const dayEvs = eventsForDay(cell.day, cell.cur);
                const sel    = cell.cur && cell.day === displayDay;
                const tod    = cell.cur && isToday(cell.day);
                const dow    = idx % 7;
                const isWknd = dow === 5 || dow === 6;

                return (
                  <button
                    key={idx}
                    onClick={() => cell.cur && onSelectDay(cell.day)}
                    className="flex flex-col items-center py-1 rounded-xl transition active:opacity-60"
                    style={{
                      background: sel ? "#7c3aed" : "transparent",
                      opacity: cell.cur ? 1 : 0.25,
                    }}>
                    <span className="text-sm font-semibold leading-none mb-0.5"
                      style={{
                        color: sel ? "#fff" : tod ? "#7c3aed" : isWknd ? "#ef4444" : t.text,
                        fontWeight: tod ? 800 : 600,
                      }}>
                      {cell.day}
                    </span>
                    {/* Точки событий */}
                    <div className="flex gap-0.5 h-1.5 items-center">
                      {dayEvs.slice(0, 3).map((e, i) => (
                        <div key={i} className="w-1 h-1 rounded-full flex-shrink-0"
                          style={{ background: sel ? "#fff" : getEventColor(e) }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Разделитель ── */}
          <div className="h-px flex-shrink-0 mx-2" style={{ background: t.border }} />

          {/* ── Список событий выбранного дня ── */}
          <div className="flex-1 overflow-y-auto px-2 pt-3 pb-24">
            <div className="text-xs font-semibold mb-3 px-1" style={{ color: t.textMute }}>
              {fmtDayHeader(displayDay)}
            </div>

            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: t.textMute }}>
                <Icon name="CalendarDays" size={28} className="opacity-20" />
                <span className="text-sm">Нет событий</span>
                <button
                  onClick={() => onAddEvent(`${year}-${String(month).padStart(2,"0")}-${String(displayDay).padStart(2,"0")}T10:00`)}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
                  style={{ background: "#7c3aed" }}>
                  <Icon name="Plus" size={13} /> Добавить событие
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dayEvents
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map(e => {
                    const color = getEventColor(e);
                    return (
                      <button key={e.id} onClick={() => {
                          if (e.client_id && onSelectClient) onSelectClient(e.client_id);
                          else onEditEvent(e);
                        }}
                        className="w-full text-left rounded-2xl p-3.5 transition active:opacity-70"
                        style={{ background: color + "15", border: `1px solid ${color}35`, borderLeft: `4px solid ${color}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold mb-0.5 truncate" style={{ color: t.text }}>{e.title}</div>
                            {e.description && (
                              <div className="text-xs mb-1 line-clamp-2" style={{ color: t.textMute }}>{e.description}</div>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs font-semibold flex items-center gap-1" style={{ color }}>
                                <Icon name="Clock" size={10} />
                                {fmtTime(e.start_time)}
                                {e.end_time && ` — ${fmtTime(e.end_time)}`}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: color + "20", color }}>
                                {EVENT_TYPE_LABELS[e.event_type] || e.event_type}
                              </span>
                            </div>
                            {e.client_name && (
                              <div className="flex items-center gap-1 mt-1.5 text-xs" style={{ color: t.textSub }}>
                                <Icon name="User" size={10} style={{ color, flexShrink: 0 }} />
                                {e.client_name}
                                {e.phone && <span className="opacity-60">· {e.phone}</span>}
                              </div>
                            )}
                          </div>
                          <Icon name="ChevronRight" size={14} style={{ color: t.textMute, flexShrink: 0, marginTop: 2 }} />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Режим СПИСОК — все события месяца по дням ── */
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-24">
          {groupedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: t.textMute }}>
              <Icon name="CalendarDays" size={32} className="opacity-20" />
              <span className="text-sm">Нет событий в этом месяце</span>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedEvents.map(group => (
                <div key={group.date}>
                  {/* Заголовок дня */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <div className="flex flex-col items-center w-9 flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase" style={{ color: t.textMute }}>{group.dow}</span>
                      <span className={`text-lg font-black leading-none ${
                        isToday(group.day) ? "text-white" : ""
                      }`} style={{
                        color: isToday(group.day) ? undefined : t.text,
                        background: isToday(group.day) ? "#7c3aed" : "transparent",
                        borderRadius: isToday(group.day) ? "50%" : 0,
                        width: isToday(group.day) ? 32 : undefined,
                        height: isToday(group.day) ? 32 : undefined,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {group.day}
                      </span>
                    </div>
                    <div className="flex-1 h-px" style={{ background: t.border }} />
                  </div>

                  {/* События дня */}
                  <div className="space-y-1.5 pl-11">
                    {group.items.map(e => {
                      const color = getEventColor(e);
                      return (
                        <button key={e.id} onClick={() => onEditEvent(e)}
                          className="w-full text-left rounded-xl p-3 transition active:opacity-70"
                          style={{ background: color + "12", borderLeft: `3px solid ${color}` }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{e.title}</div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs" style={{ color }}>
                                  {fmtTime(e.start_time)}{e.end_time && ` — ${fmtTime(e.end_time)}`}
                                </span>
                                {e.client_name && (
                                  <span className="text-xs" style={{ color: t.textMute }}>· {e.client_name}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                              style={{ background: color + "20", color }}>
                              {EVENT_TYPE_LABELS[e.event_type] || e.event_type}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FAB кнопка добавить ── */}
      <button
        onClick={() => onAddEvent(`${year}-${String(month).padStart(2,"0")}-${String(displayDay).padStart(2,"0")}T10:00`)}
        className="fixed bottom-6 right-4 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-40 transition active:scale-95"
        style={{ background: "#7c3aed", boxShadow: "0 4px 24px rgba(124,58,237,0.5)" }}>
        <Icon name="Plus" size={22} style={{ color: "#fff" }} />
      </button>
    </div>
  );
}
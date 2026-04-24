import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { CalEvent, MONTH_NAMES, DAY_NAMES, EVENT_COLORS } from "./calendarTypes";
import { CalendarEventModal } from "./CalendarEventModal";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarLeftSidebar, CalendarDaySidebar, EventBadge } from "./CalendarSidebar";

export default function CrmCalendar() {
  const t = useTheme();
  const today = new Date();

  const [view, setView]           = useState<"month" | "week">("month");
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth() + 1);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow);
    d.setHours(0,0,0,0);
    return d;
  });
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [addModal, setAddModal]   = useState<{ date: string } | null>(null);
  const [editModal, setEditModal] = useState<CalEvent | null>(null);

  const loadMonth = (m: number, y: number) => {
    crmFetch("calendar-events", undefined, { month: String(m), year: String(y) })
      .then(d => setEvents(Array.isArray(d) ? d : []));
  };
  const loadWeek = (ws: Date) => {
    const m = ws.getMonth() + 1;
    const y = ws.getFullYear();
    crmFetch("calendar-events", undefined, { month: String(m), year: String(y) })
      .then(d => setEvents(Array.isArray(d) ? d : []));
  };

  useEffect(() => { loadMonth(month, year); }, [month, year]);  
  useEffect(() => { if (view === "week") loadWeek(weekStart); }, [view, weekStart]);  

  // Навигация
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };
  const prevWeek  = () => setWeekStart(ws => { const d = new Date(ws); d.setDate(d.getDate()-7); return d; });
  const nextWeek  = () => setWeekStart(ws => { const d = new Date(ws); d.setDate(d.getDate()+7); return d; });
  const goToday   = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth()+1); setSelectedDay(today.getDate());
    const d = new Date(today);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow); d.setHours(0,0,0,0);
    setWeekStart(d);
  };

  const openAdd = (iso: string) => setAddModal({ date: iso });

  const saveAdd = async (form: Partial<CalEvent>) => {
    await crmFetch("calendar-events", { method: "POST", body: JSON.stringify({
      ...form, color: EVENT_COLORS[form.event_type || "measure"] || "#8b5cf6",
    }) });
    setAddModal(null);
    loadMonth(month, year);
    if (view === "week") loadWeek(weekStart);
  };

  const saveEdit = async (form: Partial<CalEvent>) => {
    if (!editModal) return;
    await crmFetch("calendar-events", { method: "PUT", body: JSON.stringify({ ...editModal, ...form }) }, { id: String(editModal.id) });
    setEditModal(null);
    loadMonth(month, year);
    if (view === "week") loadWeek(weekStart);
  };

  const deleteEvent = async () => {
    if (!editModal) return;
    await crmFetch("calendar-events", { method: "DELETE" }, { id: String(editModal.id) });
    setEditModal(null);
    loadMonth(month, year);
    if (view === "week") loadWeek(weekStart);
  };

  // Сетка месяца
  const firstDay     = new Date(year, month-1, 1);
  const daysInMonth  = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const prevMonthDays = new Date(year, month-1, 0).getDate();
  const prefill  = Array.from({ length: startDow }, (_, i) => ({ day: prevMonthDays - startDow + i + 1, cur: false }));
  const current  = Array.from({ length: daysInMonth }, (_, i) => ({ day: i+1, cur: true }));
  const cells    = [...prefill, ...current];
  const remaining = 42 - cells.length;
  const postfill = Array.from({ length: remaining }, (_, i) => ({ day: i+1, cur: false }));
  const allCells = [...cells, ...postfill];

  const eventsForDay = (day: number, cur = true) =>
    cur ? events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === day && d.getMonth()+1 === month && d.getFullYear() === year;
    }) : [];

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];
  const isDark = t.theme === "dark";

  // Заголовок навигации для недели
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0,3)} — ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()].slice(0,3)} ${weekEnd.getFullYear()}`;

  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.surface, height: "calc(100vh - 180px)", minHeight: 580 }}>

      {/* ── Левая: мини-календарь ── */}
      <CalendarLeftSidebar
        year={year} month={month} selectedDay={selectedDay}
        allCells={allCells} eventsForDay={eventsForDay}
        onPrevMonth={prevMonth} onNextMonth={nextMonth}
        onSelectDay={setSelectedDay} onToday={goToday}
      />

      {/* ── Центр ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <button onClick={view === "month" ? prevMonth : prevWeek}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition"
              style={{ color: t.textSub, background: t.surface2, border: `1px solid ${t.border}` }}>
              <Icon name="ChevronLeft" size={14} />
            </button>
            <button onClick={view === "month" ? nextMonth : nextWeek}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition"
              style={{ color: t.textSub, background: t.surface2, border: `1px solid ${t.border}` }}>
              <Icon name="ChevronRight" size={14} />
            </button>
            <span className="text-base font-bold ml-1" style={{ color: t.text }}>
              {view === "month" ? `${MONTH_NAMES[month-1]} ${year}` : weekLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
              {(["month","week"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="px-3 py-1.5 text-xs font-semibold transition"
                  style={view === v
                    ? { background: "#7c3aed", color: "#fff" }
                    : { background: t.surface2, color: t.textSub }}>
                  {v === "month" ? "Месяц" : "Неделя"}
                </button>
              ))}
            </div>
            <button onClick={() => openAdd(`${year}-${String(month).padStart(2,"0")}-${String(selectedDay||today.getDate()).padStart(2,"0")}T10:00`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#7c3aed" }}>
              <Icon name="Plus" size={13} /> Создать
            </button>
          </div>
        </div>

        {/* ── Вид МЕСЯЦ ── */}
        {view === "month" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${t.border}` }}>
              {DAY_NAMES.map(d => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold"
                  style={{ color: t.textMute, borderRight: `1px solid ${t.border2}` }}>
                  {d}
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-7" style={{ gridTemplateRows: "repeat(6,minmax(90px,1fr))" }}>
              {allCells.map((c, i) => {
                const dayEvents = eventsForDay(c.day, c.cur);
                const isToday  = c.cur && c.day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
                const isSel    = c.cur && c.day === selectedDay;
                return (
                  <div key={i}
                    onClick={() => c.cur && setSelectedDay(c.day === selectedDay ? null : c.day)}
                    onDoubleClick={() => { if (c.cur) openAdd(`${year}-${String(month).padStart(2,"0")}-${String(c.day).padStart(2,"0")}T10:00`); }}
                    className="relative flex flex-col p-1.5 cursor-pointer transition"
                    style={{
                      borderRight: `1px solid ${t.border2}`,
                      borderBottom: `1px solid ${t.border2}`,
                      background: isSel
                        ? (isDark ? "#7c3aed15" : "#ede9fe50")
                        : isToday
                        ? (isDark ? "#ffffff06" : "#f5f3ff")
                        : "transparent",
                    }}>
                    <div className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1"
                      style={isToday
                        ? { background: "#7c3aed", color: "#fff" }
                        : { color: c.cur ? t.text : t.textMute, opacity: c.cur ? 1 : 0.3 }}>
                      {c.day}
                    </div>
                    {dayEvents.slice(0,3).map(e => <EventBadge key={e.id} e={e} onClick={setEditModal} />)}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] pl-1" style={{ color: t.textMute }}>+{dayEvents.length-3} ещё</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Вид НЕДЕЛЯ ── */}
        {view === "week" && (
          <CalendarWeekView weekStart={weekStart} events={events} onAddAt={openAdd} onEdit={setEditModal} />
        )}
      </div>

      {/* ── Правая: события дня ── */}
      <CalendarDaySidebar
        selectedDay={selectedDay} month={month} year={year}
        selectedEvents={selectedEvents}
        onOpenAdd={openAdd} onEditEvent={setEditModal}
      />

      {addModal && (
        <CalendarEventModal mode="add" event={{ start_time: addModal.date }}
          onClose={() => setAddModal(null)} onSave={saveAdd} />
      )}
      {editModal && (
        <CalendarEventModal mode="edit" event={editModal}
          onClose={() => setEditModal(null)} onSave={saveEdit} onDelete={deleteEvent} />
      )}
    </div>
  );
}

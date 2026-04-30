import { useEffect, useState } from "react";
import { crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { CalEvent, MONTH_NAMES } from "./calendarTypes";
import { CalendarEventModal } from "./CalendarEventModal";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarLeftSidebar, CalendarDaySidebar } from "./CalendarSidebar";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarMobileView } from "./CalendarMobileView";
import { buildMonthGrid, eventsForDay, mondayWeekStart } from "./calendarUtils";
import { loadSyncedColors } from "./syncedCols";
import { KANBAN_COLS } from "./kanbanTypes";

// Цвет события из цветов канбана (синхронизированных пользователем)
function resolveEventColor(eventType: string): string {
  const syncedColors = loadSyncedColors();
  const typeToColId: Record<string, string> = {
    measure: "measures",
    install: "installs",
    call:    "working",
    payment: "done",
    other:   "new",
  };
  const colId = typeToColId[eventType] || "new";
  if (syncedColors[colId]) return syncedColors[colId];
  return KANBAN_COLS.find(c => c.id === colId)?.color || "#8b5cf6";
}

export default function CrmCalendar({ onSelectClient, canEdit = true }: { onSelectClient?: (id: number) => void; canEdit?: boolean }) {
  const t = useTheme();
  const today = new Date();

  const [view, setView]           = useState<"month" | "week">("month");
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth() + 1);
  const [weekStart, setWeekStart] = useState(() => mondayWeekStart(today));
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [addModal, setAddModal]   = useState<{ date: string } | null>(null);
  const [editModal, setEditModal] = useState<CalEvent | null>(null);

  const loadMonth = (m: number, y: number) =>
    crmFetch("calendar-events", undefined, { month: String(m), year: String(y) })
      .then(d => setEvents(Array.isArray(d) ? d : []));

  const loadWeek = (ws: Date) => {
    crmFetch("calendar-events", undefined, {
      month: String(ws.getMonth() + 1),
      year:  String(ws.getFullYear()),
    }).then(d => setEvents(Array.isArray(d) ? d : []));
  };

  useEffect(() => { loadMonth(month, year); }, [month, year]);
  useEffect(() => { if (view === "week") loadWeek(weekStart); }, [view, weekStart]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const prevWeek  = () => setWeekStart(ws => { const d = new Date(ws); d.setDate(d.getDate() - 7); return d; });
  const nextWeek  = () => setWeekStart(ws => { const d = new Date(ws); d.setDate(d.getDate() + 7); return d; });
  const goToday   = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(today.getDate());
    setWeekStart(mondayWeekStart(today));
  };

  const openAdd = (iso: string) => setAddModal({ date: iso });

  const saveAdd = async (form: Partial<CalEvent>) => {
    // Цвет берём из канбан-настроек пользователя
    const color = resolveEventColor(form.event_type || "other");
    await crmFetch("calendar-events", { method: "POST", body: JSON.stringify({ ...form, color }) });
    setAddModal(null);
    loadMonth(month, year);
    if (view === "week") loadWeek(weekStart);
  };

  const saveEdit = async (form: Partial<CalEvent>) => {
    if (!editModal) return;
    const color = resolveEventColor(form.event_type || editModal.event_type || "other");
    await crmFetch("calendar-events", { method: "PUT", body: JSON.stringify({ ...editModal, ...form, color }) }, { id: String(editModal.id) });
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

  const allCells       = buildMonthGrid(year, month);
  const getDayEvents   = (day: number, cur: boolean) => eventsForDay(events, day, month, year, cur);
  const selectedEvents = selectedDay ? getDayEvents(selectedDay, true) : [];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0,3)} — ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()].slice(0,3)} ${weekEnd.getFullYear()}`;

  return (
    <div>
      {/* ── МОБИЛЕ: Google-like календарь ── */}
      <div className="sm:hidden">
        <CalendarMobileView
          year={year}
          month={month}
          events={events}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onAddEvent={openAdd}
          onEditEvent={setEditModal}
          onToday={goToday}
          onSelectClient={onSelectClient}
        />
      </div>

      {/* ── ДЕСКТОП: оригинальный вид ── */}
      <div className="hidden sm:flex rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${t.border}`, background: t.surface, height: "calc(100vh - 180px)", minHeight: 580 }}>

        <CalendarLeftSidebar
          year={year} month={month} selectedDay={selectedDay}
          allCells={allCells} eventsForDay={getDayEvents}
          onPrevMonth={prevMonth} onNextMonth={nextMonth}
          onSelectDay={setSelectedDay} onToday={goToday}
        />

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
                    style={view === v ? { background: "#7c3aed", color: "#fff" } : { background: t.surface2, color: t.textSub }}>
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

          {view === "month" && (
            <CalendarMonthGrid
              allCells={allCells} year={year} month={month}
              selectedDay={selectedDay} events={events}
              onSelectDay={setSelectedDay} onDoubleClickDay={openAdd}
              onSelectClient={onSelectClient}
            />
          )}
          {view === "week" && (
            <CalendarWeekView weekStart={weekStart} events={events} onAddAt={openAdd} onEdit={setEditModal} onSelectClient={onSelectClient} />
          )}
        </div>

        <CalendarDaySidebar
          selectedDay={selectedDay} month={month} year={year}
          selectedEvents={selectedEvents}
          onOpenAdd={openAdd} onEditEvent={setEditModal}
          onSelectClient={onSelectClient}
        />
      </div>

      {/* Модалки — общие для мобиле и десктопа */}
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
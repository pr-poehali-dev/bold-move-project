import { useEffect, useState } from "react";
import { crmFetch, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";

interface CalEvent {
  id: number;
  client_id: number | null;
  title: string;
  description: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  color: string;
  client_name?: string;
  phone?: string;
}

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAY_NAMES   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DAY_SHORT   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const EVENT_COLORS = EVENT_TYPE_COLORS;
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00–23:00

// ── Бейдж события в сетке ──────────────────────────────────────────────────
function EventBadge({ e, onClick }: { e: CalEvent; onClick: (e: CalEvent) => void }) {
  return (
    <div onClick={ev => { ev.stopPropagation(); onClick(e); }}
      className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight cursor-pointer hover:brightness-110 transition mb-0.5"
      style={{ background: e.color + "28", color: e.color, borderLeft: `2.5px solid ${e.color}` }}>
      {new Date(e.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} {e.title}
    </div>
  );
}

// ── Модалка события ─────────────────────────────────────────────────────────
function EventModal({
  mode, event, onClose, onSave, onDelete,
}: {
  mode: "add" | "edit";
  event: Partial<CalEvent> & { start_time: string };
  onClose: () => void;
  onSave: (data: Partial<CalEvent>) => void;
  onDelete?: () => void;
}) {
  const t = useTheme();
  const [form, setForm] = useState({
    title:       event.title || "",
    description: event.description || "",
    event_type:  event.event_type || "measure",
    start_time:  event.start_time || "",
    end_time:    event.end_time || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: "#7c3aed" }}>
          <span className="text-sm font-bold text-white">{mode === "add" ? "Новое событие" : "Редактировать"}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><Icon name="X" size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Название события..."
            className="w-full text-sm font-medium bg-transparent border-b-2 pb-2 focus:outline-none transition"
            style={{ color: t.text, borderColor: "#7c3aed50" }} autoFocus />
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setForm(p => ({ ...p, event_type: k }))}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition border"
                style={form.event_type === k
                  ? { background: EVENT_COLORS[k] + "25", color: EVENT_COLORS[k], borderColor: EVENT_COLORS[k] + "50" }
                  : { background: "transparent", color: t.textSub, borderColor: t.border }}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            {[["Начало","start_time"],["Конец","end_time"]] .map(([lbl, field]) => (
              <div key={field} className="flex-1">
                <label className="text-[11px] mb-1 block" style={{ color: t.textMute }}>{lbl}</label>
                <input type="datetime-local"
                  value={(form as Record<string, string>)[field] || ""}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full text-xs rounded-xl px-3 py-2 focus:outline-none border"
                  style={{ background: t.surface2, color: t.text, borderColor: t.border }} />
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5">
            <Icon name="AlignLeft" size={14} className="mt-1 flex-shrink-0" style={{ color: t.textMute }} />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Добавить описание..." rows={2}
              className="flex-1 text-xs bg-transparent resize-none focus:outline-none"
              style={{ color: t.textSub }} />
          </div>
          <div className="flex gap-2 pt-1">
            {onDelete && (
              <button onClick={onDelete}
                className="px-3 py-2 rounded-xl text-xs font-medium transition border border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Icon name="Trash2" size={12} />
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium transition"
              style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
              Отмена
            </button>
            <button onClick={() => onSave(form)} disabled={!form.title.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
              style={{ background: "#7c3aed" }}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Вид НЕДЕЛЯ ──────────────────────────────────────────────────────────────
function WeekView({
  weekStart, events, onAddAt, onEdit,
}: {
  weekStart: Date;
  events: CalEvent[];
  onAddAt: (iso: string) => void;
  onEdit: (e: CalEvent) => void;
}) {
  const t = useTheme();
  const today = new Date();

  // 7 дней недели
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const eventsForSlot = (day: Date, hour: number) =>
    events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === day.getDate()
        && d.getMonth() === day.getMonth()
        && d.getFullYear() === day.getFullYear()
        && d.getHours() === hour;
    });

  const currentHour = today.getHours();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Заголовок дней */}
      <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: `1px solid ${t.border}` }}>
        <div />
        {days.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={i} className="py-2.5 text-center" style={{ borderLeft: `1px solid ${t.border2}` }}>
              <div className="text-[10px] font-semibold mb-1" style={{ color: t.textMute }}>{DAY_SHORT[i]}</div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mx-auto transition`}
                style={isToday
                  ? { background: "#7c3aed", color: "#fff" }
                  : { color: t.text }}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Сетка часов */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map(hour => (
          <div key={hour} className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)", minHeight: 64 }}>
            {/* Метка времени */}
            <div className="flex items-start justify-end pr-2.5 pt-1.5">
              <span className="text-[10px] font-medium" style={{ color: t.textMute }}>{String(hour).padStart(2,"0")}:00</span>
            </div>
            {/* Ячейки дней */}
            {days.map((day, di) => {
              const isToday = day.toDateString() === today.toDateString();
              const isNow   = isToday && currentHour === hour;
              const slotEvents = eventsForSlot(day, hour);
              return (
                <div key={di}
                  onClick={() => {
                    const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}T${String(hour).padStart(2,"0")}:00`;
                    onAddAt(iso);
                  }}
                  className="relative p-1 cursor-pointer transition hover:brightness-95"
                  style={{
                    borderLeft: `1px solid ${t.border2}`,
                    borderBottom: `1px solid ${t.border2}`,
                    background: isNow ? "#7c3aed08" : isToday ? (t.theme === "dark" ? "rgba(255,255,255,0.01)" : "rgba(124,58,237,0.02)") : "transparent",
                  }}>
                  {/* Линия текущего времени */}
                  {isNow && (
                    <div className="absolute left-0 right-0 top-0 h-0.5 z-10" style={{ background: "#7c3aed" }} />
                  )}
                  {slotEvents.map(e => (
                    <div key={e.id} onClick={ev => { ev.stopPropagation(); onEdit(e); }}
                      className="rounded-md px-1.5 py-1 text-[10px] font-medium cursor-pointer hover:brightness-110 transition mb-0.5"
                      style={{ background: e.color + "25", color: e.color, borderLeft: `2.5px solid ${e.color}` }}>
                      <div className="font-semibold truncate">{e.title}</div>
                      {e.client_name && <div className="truncate opacity-70">{e.client_name}</div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Главный компонент ───────────────────────────────────────────────────────
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

  // Для недели грузим +/- месяц
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
  const firstDay   = new Date(year, month-1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
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

  // Заголовок навигации
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0,3)} — ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()].slice(0,3)} ${weekEnd.getFullYear()}`;

  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.surface, height: "calc(100vh - 180px)", minHeight: 580 }}>

      {/* ── Левая: мини-календарь ── */}
      <div className="w-52 flex-shrink-0 flex flex-col" style={{ borderRight: `1px solid ${t.border}`, background: t.surface2 }}>
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-lg transition"
              style={{ color: t.textSub }}>
              <Icon name="ChevronLeft" size={13} />
            </button>
            <span className="text-sm font-bold" style={{ color: t.text }}>{MONTH_NAMES[month-1].slice(0,3)} {year}</span>
            <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-lg transition"
              style={{ color: t.textSub }}>
              <Icon name="ChevronRight" size={13} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["П","В","С","Ч","П","С","В"].map((d,i) => (
              <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: t.textMute }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {allCells.map((c,i) => {
              const isToday = c.cur && c.day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const isSel   = c.cur && c.day === selectedDay;
              const hasEv   = c.cur && eventsForDay(c.day).length > 0;
              return (
                <button key={i} onClick={() => { if (c.cur) { setSelectedDay(c.day === selectedDay ? null : c.day); } }}
                  className="w-full aspect-square flex items-center justify-center rounded-full text-[11px] transition relative"
                  style={isToday
                    ? { background: "#7c3aed", color: "#fff", fontWeight: 700 }
                    : isSel
                    ? { background: "#7c3aed20", color: "#a78bfa", fontWeight: 600 }
                    : { color: c.cur ? t.text : t.textMute }}>
                  {c.day}
                  {hasEv && !isToday && !isSel && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Кнопка сегодня */}
        <div className="px-4 pb-3">
          <button onClick={goToday}
            className="w-full py-2 rounded-xl text-xs font-semibold transition"
            style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed30" }}>
            Сегодня
          </button>
        </div>

        {/* Легенда */}
        <div className="px-4 pb-5 mt-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: t.textMute }}>Типы событий</div>
          <div className="space-y-1.5">
            {Object.entries(EVENT_TYPE_LABELS).map(([k,v]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: EVENT_COLORS[k] }} />
                <span className="text-xs" style={{ color: t.textSub }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
            {/* Переключатель Month / Week */}
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
          <WeekView weekStart={weekStart} events={events} onAddAt={openAdd} onEdit={setEditModal} />
        )}
      </div>

      {/* ── Правая: события дня ── */}
      <div className="w-60 flex-shrink-0 flex flex-col" style={{ borderLeft: `1px solid ${t.border}` }}>
        <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${t.border}` }}>
          {selectedDay ? (
            <div>
              <div className="text-base font-bold" style={{ color: t.text }}>
                {selectedDay} {MONTH_NAMES[month-1]}
              </div>
              <div className="text-xs mt-0.5" style={{ color: t.textMute }}>
                {selectedEvents.length === 0 ? "Нет событий" : `${selectedEvents.length} ${selectedEvents.length === 1 ? "событие" : "события"}`}
              </div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: t.textMute }}>Выберите день</div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {selectedDay && selectedEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: t.surface2 }}>
                <Icon name="CalendarDays" size={18} style={{ color: t.textMute }} />
              </div>
              <span className="text-xs text-center" style={{ color: t.textMute }}>Нет событий</span>
              <button onClick={() => selectedDay && openAdd(`${year}-${String(month).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}T10:00`)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium mt-1"
                style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed30" }}>
                + Добавить
              </button>
            </div>
          )}
          <div className="space-y-2">
            {selectedEvents.map(e => (
              <div key={e.id} onClick={() => setEditModal(e)}
                className="rounded-xl p-3 cursor-pointer transition"
                style={{ background: e.color + "15", border: `1px solid ${e.color}30` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <span className="text-xs font-bold truncate" style={{ color: t.text }}>{e.title}</span>
                </div>
                <div className="text-[10px] mb-1 font-medium" style={{ color: e.color }}>
                  {EVENT_TYPE_LABELS[e.event_type] || e.event_type}
                </div>
                <div className="text-[10px]" style={{ color: t.textSub }}>
                  {new Date(e.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  {e.end_time && " — " + new Date(e.end_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {e.client_name && <div className="text-[10px] mt-0.5" style={{ color: t.textMute }}>{e.client_name}</div>}
                {e.description && <div className="text-[10px] mt-1" style={{ color: t.textMute }}>{e.description}</div>}
              </div>
            ))}
          </div>
        </div>
        {selectedDay && (
          <div className="px-3 pb-3" style={{ borderTop: `1px solid ${t.border}` }}>
            <button onClick={() => openAdd(`${year}-${String(month).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}T10:00`)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white mt-3"
              style={{ background: "#7c3aed" }}>
              + Добавить событие
            </button>
          </div>
        )}
      </div>

      {addModal && (
        <EventModal mode="add" event={{ start_time: addModal.date }}
          onClose={() => setAddModal(null)} onSave={saveAdd} />
      )}
      {editModal && (
        <EventModal mode="edit" event={editModal}
          onClose={() => setEditModal(null)} onSave={saveEdit} onDelete={deleteEvent} />
      )}
    </div>
  );
}

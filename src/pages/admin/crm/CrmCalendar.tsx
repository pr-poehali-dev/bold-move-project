import { useEffect, useState, useRef } from "react";
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
const EVENT_COLORS = EVENT_TYPE_COLORS;

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
  mode, event, date, onClose, onSave, onDelete,
}: {
  mode: "add" | "edit";
  event: Partial<CalEvent> & { start_time: string };
  date?: string;
  onClose: () => void;
  onSave: (data: Partial<CalEvent>) => void;
  onDelete?: () => void;
}) {
  const t = useTheme();
  const [form, setForm] = useState({
    title: event.title || "",
    description: event.description || "",
    event_type: event.event_type || "measure",
    start_time: event.start_time || "",
    end_time: event.end_time || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}`, background: "#7c3aed" }}>
          <span className="text-sm font-bold text-white">{mode === "add" ? "Новое событие" : "Редактировать"}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><Icon name="X" size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Заголовок */}
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Название события..."
            className="w-full text-sm font-medium bg-transparent border-b-2 pb-2 focus:outline-none transition"
            style={{ color: t.text, borderColor: "#7c3aed50", caretColor: "#7c3aed" }}
            autoFocus />

          {/* Тип события */}
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

          {/* Даты */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: t.textMute }}>Начало</label>
              <input type="datetime-local" value={form.start_time}
                onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full text-xs rounded-xl px-3 py-2 focus:outline-none border"
                style={{ background: t.surface2, color: t.text, borderColor: t.border }} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: t.textMute }}>Конец</label>
              <input type="datetime-local" value={form.end_time || ""}
                onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full text-xs rounded-xl px-3 py-2 focus:outline-none border"
                style={{ background: t.surface2, color: t.text, borderColor: t.border }} />
            </div>
          </div>

          {/* Описание */}
          <div className="flex items-start gap-2.5">
            <Icon name="AlignLeft" size={14} className="mt-1 flex-shrink-0" style={{ color: t.textMute }} />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Добавить описание..."
              rows={2} className="flex-1 text-xs bg-transparent resize-none focus:outline-none"
              style={{ color: t.textSub }} />
          </div>

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            {onDelete && (
              <button onClick={onDelete}
                className="px-3 py-2 rounded-xl text-xs font-medium transition border border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Icon name="Trash2" size={12} />
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium transition"
              style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
              Отмена
            </button>
            <button onClick={() => onSave(form)}
              disabled={!form.title.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition text-white disabled:opacity-40"
              style={{ background: "#7c3aed" }}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Главный компонент ───────────────────────────────────────────────────────
export default function CrmCalendar() {
  const t = useTheme();
  const today = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth() + 1);
  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [addModal, setAddModal] = useState<{ date: string } | null>(null);
  const [editModal, setEditModal] = useState<CalEvent | null>(null);

  const load = () => {
    crmFetch("calendar-events", undefined, { month: String(month), year: String(year) })
      .then(d => setEvents(Array.isArray(d) ? d : []));
  };

  useEffect(() => { load(); }, [month, year]); // eslint-disable-line

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(today.getDate()); };

  // Сетка
  const firstDay   = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  // Дни предыдущего месяца для заполнения
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const prefill = Array.from({ length: startDow }, (_, i) => ({ day: prevMonthDays - startDow + i + 1, cur: false }));
  const current = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, cur: true }));
  const all = [...prefill, ...current];
  const remaining = 42 - all.length; // всегда 6 строк
  const postfill = Array.from({ length: remaining }, (_, i) => ({ day: i + 1, cur: false }));
  const cells = [...all, ...postfill];

  const eventsForDay = (day: number, cur = true) =>
    cur ? events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === day && d.getMonth() + 1 === month && d.getFullYear() === year;
    }) : [];

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  const openAdd = (day: number) => {
    const ds = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T10:00`;
    setAddModal({ date: ds });
  };

  const saveAdd = async (form: Partial<CalEvent>) => {
    await crmFetch("calendar-events", { method: "POST", body: JSON.stringify({
      ...form, color: EVENT_COLORS[form.event_type || "measure"] || "#8b5cf6",
    }) });
    setAddModal(null);
    load();
  };

  const saveEdit = async (form: Partial<CalEvent>) => {
    if (!editModal) return;
    await crmFetch("calendar-events", { method: "PUT", body: JSON.stringify({ ...editModal, ...form }) }, { id: String(editModal.id) });
    setEditModal(null);
    load();
  };

  const deleteEvent = async () => {
    if (!editModal) return;
    await crmFetch("calendar-events", { method: "DELETE" }, { id: String(editModal.id) });
    setEditModal(null);
    load();
  };

  const isDark = t.theme === "dark";

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.surface }}>

      {/* ── Левая панель: мини-календарь + легенда ── */}
      <div className="w-56 flex-shrink-0 flex flex-col" style={{ borderRight: `1px solid ${t.border}`, background: t.surface2 }}>
        {/* Мини-навигация */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 transition" style={{ color: t.textSub }}>
              <Icon name="ChevronLeft" size={13} />
            </button>
            <span className="text-sm font-bold" style={{ color: t.text }}>{MONTH_NAMES[month-1]} {year}</span>
            <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 transition" style={{ color: t.textSub }}>
              <Icon name="ChevronRight" size={13} />
            </button>
          </div>

          {/* Мини сетка */}
          <div className="grid grid-cols-7 mb-1">
            {["П","В","С","Ч","П","С","В"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: t.textMute }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((c, i) => {
              const isToday   = c.cur && c.day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const isSel     = c.cur && c.day === selectedDay;
              const hasEvents = c.cur && eventsForDay(c.day).length > 0;
              return (
                <button key={i} onClick={() => c.cur && setSelectedDay(c.day === selectedDay ? null : c.day)}
                  className="w-full aspect-square flex items-center justify-center rounded-full text-[11px] transition relative"
                  style={isToday
                    ? { background: "#7c3aed", color: "#fff", fontWeight: 700 }
                    : isSel
                    ? { background: "#7c3aed20", color: "#a78bfa", fontWeight: 600 }
                    : { color: c.cur ? t.text : t.textMute }}>
                  {c.day}
                  {hasEvents && !isToday && !isSel && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Кнопка сегодня */}
        <div className="px-4 pb-4">
          <button onClick={goToday}
            className="w-full py-2 rounded-xl text-xs font-semibold transition"
            style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed30" }}>
            Сегодня
          </button>
        </div>

        {/* Легенда типов */}
        <div className="px-4 pb-5 mt-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: t.textMute }}>Типы событий</div>
          <div className="space-y-1.5">
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: EVENT_COLORS[k] }} />
                <span className="text-xs" style={{ color: t.textSub }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Центр: большая сетка ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Шапка сетки */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition"
              style={{ color: t.textSub, background: t.surface2, border: `1px solid ${t.border}` }}>
              <Icon name="ChevronLeft" size={14} />
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition"
              style={{ color: t.textSub, background: t.surface2, border: `1px solid ${t.border}` }}>
              <Icon name="ChevronRight" size={14} />
            </button>
            <span className="text-base font-bold ml-1" style={{ color: t.text }}>
              {MONTH_NAMES[month-1]} {year}
            </span>
          </div>
          <button onClick={() => addModal === null && selectedDay && openAdd(selectedDay)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "#7c3aed" }}>
            <Icon name="Plus" size={13} /> Создать
          </button>
        </div>

        {/* Дни недели */}
        <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${t.border}` }}>
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold"
              style={{ color: t.textMute, borderRight: `1px solid ${t.border2}` }}>
              {d}
            </div>
          ))}
        </div>

        {/* Сетка дней (6 строк × 7) */}
        <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: "repeat(6, 1fr)" }}>
          {cells.map((c, i) => {
            const dayEvents = eventsForDay(c.day, c.cur);
            const isToday   = c.cur && c.day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
            const isSel     = c.cur && c.day === selectedDay;

            return (
              <div key={i}
                onClick={() => c.cur && setSelectedDay(c.day === selectedDay ? null : c.day)}
                onDoubleClick={() => c.cur && openAdd(c.day)}
                className="relative flex flex-col p-1.5 cursor-pointer transition min-h-[90px]"
                style={{
                  borderRight: `1px solid ${t.border2}`,
                  borderBottom: `1px solid ${t.border2}`,
                  background: isSel
                    ? (isDark ? "#7c3aed15" : "#ede9fe50")
                    : isToday
                    ? (isDark ? "#ffffff06" : "#f5f3ff")
                    : "transparent",
                }}>
                {/* Номер дня */}
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition`}
                    style={isToday
                      ? { background: "#7c3aed", color: "#fff" }
                      : { color: c.cur ? t.text : t.textMute, opacity: c.cur ? 1 : 0.35 }}>
                    {c.day}
                  </div>
                  {dayEvents.length > 0 && (
                    <button onClick={e => { e.stopPropagation(); if (c.cur) openAdd(c.day); }}
                      className="opacity-0 hover:opacity-100 w-4 h-4 rounded-full flex items-center justify-center transition"
                      style={{ background: "#7c3aed30", color: "#a78bfa" }}>
                      <Icon name="Plus" size={9} />
                    </button>
                  )}
                </div>

                {/* Ивенты */}
                <div className="space-y-0.5 flex-1">
                  {dayEvents.slice(0, 3).map(e => (
                    <EventBadge key={e.id} e={e} onClick={setEditModal} />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] pl-1" style={{ color: t.textMute }}>
                      +{dayEvents.length - 3} ещё
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Правая панель: события дня ── */}
      <div className="w-64 flex-shrink-0 flex flex-col" style={{ borderLeft: `1px solid ${t.border}` }}>
        {/* Шапка */}
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

        {/* Список событий */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {selectedDay && selectedEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: t.surface2 }}>
                <Icon name="CalendarDays" size={18} style={{ color: t.textMute }} />
              </div>
              <span className="text-xs text-center" style={{ color: t.textMute }}>Нет событий</span>
              <button onClick={() => selectedDay && openAdd(selectedDay)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition mt-1"
                style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed30" }}>
                + Добавить
              </button>
            </div>
          )}
          <div className="space-y-2">
            {selectedEvents.map(e => (
              <div key={e.id}
                onClick={() => setEditModal(e)}
                className="rounded-xl p-3 cursor-pointer transition hover:brightness-95"
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

        {/* Кнопка добавить снизу */}
        {selectedDay && (
          <div className="px-3 pb-3" style={{ borderTop: `1px solid ${t.border}` }}>
            <button onClick={() => openAdd(selectedDay)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold transition mt-3"
              style={{ background: "#7c3aed", color: "#fff" }}>
              + Добавить событие
            </button>
          </div>
        )}
      </div>

      {/* Модалка добавления */}
      {addModal && (
        <EventModal
          mode="add"
          event={{ start_time: addModal.date, title: "", description: "", event_type: "measure" }}
          onClose={() => setAddModal(null)}
          onSave={saveAdd}
        />
      )}

      {/* Модалка редактирования */}
      {editModal && (
        <EventModal
          mode="edit"
          event={editModal}
          onClose={() => setEditModal(null)}
          onSave={saveEdit}
          onDelete={deleteEvent}
        />
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { crmFetch, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "./crmApi";
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

const EVENT_COLORS = EVENT_TYPE_COLORS;

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAY_NAMES = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export default function CrmCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "", description: "", event_type: "measure",
    start_time: "", end_time: "", color: "#f59e0b",
  });

  const load = () => {
    crmFetch("calendar-events", undefined, { month: String(month), year: String(year) })
      .then(d => setEvents(Array.isArray(d) ? d : []));
  };

  useEffect(() => { load(); }, [month, year]); // eslint-disable-line

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Строим сетку
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay(); // 0=вс
  startDow = startDow === 0 ? 6 : startDow - 1; // пн=0

  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsForDay = (day: number) =>
    events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === day && d.getMonth() + 1 === month && d.getFullYear() === year;
    });

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  const addEvent = async () => {
    const payload = { ...newEvent, color: EVENT_COLORS[newEvent.event_type] || "#8b5cf6" };
    await crmFetch("calendar-events", { method: "POST", body: JSON.stringify(payload) });
    setShowAdd(false);
    setNewEvent({ title: "", description: "", event_type: "measure", start_time: "", end_time: "", color: "#f59e0b" });
    load();
  };

  const saveEdit = async () => {
    if (!editEvent) return;
    await crmFetch("calendar-events", { method: "PUT", body: JSON.stringify(editEvent) }, { id: String(editEvent.id) });
    setEditEvent(null);
    load();
  };

  const deleteEvent = async (id: number) => {
    await crmFetch("calendar-events", { method: "DELETE" }, { id: String(id) });
    setEditEvent(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Календарь</h2>
        <button onClick={() => { setShowAdd(true); setNewEvent(p => ({ ...p, start_time: `${year}-${String(month).padStart(2,"0")}-${String(selectedDay||today.getDate()).padStart(2,"0")}T10:00` })); }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">
          <Icon name="Plus" size={14} /> Добавить событие
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Сетка */}
        <div className="lg:col-span-2 bg-[#13131f] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Icon name="ChevronLeft" size={16} /></button>
            <span className="text-base font-semibold text-white">{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Icon name="ChevronRight" size={16} /></button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map(d => <div key={d} className="text-center text-xs text-white/30 font-medium py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dayEvents = eventsForDay(day);
              const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <div key={i} onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`min-h-[52px] rounded-lg p-1.5 cursor-pointer transition ${isSelected ? "bg-violet-600/30 border border-violet-500/60" : isToday ? "bg-white/8 border border-white/20" : "hover:bg-white/5"}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-violet-400" : "text-white/70"}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="text-[9px] truncate rounded px-1 py-0.5 leading-tight" style={{ background: e.color + "33", color: e.color }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[9px] text-white/30">+{dayEvents.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Панель дня */}
        <div className="bg-[#0a0a16] border border-white/[0.05] rounded-xl p-5">
          {selectedDay ? (
            <>
              <div className="text-sm font-semibold text-white mb-3">{selectedDay} {MONTH_NAMES[month - 1]}</div>
              {selectedEvents.length === 0 ? (
                <div className="text-xs text-white/30 text-center py-8">Нет событий</div>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(e => (
                    <div key={e.id} className="rounded-xl p-3 border cursor-pointer hover:border-white/20 transition"
                      style={{ background: e.color + "15", borderColor: e.color + "40" }}
                      onClick={() => setEditEvent(e)}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                        <span className="text-xs font-semibold text-white">{e.title}</span>
                      </div>
                      <div className="text-xs text-white/40 mb-1">{EVENT_TYPE_LABELS[e.event_type] || e.event_type}</div>
                      {e.client_name && <div className="text-xs text-white/50">{e.client_name}</div>}
                      <div className="text-xs text-white/30 mt-1">{new Date(e.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
                      {e.description && <div className="text-xs text-white/40 mt-1">{e.description}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-white/30 text-center py-12">Выберите день</div>
          )}
        </div>
      </div>

      {/* Модалка добавления */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#0e0e1c] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Новое событие</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Название</label>
                <input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Тип</label>
                <select value={newEvent.event_type} onChange={e => setNewEvent(p => ({ ...p, event_type: e.target.value, color: EVENT_COLORS[e.target.value] || "#8b5cf6" }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#1a1a2e]">{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Дата и время</label>
                <input type="datetime-local" value={newEvent.start_time} onChange={e => setNewEvent(p => ({ ...p, start_time: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Описание</label>
                <textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addEvent} disabled={!newEvent.title || !newEvent.start_time}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-lg transition">Добавить</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка редактирования */}
      {editEvent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditEvent(null)}>
          <div className="bg-[#0e0e1c] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Редактировать событие</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Название</label>
                <input value={editEvent.title} onChange={e => setEditEvent(p => p ? { ...p, title: e.target.value } : p)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Тип</label>
                <select value={editEvent.event_type} onChange={e => setEditEvent(p => p ? { ...p, event_type: e.target.value, color: EVENT_COLORS[e.target.value] || "#8b5cf6" } : p)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#1a1a2e]">{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Дата и время</label>
                <input type="datetime-local" value={editEvent.start_time ? editEvent.start_time.slice(0, 16) : ""}
                  onChange={e => setEditEvent(p => p ? { ...p, start_time: e.target.value } : p)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Описание</label>
                <textarea value={editEvent.description || ""} onChange={e => setEditEvent(p => p ? { ...p, description: e.target.value } : p)} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">Сохранить</button>
              <button onClick={() => deleteEvent(editEvent.id)} className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition">Удалить</button>
              <button onClick={() => setEditEvent(null)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
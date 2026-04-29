import { useTheme } from "./themeContext";
import { CalEvent, DAY_SHORT, HOURS } from "./calendarTypes";

export function CalendarWeekView({
  weekStart, events, onAddAt, onEdit, onSelectClient,
}: {
  weekStart: Date;
  events: CalEvent[];
  onAddAt: (iso: string) => void;
  onEdit: (e: CalEvent) => void;
  onSelectClient?: (id: number) => void;
}) {
  const t = useTheme();
  const today = new Date();

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
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mx-auto transition"
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
              const isToday    = day.toDateString() === today.toDateString();
              const isNow      = isToday && currentHour === hour;
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
                    <div key={e.id}
                      onClick={ev => {
                        ev.stopPropagation();
                        if (e.client_id && onSelectClient) onSelectClient(e.client_id);
                        else onEdit(e);
                      }}
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
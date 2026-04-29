import { useTheme } from "./themeContext";
import { CalEvent, DAY_NAMES } from "./calendarTypes";
import { EventBadge } from "./CalendarSidebar";
import { GridCell, eventsForDay } from "./calendarUtils";

interface CalendarMonthGridProps {
  allCells: GridCell[];
  year: number;
  month: number;
  selectedDay: number | null;
  events: CalEvent[];
  onSelectDay: (day: number | null) => void;
  onDoubleClickDay: (iso: string) => void;
  onSelectClient?: (id: number) => void;
}

export function CalendarMonthGrid({
  allCells, year, month, selectedDay, events, onSelectDay, onDoubleClickDay, onSelectClient,
}: CalendarMonthGridProps) {
  const t = useTheme();
  const today = new Date();

  return (
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
          const dayEvents = eventsForDay(events, c.day, month, year, c.cur);
          const isToday   = c.cur && c.day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
          const isSel     = c.cur && c.day === selectedDay;
          return (
            <div key={i}
              onClick={() => c.cur && onSelectDay(c.day === selectedDay ? null : c.day)}
              onDoubleClick={() => c.cur && onDoubleClickDay(`${year}-${String(month).padStart(2,"0")}-${String(c.day).padStart(2,"0")}T10:00`)}
              className="p-1 border-r border-b transition cursor-pointer"
              style={{
                borderColor: t.border2,
                background: isSel ? "#7c3aed18" : isToday ? "#7c3aed08" : "transparent",
              }}>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition`}
                  style={{
                    color: !c.cur ? t.textMute + "55" : isToday ? "#fff" : isSel ? "#7c3aed" : t.textSub,
                    background: isToday ? "#7c3aed" : "transparent",
                  }}>
                  {c.day}
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {dayEvents.slice(0, 3).map(ev => (
                  <EventBadge key={ev.id} e={ev} onClick={() => {
                    if (ev.client_id && onSelectClient) onSelectClient(ev.client_id);
                  }} />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] font-semibold px-1" style={{ color: t.textMute }}>
                    +{dayEvents.length - 3} ещё
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
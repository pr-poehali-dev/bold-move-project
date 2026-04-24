import { EVENT_TYPE_LABELS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { CalEvent, MONTH_NAMES, EVENT_COLORS } from "./calendarTypes";

// ── Бейдж события в месячной сетке ──────────────────────────────────────────
export function EventBadge({ e, onClick }: { e: CalEvent; onClick: (e: CalEvent) => void }) {
  return (
    <div onClick={ev => { ev.stopPropagation(); onClick(e); }}
      className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight cursor-pointer hover:brightness-110 transition mb-0.5"
      style={{ background: e.color + "28", color: e.color, borderLeft: `2.5px solid ${e.color}` }}>
      {new Date(e.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} {e.title}
    </div>
  );
}

// ── Левая панель: мини-календарь + легенда ───────────────────────────────────
export function CalendarLeftSidebar({
  year, month, selectedDay, allCells, eventsForDay,
  onPrevMonth, onNextMonth, onSelectDay, onToday,
}: {
  year: number;
  month: number;
  selectedDay: number | null;
  allCells: { day: number; cur: boolean }[];
  eventsForDay: (day: number, cur?: boolean) => CalEvent[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: number | null) => void;
  onToday: () => void;
}) {
  const t = useTheme();
  const today = new Date();

  return (
    <div className="w-52 flex-shrink-0 flex flex-col" style={{ borderRight: `1px solid ${t.border}`, background: t.surface2 }}>
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onPrevMonth} className="w-6 h-6 flex items-center justify-center rounded-lg transition"
            style={{ color: t.textSub }}>
            <Icon name="ChevronLeft" size={13} />
          </button>
          <span className="text-sm font-bold" style={{ color: t.text }}>{MONTH_NAMES[month-1].slice(0,3)} {year}</span>
          <button onClick={onNextMonth} className="w-6 h-6 flex items-center justify-center rounded-lg transition"
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
              <button key={i} onClick={() => { if (c.cur) { onSelectDay(c.day === selectedDay ? null : c.day); } }}
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
        <button onClick={onToday}
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
  );
}

// ── Правая панель: список событий выбранного дня ─────────────────────────────
export function CalendarDaySidebar({
  selectedDay, month, year, selectedEvents, onOpenAdd, onEditEvent,
}: {
  selectedDay: number | null;
  month: number;
  year: number;
  selectedEvents: CalEvent[];
  onOpenAdd: (iso: string) => void;
  onEditEvent: (e: CalEvent) => void;
}) {
  const t = useTheme();

  const addIso = selectedDay
    ? `${year}-${String(month).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}T10:00`
    : "";

  return (
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
            <button onClick={() => onOpenAdd(addIso)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium mt-1"
              style={{ background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed30" }}>
              + Добавить
            </button>
          </div>
        )}
        <div className="space-y-2">
          {selectedEvents.map(e => (
            <div key={e.id} onClick={() => onEditEvent(e)}
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
          <button onClick={() => onOpenAdd(addIso)}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white mt-3"
            style={{ background: "#7c3aed" }}>
            + Добавить событие
          </button>
        </div>
      )}
    </div>
  );
}

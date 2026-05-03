import { EVENT_TYPE_LABELS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { CalEvent, MONTH_NAMES, EVENT_COLORS } from "./calendarTypes";
import { resolveEventColor } from "./syncedCols";

const EVENT_TYPE_ICONS: Record<string, string> = {
  measure: "Ruler",
  install: "Wrench",
  payment: "Banknote",
  call:    "Phone",
  other:   "Circle",
};

// ── Бейдж события в месячной сетке ──────────────────────────────────────────
export function EventBadge({ e, onClick }: { e: CalEvent; onClick: (e: CalEvent) => void }) {
  const time  = new Date(e.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const icon  = EVENT_TYPE_ICONS[e.event_type] || "Circle";
  const color = resolveEventColor(e.event_type);
  const sub   = e.address || e.client_name;
  return (
    <div onClick={ev => { ev.stopPropagation(); onClick(e); }}
      className="rounded-md px-1.5 py-0.5 cursor-pointer hover:brightness-110 transition mb-0.5"
      style={{ background: color + "22", borderLeft: `2.5px solid ${color}` }}>
      <div className="flex items-center gap-1 min-w-0">
        <Icon name={icon} size={9} style={{ color, flexShrink: 0 }} />
        <span className="text-[10px] font-semibold truncate" style={{ color }}>{time}</span>
        <span className="text-[10px] font-medium truncate" style={{ color: color + "cc" }}>{e.title}</span>
      </div>
      {sub && (
        <div className="text-[9px] truncate mt-0.5 pl-3.5" style={{ color: color + "99" }}>
          {sub}
        </div>
      )}
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
  selectedDay, month, year, selectedEvents, onOpenAdd, onEditEvent, onSelectClient,
}: {
  selectedDay: number | null;
  month: number;
  year: number;
  selectedEvents: CalEvent[];
  onOpenAdd: (iso: string) => void;
  onEditEvent: (e: CalEvent) => void;
  onSelectClient?: (id: number) => void;
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
          {selectedEvents.map(e => {
            const icon      = EVENT_TYPE_ICONS[e.event_type] || "Circle";
            const color     = resolveEventColor(e.event_type);
            const startTime = new Date(e.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
            const endTime   = e.end_time ? new Date(e.end_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : null;
            const sub       = e.address || e.client_name;
            return (
              <div key={e.id}
                className="rounded-xl overflow-hidden transition"
                style={{ border: `1px solid ${color}35` }}>

                {/* Цветная полоска-шапка */}
                <div className="px-3 py-2 flex items-center gap-2 cursor-pointer"
                  style={{ background: color + "20" }}
                  onClick={() => onEditEvent(e)}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: color + "30" }}>
                    <Icon name={icon} size={12} style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate" style={{ color: t.text }}>{e.title}</div>
                    <div className="text-[10px] font-semibold" style={{ color }}>
                      {EVENT_TYPE_LABELS[e.event_type] || e.event_type}
                    </div>
                  </div>
                  <Icon name="Pencil" size={11} style={{ color: t.textMute, flexShrink: 0 }} />
                </div>

                {/* Тело */}
                <div className="px-3 py-2 space-y-1" style={{ background: color + "08" }}>
                  {/* Время */}
                  <div className="flex items-center gap-1.5">
                    <Icon name="Clock" size={10} style={{ color: t.textMute, flexShrink: 0 }} />
                    <span className="text-[11px] font-semibold" style={{ color: t.textSub }}>
                      {startTime}{endTime && ` — ${endTime}`}
                    </span>
                  </div>
                  {/* Адрес / имя клиента */}
                  {sub && (
                    <div className="flex items-center gap-1.5">
                      <Icon name="MapPin" size={10} style={{ color: t.textMute, flexShrink: 0 }} />
                      <span className="text-[11px] truncate" style={{ color: t.textSub }}>{sub}</span>
                    </div>
                  )}
                  {/* Описание */}
                  {e.description && (
                    <div className="flex items-start gap-1.5">
                      <Icon name="FileText" size={10} style={{ color: t.textMute, flexShrink: 0, marginTop: 1 }} />
                      <span className="text-[10px] leading-relaxed" style={{ color: t.textMute }}>{e.description}</span>
                    </div>
                  )}
                </div>

                {/* Кнопка перехода в заказ */}
                {e.client_id && onSelectClient && (
                  <button onClick={() => onSelectClient(e.client_id!)}
                    className="w-full px-3 py-2 flex items-center justify-center gap-1.5 text-[10px] font-bold transition hover:opacity-90"
                    style={{ background: color + "18", color, borderTop: `1px solid ${color}25` }}>
                    <Icon name="ExternalLink" size={10} />
                    Открыть заявку
                  </button>
                )}
              </div>
            );
          })}
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
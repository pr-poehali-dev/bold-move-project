import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import { getWLToken } from "./WLManagerContext";

interface Presentation {
  id:           number;
  demo_id:      number;
  scheduled_at: string;
  duration_min: number;
  notes:        string;
  status:       string;
  company_name: string;
  brand_color:  string;
  brand_logo_url: string;
  contact_name: string;
  contact_phone: string;
  site_url:     string;
}

interface Props {
  onMarkDone?: (demoId: number, nextActionDate?: string) => void;
  onReschedule: (p: Presentation) => void;
}

const masterToken = () => getWLToken();

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAY_NAMES = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function getMonday(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function WLPresentationCalendar({ onMarkDone, onReschedule }: Props) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [view,  setView]  = useState<"month" | "week">("week");
  const [weekStart, setWeekStart] = useState(getMonday(today));
  const [presentations, setPres] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Presentation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${AUTH_URL}?action=demo-presentations&month=${month}&year=${year}`, {
      headers: { "X-Authorization": masterToken() },
    });
    const d = await r.json();
    setPres(d.presentations || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const prevWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };

  // ── Неделя ────────────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });

  const presForDay = (day: Date) => presentations.filter(p => {
    const pd = new Date(p.scheduled_at);
    return pd.getFullYear() === day.getFullYear()
      && pd.getMonth() === day.getMonth()
      && pd.getDate() === day.getDate();
  });

  // ── Месяц ─────────────────────────────────────────────────────────────────
  const firstDay = new Date(year, month - 1, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Пн=0
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startDow + daysInMonth) / 7) * 7 }, (_, i) => {
    const dayNum = i - startDow + 1;
    return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
  });

  const presForMonthDay = (day: number) => presentations.filter(p => {
    const pd = new Date(p.scheduled_at);
    return pd.getFullYear() === year && pd.getMonth() + 1 === month && pd.getDate() === day;
  });

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
          <Icon name="CalendarDays" size={14} style={{ color: "#f97316" }} />
        </div>
        <h2 className="text-sm font-black uppercase tracking-wider flex-1" style={{ color: "#f97316" }}>
          Показы
        </h2>

        {/* Переключатель вид */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["week", "month"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 text-[10px] font-bold transition"
              style={{
                background: view === v ? "rgba(249,115,22,0.2)" : "transparent",
                color:      view === v ? "#f97316" : "rgba(255,255,255,0.3)",
              }}>
              {v === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>

        {/* Навигация */}
        <div className="flex items-center gap-1">
          <button onClick={view === "week" ? prevWeek : prevMonth}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-white/40">
            <Icon name="ChevronLeft" size={14} />
          </button>
          <span className="text-[11px] font-bold text-white/60 min-w-[100px] text-center">
            {view === "week"
              ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[6].getMonth()].slice(0, 3)}`
              : `${MONTH_NAMES[month - 1]} ${year}`}
          </span>
          <button onClick={view === "week" ? nextWeek : nextMonth}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-white/40">
            <Icon name="ChevronRight" size={14} />
          </button>
        </div>

        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-white/30">
          <Icon name="RefreshCw" size={13} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-white/30 text-xs">
          <div className="w-3 h-3 border-2 border-white/15 border-t-orange-400 rounded-full animate-spin" />
          Загрузка...
        </div>
      )}

      {/* ── Вид НЕДЕЛЯ ── */}
      {!loading && view === "week" && (
        <div>
          {/* Дни недели */}
          <div className="grid grid-cols-7 border-b border-white/[0.05]">
            {weekDays.map((day, i) => {
              const isToday = day.toDateString() === today.toDateString();
              const count   = presForDay(day).length;
              return (
                <div key={i} className="py-2 text-center"
                  style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                  <div className="text-[9px] uppercase tracking-wider text-white/30">{DAY_NAMES[i]}</div>
                  <div className="text-[13px] font-black mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full"
                    style={{
                      background: isToday ? "#f97316" : "transparent",
                      color: isToday ? "#fff" : "rgba(255,255,255,0.7)",
                    }}>
                    {day.getDate()}
                  </div>
                  {count > 0 && (
                    <div className="text-[8px] font-bold mt-0.5" style={{ color: "#f97316" }}>
                      {count} показ{count > 1 ? "а" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Слоты */}
          <div className="grid grid-cols-7 min-h-[200px]">
            {weekDays.map((day, i) => {
              const items = presForDay(day);
              return (
                <div key={i} className="p-1.5 space-y-1.5 min-h-[120px]"
                  style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                  {items.length === 0 ? (
                    <div className="text-center pt-4 text-[9px] text-white/10">—</div>
                  ) : items.map(p => (
                    <PresentationCard key={p.id} p={p}
                      onSelect={() => setSelected(p)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Вид МЕСЯЦ ── */}
      {!loading && view === "month" && (
        <div>
          <div className="grid grid-cols-7 border-b border-white/[0.05]">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-[9px] uppercase tracking-wider text-white/25">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const items   = day ? presForMonthDay(day) : [];
              const isToday = day && new Date(year, month - 1, day).toDateString() === today.toDateString();
              return (
                <div key={i} className="border-t border-white/[0.04] min-h-[80px] p-1.5"
                  style={{ borderLeft: i % 7 > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                  {day && (
                    <>
                      <div className="text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1"
                        style={{
                          background: isToday ? "#f97316" : "transparent",
                          color: isToday ? "#fff" : "rgba(255,255,255,0.5)",
                        }}>
                        {day}
                      </div>
                      {items.slice(0, 2).map(p => (
                        <PresentationCard key={p.id} p={p} mini
                          onSelect={() => setSelected(p)}
                        />
                      ))}
                      {items.length > 2 && (
                        <div className="text-[9px] text-white/30 mt-0.5">+{items.length - 2} ещё</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Пустое состояние */}
      {!loading && presentations.length === 0 && (
        <div className="text-center py-10 text-white/20 text-sm">
          Нет запланированных показов в этом периоде
        </div>
      )}

      {/* Детали выбранного показа */}
      {selected && (
        <div className="fixed inset-0 z-[120] flex sm:items-center sm:justify-center items-end p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setSelected(null)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: "#0e0e1a", border: "1px solid rgba(249,115,22,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} /></div>
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-black"
                style={{ background: (selected.brand_color || "#f97316") + "25", color: selected.brand_color || "#f97316" }}>
                {selected.brand_logo_url
                  ? <img src={selected.brand_logo_url} className="w-full h-full object-contain" alt="" />
                  : selected.company_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{selected.company_name}</div>
                <div className="text-[11px] text-white/35">{selected.site_url.replace(/https?:\/\//, "")}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/60 transition">
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl p-3" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <div className="text-[12px] font-bold" style={{ color: "#f97316" }}>
                  <Icon name="CalendarClock" size={13} />
                  {" "}{new Date(selected.scheduled_at).toLocaleString("ru-RU", {
                    weekday: "long", day: "numeric", month: "long",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">Длительность: {selected.duration_min} мин</div>
              </div>
              {selected.contact_name && (
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <Icon name="User" size={12} /> {selected.contact_name}
                  {selected.contact_phone && <span>· {selected.contact_phone}</span>}
                </div>
              )}
              {selected.notes && (
                <div className="text-[11px] text-white/40 px-1">{selected.notes}</div>
              )}
              <div className="flex gap-2 pt-1">
                {selected.status === "scheduled" && (
                  <button onClick={() => { setSelected(null); onReschedule(selected); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Icon name="CalendarArrowUp" size={11} /> Перенести
                  </button>
                )}
                {selected.status === "done" && (
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>
                    <Icon name="CheckCircle2" size={11} /> Показ проведён
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Карточка показа ───────────────────────────────────────────────────── */
function PresentationCard({ p, mini, onSelect }: {
  p: Presentation; mini?: boolean;
  onSelect: () => void;
}) {
  const time = new Date(p.scheduled_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const done = p.status === "done";
  const color = done ? "#10b981" : (p.brand_color || "#f97316");
  const bg    = done ? "rgba(16,185,129,0.12)" : color + "20";

  // mini — вид месяца: одна строка время + название
  if (mini) return (
    <div onClick={onSelect} className="rounded px-1.5 py-0.5 cursor-pointer truncate text-[9px] font-bold"
      style={{ background: bg, color }}>
      {time} {p.company_name}
    </div>
  );

  // full — вид недели:
  // мобиль: только время (крупно) — места мало, 7 колонок узкие
  // десктоп: время + название компании
  return (
    <div onClick={onSelect}
      className="rounded-lg p-1.5 cursor-pointer transition hover:brightness-110"
      style={{ background: color + "15", border: `1px solid ${color}30` }}>
      {/* Мобиль: только время */}
      <div className="sm:hidden text-[10px] font-black text-center" style={{ color }}>
        {time}
      </div>
      {/* Десктоп: время + название */}
      <div className="hidden sm:block text-[10px] font-bold truncate" style={{ color }}>
        {time} · {p.company_name}
      </div>
      {p.contact_name && (
        <div className="hidden sm:block text-[9px] text-white/30 truncate mt-0.5">{p.contact_name}</div>
      )}
      {done && (
        <div className="hidden sm:block mt-1 text-[9px] font-bold" style={{ color: "#10b981" }}>✓ Проведён</div>
      )}
    </div>
  );
}
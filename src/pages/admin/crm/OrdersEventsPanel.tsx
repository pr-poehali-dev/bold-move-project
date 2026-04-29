import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Client } from "./crmApi";
import { useTheme } from "./themeContext";

interface Props {
  allClients: Client[];
  loading: boolean;
  onSelect: (c: Client) => void;
}

export function OrdersEventsPanel({ allClients, loading, onSelect }: Props) {
  const t = useTheme();
  const [eventDays, setEventDays] = useState<1 | 2 | 3 | 7>(3);
  const [pushAsked, setPushAsked] = useState(false);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(now.getDate() + eventDays);

  const upcomingMeasures = allClients.filter(c => {
    if (c.status !== "measure" || !c.measure_date) return false;
    const d = new Date(c.measure_date);
    return d >= now && d <= endDate;
  }).sort((a, b) => new Date(a.measure_date!).getTime() - new Date(b.measure_date!).getTime());

  const upcomingInstalls = allClients.filter(c => {
    if (c.status !== "install_scheduled" || !c.install_date) return false;
    const d = new Date(c.install_date);
    return d >= now && d <= endDate;
  }).sort((a, b) => new Date(a.install_date!).getTime() - new Date(b.install_date!).getTime());

  const overdueM = allClients.filter(c =>
    c.status === "measure" && c.measure_date && new Date(c.measure_date) < now
  ).sort((a, b) => new Date(a.measure_date!).getTime() - new Date(b.measure_date!).getTime());

  const overdueI = allClients.filter(c =>
    c.status === "install_scheduled" && c.install_date && new Date(c.install_date) < now
  ).sort((a, b) => new Date(a.install_date!).getTime() - new Date(b.install_date!).getTime());

  const overdueCount = overdueM.length + overdueI.length;
  const hasEvents = upcomingMeasures.length > 0 || upcomingInstalls.length > 0;

  useEffect(() => {
    if (loading || pushAsked || overdueCount === 0) return;
    setPushAsked(true);
    if (!("Notification" in window)) return;
    const send = () => {
      new Notification("⚠️ Просроченные события в CRM", {
        body: `${overdueCount} ${overdueCount === 1 ? "событие требует внимания" : "события требуют внимания"} — замеры или монтажи без обновления статуса`,
        icon: "/favicon.ico",
      });
    };
    if (Notification.permission === "granted") {
      send();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => { if (p === "granted") send(); });
    }
  }, [loading, overdueCount, pushAsked]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tom = new Date(today); tom.setDate(today.getDate() + 1);
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (dd.getTime() === today.getTime()) return `Сегодня ${time}`;
    if (dd.getTime() === tom.getTime()) return `Завтра ${time}`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " " + time;
  };

  const fmtOverdue = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Сегодня (не обновлён)";
    if (diff === 1) return "Вчера";
    return `${diff} дн. назад`;
  };

  if (loading) return null;

  return (
    <>
      {/* ── ПРОСРОЧЕННЫЕ СОБЫТИЯ ────────────────────────────────────────────── */}
      {overdueCount > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "#ef444408", border: "1px solid #ef444430" }}>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="AlertTriangle" size={15} style={{ color: "#ef4444" }} />
            <span className="text-sm font-bold" style={{ color: "#ef4444" }}>Просроченные события</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: "#ef444420", color: "#ef4444" }}>
              {overdueCount}
            </span>
            <span className="text-xs ml-1" style={{ color: "#f87171" }}>— статус не обновлён, дата прошла</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {overdueM.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="Ruler" size={12} style={{ color: "#ef4444" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>
                    Замеры ({overdueM.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overdueM.map(c => (
                    <button key={c.id} onClick={() => onSelect(c)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                      style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#ef4444" }} />
                      <div className="min-w-0 pl-2">
                        <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                        {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                      </div>
                      <div className="text-xs font-semibold whitespace-nowrap ml-3" style={{ color: "#ef4444" }}>
                        {fmtOverdue(c.measure_date!)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {overdueI.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="Wrench" size={12} style={{ color: "#ef4444" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>
                    Монтажи ({overdueI.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overdueI.map(c => (
                    <button key={c.id} onClick={() => onSelect(c)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                      style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#ef4444" }} />
                      <div className="min-w-0 pl-2">
                        <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                        {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                      </div>
                      <div className="text-xs font-semibold whitespace-nowrap ml-3" style={{ color: "#ef4444" }}>
                        {fmtOverdue(c.install_date!)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ПРЕДСТОЯЩИЕ СОБЫТИЯ ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="CalendarClock" size={15} style={{ color: "#a78bfa" }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>Предстоящие события</span>
            {hasEvents && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                {upcomingMeasures.length + upcomingInstalls.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
            {([
              { val: 1, label: "Сегодня" },
              { val: 2, label: "Завтра" },
              { val: 3, label: "3 дня" },
              { val: 7, label: "7 дней" },
            ] as const).map(({ val, label }) => (
              <button key={val} onClick={() => setEventDays(val)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                style={eventDays === val
                  ? { background: "#7c3aed", color: "#fff" }
                  : { color: t.textMute, background: "transparent" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {!hasEvents ? (
          <div className="flex items-center gap-2 py-3 text-sm" style={{ color: t.textMute }}>
            <Icon name="CheckCircle2" size={14} className="opacity-50" />
            Нет замеров и монтажей на выбранный период
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingMeasures.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="Ruler" size={12} style={{ color: "#f59e0b" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>
                    Замеры ({upcomingMeasures.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {upcomingMeasures.map(c => {
                    const isToday = new Date(c.measure_date!).toDateString() === now.toDateString();
                    return (
                      <button key={c.id} onClick={() => onSelect(c)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                        style={{
                          background: isToday ? "#f59e0b22" : "#f59e0b12",
                          border: `1px solid ${isToday ? "#f59e0b60" : "#f59e0b30"}`,
                        }}>
                        {isToday && <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#f59e0b" }} />}
                        <div className={`min-w-0 ${isToday ? "pl-2" : ""}`}>
                          <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                          {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                          {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#f59e0b30", color: "#f59e0b" }}>СЕГОДНЯ</span>}
                          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#f59e0b" }}>
                            {fmtDate(c.measure_date!)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {upcomingInstalls.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="Wrench" size={12} style={{ color: "#f97316" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f97316" }}>
                    Монтажи ({upcomingInstalls.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {upcomingInstalls.map(c => {
                    const isToday = new Date(c.install_date!).toDateString() === now.toDateString();
                    return (
                      <button key={c.id} onClick={() => onSelect(c)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                        style={{
                          background: isToday ? "#f9731622" : "#f9731612",
                          border: `1px solid ${isToday ? "#f9731660" : "#f9731630"}`,
                        }}>
                        {isToday && <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#f97316" }} />}
                        <div className={`min-w-0 ${isToday ? "pl-2" : ""}`}>
                          <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                          {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                          {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#f9731630", color: "#f97316" }}>СЕГОДНЯ</span>}
                          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#f97316" }}>
                            {fmtDate(c.install_date!)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

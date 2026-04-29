import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Client } from "./crmApi";
import { useTheme } from "./themeContext";

interface Props {
  allClients: Client[];
  loading: boolean;
  onSelect: (c: Client) => void;
}

const MEASURE_ACTIVE = ["new", "call", "measure"];
const INSTALL_ACTIVE = ["contract", "prepaid", "install_scheduled"];

export function OrdersEventsPanel({ allClients, loading, onSelect }: Props) {
  const t = useTheme();
  const [eventDays, setEventDays] = useState<1 | 2 | 3 | 7>(3);
  const [collapsed, setCollapsed] = useState(true);
  const [pushAsked, setPushAsked] = useState(false);

  const now = new Date();

  // startDate: для "Завтра" начинаем с завтра 00:00, иначе с текущего момента
  const startDate = new Date(now);
  if (eventDays === 2) {
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
  }

  // endDate: конец последнего дня диапазона
  const endDate = new Date(now);
  // "Сегодня"=1 день, "Завтра"=только завтра, "3 дня"=3 дня, "7 дней"=7 дней
  const daysToAdd = eventDays === 2 ? 1 : eventDays - 1;
  endDate.setDate(now.getDate() + daysToAdd);
  endDate.setHours(23, 59, 59, 999);

  // Замеры — measure_date в диапазоне, статус ещё активен (не выполнен/не отменён)
  const upcomingMeasures = allClients.filter(c => {
    if (!c.measure_date || !MEASURE_ACTIVE.includes(c.status)) return false;
    const d = new Date(c.measure_date);
    return d >= startDate && d <= endDate;
  }).sort((a, b) => new Date(a.measure_date!).getTime() - new Date(b.measure_date!).getTime());

  // Монтажи — install_date в диапазоне, статус ещё активен (не выполнен/не отменён)
  const upcomingInstalls = allClients.filter(c => {
    if (!c.install_date || !INSTALL_ACTIVE.includes(c.status)) return false;
    const d = new Date(c.install_date);
    return d >= startDate && d <= endDate;
  }).sort((a, b) => new Date(a.install_date!).getTime() - new Date(b.install_date!).getTime());

  // Просроченные замеры
  const overdueM = allClients.filter(c =>
    MEASURE_ACTIVE.includes(c.status) && c.measure_date && new Date(c.measure_date) < now
  ).sort((a, b) => new Date(a.measure_date!).getTime() - new Date(b.measure_date!).getTime());

  // Просроченные монтажи
  const overdueI = allClients.filter(c =>
    INSTALL_ACTIVE.includes(c.status) && c.install_date && new Date(c.install_date) < now
  ).sort((a, b) => new Date(a.install_date!).getTime() - new Date(b.install_date!).getTime());

  const overdueCount = overdueM.length + overdueI.length;
  const upcomingCount = upcomingMeasures.length + upcomingInstalls.length;
  const hasEvents = upcomingCount > 0;

  // Push-уведомление при загрузке если есть просроченные
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
      {/* ── ПРОСРОЧЕННЫЕ ────────────────────────────────────────────────────── */}
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
              <EventGroup
                title={`Замеры (${overdueM.length})`}
                icon="Ruler" color="#ef4444"
                items={overdueM.map(c => ({
                  id: c.id, name: c.client_name, phone: c.phone, address: c.address,
                  dateStr: fmtOverdue(c.measure_date!), isToday: false, client: c,
                }))}
                onSelect={onSelect}
                overdue
              />
            )}
            {overdueI.length > 0 && (
              <EventGroup
                title={`Монтажи (${overdueI.length})`}
                icon="Wrench" color="#ef4444"
                items={overdueI.map(c => ({
                  id: c.id, name: c.client_name, phone: c.phone, address: c.address,
                  dateStr: fmtOverdue(c.install_date!), isToday: false, client: c,
                }))}
                onSelect={onSelect}
                overdue
              />
            )}
          </div>
        </div>
      )}

      {/* ── ПРЕДСТОЯЩИЕ ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        {/* Шапка — всегда видна, кликабельна */}
        <div
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 rounded-2xl transition hover:opacity-80 cursor-pointer"
        >
          {/* Левая часть: иконка + заголовок */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon name="CalendarClock" size={15} style={{ color: "#a78bfa", flexShrink: 0 }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>Предстоящие события</span>
          </div>

          {/* Правая часть: счётчик + фильтр + шеврон */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {upcomingCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                {upcomingCount}
              </span>
            )}
            {/* Фильтр дней — stopPropagation только на кнопках фильтра */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl"
              style={{ background: t.surface2, border: `1px solid ${t.border}` }}
              onClick={e => e.stopPropagation()}>
              {([
                { val: 1, label: "Сег", labelFull: "Сегодня" },
                { val: 2, label: "Зав", labelFull: "Завтра" },
                { val: 3, label: "3д",  labelFull: "3 дня" },
                { val: 7, label: "7д",  labelFull: "7 дней" },
              ] as const).map(({ val, label, labelFull }) => (
                <button key={val}
                  onClick={e => { e.stopPropagation(); setEventDays(val); if (collapsed) setCollapsed(false); }}
                  className="rounded-lg text-xs font-semibold transition whitespace-nowrap px-2 sm:px-3 py-1"
                  style={eventDays === val
                    ? { background: "#7c3aed", color: "#fff" }
                    : { color: t.textMute, background: "transparent" }}>
                  <span className="sm:hidden">{label}</span>
                  <span className="hidden sm:inline">{labelFull}</span>
                </button>
              ))}
            </div>
            {/* Шеврон — вне stopPropagation, клик доходит до родителя */}
            <div className="p-1">
              <Icon name={collapsed ? "ChevronDown" : "ChevronUp"} size={14} style={{ color: t.textMute }} />
            </div>
          </div>
        </div>

        {/* Тело — сворачивается */}
        {!collapsed && (
          <div className="px-4 pb-4">
            {!hasEvents ? (
              <div className="flex items-center gap-2 py-2 text-sm" style={{ color: t.textMute }}>
                <Icon name="CheckCircle2" size={14} className="opacity-50" />
                Нет замеров и монтажей на выбранный период
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingMeasures.length > 0 && (
                  <EventGroup
                    title={`Замеры (${upcomingMeasures.length})`}
                    icon="Ruler" color="#f59e0b"
                    items={upcomingMeasures.map(c => {
                      const isToday = new Date(c.measure_date!).toDateString() === now.toDateString();
                      return { id: c.id, name: c.client_name, phone: c.phone, address: c.address, dateStr: fmtDate(c.measure_date!), isToday, client: c };
                    })}
                    onSelect={onSelect}
                  />
                )}
                {upcomingInstalls.length > 0 && (
                  <EventGroup
                    title={`Монтажи (${upcomingInstalls.length})`}
                    icon="Wrench" color="#f97316"
                    items={upcomingInstalls.map(c => {
                      const isToday = new Date(c.install_date!).toDateString() === now.toDateString();
                      return { id: c.id, name: c.client_name, phone: c.phone, address: c.address, dateStr: fmtDate(c.install_date!), isToday, client: c };
                    })}
                    onSelect={onSelect}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Переиспользуемая группа событий ─────────────────────────────────────── */
function EventGroup({ title, icon, color, items, onSelect, overdue }: {
  title: string;
  icon: string;
  color: string;
  items: { id: number; name: string; phone?: string | null; address?: string | null; dateStr: string; isToday: boolean; client: Client }[];
  onSelect: (c: Client) => void;
  overdue?: boolean;
}) {
  const t = useTheme();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name={icon} size={12} style={{ color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <button key={item.id} onClick={() => onSelect(item.client)}
            className="w-full flex items-start justify-between px-3 py-2.5 rounded-xl text-left transition active:opacity-70 hover:opacity-80 relative overflow-hidden gap-2"
            style={{
              background: overdue ? `${color}15` : item.isToday ? `${color}22` : `${color}12`,
              border: `1px solid ${overdue ? `${color}35` : item.isToday ? `${color}60` : `${color}30`}`,
            }}>
            {(overdue || item.isToday) && (
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: color }} />
            )}
            <div className={`min-w-0 flex-1 ${overdue || item.isToday ? "pl-2" : ""}`}>
              <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{item.name || "Без имени"}</div>
              {item.phone && (
                <div className="text-xs truncate flex items-center gap-1 mt-0.5" style={{ color: t.textMute }}>
                  <Icon name="Phone" size={9} style={{ color, flexShrink: 0 }} />{item.phone}
                </div>
              )}
              {item.address && (
                <div className="text-xs truncate flex items-center gap-1 mt-0.5" style={{ color: t.textMute }}>
                  <Icon name="MapPin" size={9} style={{ color, flexShrink: 0 }} />{item.address}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {item.isToday && !overdue && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ background: `${color}30`, color }}>СЕГОДНЯ</span>
              )}
              <span className="text-xs font-bold whitespace-nowrap" style={{ color }}>{item.dateStr}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
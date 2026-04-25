import { useState } from "react";
import { Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

export interface ActivityEvent {
  icon: string; color: string; text: string; date: string;
}

// ── Хранилище лога активности в localStorage per client ───────────────────────
function logKey(clientId: number) { return `activity_log_${clientId}`; }

export function loadActivityLog(clientId: number): ActivityEvent[] {
  try { return JSON.parse(localStorage.getItem(logKey(clientId)) || "[]"); } catch { return []; }
}

export function appendActivityLog(clientId: number, event: ActivityEvent) {
  const current = loadActivityLog(clientId);
  const updated = [...current, event];
  localStorage.setItem(logKey(clientId), JSON.stringify(updated));
  return updated;
}

export function ActivityFeed({ client, extraEvents = [], onAddComment }: {
  client: Client;
  extraEvents?: ActivityEvent[];
  onAddComment: (text: string) => void;
}) {
  const t = useTheme();
  const [comment, setComment] = useState("");

  // Базовые события из полей клиента
  const baseEvents: ActivityEvent[] = [];
  if (client.created_at)    baseEvents.push({ icon: "Plus",     color: "#8b5cf6", text: "Заявка создана",                                                       date: new Date(client.created_at).toLocaleString("ru-RU",   { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  if (client.measure_date)  baseEvents.push({ icon: "Ruler",    color: "#f59e0b", text: "Замер назначен",                                                       date: new Date(client.measure_date).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  if (client.install_date)  baseEvents.push({ icon: "Wrench",   color: "#f97316", text: "Монтаж назначен",                                                      date: new Date(client.install_date).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  if (client.contract_sum)  baseEvents.push({ icon: "FileText", color: "#06b6d4", text: `Договор: ${Number(client.contract_sum).toLocaleString("ru-RU")} ₽`,   date: "" });
  if (client.prepayment)    baseEvents.push({ icon: "Wallet",   color: "#10b981", text: `Предоплата: +${Number(client.prepayment).toLocaleString("ru-RU")} ₽`, date: "" });
  if (client.extra_payment) baseEvents.push({ icon: "Wallet",   color: "#10b981", text: `Доплата: +${Number(client.extra_payment).toLocaleString("ru-RU")} ₽`, date: "" });

  // Сохранённые события из localStorage
  const savedEvents = loadActivityLog(client.id);

  // Объединяем: базовые + сохранённые + текущей сессии (без дублей)
  const sessionTexts = new Set(extraEvents.map(e => e.text + e.date));
  const savedFiltered = savedEvents.filter(e => !sessionTexts.has(e.text + e.date));
  const allEvents = [...baseEvents, ...savedFiltered, ...extraEvents];

  const handleSend = () => {
    if (!comment.trim()) return;
    onAddComment(comment.trim());
    setComment("");
  };

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col flex-1" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620" }}>
          <Icon name="Activity" size={12} style={{ color: "#8b5cf6" }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8b5cf6" }}>Активность</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "#8b5cf620", color: "#8b5cf6" }}>{allEvents.length}</span>
      </div>

      {/* Поле комментария — вверху */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex gap-2">
          <input value={comment} onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Добавить комментарий..."
            className="flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
          <button onClick={handleSend} disabled={!comment.trim()}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-40"
            style={{ background: "#7c3aed", color: "#fff" }}>
            <Icon name="Send" size={13} />
          </button>
        </div>
      </div>

      {/* Список событий — растягивается до конца */}
      <div className="px-4 py-3 space-y-2.5 overflow-y-auto flex-1">
        {allEvents.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: "#a3a3a3" }}>Нет событий</div>
        ) : [...allEvents].reverse().map((ev, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: ev.color + "20" }}>
              <Icon name={ev.icon} size={11} style={{ color: ev.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs leading-relaxed" style={{ color: "#fff" }}>{ev.text}</div>
              {ev.date && <div className="text-[10px] mt-0.5" style={{ color: "#a3a3a3" }}>{ev.date}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

// ── StatusSelector — визуальная воронка ──────────────────────────────────────
const FUNNEL_STAGES = [
  { statuses: ["new"],                                                                    label: "Заявка",   color: "#8b5cf6", icon: "Inbox" },
  { statuses: ["call"],                                                                   label: "В работе", color: "#a78bfa", icon: "Zap" },
  { statuses: ["measure", "measured"],                                                    label: "Замер",    color: "#f59e0b", icon: "Ruler" },
  { statuses: ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"], label: "Монтаж",  color: "#f97316", icon: "Wrench" },
  { statuses: ["done"],                                                                   label: "Готово",   color: "#10b981", icon: "CheckCircle2" },
  { statuses: ["cancelled"],                                                              label: "Отказ",    color: "#ef4444", icon: "XCircle" },
] as const;

const STAGE_DETAIL: Record<string, string[]> = {
  "В работе": ["call"],
  "Замер":    ["measure", "measured"],
  "Монтаж":   ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"],
};

export function StatusSelector({ status, onSave }: { status: string; onSave: (s: string) => void }) {
  const t = useTheme();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const currentStage = FUNNEL_STAGES.find(g => g.statuses.includes(status as never));

  return (
    <div className="pt-2 pb-2 space-y-2">
      <div className="flex items-center gap-0.5">
        {FUNNEL_STAGES.filter(g => g.label !== "Отказ").map((g, i, arr) => {
          const isActive = g.statuses.includes(status as never);
          const isPast = FUNNEL_STAGES.findIndex(x => x.statuses.includes(status as never)) > i;
          return (
            <div key={g.label} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => {
                  if (STAGE_DETAIL[g.label]) {
                    setExpandedStage(expandedStage === g.label ? null : g.label);
                  } else {
                    onSave(g.statuses[0]);
                    setExpandedStage(null);
                  }
                }}
                className="flex flex-col items-center gap-1 flex-1 min-w-0 py-1.5 px-1 rounded-xl transition"
                style={{
                  background: isActive ? g.color + "20" : isPast ? g.color + "10" : "transparent",
                  border: `1.5px solid ${isActive ? g.color + "60" : isPast ? g.color + "30" : t.border2}`,
                }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: isActive ? g.color : isPast ? g.color + "40" : t.surface }}>
                  <Icon name={g.icon} size={11} style={{ color: isActive ? "#fff" : isPast ? g.color : t.textMute }} />
                </div>
                <span className="text-[9px] font-semibold text-center leading-tight truncate w-full"
                  style={{ color: isActive ? g.color : isPast ? g.color + "cc" : t.textMute }}>
                  {g.label}
                </span>
              </button>
              {i < arr.length - 1 && (
                <div className="w-2 flex-shrink-0 h-px mx-0.5" style={{ background: isPast ? currentStage?.color + "50" : t.border2 }} />
              )}
            </div>
          );
        })}
        <div className="w-2 flex-shrink-0" />
        <button
          onClick={() => { onSave("cancelled"); setExpandedStage(null); }}
          className="flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition flex-shrink-0"
          style={{
            background: status === "cancelled" ? "#ef444420" : "transparent",
            border: `1.5px solid ${status === "cancelled" ? "#ef444460" : t.border2}`,
          }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: status === "cancelled" ? "#ef4444" : t.surface }}>
            <Icon name="XCircle" size={11} style={{ color: status === "cancelled" ? "#fff" : t.textMute }} />
          </div>
          <span className="text-[9px] font-semibold" style={{ color: status === "cancelled" ? "#ef4444" : t.textMute }}>Отказ</span>
        </button>
      </div>

      {expandedStage && STAGE_DETAIL[expandedStage] && (
        <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
          {STAGE_DETAIL[expandedStage].map(s => (
            <button key={s} onClick={() => { onSave(s); setExpandedStage(null); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition border"
              style={status === s
                ? { background: STATUS_COLORS[s] + "25", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "50" }
                : { borderColor: t.border2, background: t.surface, color: t.textMute }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ActivityFeed ──────────────────────────────────────────────────────────────
export interface ActivityEvent {
  icon: string; color: string; text: string; date: string;
}

export function ActivityFeed({ client, onAddComment, extraEvents = [] }: {
  client: Client;
  onAddComment: (text: string) => void;
  extraEvents?: ActivityEvent[];
}) {
  const t = useTheme();
  const [comment, setComment] = useState("");

  const now = () => new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // Базовые события из данных клиента
  const baseEvents: ActivityEvent[] = [];
  if (client.created_at) baseEvents.push({ icon: "Plus", color: "#8b5cf6", text: "Заявка создана", date: new Date(client.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  if (client.measure_date) baseEvents.push({ icon: "Ruler", color: "#f59e0b", text: "Замер назначен", date: new Date(client.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  if (client.install_date) baseEvents.push({ icon: "Wrench", color: "#f97316", text: "Монтаж назначен", date: new Date(client.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  if (client.contract_sum) baseEvents.push({ icon: "FileText", color: "#06b6d4", text: `Договор: ${client.contract_sum.toLocaleString("ru-RU")} ₽`, date: "" });
  if (client.prepayment) baseEvents.push({ icon: "Wallet", color: "#10b981", text: `Предоплата: +${client.prepayment.toLocaleString("ru-RU")} ₽`, date: "" });
  if (client.extra_payment) baseEvents.push({ icon: "Wallet", color: "#10b981", text: `Доплата: +${client.extra_payment.toLocaleString("ru-RU")} ₽`, date: "" });

  // Объединяем базовые + динамические события из сессии
  const allEvents = [...baseEvents, ...extraEvents];

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

      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1" style={{ maxHeight: 400 }}>
        {allEvents.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: t.textMute }}>Нет событий</div>
        ) : allEvents.map((ev, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: ev.color + "20" }}>
              <Icon name={ev.icon} size={11} style={{ color: ev.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs" style={{ color: "#fff" }}>{ev.text}</div>
              {ev.date && <div className="text-[10px] mt-0.5" style={{ color: t.textMute }}>{ev.date}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-3 flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
        <div className="flex gap-2 pt-3">
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
    </div>
  );
}
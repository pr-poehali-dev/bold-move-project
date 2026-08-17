import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { crmFetch } from "@/pages/admin/crm/crmApi";

export interface LeadLogEntry {
  id: number;
  channel: string;
  parsed_phone: string | null;
  outcome: string | null;
  client_id: number | null;
  error: string | null;
  created_at: string;
  payload: unknown;
}

/** Потерянной считаем заявку, по которой карточка так и не появилась. */
export const isLostLead = (e: LeadLogEntry) => e.outcome === "error" || e.outcome === "skipped";

const CHANNEL_LABEL: Record<string, string> = {
  telegram_leads: "Telegram",
  leakad_webhook: "Квиз",
  email_leads: "Почта",
};

const OUTCOME_META: Record<string, { label: string; color: string; icon: string }> = {
  created:   { label: "Заявка создана",  color: "#10b981", icon: "CheckCircle2" },
  duplicate: { label: "Повтор",          color: "#64748b", icon: "Copy" },
  skipped:   { label: "Не распознана",   color: "#f59e0b", icon: "AlertTriangle" },
  error:     { label: "Не сохранилась",  color: "#ef4444", icon: "XCircle" },
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

/** Достаём текст заявки из сырого запроса — чтобы потерянную можно было завести руками. */
function payloadText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const msg = p.message as Record<string, unknown> | undefined;
  const fromTg = msg && (msg.text || msg.caption);
  if (typeof fromTg === "string") return fromTg;
  const parts = ["phone", "телефон", "name", "имя", "city", "город", "comment", "комментарий"]
    .map(k => (typeof p[k] === "string" || typeof p[k] === "number" ? `${k}: ${p[k]}` : null))
    .filter(Boolean);
  if (parts.length > 0) return parts.join("\n");
  try { return JSON.stringify(payload, null, 2); } catch { return ""; }
}

export function LeadsLogModal({ onClose }: { onClose: () => void }) {
  const [items, setItems]     = useState<LeadLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyLost, setOnlyLost] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    crmFetch("leads-log", undefined, { limit: "200" })
      .then(d => { if (alive) setItems(Array.isArray(d) ? d as LeadLogEntry[] : []); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const lostCount = items.filter(isLostLead).length;
  const visible = onlyLost ? items.filter(isLostLead) : items;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[720px] my-8 shadow-2xl overflow-hidden"
        style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)" }}>
            <Icon name="Inbox" size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white">Журнал входящих заявок</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "#a3a3a3" }}>
              Всё, что пришло с сайта и квиза — включая то, что не попало в CRM
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition hover:bg-white/10" title="Закрыть">
            <Icon name="X" size={16} style={{ color: "#a3a3a3" }} />
          </button>
        </div>

        {/* Фильтр */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { key: false, label: `Все (${items.length})`, color: "#7c3aed" },
            { key: true,  label: `Потерянные (${lostCount})`, color: "#ef4444" },
          ] as const).map(f => (
            <button key={String(f.key)} onClick={() => setOnlyLost(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
              style={onlyLost === f.key
                ? { background: f.color, borderColor: f.color, color: "#fff" }
                : { background: "transparent", borderColor: "rgba(255,255,255,0.12)", color: "#a3a3a3" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Список */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: "#737373" }}>
              <Icon name={onlyLost ? "ShieldCheck" : "Inbox"} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">
                {onlyLost ? "Потерянных заявок нет" : "Заявок пока не поступало"}
              </span>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {visible.map(e => {
                const meta = OUTCOME_META[e.outcome || ""] || { label: e.outcome || "—", color: "#64748b", icon: "Circle" };
                const lost = isLostLead(e);
                const isOpen = expanded === e.id;
                const text = payloadText(e.payload);
                return (
                  <div key={e.id} className="px-4 py-2.5"
                    style={lost ? { background: "rgba(239,68,68,0.06)", borderLeft: "2px solid #ef4444" } : undefined}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon name={meta.icon} size={12} style={{ color: meta.color, flexShrink: 0 }} />
                      <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#a3a3a3" }}>
                        {CHANNEL_LABEL[e.channel] || e.channel}
                      </span>
                      {e.parsed_phone && (
                        <span className="text-xs font-medium text-white">{e.parsed_phone}</span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: "#737373" }}>{fmtTime(e.created_at)}</span>
                    </div>

                    {e.error && (
                      <div className="text-[11px] mt-1" style={{ color: "#fca5a5" }}>{e.error}</div>
                    )}

                    {text && (
                      <button onClick={() => setExpanded(isOpen ? null : e.id)}
                        className="text-[11px] mt-1 transition hover:opacity-80"
                        style={{ color: "#a78bfa" }}>
                        {isOpen ? "Свернуть" : "Показать текст заявки"}
                      </button>
                    )}
                    {isOpen && text && (
                      <pre className="text-[11px] mt-1.5 p-2 rounded-lg whitespace-pre-wrap break-words"
                        style={{ background: "rgba(255,255,255,0.04)", color: "#d4d4d4" }}>{text}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default LeadsLogModal;

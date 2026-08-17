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

/** Заявка пришла, но карточки в CRM по ней НЕТ — единственный по-настоящему
 *  тревожный случай, всё остальное штатно. */
export const isLostLead = (e: LeadLogEntry) => e.outcome === "error" || e.outcome === "skipped";

/** Заявка, которую подобрала почта, когда вебхук её не принёс. */
export const isRecoveredLead = (e: LeadLogEntry) => e.outcome === "recovered";

const CHANNEL_LABEL: Record<string, string> = {
  telegram_leads: "Telegram",
  leakad_webhook: "Квиз",
  email_leads: "Почта",
};

// Понятные человеку статусы: что произошло и надо ли что-то делать.
const OUTCOME_META: Record<string, { title: string; hint: string; color: string; icon: string }> = {
  created:   { title: "Попала в CRM",      hint: "Заявка успешно создана",                       color: "#10b981", icon: "CheckCircle2" },
  duplicate: { title: "Повтор",            hint: "Такая заявка уже есть — новая не создавалась", color: "#64748b", icon: "Copy" },
  recovered: { title: "Подобрана с почты", hint: "Вебхук её не принёс — завели из письма",       color: "#f97316", icon: "LifeBuoy" },
  skipped:   { title: "Не разобрали",      hint: "Не похоже на заявку или нет телефона",         color: "#f59e0b", icon: "AlertTriangle" },
  error:     { title: "Не сохранилась",    hint: "Сбой при записи — заведите вручную",           color: "#ef4444", icon: "XCircle" },
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

/** Текст заявки из сырого запроса — чтобы потерянную можно было завести руками. */
function payloadText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const msg = p.message as Record<string, unknown> | undefined;
  const fromTg = msg && (msg.text || msg.caption);
  if (typeof fromTg === "string") return fromTg;
  if (typeof p.text === "string") return p.text;
  const LABELS: Record<string, string> = {
    phone: "Телефон", телефон: "Телефон", name: "Имя", имя: "Имя",
    city: "Город", город: "Город", comment: "Комментарий", комментарий: "Комментарий",
  };
  const parts = Object.entries(LABELS)
    .map(([k, label]) => (typeof p[k] === "string" || typeof p[k] === "number" ? `${label}: ${p[k]}` : null))
    .filter(Boolean);
  if (parts.length > 0) return [...new Set(parts)].join("\n");
  try { return JSON.stringify(payload, null, 2); } catch { return ""; }
}

type FilterKey = "all" | "lost" | "recovered";

export function LeadsLogModal({ onClose }: { onClose: () => void }) {
  const [items, setItems]     = useState<LeadLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterKey>("all");
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

  const lostCount      = items.filter(isLostLead).length;
  const recoveredCount = items.filter(isRecoveredLead).length;
  const okCount        = items.length - lostCount;

  const visible = filter === "lost" ? items.filter(isLostLead)
    : filter === "recovered" ? items.filter(isRecoveredLead)
    : items;

  const allGood = !loading && lostCount === 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/75 p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[680px] my-8 shadow-2xl overflow-hidden"
        style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>

        {/* ── Шапка ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)" }}>
            <Icon name="Inbox" size={17} style={{ color: "#a78bfa" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-white leading-tight">Приём заявок</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "#8f8f8f" }}>
              Все заявки с сайта и квиза — дошли ли они до CRM
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition hover:bg-white/10" title="Закрыть">
            <Icon name="X" size={16} style={{ color: "#a3a3a3" }} />
          </button>
        </div>

        {/* ── Главный вывод: всё хорошо / есть потери ──────────── */}
        {!loading && (
          <div className="px-5 py-3.5 flex items-center gap-3"
            style={{
              background: allGood ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.09)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
            <Icon name={allGood ? "ShieldCheck" : "AlertOctagon"} size={20}
              style={{ color: allGood ? "#10b981" : "#ef4444", flexShrink: 0 }} />
            <div className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: allGood ? "#34d399" : "#f87171" }}>
                {allGood ? "Все заявки на месте" : `Не дошло до CRM: ${lostCount}`}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "#8f8f8f" }}>
                {allGood
                  ? `Обработано ${items.length} — потерь нет`
                  : "Откройте их ниже, скопируйте телефон и заведите вручную"}
              </div>
            </div>
          </div>
        )}

        {/* ── Три цифры: сколько дошло / потеряно / спасено ────── */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-3 gap-2 px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { key: "all"       as const, n: okCount,        label: "дошли",        color: "#10b981" },
              { key: "lost"      as const, n: lostCount,      label: "потеряно",     color: "#ef4444" },
              { key: "recovered" as const, n: recoveredCount, label: "спасла почта", color: "#f97316" },
            ].map(s => (
              <button key={s.key} onClick={() => setFilter(s.key)}
                className="rounded-xl px-3 py-2.5 text-left transition"
                style={{
                  background: filter === s.key ? s.color + "1f" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === s.key ? s.color + "66" : "rgba(255,255,255,0.07)"}`,
                }}>
                <div className="text-lg font-black leading-none" style={{ color: s.n > 0 ? s.color : "#5a5a5a" }}>{s.n}</div>
                <div className="text-[10px] mt-1" style={{ color: "#8f8f8f" }}>{s.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── Список ──────────────────────────────────────────── */}
        <div className="max-h-[52vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center" style={{ color: "#6b6b6b" }}>
              <Icon name={filter === "all" ? "Inbox" : "ShieldCheck"} size={30} className="mb-2.5 opacity-25" />
              <span className="text-[13px]">
                {filter === "lost" ? "Ни одна заявка не потерялась"
                  : filter === "recovered" ? "Почте пока некого было спасать"
                  : "Заявок пока не поступало"}
              </span>
            </div>
          ) : (
            <div>
              {visible.map(e => {
                const meta = OUTCOME_META[e.outcome || ""]
                  || { title: e.outcome || "—", hint: "", color: "#64748b", icon: "Circle" };
                const lost = isLostLead(e);
                const isOpen = expanded === e.id;
                const text = payloadText(e.payload);
                return (
                  <div key={e.id} className="px-5 py-3"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: lost ? "rgba(239,68,68,0.05)" : undefined,
                      borderLeft: `3px solid ${lost ? "#ef4444" : "transparent"}`,
                    }}>

                    {/* Строка 1: телефон крупно + время */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-bold text-white">
                        {e.parsed_phone || "Телефон не распознан"}
                      </span>
                      <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "#6b6b6b" }}>
                        {fmtTime(e.created_at)}
                      </span>
                    </div>

                    {/* Строка 2: что произошло + откуда */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Icon name={meta.icon} size={11} style={{ color: meta.color, flexShrink: 0 }} />
                      <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.title}</span>
                      <span className="text-[11px]" style={{ color: "#6b6b6b" }}>·</span>
                      <span className="text-[11px]" style={{ color: "#8f8f8f" }}>{meta.hint}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#8f8f8f" }}>
                        {CHANNEL_LABEL[e.channel] || e.channel}
                      </span>
                    </div>

                    {/* Кнопка «текст заявки» — нужна в основном для потерянных */}
                    {text && (
                      <>
                        <button onClick={() => setExpanded(isOpen ? null : e.id)}
                          className="text-[11px] mt-1.5 flex items-center gap-1 transition hover:opacity-80"
                          style={{ color: "#a78bfa" }}>
                          <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={11} />
                          {isOpen ? "Свернуть" : "Что было в заявке"}
                        </button>
                        {isOpen && (
                          <pre className="text-[11px] mt-1.5 p-2.5 rounded-lg whitespace-pre-wrap break-words leading-relaxed"
                            style={{ background: "rgba(255,255,255,0.04)", color: "#d4d4d4" }}>{text}</pre>
                        )}
                      </>
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

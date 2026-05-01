import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { DemoPipelineCompany } from "./wlTypes";
import { getWLToken } from "./WLManagerContext";

interface HistoryRow { id: number; amount: number; reason: string; created_at: string }

interface Props {
  company: DemoPipelineCompany;
  mode: "demo" | "est" | "info";
  onClose: () => void;
}

const masterToken = () => getWLToken();

const REASON_LABEL: Record<string, string> = {
  trial_signup:     "Стартовый баланс (триал)",
  admin_manual:     "Начислено вручную",
  admin_top_up:     "Пополнение от мастера",
  estimate_created: "Использована смета",
  package_purchase: "Куплен пакет смет",
};

const DEMO_DAYS = 10;
const fmt = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString("ru-RU", opts ?? { day: "numeric", month: "long", year: "numeric" });
const fmtT = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export function WLBalanceHistoryModal({ company, mode, onClose }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"demo" | "est">(mode === "est" ? "est" : "demo");

  useEffect(() => {
    fetch(`${AUTH_URL}?action=balance-history&user_id=${company.company_id}`, {
      headers: { "X-Authorization": masterToken() },
    })
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .finally(() => setLoading(false));
  }, [company.company_id]);

  // ── Демо данные ────────────────────────────────────────────────────────────
  const createdAt = new Date(company.created_at);
  const passed    = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  const daysLeft  = Math.max(0, DEMO_DAYS - passed);
  const endDate   = new Date(createdAt.getTime() + DEMO_DAYS * 86400000);
  const demoColor = daysLeft === 0 ? "#ef4444" : daysLeft <= 3 ? "#f59e0b" : "#06b6d4";

  // ── Сметы данные ───────────────────────────────────────────────────────────
  const used      = company.estimates_used || 0;
  const bal       = company.estimates_balance;
  const isRedFlag = used === 0;
  const boughtEst = bal > 10;

  // Начисления (плюс) и списания (минус) отдельно
  const additions  = history.filter(h => h.amount > 0);
  const deductions = history.filter(h => h.amount < 0);
  const totalAdded = additions.reduce((s, h) => s + h.amount, 0);

  // ── Агент ──────────────────────────────────────────────────────────────────
  // Куплен = статус paid (мастер подтвердил оплату и включил агента)
  // Триал = has_own_agent включён, но статус не paid (демо-доступ)
  const agentBought = company.status === "paid";
  const agentTrial  = company.has_own_agent && !agentBought;

  const isInfo = mode === "info";
  const title  = isInfo ? "Полная информация" : mode === "demo" ? "Демо-период" : "Сметы";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#0e0e1a", border: "1px solid rgba(139,92,246,0.25)", maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: (company.brand_color || "#8b5cf6") + "25", border: `1px solid ${(company.brand_color || "#8b5cf6")}40` }}>
            {company.brand_logo_url
              ? <img src={company.brand_logo_url} className="w-full h-full object-contain" alt="" />
              : <span className="text-sm font-black" style={{ color: company.brand_color || "#8b5cf6" }}>
                  {company.company_name[0]?.toUpperCase()}
                </span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{company.company_name}</div>
            <div className="text-[11px] text-white/35">{title} · ID #{company.company_id}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition p-1">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Вкладки (только для info-режима) */}
        {isInfo && (
          <div className="flex border-b border-white/[0.06] flex-shrink-0">
            {([
              { id: "demo", label: "Демо", icon: "Clock" },
              { id: "est",  label: "Сметы", icon: "Receipt" },
            ] as { id: "demo" | "est"; label: string; icon: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition"
                style={{
                  background: tab === t.id ? "rgba(139,92,246,0.1)" : "transparent",
                  color:      tab === t.id ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  borderBottom: tab === t.id ? "2px solid #a78bfa" : "2px solid transparent",
                }}>
                <Icon name={t.icon} size={12} /> {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Контент */}
        <div className="flex-1 overflow-y-auto">

          {/* ═══ ДЕМО-ВКЛАДКА ════════════════════════════════════════════════ */}
          {(tab === "demo" || mode === "demo") && (
            <div className="p-5 space-y-4">

              {/* Статус карточка */}
              <div className="rounded-xl p-4"
                style={{ background: demoColor + "10", border: `1px solid ${demoColor}30` }}>
                <div className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0">
                    <div className="text-3xl font-black leading-none" style={{ color: demoColor }}>
                      {daysLeft === 0 ? "✗" : daysLeft}
                    </div>
                    <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: demoColor + "80" }}>
                      {daysLeft === 0 ? "истёк" : "дн. осталось"}
                    </div>
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="text-[12px] font-bold text-white/80">
                      {daysLeft === 0 ? "Демо-период завершён" : "Демо-период активен"}
                    </div>
                    <div className="text-[10px] text-white/35">Длительность: {DEMO_DAYS} дней</div>
                    <div className="text-[10px] text-white/35">
                      {daysLeft === 0 ? "Истёк:" : "Истекает:"} {fmt(endDate.toISOString(), { day: "numeric", month: "long" })}
                    </div>
                  </div>
                </div>
                {/* Прогресс */}
                <div className="mt-3">
                  <div className="flex justify-between text-[9px] mb-1" style={{ color: demoColor + "80" }}>
                    <span>0</span>
                    <span>{Math.min(passed, DEMO_DAYS)}/{DEMO_DAYS} дней</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (passed / DEMO_DAYS) * 100)}%`, background: demoColor }} />
                  </div>
                </div>
              </div>

              {/* Хронология */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Хронология</div>
                <div className="space-y-0">
                  {/* Начало */}
                  <TimelineRow icon="Play" color="#a78bfa"
                    title="Компания создана · Демо выдано"
                    date={fmt(company.created_at)} time={fmtT(company.created_at)}
                    note={company.site_url.replace(/https?:\/\//, "").split("/")[0]} />
                  <TimelineLine />
                  {/* Агент */}
                  {agentBought ? (
                    <>
                      <TimelineRow icon="Bot" color="#10b981"
                        title="Агент куплен (оплачено)"
                        date={fmt(company.agent_purchased_at)} time="" note="" />
                      <TimelineLine />
                    </>
                  ) : null}
                  {/* Конец */}
                  <TimelineRow
                    icon={daysLeft === 0 ? "XCircle" : "Flag"}
                    color={daysLeft === 0 ? "#ef4444" : "rgba(255,255,255,0.2)"}
                    title={daysLeft === 0 ? "Демо-период истёк" : "Конец демо-периода"}
                    date={fmt(endDate.toISOString())}
                    time="" note="" />
                </div>
              </div>

              {/* Агент */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Агент (White Label)</div>
                <div className="rounded-xl p-3 flex items-center gap-3"
                  style={{
                    background: agentBought ? "rgba(16,185,129,0.08)" : agentTrial ? "rgba(6,182,212,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${agentBought ? "rgba(16,185,129,0.25)" : agentTrial ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  <Icon name={agentBought || agentTrial ? "Bot" : "BotOff"} size={18} style={{
                    color: agentBought ? "#10b981" : agentTrial ? "#06b6d4" : "rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }} />
                  <div className="flex-1">
                    <div className="text-[11px] font-bold" style={{
                      color: agentBought ? "#10b981" : agentTrial ? "#06b6d4" : "rgba(255,255,255,0.4)",
                    }}>
                      {agentBought ? "Куплен (подтверждена оплата)" : agentTrial ? "Выдан триал-доступ" : "Агент не выдан"}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {agentBought
                        ? "Мастер подтвердил оплату → статус «Оплатили»"
                        : agentTrial
                        ? "Доступ выдан в рамках демо, оплата не подтверждена"
                        : "Агент не активирован"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ СМЕТЫ-ВКЛАДКА ═══════════════════════════════════════════════ */}
          {(tab === "est" || mode === "est") && (
            <div className="p-5 space-y-4">

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Баланс",      value: bal,       color: bal > 0 ? "#10b981" : "#ef4444" },
                  { label: "Использовано", value: used,     color: used > 0 ? "#a78bfa" : "#ef4444" },
                  { label: "Начислено",   value: totalAdded, color: "#06b6d4" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{ background: s.color + "10", border: `1px solid ${s.color}25` }}>
                    <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: s.color + "70" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Ред флаг */}
              {isRedFlag && (
                <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <svg width="14" height="13" viewBox="0 0 14 13" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M7 1L13 12H1L7 1Z" fill="#ef4444"/>
                    <text x="7" y="10.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="white">!</text>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold" style={{ color: "#ef4444" }}>Ред флаг: сметы не используются</div>
                    <div className="text-[10px] text-white/40">Выдано {totalAdded} смет, но ни одной не создано</div>
                  </div>
                </div>
              )}

              {/* Пакеты */}
              {boughtEst && (
                <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                  style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <Icon name="ShoppingCart" size={14} style={{ color: "#a78bfa", flexShrink: 0 }} />
                  <div className="text-[11px] text-white/60">
                    Клиент докупил сметы сверх стартового пакета
                  </div>
                </div>
              )}

              {/* История транзакций */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/25 mb-2">История транзакций</div>
                {loading ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-white/30 text-xs">
                    <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />
                    Загрузка...
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-5 text-white/20 text-xs">Нет транзакций</div>
                ) : (
                  <div className="space-y-1">
                    {history.map((h, i) => {
                      const isPlus = h.amount > 0;
                      const color  = isPlus ? "#10b981" : "#ef4444";
                      const label  = REASON_LABEL[h.reason] || h.reason || "Операция";
                      return (
                        <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                          style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent" }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: color + "18" }}>
                            <Icon name={isPlus ? "Plus" : "Minus"} size={9} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-white/70 truncate">{label}</div>
                            <div className="text-[9px] text-white/30">
                              {fmt(h.created_at, { day: "numeric", month: "short" })} {fmtT(h.created_at)}
                            </div>
                          </div>
                          <div className="text-[12px] font-black flex-shrink-0" style={{ color }}>
                            {isPlus ? "+" : ""}{h.amount}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Вспомогательные компоненты хронологии ─────────────────────────────── */
function TimelineRow({ icon, color, title, date, time, note }: {
  icon: string; color: string; title: string; date: string; time: string; note: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: color + "20" }}>
        <Icon name={icon} size={10} style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-bold text-white/80">{title}</div>
        <div className="text-[10px] text-white/35">{date}{time ? ` · ${time}` : ""}</div>
        {note && <div className="text-[10px] text-white/20 mt-0.5">{note}</div>}
      </div>
    </div>
  );
}

function TimelineLine() {
  return <div className="ml-3 w-px h-4 bg-white/[0.07]" />;
}
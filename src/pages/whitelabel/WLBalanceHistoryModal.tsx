import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { DemoPipelineCompany } from "./wlTypes";

interface HistoryRow {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
}

interface Props {
  company: DemoPipelineCompany;
  mode: "demo" | "est";
  onClose: () => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

const REASON_LABEL: Record<string, string> = {
  trial_signup:     "Стартовый баланс",
  admin_manual:     "Начислено вручную",
  admin_top_up:     "Пополнение от мастера",
  estimate_created: "Смета создана",
  package_purchase: "Пакет куплен",
};

const DEMO_DAYS = 10;

export function WLBalanceHistoryModal({ company, mode, onClose }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode !== "est") { setLoading(false); return; }
    fetch(`${AUTH_URL}?action=balance-history&user_id=${company.company_id}`, {
      headers: { "X-Authorization": masterToken() },
    })
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .finally(() => setLoading(false));
  }, [company.company_id, mode]);

  // Данные для «Демо»
  const createdAt  = new Date(company.created_at);
  const passed     = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  const daysLeft   = Math.max(0, DEMO_DAYS - passed);
  const demoColor  = daysLeft === 0 ? "#ef4444" : daysLeft <= 3 ? "#f59e0b" : "#06b6d4";
  const endDate    = new Date(createdAt.getTime() + DEMO_DAYS * 86400000);

  const title  = mode === "demo" ? "История демо-периода" : "История баланса смет";
  const icon   = mode === "demo" ? "Clock" : "Receipt";
  const accent = mode === "demo" ? demoColor : "#a78bfa";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
        style={{ background: "#0e0e1a", border: `1px solid ${accent}30` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accent + "20" }}>
            <Icon name={icon} size={15} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-[11px] text-white/35 truncate">{company.company_name}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Режим ДЕМО ── */}
          {mode === "demo" && (
            <div className="space-y-3">
              {/* Статус */}
              <div className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: demoColor + "12", border: `1px solid ${demoColor}30` }}>
                <div className="text-center flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: demoColor }}>
                    {daysLeft === 0 ? "∞" : daysLeft}
                  </div>
                  <div className="text-[9px] uppercase" style={{ color: demoColor + "80" }}>
                    {daysLeft === 0 ? "истёк" : "дн. осталось"}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/50">Демо-период {DEMO_DAYS} дней</div>
                  <div className="text-[10px] text-white/30 mt-0.5">
                    Действует до {endDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Хронология */}
              <div className="space-y-1.5">
                {/* Начало */}
                <div className="flex items-start gap-3 py-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(139,92,246,0.2)" }}>
                    <Icon name="Play" size={10} style={{ color: "#a78bfa" }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-white/80">Демо-период начался</div>
                    <div className="text-[10px] text-white/35">
                      {createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                      {" · "}{createdAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5">{company.site_url}</div>
                  </div>
                </div>

                {/* Линия прогресса */}
                <div className="ml-3 pl-3 border-l border-white/[0.07]">
                  <div className="rounded-lg p-2.5 mb-1.5"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-white/30">Прошло дней</span>
                      <span className="text-[10px] font-bold" style={{ color: demoColor }}>
                        {Math.min(passed, DEMO_DAYS)} / {DEMO_DAYS}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (passed / DEMO_DAYS) * 100)}%`, background: demoColor }} />
                    </div>
                  </div>
                </div>

                {/* Конец */}
                <div className="flex items-start gap-3 py-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: daysLeft === 0 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)" }}>
                    <Icon name="Flag" size={10} style={{ color: daysLeft === 0 ? "#ef4444" : "rgba(255,255,255,0.2)" }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold"
                      style={{ color: daysLeft === 0 ? "#ef4444" : "rgba(255,255,255,0.3)" }}>
                      {daysLeft === 0 ? "Демо-период истёк" : "Конец демо-периода"}
                    </div>
                    <div className="text-[10px] text-white/35">
                      {endDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Режим СМЕТЫ ── */}
          {mode === "est" && (
            <div className="space-y-2">
              {/* Текущий баланс */}
              <div className="rounded-xl p-3 flex items-center gap-3 mb-4"
                style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <div className="text-center flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: "#a78bfa" }}>
                    {company.estimates_balance}
                  </div>
                  <div className="text-[9px] uppercase" style={{ color: "#a78bfa80" }}>смет</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/50">Текущий баланс</div>
                  <div className="text-[10px] text-white/30 mt-0.5">
                    {company.agent_purchased_at
                      ? `Агент куплен ${new Date(company.agent_purchased_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
                      : "Агент не куплен"}
                  </div>
                </div>
              </div>

              {/* История */}
              {loading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-white/30 text-xs">
                  <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />
                  Загрузка...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-6 text-white/20 text-xs">Нет транзакций</div>
              ) : (
                <div className="space-y-1.5">
                  {history.map((h, i) => {
                    const isPlus = h.amount > 0;
                    const color  = isPlus ? "#10b981" : "#ef4444";
                    const label  = REASON_LABEL[h.reason] || h.reason || "Операция";
                    const date   = new Date(h.created_at);
                    return (
                      <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                        style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: color + "15" }}>
                          <Icon name={isPlus ? "Plus" : "Minus"} size={10} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-white/70 truncate">{label}</div>
                          <div className="text-[9px] text-white/30">
                            {date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                            {" "}{date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div className="text-[12px] font-black flex-shrink-0"
                          style={{ color }}>
                          {isPlus ? "+" : ""}{h.amount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

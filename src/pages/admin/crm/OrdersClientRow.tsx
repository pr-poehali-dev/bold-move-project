import { useState } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";

function InstallProgress({ client }: { client: Client }) {
  const allSubs = useSubstatuses();
  const steps = allSubs.filter(s => s.parent_status === "installs");
  if (steps.length === 0) return null;
  const idx = steps.findIndex(s => String(s.id) === client.sub_status);
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: i <= idx ? s.color : "rgba(128,128,128,0.2)" }} />
          {i < steps.length - 1 && <div className="w-2 h-px" style={{ background: i < idx ? s.color : "rgba(128,128,128,0.15)" }} />}
        </div>
      ))}
      {idx >= 0 && (
        <span className="ml-1 text-[9px] font-medium" style={{ color: steps[idx].color }}>
          {steps[idx].label}
        </span>
      )}
    </div>
  );
}

export function OrdersClientRow({ c, onClick, onNextStep }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const nextStatus  = NEXT_STATUS[c.status];
  const nextLabel   = NEXT_LABEL[c.status];
  const tab         = ORDERS_TABS.find(tb => tb.statuses.includes(c.status));
  const isInstall   = tab?.id === "installs";
  const isDone      = c.status === "done";
  const isCancelled = c.status === "cancelled";

  const contractSum = Number(c.contract_sum) || 0;
  const prepayment  = Number(c.prepayment) || 0;
  const extraPay    = Number(c.extra_payment) || 0;
  const income      = contractSum + prepayment + extraPay;
  const paid        = prepayment + extraPay;
  const debt        = contractSum - paid;
  const costs       = (Number(c.material_cost)||0) + (Number(c.measure_cost)||0) + (Number(c.install_cost)||0);
  const profit      = income - costs;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  const title = localStorage.getItem(`order_title_${c.id}`) || `Заявка №${c.id}`;
  const color = STATUS_COLORS[c.status];

  return (
    <>
      {/* ── МОБИЛЕ: компактная карточка ──────────────────────────────── */}
      <div className="sm:hidden rounded-xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${color}60` }}>

        <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer active:opacity-75 transition"
          onClick={onClick}>
          {/* Левая часть */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold truncate" style={{ color: t.text }}>{title}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {c.client_name && (
                <span className="text-xs" style={{ color: t.textMute }}>{c.client_name}</span>
              )}
              {c.phone && (
                <span className="text-xs" style={{ color: t.textMute }}>{c.phone}</span>
              )}
            </div>
            {c.address && (
              <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: t.textSub }}>
                <Icon name="MapPin" size={9} style={{ color: "#f59e0b", flexShrink: 0 }} />
                <span className="truncate">{c.address}</span>
              </div>
            )}
          </div>

          {/* Правая часть */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {isInstall
              ? <InstallProgress client={c} />
              : <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                  style={{ background: color + "20", color }}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>
            }
            {income > 0 && (
              <span className="text-xs font-bold text-emerald-500">{income.toLocaleString("ru-RU")} ₽</span>
            )}
            {debt > 0 && !isDone && !isCancelled && (
              <span className="text-[10px] text-red-400">долг {debt.toLocaleString("ru-RU")} ₽</span>
            )}
          </div>

          <Icon name="ChevronRight" size={14} style={{ color: t.textMute, flexShrink: 0 }} />
        </div>

        {/* Кнопка следующего шага — на всю ширину */}
        {nextStatus && !isDone && !isCancelled && (
          <button onClick={handleNext} disabled={stepping}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold transition active:opacity-70 disabled:opacity-50"
            style={{ borderTop: `1px solid ${t.border2}`, background: STATUS_COLORS[nextStatus] + "0a", color: STATUS_COLORS[nextStatus] }}>
            <span className="flex items-center gap-1.5">
              <Icon name="ArrowRight" size={11} />
              {stepping ? "Обновление..." : nextLabel}
            </span>
            <Icon name="ChevronRight" size={12} style={{ color: STATUS_COLORS[nextStatus] + "70" }} />
          </button>
        )}
        {isDone && (
          <div className="px-3 py-2 text-xs font-semibold text-emerald-500 flex items-center gap-1.5"
            style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.05)" }}>
            <Icon name="CheckCircle2" size={11} /> Завершён
            {contractSum > 0 && <span className="ml-auto">{contractSum.toLocaleString("ru-RU")} ₽</span>}
          </div>
        )}
      </div>

      {/* ── ДЕСКТОП: горизонтальная строка ───────────────────────────── */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:brightness-[1.04] transition"
        style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${color}50` }}
        onClick={onClick}>

        {/* Клиент */}
        <div className="w-44 min-w-0 flex-shrink-0">
          <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{title}</div>
          {(c.client_name || c.phone) && (
            <div className="text-xs truncate" style={{ color: t.textMute }}>
              {[c.client_name, c.phone].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        {/* Статус */}
        <div className="w-36 flex-shrink-0">
          {isInstall
            ? <InstallProgress client={c} />
            : <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: color + "20", color }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
          }
          {(c.measure_date && !isInstall) && (
            <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: "#f59e0b" }}>
              <Icon name="Ruler" size={9} />
              <span>{new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              <span className="opacity-50">замер</span>
            </div>
          )}
          {(c.install_date && isInstall) && (
            <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: "#f97316" }}>
              <Icon name="Wrench" size={9} />
              <span>{new Date(c.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              <span className="opacity-50">монтаж</span>
            </div>
          )}
        </div>

        {/* Объект */}
        <div className="flex-1 min-w-0">
          {c.address ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: t.textSub }}>
              <Icon name="MapPin" size={10} style={{ color: "#f59e0b" }} className="flex-shrink-0" />
              <span className="truncate">{c.address}</span>
            </div>
          ) : <span className="text-xs" style={{ color: t.textMute }}>—</span>}
          {c.area && (
            <div className="text-[10px] mt-0.5" style={{ color: t.textMute }}>
              Площадь: <b>{c.area} м²</b>
            </div>
          )}
        </div>

        {/* Финансы */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {income > 0 ? (
            <>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Доходы</div>
                <div className="text-sm font-bold text-emerald-500">{income.toLocaleString("ru-RU")} ₽</div>
              </div>
              {costs > 0 && (
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Затраты</div>
                  <div className="text-xs font-semibold" style={{ color: "#f97316" }}>{costs.toLocaleString("ru-RU")} ₽</div>
                </div>
              )}
              {debt > 0 && !isDone && !isCancelled && (
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Долг</div>
                  <div className="text-xs font-semibold text-red-400">{debt.toLocaleString("ru-RU")} ₽</div>
                </div>
              )}
              {(income > 0 || costs > 0) && (
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Прибыль</div>
                  <div className="text-xs font-semibold" style={{ color: profit >= 0 ? "#a78bfa" : "#ef4444" }}>
                    {profit >= 0 ? "+" : ""}{profit.toLocaleString("ru-RU")} ₽
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs" style={{ color: t.textMute }}>Сумма не указана</div>
          )}
        </div>

        {/* Кнопка */}
        <div className="flex-shrink-0 w-36" onClick={e => e.stopPropagation()}>
          {nextStatus && !isDone && !isCancelled && (
            <button onClick={handleNext} disabled={stepping}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              style={{ background: STATUS_COLORS[nextStatus] + "18", color: STATUS_COLORS[nextStatus], border: `1px solid ${STATUS_COLORS[nextStatus]}30` }}>
              {stepping
                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <><Icon name="ArrowRight" size={11} /> {nextLabel}</>}
            </button>
          )}
          {isDone && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
              <Icon name="CheckCircle2" size={12} /> Завершён
            </span>
          )}
          {isCancelled && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <Icon name="XCircle" size={12} /> Отказ
            </span>
          )}
        </div>
      </div>
    </>
  );
}
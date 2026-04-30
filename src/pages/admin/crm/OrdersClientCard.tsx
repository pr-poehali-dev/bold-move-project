import { useState } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS, crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";

function SubstatusPills({ client, tabId, onUpdate }: { client: Client; tabId: string; onUpdate: (subStatus: string | null) => void }) {
  const allSubs = useSubstatuses();
  const steps = allSubs.filter(s => s.parent_status === tabId);
  if (steps.length === 0) return null;
  const current = client.sub_status;

  const handleClick = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const newVal = current === String(id) ? null : String(id);
    onUpdate(newVal);
    await crmFetch("clients", {
      method: "PUT",
      body: JSON.stringify({ sub_status: newVal }),
    }, { id: String(client.id) });
  };

  return (
    <div className="flex flex-wrap gap-1 mt-2" onClick={e => e.stopPropagation()}>
      {steps.map(s => {
        const active = current === String(s.id);
        return (
          <button key={s.id} onClick={e => handleClick(e, s.id)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition"
            style={{
              background: active ? s.color + "25" : "rgba(128,128,128,0.08)",
              color: active ? s.color : "rgba(150,150,150,0.7)",
              border: `1px solid ${active ? s.color + "60" : "transparent"}`,
            }}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// Метрика с подписью
function Metric({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  const t = useTheme();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: t.textMute }}>{label}</span>
      <span className="text-xs font-bold flex items-center gap-1" style={{ color: color || t.text }}>
        {icon && <Icon name={icon} size={10} style={{ color }} />}
        {value}
      </span>
    </div>
  );
}

export function OrdersClientCard({ c, onClick, onNextStep }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const [localSubStatus, setLocalSubStatus] = useState<string | null>(c.sub_status ?? null);
  const clientWithSub = { ...c, sub_status: localSubStatus };
  const tab         = ORDERS_TABS.find(tb => tb.statuses.includes(c.status));
  const isInstall   = tab?.id === "installs";
  const isCancelled = c.status === "cancelled";
  const isDone      = c.status === "done";
  const nextStatus  = NEXT_STATUS[c.status];
  const nextLabel   = NEXT_LABEL[c.status];

  const contractSum = Number(c.contract_sum) || 0;
  const prepayment  = Number(c.prepayment) || 0;
  const extraPay    = Number(c.extra_payment) || 0;
  const income      = contractSum + prepayment + extraPay;
  const paid        = prepayment + extraPay;
  const costs       = (Number(c.material_cost)||0) + (Number(c.measure_cost)||0) + (Number(c.install_cost)||0);
  const debt        = contractSum - paid;
  const profit      = income - costs;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden transition flex flex-col"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Шапка */}
      <div className="p-3 sm:p-4 cursor-pointer hover:brightness-[1.03] transition flex-1" onClick={onClick}>

        {/* Клиент */}
        <div className="flex items-start mb-3">
          <div className="flex-1 min-w-0">
            {/* Заголовок + статус в одной строке */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold truncate" style={{ color: t.text }}>
                {localStorage.getItem(`order_title_${c.id}`) || `Заявка №${c.id}`}
              </span>
              {isInstall
                ? <InstallProgress client={clientWithSub} />
                : <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                    style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
              }
            </div>
            <div className="space-y-1 mt-1.5">
              {c.client_name && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: t.surface2 }}>
                  <Icon name="User" size={10} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                  <span className="truncate" style={{ color: t.textSub }}>{c.client_name}</span>
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: t.surface2 }}>
                  <Icon name="Phone" size={10} style={{ color: "#10b981", flexShrink: 0 }} />
                  <span className="truncate" style={{ color: t.textSub }}>{c.phone}</span>
                </div>
              )}
              {(c.address || c.area) && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: t.surface2 }}>
                  <Icon name="MapPin" size={10} style={{ color: "#f59e0b", flexShrink: 0 }} />
                  <span className="truncate flex-1" style={{ color: t.textSub }}>{c.address || "Адрес не указан"}</span>
                  {c.area && <span className="flex-shrink-0 text-[10px] font-medium" style={{ color: t.textMute }}>{c.area} м²</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Даты */}
        {(c.measure_date || c.install_date) && (
          <div className="flex gap-2 mb-3">
            {c.measure_date && (
              <div className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md"
                style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                <Icon name="Ruler" size={9} />
                <div>
                  <div className="font-medium">{new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                  <div className="opacity-60">Замер</div>
                </div>
              </div>
            )}
            {c.install_date && (
              <div className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md"
                style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                <Icon name="Wrench" size={9} />
                <div>
                  <div className="font-medium">{new Date(c.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                  <div className="opacity-60">Монтаж</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Подстатусы — только для монтажей */}
        {isInstall && tab && (
          <SubstatusPills client={clientWithSub} tabId={tab.id} onUpdate={setLocalSubStatus} />
        )}

        {/* Финансы */}
        {income > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-2.5 mt-1" style={{ borderTop: `1px solid ${t.border2}` }}>
            <Metric label="Доходы"  value={`${income.toLocaleString("ru-RU")} ₽`} color="#10b981" icon="TrendingUp" />
            <Metric label="Затраты" value={costs > 0 ? `${costs.toLocaleString("ru-RU")} ₽` : "—"} color={costs > 0 ? "#f97316" : undefined} icon="TrendingDown" />
            <Metric label={profit >= 0 ? "Прибыль" : "Убыток"} value={profit !== 0 ? `${Math.abs(profit).toLocaleString("ru-RU")} ₽` : "—"} color={profit > 0 ? "#a78bfa" : profit < 0 ? "#ef4444" : undefined} icon={profit >= 0 ? "TrendingUp" : "TrendingDown"} />
          </div>
        )}

        {/* Долг */}
        {contractSum > 0 && debt > 0 && !isDone && !isCancelled && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] px-2 py-1 rounded-md"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
            <Icon name="AlertCircle" size={10} />
            <span>Долг: <b>{debt.toLocaleString("ru-RU")} ₽</b></span>
          </div>
        )}

        {isCancelled && c.cancel_reason && (
          <div className="mt-2 text-[10px] px-2.5 py-1.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444" }}>
            Причина отказа: {c.cancel_reason}
          </div>
        )}
      </div>

      {/* Кнопка следующего шага */}
      {nextStatus && !isDone && !isCancelled && (
        <button onClick={handleNext} disabled={stepping}
          className="w-full flex items-center justify-between px-4 py-3 sm:py-2.5 transition disabled:opacity-60 active:opacity-70"
          style={{ borderTop: `1px solid ${t.border2}`, background: STATUS_COLORS[nextStatus] + "08" }}>
          {stepping ? (
            <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: STATUS_COLORS[nextStatus] }}>
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> Обновление...
            </span>
          ) : (
            <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: STATUS_COLORS[nextStatus] }}>
              <Icon name="ArrowRight" size={11} />
              {nextLabel}
            </span>
          )}
          <Icon name="ChevronRight" size={13} style={{ color: STATUS_COLORS[nextStatus] + "80" }} />
        </button>
      )}

      {isDone && (
        <div className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-emerald-500"
          style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
          <span className="flex items-center gap-1.5"><Icon name="CheckCircle2" size={12} /> Заказ завершён</span>
          {contractSum > 0 && <span className="text-emerald-400">{contractSum.toLocaleString("ru-RU")} ₽</span>}
        </div>
      )}
    </div>
  );
}
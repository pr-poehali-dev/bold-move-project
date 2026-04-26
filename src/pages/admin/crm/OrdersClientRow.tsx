import { useState } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, INSTALL_STEPS, ORDERS_TABS } from "./ordersTypes";

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "25", border: `1.5px solid ${color}50`, color }}>
      {initials}
    </div>
  );
}

function InstallProgress({ status }: { status: string }) {
  const idx = INSTALL_STEPS.findIndex(s => s.status === status);
  return (
    <div className="flex items-center gap-0.5">
      {INSTALL_STEPS.map((s, i) => (
        <div key={s.status} className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: i <= idx ? s.color : "rgba(128,128,128,0.2)" }} />
          {i < INSTALL_STEPS.length - 1 && <div className="w-2 h-px" style={{ background: i < idx ? s.color : "rgba(128,128,128,0.15)" }} />}
        </div>
      ))}
      <span className="ml-1 text-[9px] font-medium" style={{ color: INSTALL_STEPS[idx]?.color }}>
        {INSTALL_STEPS[idx]?.label}
      </span>
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
  const paid        = (Number(c.prepayment) || 0) + (Number(c.extra_payment) || 0);
  const debt        = contractSum - paid;
  const costs       = (Number(c.material_cost)||0) + (Number(c.measure_cost)||0) + (Number(c.install_cost)||0);
  const profit      = contractSum - costs;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:brightness-[1.04] transition"
      style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${STATUS_COLORS[c.status]}50` }}
      onClick={onClick}>

      <Avatar name={c.client_name} />

      {/* Клиент */}
      <div className="w-44 min-w-0 flex-shrink-0">
        <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
        <div className="text-xs truncate" style={{ color: t.textMute }}>{c.phone || "—"}</div>
      </div>

      {/* Статус */}
      <div className="w-36 flex-shrink-0">
        {isInstall
          ? <InstallProgress status={c.status} />
          : <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
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
        {contractSum > 0 ? (
          <>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Договор</div>
              <div className="text-sm font-bold text-emerald-500">{contractSum.toLocaleString("ru-RU")} ₽</div>
            </div>
            {paid > 0 && (
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Оплачено</div>
                <div className="text-xs font-semibold" style={{ color: "#06b6d4" }}>{paid.toLocaleString("ru-RU")} ₽</div>
              </div>
            )}
            {debt > 0 && !isDone && !isCancelled && (
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wide" style={{ color: t.textMute }}>Долг</div>
                <div className="text-xs font-semibold text-red-400">{debt.toLocaleString("ru-RU")} ₽</div>
              </div>
            )}
            {costs > 0 && (
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
  );
}

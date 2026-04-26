import { useState } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS, INSTALL_STEPS } from "./ordersTypes";

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "25", border: `1.5px solid ${color}40`, color: "#fff" }}>
      {initials}
    </div>
  );
}

// ── InstallProgress ───────────────────────────────────────────────────────────
function InstallProgress({ status }: { status: string }) {
  const idx = INSTALL_STEPS.findIndex(s => s.status === status);
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {INSTALL_STEPS.map((s, i) => (
        <div key={s.status} className="flex items-center gap-0.5">
          <div className="w-2 h-2 rounded-full transition-all"
            style={{ background: i <= idx ? s.color : "rgba(128,128,128,0.2)" }} />
          {i < INSTALL_STEPS.length - 1 && (
            <div className="w-3 h-px" style={{ background: i < idx ? s.color : "rgba(128,128,128,0.15)" }} />
          )}
        </div>
      ))}
      <span className="ml-1.5 text-[10px] font-medium" style={{ color: INSTALL_STEPS[idx]?.color || "#999" }}>
        {INSTALL_STEPS[idx]?.label || ""}
      </span>
    </div>
  );
}

// ── ClientCard ────────────────────────────────────────────────────────────────
export function OrdersClientCard({ c, onClick, onNextStep }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const tab         = ORDERS_TABS.find(tb => tb.statuses.includes(c.status));
  const isInstall   = tab?.id === "installs";
  const isCancelled = c.status === "cancelled";
  const isDone      = c.status === "done";
  const nextStatus  = NEXT_STATUS[c.status];
  const nextLabel   = NEXT_LABEL[c.status];

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden transition group"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      <div className="p-4 cursor-pointer hover:brightness-[1.03] transition" onClick={onClick}>
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={c.client_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</span>
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: t.textMute }}>#{c.id}</span>
            </div>
            <div className="text-xs truncate mt-0.5" style={{ color: t.textMute }}>{c.phone || "—"}</div>
            {isInstall && <InstallProgress status={c.status} />}
            {!isInstall && (
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            )}
          </div>
        </div>

        {(c.address || c.area) && (
          <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: t.textMute }}>
            <Icon name="MapPin" size={10} className="flex-shrink-0" />
            <span className="truncate">{c.address || "—"}</span>
            {c.area && <span className="flex-shrink-0">· {c.area} м²</span>}
          </div>
        )}

        {c.measure_date && !isInstall && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500/70 mb-2">
            <Icon name="Calendar" size={10} />
            <span>{new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
        {c.install_date && isInstall && (
          <div className="flex items-center gap-1.5 text-xs text-orange-500/70 mb-2">
            <Icon name="Wrench" size={10} />
            <span>{new Date(c.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        {(c.contract_sum || c.prepayment || c.extra_payment) && (
          <div className="flex items-center justify-between text-xs pt-2.5 mt-1"
            style={{ borderTop: `1px solid ${t.border2}` }}>
            {c.contract_sum
              ? <span className="font-bold text-emerald-500">{Number(c.contract_sum).toLocaleString("ru-RU")} ₽</span>
              : <span />}
            {(c.prepayment || c.extra_payment) && (
              <span style={{ color: t.textMute }}>
                оплачено {((Number(c.prepayment)||0)+(Number(c.extra_payment)||0)).toLocaleString("ru-RU")} ₽
              </span>
            )}
          </div>
        )}

        {isCancelled && c.cancel_reason && (
          <div className="mt-2 text-[11px] text-red-400/60 rounded-lg px-2.5 py-1.5"
            style={{ background: "rgba(239,68,68,0.07)" }}>
            Отказ: {c.cancel_reason}
          </div>
        )}
      </div>

      {nextStatus && !isDone && !isCancelled && (
        <button onClick={handleNext} disabled={stepping}
          className="w-full flex items-center justify-between px-4 py-2.5 transition group/btn disabled:opacity-60"
          style={{ borderTop: `1px solid ${t.border2}`, background: STATUS_COLORS[nextStatus] + "08" }}>
          <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[nextStatus] }}>
            {stepping
              ? <span className="flex items-center gap-1.5"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> Обновление...</span>
              : nextLabel}
          </span>
          <span className="text-[10px] opacity-60 font-mono"
            style={{ background: STATUS_COLORS[nextStatus] + "20", borderRadius: 4, padding: "1px 5px" }}>
            {STATUS_LABELS[nextStatus]}
          </span>
        </button>
      )}

      {isDone && (
        <div className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-500"
          style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
          <Icon name="CheckCircle2" size={12} /> Заказ завершён
        </div>
      )}
    </div>
  );
}
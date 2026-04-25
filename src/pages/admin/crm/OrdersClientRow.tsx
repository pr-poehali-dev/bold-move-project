import { useState } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL } from "./ordersTypes";

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

export function OrdersClientRow({ c, onClick, onNextStep }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const nextStatus = NEXT_STATUS[c.status];
  const nextLabel  = NEXT_LABEL[c.status];

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:brightness-[1.04] transition group"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
      onClick={onClick}>
      <Avatar name={c.client_name} />
      <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
          <div className="text-xs truncate" style={{ color: t.textMute }}>{c.phone || "—"}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs truncate" style={{ color: t.textMute }}>{c.address || "—"}</div>
          {c.area && <div className="text-xs" style={{ color: t.textMute }}>{c.area} м²</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-md font-medium"
            style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
            {STATUS_LABELS[c.status] || c.status}
          </span>
          {c.contract_sum ? (
            <span className="text-xs font-bold text-emerald-500">{c.contract_sum.toLocaleString("ru-RU")} ₽</span>
          ) : null}
        </div>
        <div onClick={e => e.stopPropagation()}>
          {nextStatus && c.status !== "done" && c.status !== "cancelled" && (
            <button onClick={handleNext} disabled={stepping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 whitespace-nowrap"
              style={{ background: STATUS_COLORS[nextStatus] + "18", color: STATUS_COLORS[nextStatus] }}>
              {stepping
                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <><Icon name="ArrowRight" size={11} /> {nextLabel}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

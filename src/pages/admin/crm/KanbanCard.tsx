import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, INSTALL_STEPS } from "./kanbanTypes";
import { ORDERS_TABS } from "./ordersTypes";

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "30", border: `1.5px solid ${color}50`, color }}>
      {initials}
    </div>
  );
}

function InstallProgress({ status, color }: { status: string; color: string }) {
  const idx = INSTALL_STEPS.findIndex(s => s.status === status);
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {INSTALL_STEPS.map((s, i) => (
        <div key={s.status} className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full transition-all"
            style={{ background: i <= idx ? color : "rgba(128,128,128,0.2)" }} />
          {i < INSTALL_STEPS.length - 1 && (
            <div className="w-2 h-px" style={{ background: i < idx ? color : "rgba(128,128,128,0.15)" }} />
          )}
        </div>
      ))}
      <span className="ml-1 text-[9px] font-medium" style={{ color }}>
        {INSTALL_STEPS[idx]?.label}
      </span>
    </div>
  );
}

interface Props {
  client: Client;
  colColor?: string;
  onOpen: () => void;
  onNextStep: (id: number, status: string) => void;
  dragging: boolean;
}

export default function KanbanCard({ client, colColor, onOpen, onNextStep, dragging }: Props) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const color = colColor || STATUS_COLORS[client.status] || "#8b5cf6";
  const next = NEXT_STATUS[client.status];
  const nextLabel = NEXT_LABEL[client.status];

  const tab       = ORDERS_TABS.find(tb => tb.statuses.includes(client.status));
  const isInstall = tab?.id === "installs";
  const isDone    = client.status === "done";

  const contractSum = Number(client.contract_sum) || 0;
  const paid        = (Number(client.prepayment) || 0) + (Number(client.extra_payment) || 0);
  const debt        = contractSum - paid;
  const costs       = (Number(client.material_cost)||0) + (Number(client.measure_cost)||0) + (Number(client.install_cost)||0);
  const profit      = contractSum - costs;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!next || stepping) return;
    setStepping(true);
    await onNextStep(client.id, next);
    setStepping(false);
  };

  return (
    <div
      draggable
      onClick={onOpen}
      className={`rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition select-none ${dragging ? "opacity-40 scale-95" : ""}`}
      style={{ background: t.surface, border: `1px solid ${color}25`, borderLeft: `3px solid ${color}` }}>

      {/* Тело */}
      <div className="p-3">
        {/* Шапка клиента */}
        <div className="flex items-start gap-2 mb-2">
          <Avatar name={client.client_name || "?"} color={color} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold truncate" style={{ color: t.text }}>
                {client.client_name || "Без имени"}
              </span>
              <span className="text-[9px] font-mono flex-shrink-0" style={{ color: t.textMute }}>#{client.id}</span>
            </div>
            {client.phone && (
              <div className="text-[10px] truncate" style={{ color: t.textMute }}>{client.phone}</div>
            )}
          </div>
        </div>

        {/* Статус */}
        {isInstall
          ? <InstallProgress status={client.status} color={color} />
          : <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-md font-medium mb-2"
              style={{ background: color + "20", color }}>
              {STATUS_LABELS[client.status] || client.status}
            </span>
        }

        {/* Адрес + площадь */}
        {(client.address || client.area) && (
          <div className="flex items-center gap-1 text-[10px] mt-1.5 mb-1" style={{ color: t.textMute }}>
            <Icon name="MapPin" size={9} style={{ color: "#f59e0b" }} className="flex-shrink-0" />
            {client.address && <span className="truncate flex-1">{client.address}</span>}
            {client.area && <span className="flex-shrink-0 font-medium">{client.area} м²</span>}
          </div>
        )}

        {/* Даты */}
        {(client.measure_date || client.install_date) && (
          <div className="flex gap-1.5 mt-1 mb-1">
            {client.measure_date && (
              <div className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                <Icon name="Ruler" size={8} />
                <span>{new Date(client.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              </div>
            )}
            {client.install_date && (
              <div className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                <Icon name="Wrench" size={8} />
                <span>{new Date(client.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              </div>
            )}
          </div>
        )}

        {/* Финансы */}
        {contractSum > 0 && (
          <div className="mt-2 pt-2 grid grid-cols-2 gap-x-2 gap-y-1" style={{ borderTop: `1px solid ${t.border2}` }}>
            <div>
              <div className="text-[8px] uppercase tracking-wide" style={{ color: t.textMute }}>Договор</div>
              <div className="text-xs font-bold text-emerald-500">{contractSum.toLocaleString("ru-RU")} ₽</div>
            </div>
            {paid > 0 && (
              <div>
                <div className="text-[8px] uppercase tracking-wide" style={{ color: t.textMute }}>Оплачено</div>
                <div className="text-xs font-semibold" style={{ color: "#06b6d4" }}>{paid.toLocaleString("ru-RU")} ₽</div>
              </div>
            )}
            {debt > 0 && !isDone && (
              <div>
                <div className="text-[8px] uppercase tracking-wide" style={{ color: t.textMute }}>Долг</div>
                <div className="text-xs font-semibold text-red-400">{debt.toLocaleString("ru-RU")} ₽</div>
              </div>
            )}
            {costs > 0 && (
              <div>
                <div className="text-[8px] uppercase tracking-wide" style={{ color: t.textMute }}>Прибыль</div>
                <div className="text-xs font-semibold" style={{ color: profit >= 0 ? "#a78bfa" : "#ef4444" }}>
                  {profit >= 0 ? "+" : ""}{profit.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Кнопка следующего шага */}
      {next && !isDone && client.status !== "cancelled" && (
        <button onClick={handleNext} disabled={stepping}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold transition disabled:opacity-50"
          style={{ borderTop: `1px solid ${t.border2}`, background: color + "0c", color }}>
          <span className="flex items-center gap-1">
            {stepping
              ? <><div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> Сохраняем...</>
              : <><Icon name="ArrowRight" size={10} /> {nextLabel}</>}
          </span>
          <span className="opacity-50">{STATUS_LABELS[next]}</span>
        </button>
      )}
      {isDone && (
        <div className="px-3 py-2 text-[10px] font-semibold text-emerald-500 flex items-center justify-between"
          style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
          <span className="flex items-center gap-1"><Icon name="CheckCircle2" size={10} /> Завершён</span>
          {contractSum > 0 && <span>{contractSum.toLocaleString("ru-RU")} ₽</span>}
        </div>
      )}
    </div>
  );
}

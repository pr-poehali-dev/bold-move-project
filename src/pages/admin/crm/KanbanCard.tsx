import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL } from "./kanbanTypes";

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white"
      style={{ background: color + "40", border: `1.5px solid ${color}60` }}>
      {initials}
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
      style={{ background: t.surface, border: `1px solid ${color}35`, borderLeft: `3px solid ${color}` }}>

      {/* Тело карточки */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <Avatar name={client.client_name || "?"} color={color} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: t.text }}>
              {client.client_name || "Без имени"}
            </div>
            {client.phone && (
              <div className="text-[10px] truncate mt-0.5" style={{ color: t.textMute }}>{client.phone}</div>
            )}
          </div>
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: t.textMute }}>#{client.id}</span>
        </div>

        {/* Статус бейдж */}
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md font-medium mb-2"
          style={{ background: color + "20", color }}>
          {STATUS_LABELS[client.status] || client.status}
        </span>

        {/* Адрес */}
        {client.address && (
          <div className="flex items-center gap-1 text-[10px] mb-1.5" style={{ color: t.textMute }}>
            <Icon name="MapPin" size={9} />
            <span className="truncate">{client.address}</span>
          </div>
        )}

        {/* Сумма */}
        {client.contract_sum ? (
          <div className="text-xs font-bold text-emerald-500">{Number(client.contract_sum).toLocaleString("ru-RU")} ₽</div>
        ) : null}
      </div>

      {/* Кнопка следующего шага */}
      {next && client.status !== "done" && client.status !== "cancelled" && (
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
      {client.status === "done" && (
        <div className="px-3 py-2 text-[10px] font-semibold text-emerald-500 flex items-center gap-1"
          style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
          <Icon name="CheckCircle2" size={10} /> Завершён
        </div>
      )}
    </div>
  );
}
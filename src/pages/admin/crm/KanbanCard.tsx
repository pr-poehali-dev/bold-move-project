import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS, Client, stageDuration } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL } from "./kanbanTypes";
import { ORDERS_TABS } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";
import { useOrderSourcesCtx, sourceDisplay } from "./orderSourcesContext";
import { SubstatusPicker } from "./SubstatusPicker";


function InstallProgress({ client, color }: { client: Client; color: string }) {
  const allSubs = useSubstatuses();
  const steps = allSubs.filter(s => s.parent_status === "installs");
  if (steps.length === 0) return null;
  const idx = steps.findIndex(s => String(s.id) === client.sub_status);
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full transition-all"
            style={{ background: i <= idx ? color : "rgba(128,128,128,0.2)" }} />
          {i < steps.length - 1 && (
            <div className="w-2 h-px" style={{ background: i < idx ? color : "rgba(128,128,128,0.15)" }} />
          )}
        </div>
      ))}
      {idx >= 0 && (
        <span className="ml-1 text-[9px] font-medium" style={{ color }}>
          {steps[idx].label}
        </span>
      )}
    </div>
  );
}

interface Props {
  client: Client;
  colColor?: string;
  onOpen: () => void;
  onNextStep: (id: number, status: string) => void;
  onSaveSubStatus?: (id: number, subStatusId: number) => void;
  dragging: boolean;
}

export default function KanbanCard({ client, colColor, onOpen, onNextStep, onSaveSubStatus, dragging }: Props) {
  const t = useTheme();
  const sources = useOrderSourcesCtx();
  const src = sourceDisplay(client.source, sources);
  const allSubs = useSubstatuses();
  const [stepping, setStepping] = useState(false);
  const color = colColor || STATUS_COLORS[client.status] || "#8b5cf6";
  const next = NEXT_STATUS[client.status];
  const nextLabel = NEXT_LABEL[client.status];

  const tab       = ORDERS_TABS.find(tb => tb.statuses.includes(client.status));
  const isInstall = tab?.id === "installs";
  const isDone    = client.status === "done";
  const activeSub  = tab ? allSubs.find(s => s.parent_status === tab.id && String(s.id) === client.sub_status) : undefined;
  const subsForTab = tab ? allSubs.filter(s => s.parent_status === tab.id) : [];

  const contractSum = Number(client.contract_sum) || 0;
  const prepayment  = Number(client.prepayment) || 0;
  const extraPay    = Number(client.extra_payment) || 0;
  const income      = contractSum;
  const paidPre   = client.prepayment_confirmed ? (Number(client.prepayment_fact) || prepayment) : 0;
  const paidExtra = client.extra_payment_confirmed ? (Number(client.extra_payment_fact) || extraPay) : 0;
  const paid        = paidPre + paidExtra;
  const debt        = contractSum - paid;
  const costs       = (Number(client.material_cost)||0) + (Number(client.measure_cost)||0) + (Number(client.install_cost)||0);
  const profit      = income - costs;

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
        {/* Заголовок + статус в одной строке */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold truncate" style={{ color: t.text }}>
              {localStorage.getItem(`order_title_${client.id}`) || `Заявка №${client.id}`}
            </span>
            {(() => {
              // Единый "якорь" текущего времени для всех трёх счётчиков — иначе на
              // границе минуты значения расходятся (52/53/53) хотя from одинаковый.
              const now = Date.now();
              // Последнее действие — любое касание заявки (правка карточки, звонок,
              // сообщение), приходит с бэкенда уже готовым (GREATEST по нескольким источникам).
              const lastAction = stageDuration(client.last_activity_at, now);
              const onStage = client.status !== "done" && client.status !== "cancelled" ? stageDuration(client.status_changed_at, now) : "";
              const age = stageDuration(client.created_at, now);
              if (!lastAction && !onStage && !age) return null;
              return (
                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                  style={{ background: t.surface2, border: `1px solid ${t.border}` }}
                  title={`Последнее действие: ${lastAction || "—"} · На этапе: ${onStage || "—"} · Возраст заявки: ${age || "—"}`}>
                  <Icon name="Clock" size={9} style={{ color: t.accentLight }} />
                  {lastAction && <span style={{ color: t.text }}>{lastAction}</span>}
                  {lastAction && (onStage || age) && <span style={{ color: t.textMute }}>/</span>}
                  {onStage && <span style={{ color: t.textSub }}>{onStage}</span>}
                  {onStage && age && <span style={{ color: t.textMute }}>/</span>}
                  {age && <span style={{ color: t.textMute }}>{age}</span>}
                </span>
              );
            })()}
          </div>
          {isInstall
            ? <InstallProgress client={client} color={color} />
            : (
              <>
                {src && (
                  <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                    style={{ background: src.color + "20", color: src.color }}>
                    {src.label}
                  </span>
                )}
                <SubstatusPicker
                  active={activeSub}
                  options={subsForTab}
                  fallbackLabel={STATUS_LABELS[client.status] || client.status}
                  fallbackColor={color}
                  onSelect={subId => onSaveSubStatus?.(client.id, subId)}
                />
              </>
            )
          }
          {client.avito_chat_url && (
            <button
              onClick={e => { e.stopPropagation(); window.open(client.avito_chat_url!, "_blank"); }}
              title="Открыть диалог в Avito"
              className="flex-shrink-0 flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-medium transition hover:opacity-80"
              style={{ background: "#f9731620", color: "#f97316" }}>
              <Icon name="ExternalLink" size={9} /> Avito
            </button>
          )}
          {client.is_service && (
            <span
              title="Сервисная заявка — доделка/переделка, не новый монтаж"
              className="flex-shrink-0 flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold"
              style={{ background: "#14b8a622", color: "#14b8a6", border: "1px solid #14b8a644" }}>
              <Icon name="Hammer" size={9} /> Сервис
            </span>
          )}
          {client.has_missed_call && (
            <span
              title="Есть пропущенный звонок, на который ещё не перезвонили"
              className="flex-shrink-0 flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
              style={{ background: "#ef444420", color: "#ef4444" }}>
              <Icon name="PhoneMissed" size={9} /> Пропущен
            </span>
          )}
        </div>

        {/* Имя + телефон + адрес */}
        <div className="space-y-0.5 mb-1">
          {client.client_name && (
            <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textMute }}>
              <Icon name="User" size={9} className="flex-shrink-0" style={{ color: t.textMute }} />
              <span className="truncate">{client.client_name}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textMute }}>
              <Icon name="Phone" size={9} className="flex-shrink-0" style={{ color: t.textMute }} />
              <span className="truncate">{client.phone}</span>
            </div>
          )}
          {(client.address || client.area) && (
            <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textMute }}>
              <Icon name="MapPin" size={9} className="flex-shrink-0" style={{ color: t.textMute }} />
              {client.address && <span className="truncate flex-1">{client.address}</span>}
              {client.area && <span className="flex-shrink-0 font-medium">{client.area} м²</span>}
            </div>
          )}
        </div>

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
        {income > 0 && (
          <div className="mt-2 pt-2 grid grid-cols-2 gap-x-2 gap-y-1" style={{ borderTop: `1px solid ${t.border2}` }}>
            <div>
              <div className="text-[8px] uppercase tracking-wide" style={{ color: t.textMute }}>Доходы</div>
              <div className="text-xs font-bold text-emerald-500">{income.toLocaleString("ru-RU")} ₽</div>
            </div>
            {costs > 0 && (
              <div>
                <div className="text-[8px] uppercase tracking-wide" style={{ color: t.textMute }}>Затраты</div>
                <div className="text-xs font-semibold" style={{ color: "#f97316" }}>{costs.toLocaleString("ru-RU")} ₽</div>
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
import { Client, STATUS_LABELS, STATUS_COLORS, stageDuration } from "./crmApi";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import { Substatus } from "./OrdersTabs";
import { InstallProgress } from "./ordersClientRowShared";
import { SubstatusPicker } from "./SubstatusPicker";

export interface OrdersClientRowDesktopProps {
  c: Client;
  t: ThemeCtx;
  onClick: () => void;
  clientWithSub: Client;
  activeSub: Substatus | undefined;
  subsForTab?: Substatus[];
  onSaveSubStatus?: (id: number, subStatusId: number) => void;
  isInstall: boolean;
  isDone: boolean;
  isCancelled: boolean;
  nextStatus: string;
  nextLabel: string;
  stepping: boolean;
  handleNext: (e: React.MouseEvent) => void;
  title: string;
  color: string;
  hasProject: boolean;
  ordersCount: number;
  income: number;
  costs: number;
  debt: number;
  profit: number;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}

export function OrdersClientRowDesktop({
  c, t, onClick, clientWithSub, activeSub, subsForTab = [], onSaveSubStatus, isInstall, isDone, isCancelled,
  nextStatus, nextLabel, stepping, handleNext,
  title, color, hasProject, ordersCount, income, costs, debt, profit,
  onSwipeBuilder, onSwipeAgent,
}: OrdersClientRowDesktopProps) {
  return (
    <div className="hidden sm:flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:brightness-[1.04] transition"
      style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${color}50` }}
      onClick={onClick}>

      <div className="w-44 min-w-0 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{title}</div>
          {ordersCount > 1 && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
              style={{ background: "#7c3aed22", color: "#a78bfa" }}
              title={`Всего заявок у клиента: ${ordersCount}`}>
              <Icon name="Layers" size={9} /> {ordersCount}
            </span>
          )}
          {(() => {
            const onStage = !isDone && !isCancelled ? stageDuration(c.status_changed_at) : "";
            const age = stageDuration(c.created_at);
            if (!onStage && !age) return null;
            return (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                style={{ background: t.surface2, border: `1px solid ${t.border}` }}
                title={`На этапе: ${onStage || "—"} · Возраст заявки: ${age || "—"}`}>
                <Icon name="Clock" size={9} style={{ color: t.accentLight }} />
                {onStage && <span style={{ color: t.text }}>{onStage}</span>}
                {onStage && age && <span style={{ color: t.textMute }}>/</span>}
                {age && <span style={{ color: t.textSub }}>{age}</span>}
              </span>
            );
          })()}
        </div>
        {(c.client_name || c.phone) && (
          <div className="text-xs truncate" style={{ color: t.textMute }}>
            {[c.client_name, c.phone].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      <div className="w-44 flex-shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          {isInstall
            ? <InstallProgress client={clientWithSub} />
            : (
              <SubstatusPicker
                active={activeSub}
                options={subsForTab}
                fallbackLabel={STATUS_LABELS[c.status] || c.status}
                fallbackColor={color}
                onSelect={subId => onSaveSubStatus?.(c.id, subId)}
              />
            )
          }
          {c.avito_chat_url && (
            <button
              onClick={e => { e.stopPropagation(); window.open(c.avito_chat_url!, "_blank"); }}
              title="Открыть диалог в Avito"
              className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-medium transition hover:opacity-80"
              style={{ background: "#f9731620", color: "#f97316" }}>
              <Icon name="ExternalLink" size={9} /> Avito
            </button>
          )}
        </div>
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

      {/* Кнопки экосистемы — десктоп */}
      <div className="flex flex-col gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
        {hasProject ? (
          <button onClick={() => window.open(`/plan?project_id=${c.project_id}`, "_blank")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630" }}>
            <Icon name="ExternalLink" size={11} /> Проект
          </button>
        ) : (
          <button onClick={() => onSwipeBuilder?.(c)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition hover:opacity-80"
            style={{ background: "#3b82f610", color: "#60a5fa", border: "1px dashed #3b82f640" }}>
            <Icon name="Layers" size={11} /> Построитель
          </button>
        )}
        <button onClick={() => onSwipeAgent?.(c)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition hover:opacity-80"
          style={{ background: "#10b98110", color: "#34d399", border: "1px dashed #10b98140" }}>
          <Icon name="Bot" size={11} /> Агент
        </button>
      </div>
    </div>
  );
}
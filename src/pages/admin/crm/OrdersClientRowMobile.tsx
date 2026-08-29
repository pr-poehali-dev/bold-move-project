import { Client, STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import { Substatus } from "./OrdersTabs";
import { SNAP_WIDTH, InstallProgress, DuplicateBadge } from "./ordersClientRowShared";
import { SubstatusPicker } from "./SubstatusPicker";

export interface OrdersClientRowMobileProps {
  c: Client;
  t: ThemeCtx;
  onClick: () => void;
  mobileRef: React.RefObject<HTMLDivElement>;
  offset: number;
  dragging: boolean;
  swipeHint: "builder" | "agent" | null;
  cb: React.MutableRefObject<{
    onSwipeBuilder?: (client: Client) => void;
    onSwipeAgent?: (client: Client) => void;
    c: Client;
  }>;
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
  debt: number;
  contractSum: number;
}

export function OrdersClientRowMobile({
  c, t, onClick, mobileRef, offset, dragging, swipeHint, cb,
  clientWithSub, activeSub, subsForTab = [], onSaveSubStatus, isInstall, isDone, isCancelled,
  nextStatus, nextLabel, stepping, handleNext,
  title, color, hasProject, ordersCount, income, debt, contractSum,
}: OrdersClientRowMobileProps) {
  return (
    <div className="sm:hidden relative rounded-xl overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Фон свайпа вправо — Агент */}
      <div className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none"
        style={{
          width: SNAP_WIDTH,
          background: swipeHint === "agent"
            ? "linear-gradient(135deg,#059669,#10b981)"
            : "linear-gradient(135deg,#06573a,#0a7c50)",
          zIndex: 0,
          transition: "background 0.2s",
        }}>
        <Icon name="Bot" size={18} style={{ color: "#fff" }} />
        <span className="text-[9px] font-bold uppercase tracking-wide text-white">Агент</span>
      </div>

      {/* Фон свайпа влево — Построитель */}
      <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none"
        style={{
          width: SNAP_WIDTH,
          background: swipeHint === "builder"
            ? "linear-gradient(135deg,#1d4ed8,#3b82f6)"
            : "linear-gradient(135deg,#1e3a6e,#1d4ed8)",
          zIndex: 0,
          transition: "background 0.2s",
        }}>
        <Icon name="Layers" size={18} style={{ color: "#fff" }} />
        <span className="text-[9px] font-bold uppercase tracking-wide text-white">Построитель</span>
      </div>

      {/* Карточка — двигается */}
      <div
        ref={mobileRef}
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.25,1,0.5,1)",
          background: t.surface,
          borderLeft: `3px solid ${color}60`,
          willChange: "transform",
          userSelect: "none",
        }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer active:opacity-75 transition"
          onClick={onClick}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold truncate" style={{ color: t.text }}>{title}</span>
              <DuplicateBadge client={c} />
              {ordersCount > 1 && (
                <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                  style={{ background: "#7c3aed22", color: "#a78bfa" }}
                  title={`Всего заявок у клиента: ${ordersCount}`}>
                  <Icon name="Layers" size={9} /> {ordersCount}
                </span>
              )}
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

          <div className="flex-shrink-0 flex flex-col items-end gap-1">
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
            {income > 0 && (
              <span className="text-xs font-bold text-emerald-500">{income.toLocaleString("ru-RU")} ₽</span>
            )}
            {debt > 0 && !isDone && !isCancelled && (
              <span className="text-[10px] text-red-400">долг {debt.toLocaleString("ru-RU")} ₽</span>
            )}
          </div>

          <Icon name="ChevronRight" size={14} style={{ color: t.textMute, flexShrink: 0 }} />
        </div>

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

        {/* Кнопки экосистемы — мобайл подсказка (свайп тоже работает) */}
        <div className="flex items-center gap-1.5 px-2.5 py-2" onClick={e => e.stopPropagation()}
          style={{ borderTop: `1px solid ${t.border2}` }}>
          {hasProject ? (
            <button onClick={() => window.open(`/plan?project_id=${c.project_id}`, "_blank")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition active:opacity-70"
              style={{ background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630" }}>
              <Icon name="ExternalLink" size={11} /> В построитель
            </button>
          ) : (
            <button onClick={() => cb.current.onSwipeBuilder?.(cb.current.c)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition active:opacity-70"
              style={{ background: "#3b82f610", color: "#60a5fa", border: "1px dashed #3b82f640" }}>
              <Icon name="Layers" size={11} /> В построитель
            </button>
          )}
          <button onClick={() => cb.current.onSwipeAgent?.(cb.current.c)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition active:opacity-70"
            style={{ background: "#10b98110", color: "#34d399", border: "1px dashed #10b98140" }}>
            <Icon name="Bot" size={11} /> В агент
          </button>
        </div>
      </div>
    </div>
  );
}
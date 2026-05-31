import { useState, useRef, useEffect } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS, crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";

const SNAP_WIDTH = 88;
const THRESHOLD  = 44;

function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

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

export function OrdersClientCard({ c, onClick, onNextStep, onSwipeBuilder, onSwipeAgent }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping]             = useState(false);
  const [localSubStatus, setLocalSubStatus] = useState<string | null>(c.sub_status ?? null);

  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset]       = useState(0);
  const [dragging, setDragging]   = useState(false);
  const [swipeHint, setSwipeHint] = useState<"builder" | "agent" | null>(null);

  const sx        = useRef(0);
  const sy        = useRef(0);
  const axis      = useRef<"h" | "v" | null>(null);
  const alive     = useRef(false);
  const vibed     = useRef(false);
  const offsetRef = useRef(0);

  const setOffsetSync    = useRef((v: number)  => { offsetRef.current = v; setOffset(v); });
  const setDraggingSync  = useRef((v: boolean) => setDragging(v));
  const setSwipeHintSync = useRef((v: "builder" | "agent" | null) => setSwipeHint(v));
  setOffsetSync.current    = (v) => { offsetRef.current = v; setOffset(v); };
  setDraggingSync.current  = (v) => setDragging(v);
  setSwipeHintSync.current = (v) => setSwipeHint(v);

  const cb = useRef({ onSwipeBuilder, onSwipeAgent, c });
  cb.current = { onSwipeBuilder, onSwipeAgent, c };

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      sx.current = e.touches[0].clientX; sy.current = e.touches[0].clientY;
      axis.current = null; alive.current = true; vibed.current = false;
      setDraggingSync.current(false); setSwipeHintSync.current(null);
    };
    const onMove = (e: TouchEvent) => {
      if (!alive.current) return;
      const dx = e.touches[0].clientX - sx.current;
      const dy = e.touches[0].clientY - sy.current;
      if (!axis.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        axis.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }
      if (axis.current === "v") return;
      e.preventDefault();
      setDraggingSync.current(true);
      const clamped = Math.max(-SNAP_WIDTH, Math.min(SNAP_WIDTH, dx));
      setOffsetSync.current(clamped);
      if (clamped >= THRESHOLD) setSwipeHintSync.current("agent");
      else if (clamped <= -THRESHOLD) setSwipeHintSync.current("builder");
      else setSwipeHintSync.current(null);
      if (!vibed.current && Math.abs(dx) >= THRESHOLD) { vibe(25); vibed.current = true; }
    };
    const onEnd = () => {
      if (!alive.current) return;
      alive.current = false; setDraggingSync.current(false); setSwipeHintSync.current(null);
      if (axis.current !== "h") return;
      const cur = offsetRef.current;
      if (cur >= THRESHOLD) { vibe(40); setOffsetSync.current(0); cb.current.onSwipeAgent?.(cb.current.c); }
      else if (cur <= -THRESHOLD) { vibe([30, 60, 30]); setOffsetSync.current(0); cb.current.onSwipeBuilder?.(cb.current.c); }
      else setOffsetSync.current(0);
    };
    el.addEventListener("touchstart",  onStart, { passive: true });
    el.addEventListener("touchmove",   onMove,  { passive: false });
    el.addEventListener("touchend",    onEnd,   { passive: true });
    el.addEventListener("touchcancel", onEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart",  onStart);
      el.removeEventListener("touchmove",   onMove);
      el.removeEventListener("touchend",    onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

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
  const income      = contractSum;
  const paidPre     = c.prepayment_confirmed ? (Number(c.prepayment_fact) || prepayment) : 0;
  const paidExtra   = c.extra_payment_confirmed ? (Number(c.extra_payment_fact) || extraPay) : 0;
  const paid        = paidPre + paidExtra;
  const costs       = (Number(c.material_cost)||0) + (Number(c.measure_cost)||0) + (Number(c.install_cost)||0);
  const debt        = contractSum - paid;
  const profit      = income - costs;
  const hasProject  = !!c.project_id;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Фоны свайпа — только мобайл */}
      <div className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1 pointer-events-none sm:hidden"
        style={{
          width: SNAP_WIDTH, zIndex: 0, transition: "background 0.2s",
          background: swipeHint === "agent" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#065f46,#059669)",
        }}>
        <Icon name="Bot" size={20} style={{ color: "#fff" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Агент</span>
      </div>
      <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 pointer-events-none sm:hidden"
        style={{
          width: SNAP_WIDTH, zIndex: 0, transition: "background 0.2s",
          background: swipeHint === "builder" ? "linear-gradient(135deg,#1d4ed8,#3b82f6)" : "linear-gradient(135deg,#1e3a6e,#1d4ed8)",
        }}>
        <Icon name="Layers" size={20} style={{ color: "#fff" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Построитель</span>
      </div>

      {/* Карточка */}
      <div ref={cardRef} className="flex flex-col"
        style={{
          position: "relative", zIndex: 1, background: t.surface,
          willChange: "transform", userSelect: "none",
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.25,1,0.5,1)",
        }}>

        {/* Основной контент */}
        <div className="p-3 sm:p-4 cursor-pointer hover:brightness-[1.03] transition flex-1" onClick={onClick}>
          <div className="flex items-start mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold truncate" style={{ color: t.text }}>
                  {localStorage.getItem(`order_title_${c.id}`) || `Заявка №${c.id}`}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.is_demo && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                      style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                      ДЕМО
                    </span>
                  )}
                  {isInstall
                    ? <InstallProgress client={clientWithSub} />
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                  }
                </div>
              </div>
              <div className="space-y-1 mt-1.5">
                {c.client_name && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                    <Icon name="User" size={10} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                    <span className="truncate" style={{ color: t.textSub }}>{c.client_name}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                    <Icon name="Phone" size={10} style={{ color: "#10b981", flexShrink: 0 }} />
                    <span className="truncate" style={{ color: t.textSub }}>{c.phone}</span>
                  </div>
                )}
                {(c.address || c.area) && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                    <Icon name="MapPin" size={10} style={{ color: "#f59e0b", flexShrink: 0 }} />
                    <span className="truncate flex-1" style={{ color: t.textSub }}>{c.address || "Адрес не указан"}</span>
                    {c.area && <span className="flex-shrink-0 text-[10px] font-medium" style={{ color: t.textMute }}>{c.area} м²</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

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

          {tab && <SubstatusPills client={clientWithSub} tabId={tab.id} onUpdate={setLocalSubStatus} />}

          {income > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-2.5 mt-1" style={{ borderTop: `1px solid ${t.border2}` }}>
              <Metric label="Доходы"  value={`${income.toLocaleString("ru-RU")} ₽`} color="#10b981" icon="TrendingUp" />
              <Metric label="Затраты" value={costs > 0 ? `${costs.toLocaleString("ru-RU")} ₽` : "—"} color={costs > 0 ? "#f97316" : undefined} icon="TrendingDown" />
              <Metric label={profit >= 0 ? "Прибыль" : "Убыток"} value={profit !== 0 ? `${Math.abs(profit).toLocaleString("ru-RU")} ₽` : "—"} color={profit > 0 ? "#a78bfa" : profit < 0 ? "#ef4444" : undefined} icon={profit >= 0 ? "TrendingUp" : "TrendingDown"} />
            </div>
          )}

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

        {/* Кнопки экосистемы — десктоп всегда видны, мобайл скрыты (там свайп) */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 pb-3" onClick={e => e.stopPropagation()}>
          {hasProject ? (
            <button
              onClick={() => window.open(`/plan?project_id=${c.project_id}`, "_blank")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
              style={{ background: "#3b82f610", color: "#60a5fa", border: "1px dashed #3b82f640" }}>
              <Icon name="Layers" size={12} />
              В построитель
            </button>
          ) : (
            <button
              onClick={() => onSwipeBuilder?.(c)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
              style={{ background: "#3b82f610", color: "#60a5fa", border: "1px dashed #3b82f640" }}>
              <Icon name="Layers" size={12} />
              В построитель
            </button>
          )}
          <button
            onClick={() => onSwipeAgent?.(c)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
            style={{ background: "#10b98110", color: "#34d399", border: "1px dashed #10b98140" }}>
            <Icon name="Bot" size={12} />
            В агент
          </button>
        </div>

        {/* Следующий шаг */}
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
                <Icon name="ArrowRight" size={11} />{nextLabel}
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
    </div>
  );
}
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

function SubstatusPills({ client, tabId, onUpdate }: { client: Client; tabId: string; onUpdate: (v: string | null) => void }) {
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
    <div className="flex flex-wrap gap-1 mt-1" onClick={e => e.stopPropagation()}>
      {steps.map(s => {
        const active = current === String(s.id);
        return (
          <button key={s.id} onClick={e => handleClick(e, s.id)}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition"
            style={{
              background: active ? s.color + "25" : "rgba(128,128,128,0.08)",
              color: active ? s.color : "rgba(150,150,150,0.6)",
              border: `1px solid ${active ? s.color + "50" : "transparent"}`,
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

export function OrdersClientRow({ c, onClick, onNextStep, onSwipeBuilder, onSwipeAgent }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const [localSubStatus, setLocalSubStatus] = useState<string | null>(c.sub_status ?? null);

  // свайп — только для мобильной карточки
  const mobileRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset]     = useState(0);
  const [dragging, setDragging] = useState(false);
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
    const el = mobileRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      sx.current    = e.touches[0].clientX;
      sy.current    = e.touches[0].clientY;
      axis.current  = null;
      alive.current = true;
      vibed.current = false;
      setDraggingSync.current(false);
      setSwipeHintSync.current(null);
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

      if (!vibed.current && Math.abs(dx) >= THRESHOLD) {
        vibe(25);
        vibed.current = true;
      }
    };

    const onEnd = () => {
      if (!alive.current) return;
      alive.current = false;
      setDraggingSync.current(false);
      setSwipeHintSync.current(null);

      if (axis.current !== "h") return;

      const cur = offsetRef.current;

      if (cur >= THRESHOLD) {
        vibe(40);
        setOffsetSync.current(0);
        cb.current.onSwipeAgent?.(cb.current.c);
      } else if (cur <= -THRESHOLD) {
        vibe([30, 60, 30]);
        setOffsetSync.current(0);
        cb.current.onSwipeBuilder?.(cb.current.c);
      } else {
        setOffsetSync.current(0);
      }
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
  const nextStatus  = NEXT_STATUS[c.status];
  const nextLabel   = NEXT_LABEL[c.status];
  const tab         = ORDERS_TABS.find(tb => tb.statuses.includes(c.status));
  const isInstall   = tab?.id === "installs";
  const isDone      = c.status === "done";
  const isCancelled = c.status === "cancelled";

  const contractSum = Number(c.contract_sum) || 0;
  const prepayment  = Number(c.prepayment) || 0;
  const extraPay    = Number(c.extra_payment) || 0;
  const income      = contractSum;
  const paidPre   = c.prepayment_confirmed ? (Number(c.prepayment_fact) || prepayment) : 0;
  const paidExtra = c.extra_payment_confirmed ? (Number(c.extra_payment_fact) || extraPay) : 0;
  const paid        = paidPre + paidExtra;
  const debt        = contractSum - paid;
  const costs       = (Number(c.material_cost)||0) + (Number(c.measure_cost)||0) + (Number(c.install_cost)||0);
  const profit      = income - costs;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  const title      = localStorage.getItem(`order_title_${c.id}`) || `Заявка №${c.id}`;
  const color      = STATUS_COLORS[c.status];
  const hasProject = !!c.project_id;

  return (
    <>
      {/* ── МОБИЛЕ: компактная карточка со свайпом ────────────────── */}
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
                : <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                    style={{ background: color + "20", color }}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
              }
              {tab && <SubstatusPills client={clientWithSub} tabId={tab.id} onUpdate={setLocalSubStatus} />}
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
                <Icon name="ExternalLink" size={11} /> Открыть проект
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

      {/* ── ДЕСКТОП: горизонтальная строка ───────────────────────────── */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:brightness-[1.04] transition"
        style={{ background: t.surface, border: `1px solid ${t.border}`, borderLeft: `3px solid ${color}50` }}
        onClick={onClick}>

        <div className="w-44 min-w-0 flex-shrink-0">
          <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{title}</div>
          {(c.client_name || c.phone) && (
            <div className="text-xs truncate" style={{ color: t.textMute }}>
              {[c.client_name, c.phone].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        <div className="w-44 flex-shrink-0">
          {isInstall
            ? <InstallProgress client={clientWithSub} />
            : <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: color + "20", color }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
          }
          {tab && <SubstatusPills client={clientWithSub} tabId={tab.id} onUpdate={setLocalSubStatus} />}
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
    </>
  );
}
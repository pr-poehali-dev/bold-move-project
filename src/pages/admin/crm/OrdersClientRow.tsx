import { useState, useRef, useEffect } from "react";
import { Client, STATUS_COLORS, getClientOrders } from "./crmApi";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";
import { SNAP_WIDTH, THRESHOLD, vibe } from "./ordersClientRowShared";
import { OrdersClientRowMobile } from "./OrdersClientRowMobile";
import { OrdersClientRowDesktop } from "./OrdersClientRowDesktop";

export function OrdersClientRow({ c, allClients, onClick, onNextStep, onSwipeBuilder, onSwipeAgent }: {
  c: Client;
  allClients?: Client[];
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}) {
  const t = useTheme();
  const allSubs = useSubstatuses();
  const [stepping, setStepping] = useState(false);
  const localSubStatus = c.sub_status ?? null;

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
  // Активный подэтап — показываем его вместо общего статуса
  const activeSub   = tab ? allSubs.find(s => s.parent_status === tab.id && String(s.id) === localSubStatus) : undefined;
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
  const ordersCount = allClients ? getClientOrders(c, allClients).length : 1;

  return (
    <>
      {/* ── МОБИЛЕ: компактная карточка со свайпом ────────────────── */}
      <OrdersClientRowMobile
        c={c}
        t={t}
        onClick={onClick}
        mobileRef={mobileRef}
        offset={offset}
        dragging={dragging}
        swipeHint={swipeHint}
        cb={cb}
        clientWithSub={clientWithSub}
        activeSub={activeSub}
        isInstall={isInstall}
        isDone={isDone}
        isCancelled={isCancelled}
        nextStatus={nextStatus}
        nextLabel={nextLabel}
        stepping={stepping}
        handleNext={handleNext}
        title={title}
        color={color}
        hasProject={hasProject}
        ordersCount={ordersCount}
        income={income}
        debt={debt}
        contractSum={contractSum}
      />

      {/* ── ДЕСКТОП: горизонтальная строка ───────────────────────────── */}
      <OrdersClientRowDesktop
        c={c}
        t={t}
        onClick={onClick}
        clientWithSub={clientWithSub}
        activeSub={activeSub}
        isInstall={isInstall}
        isDone={isDone}
        isCancelled={isCancelled}
        nextStatus={nextStatus}
        nextLabel={nextLabel}
        stepping={stepping}
        handleNext={handleNext}
        title={title}
        color={color}
        hasProject={hasProject}
        ordersCount={ordersCount}
        income={income}
        costs={costs}
        debt={debt}
        profit={profit}
        onSwipeBuilder={onSwipeBuilder}
        onSwipeAgent={onSwipeAgent}
      />
    </>
  );
}

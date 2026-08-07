import { useState, useRef } from "react";
import { Client, STATUS_COLORS, getClientOrders } from "./crmApi";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";
import { OrdersClientRowMobile } from "./OrdersClientRowMobile";
import { OrdersClientRowDesktop } from "./OrdersClientRowDesktop";
import { useSwipeGesture } from "./useSwipeGesture";
import { useOrderMetrics } from "./useOrderMetrics";

export function OrdersClientRow({ c, allClients, onClick, onNextStep, onSaveSubStatus, onSwipeBuilder, onSwipeAgent }: {
  c: Client;
  allClients?: Client[];
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
  onSaveSubStatus?: (id: number, subStatusId: number) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}) {
  const t = useTheme();
  const allSubs = useSubstatuses();
  const [stepping, setStepping] = useState(false);
  const localSubStatus = c.sub_status ?? null;

  // свайп — только для мобильной карточки
  const mobileRef = useRef<HTMLDivElement>(null);
  const { offset, dragging, swipeHint, cb } = useSwipeGesture({ elRef: mobileRef, client: c, onSwipeBuilder, onSwipeAgent });

  const clientWithSub = { ...c, sub_status: localSubStatus };
  const nextStatus  = NEXT_STATUS[c.status];
  const nextLabel   = NEXT_LABEL[c.status];
  const tab         = ORDERS_TABS.find(tb => tb.statuses.includes(c.status));
  // Активный подэтап — показываем его вместо общего статуса
  const activeSub   = tab ? allSubs.find(s => s.parent_status === tab.id && String(s.id) === localSubStatus) : undefined;
  const subsForTab  = tab ? allSubs.filter(s => s.parent_status === tab.id) : [];
  const isInstall   = tab?.id === "installs";
  const isDone      = c.status === "done";
  const isCancelled = c.status === "cancelled";

  const { contractSum, income, debt, costs, profit } = useOrderMetrics(c);

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
        subsForTab={subsForTab}
        onSaveSubStatus={onSaveSubStatus}
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
        subsForTab={subsForTab}
        onSaveSubStatus={onSaveSubStatus}
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
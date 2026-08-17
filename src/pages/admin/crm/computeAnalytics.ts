import { Client, LEAD_STATUSES, ORDER_STATUSES } from "./crmApi";
import { Stats, EMPTY_STATS, FunnelMonth } from "./analyticsTypes";
import { clientPeriodDate } from "./analyticsFilters";

// Клиентский расчёт всех показателей аналитики по уже загруженному списку заявок.
// Полностью повторяет серверную логику (backend/crm-manager resource=="stats"),
// но выполняется мгновенно в браузере — это позволяет фильтровать по источнику
// без запросов на сервер.

// Статусы, которые считаются "дошедшими до замера" / "до договора" — как на сервере.
const WENT_MEASURE_STATUSES = ["measure", "measured", "contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done"];
const WENT_CONTRACT_STATUSES = ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done"];

// Статусы стадии "Монтаж" — договор подписан, работа идёт (как на сервере).
const MONTAGE_STATUSES = ["contract", "prepaid", "install_scheduled", "install_done"];

const num = (v: unknown): number => Number(v) || 0;

// Ключ месяца "YYYY-MM" из даты создания заявки
function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Скользящее окно из 12 месяцев (включая текущий) — как generate_series на сервере
function last12Months(): string[] {
  const res: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return res;
}

/** Воронка по месяцам: заявки → замеры → монтажи → завершено.
 *  Специально принимает список БЕЗ фильтра стадии — график динамики должен
 *  показывать весь путь заявок целиком, а не срез по одной стадии воронки
 *  (иначе, например, при активном фильтре «Финал» столбец «Заявки» на графике
 *  будет считать только уже закрытые сделки, что выглядит как "заявок почти нет"). */
export function computeFunnelByMonth(clients: Client[]): FunnelMonth[] {
  const list = clients.filter(c => c.status !== "deleted");
  const months = last12Months();
  const zero = () => Object.fromEntries(months.map(m => [m, 0])) as Record<string, number>;
  const mLeads = zero(), mMeasures = zero(), mMontages = zero(), mDone = zero();

  for (const c of list) {
    const leadMk = monthKey(c.created_at);
    if (leadMk != null && leadMk in mLeads) mLeads[leadMk] += 1;

    // Дошли до замера — считаем по факту назначенной даты замера (когда именно замеряли)
    if (c.measure_date) {
      const mk = monthKey(c.measure_date);
      if (mk != null && mk in mMeasures) mMeasures[mk] += 1;
    }
    // Дошли до монтажа — по дате монтажа
    if (c.install_date) {
      const mk = monthKey(c.install_date);
      if (mk != null && mk in mMontages) mMontages[mk] += 1;
    }
    // Завершено — по дате закрытия сделки (не съезжает при правках карточки)
    if (c.status === "done") {
      const mk = monthKey(clientPeriodDate(c, "closed"));
      if (mk != null && mk in mDone) mDone[mk] += 1;
    }
  }

  return months.map(m => ({
    month: m,
    leads: mLeads[m], measures: mMeasures[m], montages: mMontages[m], done: mDone[m],
  }));
}

export function computeStats(clients: Client[]): Stats {
  // Только не удалённые заявки (сервер: status != 'deleted')
  const list = clients.filter(c => c.status !== "deleted");
  if (list.length === 0) return { ...EMPTY_STATS };

  // Распределение по статусам
  const statusDist: Record<string, number> = {};
  for (const c of list) statusDist[c.status] = (statusDist[c.status] || 0) + 1;

  const sumStatuses = (arr: string[]) => arr.reduce((s, st) => s + (statusDist[st] || 0), 0);

  const total_all     = list.length;
  const total_leads   = sumStatuses(LEAD_STATUSES);
  const total_orders  = sumStatuses(ORDER_STATUSES.filter(s => s !== "cancelled"));
  const total_done    = statusDist["done"]      || 0;
  const total_cancel  = statusDist["cancelled"] || 0;
  const went_measure  = sumStatuses(WENT_MEASURE_STATUSES);
  const went_contract = sumStatuses(WENT_CONTRACT_STATUSES);

  // Предстоящие события (сервер: measure_date >= NOW() AND status='measure')
  const nowMs = Date.now();
  const upcoming_measures = list.filter(c =>
    c.status === "measure" && c.measure_date && new Date(c.measure_date).getTime() >= nowMs).length;
  const upcoming_installs = list.filter(c =>
    c.status === "install_scheduled" && c.install_date && new Date(c.install_date).getTime() >= nowMs).length;

  // Финансы
  let total_contract = 0, total_prepayment = 0, total_extra = 0, total_extra_agreement = 0;
  let total_material = 0, total_measure_cost = 0, total_install_cost = 0;
  // management_cost — расход на менеджмент заказа; custom_costs_total — сумма кастомных
  // статей затрат (Технолог, Логистика, Менеджер и т.п.), уже отфильтрованных backend'ом
  // по row_type='cost' в поле /clients (см. crm-manager resource=="clients").
  let total_management = 0, total_custom_costs = 0;
  for (const c of list) {
    total_contract        += num(c.contract_sum);
    total_prepayment      += num(c.prepayment);
    total_extra            += num(c.extra_payment);
    total_extra_agreement += num(c.extra_agreement_sum);
    total_material         += num(c.material_cost);
    total_measure_cost     += num(c.measure_cost);
    total_install_cost     += num(c.install_cost);
    total_management       += num(c.management_cost);
    total_custom_costs     += num(c.custom_costs_total);
  }
  // "Получено" — разбивка по стадиям, считаем только ПОДТВЕРЖДЁННЫЕ платежи (как на сервере):
  //   Замеры  — заявка ещё без договора, денег с клиента не берём (всегда 0)
  //   Монтажи — договор подписан, работа идёт (подтверждённая предоплата)
  //   Финал   — сделка завершена (вся подтверждённая сумма: предоплата+доплата+допсоглашение)
  let received_montage = 0, received_final = 0;
  for (const c of list) {
    if (MONTAGE_STATUSES.includes(c.status) && c.prepayment_confirmed) {
      received_montage += num(c.prepayment_fact) || num(c.prepayment);
    }
    if (c.status === "done") {
      if (c.prepayment_confirmed) received_final += num(c.prepayment_fact) || num(c.prepayment);
      if (c.extra_payment_confirmed) received_final += num(c.extra_payment_fact) || num(c.extra_payment);
      received_final += num(c.extra_agreement_sum);
    }
  }
  const received_measure = 0;
  const total_received = received_measure + received_montage + received_final;
  const total_costs    = total_material + total_measure_cost + total_install_cost + total_management + total_custom_costs;
  const total_profit   = total_contract - total_costs;

  // Причины отказов (top-10, как на сервере)
  const reasonMap: Record<string, number> = {};
  for (const c of list) {
    if (c.status === "cancelled" && c.cancel_reason && c.cancel_reason.trim() !== "") {
      reasonMap[c.cancel_reason] = (reasonMap[c.cancel_reason] || 0) + 1;
    }
  }
  const cancel_reasons = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Динамика по месяцам — 12 месяцев с нулями для пустых.
  // Заявки (mLeads) считаем по дате ПРИХОДА — это поток лидов.
  // Завершённые и деньги (mDone/mRevenue/mCosts/mProfit) — по дате ЗАКРЫТИЯ сделки
  // (closed_at), чтобы график совпадал с карточками сверху («Сумма договоров»,
  // «Прибыль» и т.п.), которые считаются по тому же денежному срезу.
  const months = last12Months();
  const zero = () => Object.fromEntries(months.map(m => [m, 0])) as Record<string, number>;
  const mLeads = zero(), mDone = zero(), mRevenue = zero(), mCosts = zero(), mProfit = zero();
  for (const c of list) {
    const leadMk = monthKey(c.created_at);
    if (leadMk != null && leadMk in mLeads) mLeads[leadMk] += 1;

    if (c.status === "done") {
      const closedMk = monthKey(clientPeriodDate(c, "closed"));
      if (closedMk != null && closedMk in mDone) {
        mDone[closedMk] += 1;
        const rev = num(c.contract_sum);
        const cost = num(c.material_cost) + num(c.measure_cost) + num(c.install_cost)
                   + num(c.management_cost) + num(c.custom_costs_total);
        mRevenue[closedMk] += rev;
        mCosts[closedMk]   += cost;
        mProfit[closedMk]  += rev - cost;
      }
    }
  }

  // Средние (по не-null значениям, как AVG на сервере)
  const areas = list.map(c => c.area).filter((v): v is number => v != null && !isNaN(Number(v)));
  const contracts = list.map(c => c.contract_sum).filter((v): v is number => v != null && !isNaN(Number(v)));
  const avg_area     = areas.length     ? areas.reduce((s, v) => s + Number(v), 0) / areas.length         : 0;
  const avg_contract = contracts.length ? contracts.reduce((s, v) => s + Number(v), 0) / contracts.length : 0;

  return {
    total_all, total_leads, total_orders, total_done, total_cancel,
    went_measure, went_contract, upcoming_measures, upcoming_installs,
    total_contract, total_received, received_measure, received_montage, received_final,
    total_prepayment, total_extra,
    total_material, total_measure_cost, total_install_cost,
    total_management, total_custom_costs,
    total_costs, total_profit,
    avg_area: Math.round(avg_area * 10) / 10,
    avg_contract: Math.round(avg_contract),
    cancel_reasons,
    funnel: [
      { label: "Заявки",        count: total_all,      status: "all" },
      { label: "Замер назначен", count: went_measure,   status: "measure" },
      { label: "До договора",    count: went_contract,  status: "contract" },
      { label: "Завершённые",    count: total_done,     status: "done" },
    ],
    status_dist: Object.entries(statusDist).map(([status, count]) => ({ status, count })),
    monthly_leads:   months.map(m => ({ month: m, count: mLeads[m] })),
    monthly_done:    months.map(m => ({ month: m, count: mDone[m] })),
    monthly_revenue: months.map(m => ({ month: m, revenue: mRevenue[m] })),
    monthly_costs:   months.map(m => ({ month: m, costs: mCosts[m] })),
    monthly_profit:  months.map(m => ({ month: m, profit: mProfit[m] })),
  };
}
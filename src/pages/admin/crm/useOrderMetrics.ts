import { Client } from "./crmApi";

// Общий расчёт финансовых показателей заявки: доход, долг, затраты, прибыль.
export function useOrderMetrics(c: Client) {
  const contractSum = Number(c.contract_sum) || 0;
  const prepayment  = Number(c.prepayment) || 0;
  const extraPay    = Number(c.extra_payment) || 0;
  const income      = contractSum;
  const paidPre     = c.prepayment_confirmed ? (Number(c.prepayment_fact) || prepayment) : 0;
  const paidExtra   = c.extra_payment_confirmed ? (Number(c.extra_payment_fact) || extraPay) : 0;
  const paid        = paidPre + paidExtra;
  const debt        = contractSum - paid;
  const costs       = (Number(c.material_cost) || 0) + (Number(c.measure_cost) || 0) + (Number(c.install_cost) || 0);
  const profit      = income - costs;

  return { contractSum, income, debt, costs, profit };
}

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell } from "recharts";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client, OrderSource } from "./crmApi";
import { Expense, ExpenseCategory, ExpenseInput, ExpenseKind } from "@/hooks/useExpenses";
import { computeSourceRows, computeExpenseSummary, computeExpensePie, fmtMoney, fmtPct } from "./computeExpenses";
import ExpenseModal from "./ExpenseModal";

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) {
  const t = useTheme();
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "18" }}>
        <Icon name={icon} size={17} style={{ color }} />
      </div>
      <div className="text-xs mb-0.5" style={{ color: t.textMute }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: t.text }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: t.textMute }}>{sub}</div>}
      <div className="absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: color }} />
    </div>
  );
}

interface Props {
  clients: Client[];
  expenses: Expense[];
  categories: ExpenseCategory[];
  sources: OrderSource[];
  loading: boolean;
  /** Доход (получено) и себестоимость сделок из общей аналитики */
  income: number;
  dealCosts: number;
  onCreate: (input: ExpenseInput) => Promise<void>;
  onUpdate: (id: number, patch: Partial<ExpenseInput>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onAddCategory: (name: string, kind: ExpenseKind) => Promise<ExpenseCategory>;
}

type PieMode = "category" | "source" | "type";

const PIE_MODES: { id: PieMode; label: string }[] = [
  { id: "category", label: "По статьям" },
  { id: "source",   label: "По источникам" },
  { id: "type",     label: "Услуга / бюджет" },
];

/** Вкладка «Расходы»: все вложения бизнеса и реальный результат по деньгам. */
export default function AnalyticsExpenses({
  clients, expenses, categories, sources, loading,
  income, dealCosts, onCreate, onUpdate, onRemove, onAddCategory,
}: Props) {
  const t = useTheme();
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pieMode, setPieMode] = useState<PieMode>("category");

  const summary    = useMemo(() => computeExpenseSummary(clients, expenses, { income, dealCosts }), [clients, expenses, income, dealCosts]);
  const sourceRows = useMemo(() => computeSourceRows(clients, expenses), [clients, expenses]);
  const pie        = useMemo(() => computeExpensePie(expenses, pieMode), [expenses, pieMode]);

  const totals = useMemo(() => sourceRows.reduce((acc, r) => ({
    adService: acc.adService + r.adService,
    adBudget:  acc.adBudget  + r.adBudget,
    adTotal:   acc.adTotal   + r.adTotal,
    leads:     acc.leads     + r.leads,
    measures:  acc.measures  + r.measures,
    montages:  acc.montages  + r.montages,
    finals:    acc.finals    + r.finals,
  }), { adService: 0, adBudget: 0, adTotal: 0, leads: 0, measures: 0, montages: 0, finals: 0 }), [sourceRows]);

  const openAdd  = () => { setEditing(null); setModal(true); };
  const openEdit = (e: Expense) => { setEditing(e); setModal(true); };

  const save = async (input: ExpenseInput) => {
    if (editing) await onUpdate(editing.id, input);
    else await onCreate(input);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const cell = "px-3 py-2.5 text-xs whitespace-nowrap";

  return (
    <div className="space-y-5">

      {/* Кнопка добавления */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs" style={{ color: t.textMute }}>
          Все вложения: реклама, зарплаты, аренда и прочее — и реальная прибыль после них
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition hover:opacity-90"
          style={{ background: t.accent, color: "#fff" }}>
          <Icon name="Plus" size={13} /> Добавить расход
        </button>
      </div>

      {/* KPI: реальный результат по деньгам */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard icon="Wallet"     label="Получено денег"  value={fmtMoney(summary.income)} sub="подтверждённые платежи" color="#10b981" />
        <KpiCard icon="Receipt"    label="Все вложения"    value={fmtMoney(summary.totalSpend)} sub="реклама + ЗП + прочее" color="#ef4444" />
        <KpiCard icon="TrendingUp" label="Чистая прибыль"
          value={summary.netProfit >= 0 ? `+${fmtMoney(summary.netProfit)}` : fmtMoney(summary.netProfit)}
          sub="получено минус вложения" color={summary.netProfit >= 0 ? "#10b981" : "#ef4444"} />
        <KpiCard icon="Megaphone"  label="Стоимость лида"  value={fmtMoney(summary.cplLead)} sub={`${summary.leads} заявок`} color="#f97316" />
        <KpiCard icon="Target"     label="Цена клиента"    value={fmtMoney(summary.cac)} sub={`${summary.finals} закрыто, конверсия ${fmtPct(summary.convFinal)}`} color="#a78bfa" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Структура вложений построчно */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-orange-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Структура вложений</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Реклама — услуга",   val: summary.adService },
              { label: "Реклама — бюджет",   val: summary.adBudget },
              { label: "Зарплаты",           val: summary.salaryTotal },
              { label: "Общие расходы",      val: summary.generalTotal },
              { label: "Себестоимость сделок", val: summary.dealCosts },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-sm pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
                <span style={{ color: t.textMute }}>{r.label}</span>
                <span className="font-semibold text-red-400">{r.val > 0 ? `−${fmtMoney(r.val)}` : "—"}</span>
              </div>
            ))}
            <div className="flex justify-between items-center text-sm pb-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
              <span className="font-bold" style={{ color: t.text }}>Всего вложено</span>
              <span className="font-bold text-red-400">{fmtMoney(summary.totalSpend)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold" style={{ color: t.text }}>Чистая прибыль</span>
              <span className={`text-xl font-bold ${summary.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {summary.netProfit >= 0 ? "+" : ""}{fmtMoney(summary.netProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: t.textMute }}>Рентабельность</span>
              <span className="font-semibold" style={{ color: (summary.profitability ?? 0) >= 0 ? "#34d399" : "#f87171" }}>
                {fmtPct(summary.profitability)}
              </span>
            </div>
          </div>
        </div>

        {/* Круговая диаграмма */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-violet-500" />
              <span className="text-sm font-bold" style={{ color: t.text }}>Куда ушли деньги</span>
            </div>
          </div>
          <div className="flex gap-1 mb-3 flex-wrap">
            {PIE_MODES.map(m => (
              <button key={m.id} onClick={() => setPieMode(m.id)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition hover:opacity-80"
                style={pieMode === m.id
                  ? { background: t.accent + "1F", color: t.accentLight, border: `1px solid ${t.accent}55` }
                  : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
                {m.label}
              </button>
            ))}
          </div>
          {pie.length > 0 ? (
            <>
              <div className="flex justify-center mb-3">
                <PieChart width={150} height={150}>
                  <Pie data={pie} cx={70} cy={70} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke={t.surface}>
                    {pie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </div>
              <div className="space-y-2">
                {pie.map(c => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                      <span style={{ color: t.textSub }}>{c.name}</span>
                    </div>
                    <span className="font-semibold" style={{ color: t.text }}>{fmtMoney(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
              <Icon name="PieChart" size={28} className="mb-2 opacity-30" />
              <span className="text-sm">Пока нет внесённых расходов</span>
            </div>
          )}
        </div>

        {/* Последние расходы */}
        <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-cyan-500" />
            <span className="text-sm font-bold" style={{ color: t.text }}>Последние вложения</span>
          </div>
          {expenses.length > 0 ? (
            <div className="space-y-2 max-h-[330px] overflow-y-auto">
              {expenses.slice(0, 20).map(e => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: t.text }}>
                      {e.category_name}
                      {e.source_name && <span style={{ color: t.textMute }}> · {e.source_name}</span>}
                      {e.employee && <span style={{ color: t.textMute }}> · {e.employee}</span>}
                    </div>
                    <div className="text-[11px]" style={{ color: t.textMute }}>
                      {e.spent_on ? new Date(`${e.spent_on}T12:00:00`).toLocaleDateString("ru-RU") : "—"}
                      {e.comment ? ` · ${e.comment}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-red-400">{fmtMoney(e.amount)}</span>
                    <button onClick={() => openEdit(e)} className="p-1 rounded-lg transition hover:opacity-70" title="Изменить">
                      <Icon name="Pencil" size={12} style={{ color: t.textMute }} />
                    </button>
                    <button onClick={() => onRemove(e.id)} className="p-1 rounded-lg transition hover:opacity-70" title="Удалить">
                      <Icon name="Trash2" size={12} style={{ color: "#f87171" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
              <Icon name="Receipt" size={28} className="mb-2 opacity-30" />
              <span className="text-sm mb-3">Расходы ещё не внесены</span>
              <button onClick={openAdd} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition hover:opacity-90"
                style={{ background: t.accent, color: "#fff" }}>
                Добавить первый
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Главная таблица: воронка и стоимость лида по источникам */}
      <div className="rounded-2xl p-5 overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full bg-emerald-500" />
          <span className="text-sm font-bold" style={{ color: t.text }}>Стоимость лида по этапам</span>
          <span className="text-xs" style={{ color: t.textMute }}>реклама / заявки на каждом шаге воронки</span>
        </div>
        {sourceRows.length > 0 ? (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {["Источник", "Расход", "Заявки", "Цена заявки", "Замеры", "Цена замера", "Монтажи", "Цена монтажа", "Финал", "Цена клиента", "Конверсия"].map((h, i) => (
                    <th key={h} className={`${cell} font-semibold ${i === 0 ? "text-left" : "text-right"}`} style={{ color: t.textMute }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceRows.map(r => (
                  <tr key={r.source} style={{ borderBottom: `1px solid ${t.border2}` }}>
                    <td className={`${cell} font-semibold`} style={{ color: t.text }}>{r.source}</td>
                    <td className={`${cell} text-right`} style={{ color: t.textSub }}>{r.adTotal > 0 ? fmtMoney(r.adTotal) : "—"}</td>
                    <td className={`${cell} text-right font-semibold`} style={{ color: t.text }}>{r.leads}</td>
                    <td className={`${cell} text-right`} style={{ color: "#fb923c" }}>{fmtMoney(r.cplLead)}</td>
                    <td className={`${cell} text-right`} style={{ color: t.textSub }}>{r.measures}</td>
                    <td className={`${cell} text-right`} style={{ color: "#fb923c" }}>{fmtMoney(r.cplMeasure)}</td>
                    <td className={`${cell} text-right`} style={{ color: t.textSub }}>{r.montages}</td>
                    <td className={`${cell} text-right`} style={{ color: "#fb923c" }}>{fmtMoney(r.cplMontage)}</td>
                    <td className={`${cell} text-right font-semibold`} style={{ color: "#34d399" }}>{r.finals}</td>
                    <td className={`${cell} text-right font-semibold`} style={{ color: "#a78bfa" }}>{fmtMoney(r.cplFinal)}</td>
                    <td className={`${cell} text-right`} style={{ color: t.textSub }}>{fmtPct(r.convFinal)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${cell} font-bold`} style={{ color: t.text }}>Всего</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: t.text }}>{totals.adTotal > 0 ? fmtMoney(totals.adTotal) : "—"}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: t.text }}>{totals.leads}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: "#fb923c" }}>{fmtMoney(totals.adTotal > 0 && totals.leads > 0 ? totals.adTotal / totals.leads : null)}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: t.text }}>{totals.measures}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: "#fb923c" }}>{fmtMoney(totals.adTotal > 0 && totals.measures > 0 ? totals.adTotal / totals.measures : null)}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: t.text }}>{totals.montages}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: "#fb923c" }}>{fmtMoney(totals.adTotal > 0 && totals.montages > 0 ? totals.adTotal / totals.montages : null)}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: "#34d399" }}>{totals.finals}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: "#a78bfa" }}>{fmtMoney(totals.adTotal > 0 && totals.finals > 0 ? totals.adTotal / totals.finals : null)}</td>
                  <td className={`${cell} text-right font-bold`} style={{ color: t.text }}>{fmtPct(totals.leads > 0 ? (totals.finals / totals.leads) * 100 : null)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8" style={{ color: t.textMute }}>
            <Icon name="Table" size={28} className="mb-2 opacity-30" />
            <span className="text-sm">Нет заявок и расходов за выбранный период</span>
          </div>
        )}
      </div>

      {modal && (
        <ExpenseModal
          categories={categories}
          sources={sources}
          initial={editing}
          onSave={save}
          onAddCategory={onAddCategory}
          onClose={() => { setModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

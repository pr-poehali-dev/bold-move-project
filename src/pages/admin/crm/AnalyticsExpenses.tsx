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
  /** Весь поток заявок БЕЗ фильтра стадии — нужен для честной воронки по источникам
   *  (иначе, например, при фильтре «Финал» столбец «Заявки» совпадёт с «Финал»). */
  leadsClients: Client[];
  /** Список для подсчёта закрытых сделок и денег — с учётом фильтра стадии, если он задан. */
  closedClients: Client[];
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
  leadsClients, closedClients, expenses, categories, sources, loading,
  income, dealCosts, onCreate, onUpdate, onRemove, onAddCategory,
}: Props) {
  const t = useTheme();
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pieMode, setPieMode] = useState<PieMode>("category");

  const summary    = useMemo(() => computeExpenseSummary(leadsClients, closedClients, expenses, { income, dealCosts }), [leadsClients, closedClients, expenses, income, dealCosts]);
  const sourceRows = useMemo(() => computeSourceRows(leadsClients, expenses), [leadsClients, expenses]);
  const pie        = useMemo(() => computeExpensePie(expenses, pieMode), [expenses, pieMode]);

  const totals = useMemo(() => sourceRows.reduce((acc, r) => ({
    adService: acc.adService + r.adService,
    adBudget:  acc.adBudget  + r.adBudget,
    adTotal:   acc.adTotal   + r.adTotal,
    leads:     acc.leads     + r.leads,
    measures:  acc.measures  + r.measures,
    montages:  acc.montages  + r.montages,
    finals:    acc.finals    + r.finals,
    service:         acc.service         + r.service,
    serviceRevenue:  acc.serviceRevenue  + r.serviceRevenue,
  }), { adService: 0, adBudget: 0, adTotal: 0, leads: 0, measures: 0, montages: 0, finals: 0, service: 0, serviceRevenue: 0 }), [sourceRows]);

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

  // Воронка разбита на 5 смысловых зон, у каждой свой цвет и своя граница.
  // Индексы колонок: 0 Источник | 1 Расход | 2-3 Заявки | 4-5 Замеры | 6-7 Монтажи | 8-10 Финал | 11-12 Сервис.
  // «Сервис» (доделки/переделки) — отдельная зона, намеренно НЕ смешанная с «Монтажи»/«Финал»:
  // это не новые заказы, а мелкие работы по уже сданным объектам (см. computeExpenses.ts).
  const ZONES = [
    { label: "Заявки",  color: "#8b5cf6", start: 2, span: 2 },
    { label: "Замеры",  color: "#f59e0b", start: 4, span: 2 },
    { label: "Монтажи", color: "#f97316", start: 6, span: 2 },
    { label: "Финал",   color: "#10b981", start: 8, span: 3 },
    { label: "Сервис",  color: "#14b8a6", start: 11, span: 2 },
  ];
  const zoneOf = (i: number) => ZONES.find(z => i >= z.start && i < z.start + z.span);
  // Граница слева — на первой колонке каждой зоны, в цвете самой зоны.
  const groupBorder = (i: number): React.CSSProperties => {
    const z = ZONES.find(zz => zz.start === i);
    return z ? { borderLeft: `2px solid ${z.color}55` } : {};
  };
  // Лёгкая заливка зоны, чтобы столбцы читались группами, а не сплошной простынёй.
  const zoneTint = (i: number): React.CSSProperties => {
    const z = zoneOf(i);
    return z ? { background: z.color + "0a" } : {};
  };

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
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard icon="Wallet"     label="Получено денег"  value={fmtMoney(summary.income)} sub="подтверждённые платежи" color="#10b981" />
        <KpiCard icon="Receipt"    label="Все вложения"    value={fmtMoney(summary.totalSpend)} sub="реклама + ЗП + прочее" color="#ef4444" />
        <KpiCard icon="TrendingUp" label="Чистая прибыль"
          value={summary.netProfit >= 0 ? `+${fmtMoney(summary.netProfit)}` : fmtMoney(summary.netProfit)}
          sub="получено минус вложения" color={summary.netProfit >= 0 ? "#10b981" : "#ef4444"} />
        <KpiCard icon="Megaphone"  label="Стоимость лида"  value={fmtMoney(summary.cplLead)} sub={`${summary.leads} заявок`} color="#f97316" />
        <KpiCard icon="Target"     label="Цена клиента"    value={fmtMoney(summary.cac)} sub={`${summary.finals} закрыто, конверсия ${fmtPct(summary.convFinal)}`} color="#a78bfa" />
        <KpiCard icon="Hammer"     label="Сервис"          value={String(summary.service)} sub="доделки/переделки, отдельно от заказов" color="#14b8a6" />
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
            <table className="w-full min-w-[1180px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                {/* Ряд зон воронки: Заявки | Замеры | Монтажи | Финал — каждая своим цветом */}
                <tr>
                  <th className={cell} colSpan={2} />
                  {ZONES.map(z => (
                    <th key={z.label} colSpan={z.span}
                      className={`${cell} text-center text-[10px] uppercase tracking-wider font-bold`}
                      style={{
                        color: z.color,
                        background: z.color + "14",
                        borderLeft: `2px solid ${z.color}55`,
                        borderTopLeftRadius: 8, borderTopRightRadius: 8,
                      }}>
                      {z.label}
                    </th>
                  ))}
                </tr>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {["Источник", "Расход", "Кол-во", "Цена", "Кол-во", "Цена", "Кол-во", "Цена", "Кол-во", "Цена клиента", "Конверсия", "Кол-во", "Выручка"].map((h, i) => (
                    <th key={`${h}-${i}`} className={`${cell} font-semibold ${i === 0 ? "text-left" : "text-right"}`}
                      style={{
                        color: zoneOf(i)?.color ?? t.textMute,
                        ...zoneTint(i), ...groupBorder(i),
                        borderBottom: `1px solid ${t.border}`,
                      }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceRows.map(r => {
                  // Значения по колонкам: пары «количество / цена» для каждой зоны воронки.
                  const cells: { v: string | number; color?: string; bold?: boolean }[] = [
                    { v: r.leads,                 color: t.text,    bold: true },
                    { v: fmtMoney(r.cplLead),     color: "#c4b5fd" },
                    { v: r.measures,              color: t.text,    bold: true },
                    { v: fmtMoney(r.cplMeasure),  color: "#fcd34d" },
                    { v: r.montages,              color: t.text,    bold: true },
                    { v: fmtMoney(r.cplMontage),  color: "#fdba74" },
                    { v: r.finals,                color: "#34d399", bold: true },
                    { v: fmtMoney(r.cplFinal),    color: "#6ee7b7" },
                    { v: fmtPct(r.convFinal),     color: t.textSub },
                    { v: r.service,                          color: "#5eead4", bold: true },
                    { v: r.serviceRevenue > 0 ? fmtMoney(r.serviceRevenue) : "—", color: "#5eead4" },
                  ];
                  return (
                    <tr key={r.source} style={{ borderBottom: `1px solid ${t.border2}` }}>
                      <td className={`${cell} font-semibold`} style={{ color: t.text, borderBottom: `1px solid ${t.border2}` }}>{r.source}</td>
                      <td className={`${cell} text-right`} style={{ color: t.textSub, borderBottom: `1px solid ${t.border2}` }}>
                        {r.adTotal > 0 ? fmtMoney(r.adTotal) : "—"}
                      </td>
                      {cells.map((c, idx) => {
                        const i = idx + 2;
                        return (
                          <td key={i} className={`${cell} text-right ${c.bold ? "font-semibold" : ""}`}
                            style={{ color: c.color, ...zoneTint(i), ...groupBorder(i), borderBottom: `1px solid ${t.border2}` }}>
                            {c.v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {(() => {
                  const cpl = (n: number) => (totals.adTotal > 0 && n > 0 ? totals.adTotal / n : null);
                  const cells: { v: string | number; color?: string }[] = [
                    { v: totals.leads,                    color: t.text },
                    { v: fmtMoney(cpl(totals.leads)),     color: "#c4b5fd" },
                    { v: totals.measures,                 color: t.text },
                    { v: fmtMoney(cpl(totals.measures)),  color: "#fcd34d" },
                    { v: totals.montages,                 color: t.text },
                    { v: fmtMoney(cpl(totals.montages)),  color: "#fdba74" },
                    { v: totals.finals,                   color: "#34d399" },
                    { v: fmtMoney(cpl(totals.finals)),    color: "#6ee7b7" },
                    { v: fmtPct(totals.leads > 0 ? (totals.finals / totals.leads) * 100 : null), color: t.text },
                    { v: totals.service,                                              color: "#5eead4" },
                    { v: totals.serviceRevenue > 0 ? fmtMoney(totals.serviceRevenue) : "—", color: "#5eead4" },
                  ];
                  return (
                    <tr>
                      <td className={`${cell} font-bold`} style={{ color: t.text }}>Всего</td>
                      <td className={`${cell} text-right font-bold`} style={{ color: t.text }}>
                        {totals.adTotal > 0 ? fmtMoney(totals.adTotal) : "—"}
                      </td>
                      {cells.map((c, idx) => {
                        const i = idx + 2;
                        return (
                          <td key={i} className={`${cell} text-right font-bold`}
                            style={{ color: c.color, ...zoneTint(i), ...groupBorder(i) }}>
                            {c.v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })()}
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
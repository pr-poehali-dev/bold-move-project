import { useEffect, useState, useMemo } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client, getClientOrders } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import { Stats, AnalyticsTab, ANALYTICS_TABS } from "./analyticsTypes";
import { loadCustomFinRows } from "./drawerTypes";
import { computeStats, computeFunnelByMonth } from "./computeAnalytics";
import { useOrderSources } from "@/hooks/useOrderSources";
import { applyMultiFilters, STAGE_OPTIONS, PERIOD_OPTIONS, periodLabel, stagesLabel, StageFilter, PeriodFilter, CustomRange } from "./analyticsFilters";
import AnalyticsMultiSelect from "./AnalyticsMultiSelect";
import PeriodRangeModal from "./PeriodRangeModal";
import { useExpenses } from "@/hooks/useExpenses";
import { filterExpenses } from "./computeExpenses";

// Суммирует кастомные строки ДОХОДОВ из localStorage по всем клиентам.
// Кастомные статьи ЗАТРАТ (Технолог, Логистика, Менеджер и т.п.) уже переехали
// в БД (client_custom_fin_values) и приходят с сервера в поле custom_costs_total
// клиента — их считает computeStats(), здесь их суммировать НЕЛЬЗЯ (задвоение).
function calcCustomIncomeTotal(clientIds: number[]): number {
  const rows = loadCustomFinRows().filter(r => r.block === "income");
  let extraIncome = 0;
  for (const clientId of clientIds) {
    for (const row of rows) {
      extraIncome += Number(localStorage.getItem(`fin_row_${clientId}_${row.key}`)) || 0;
    }
  }
  return extraIncome;
}
import AnalyticsOverview from "./AnalyticsOverview";
import AnalyticsFinance from "./AnalyticsFinance";
import AnalyticsExpenses from "./AnalyticsExpenses";
import TouchDashboard from "./TouchDashboard";

export default function CrmAnalytics() {
  const t = useTheme();
  const [loading, setLoading]     = useState(true);
  // По умолчанию открываем «Финансы» за текущий месяц по стадии «Финал», все источники
  const [tab, setTab]             = useState<AnalyticsTab>("finance");
  const [allClients,    setAllClients]    = useState<Client[]>([]);
  const [drawerClient,  setDrawerClient]  = useState<Client | null>(null);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);            // [] = все источники
  const [stageFilters,  setStageFilters]  = useState<StageFilter[]>(["final"]); // финал по умолчанию
  const [periodFilter,  setPeriodFilter]  = useState<PeriodFilter>("month");    // текущий месяц
  const [customRange,   setCustomRange]   = useState<CustomRange | null>(null);
  const [rangeModal,    setRangeModal]    = useState(false);
  const { sources } = useOrderSources();
  const exp = useExpenses();

  useEffect(() => {
    crmFetch("clients").then((d: unknown) => {
      if (Array.isArray(d)) setAllClients((d as Client[]).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Заявки под выбранные фильтры (источники / стадии / период). Считаем в браузере — мгновенно.
  // Период здесь — по дате ПРИХОДА заявки: это поток лидов («Обзор», «Касания»).
  const filteredClients = useMemo(
    () => applyMultiFilters(allClients, { sources: sourceFilters, stages: stageFilters, period: periodFilter, range: customRange }),
    [allClients, sourceFilters, stageFilters, periodFilter, customRange],
  );

  // Для графика «Воронка по месяцам» стадию НЕ фильтруем — иначе, например, при
  // активном фильтре «Финал» столбец «Заявки» на графике посчитает только уже
  // закрытые сделки, и выглядит так, будто заявок почти не было. Источник и период
  // применяем как обычно — это разрезы, а не срез по одному этапу воронки.
  const funnelSourceClients = useMemo(
    () => applyMultiFilters(allClients, { sources: sourceFilters, period: periodFilter, range: customRange }),
    [allClients, sourceFilters, periodFilter, customRange],
  );
  const funnelMonths = useMemo(() => computeFunnelByMonth(funnelSourceClients), [funnelSourceClients]);

  // Для ДЕНЕГ («Финансы», «Расходы») период считаем по дате ЗАКРЫТИЯ сделки:
  // выручка относится к месяцу, когда её получили, а не когда пришла заявка.
  const moneyClients = useMemo(
    () => applyMultiFilters(allClients, { sources: sourceFilters, stages: stageFilters, period: periodFilter, range: customRange, basis: "closed" }),
    [allClients, sourceFilters, stageFilters, periodFilter, customRange],
  );

  // Расходы под тот же период; фильтр по источнику применяется только к рекламным статьям
  const filteredExpenses = useMemo(
    () => filterExpenses(exp.expenses, {
      period: periodFilter,
      range: customRange,
      source: sourceFilters.length === 1 ? sourceFilters[0] : "",
    }),
    [exp.expenses, periodFilter, customRange, sourceFilters],
  );

  const recentClients = filteredClients.slice(0, 10);

  const withCustomIncome = (list: Client[]): Stats => {
    const base = computeStats(list);
    // Кастомные строки ДОХОДОВ из localStorage — по отфильтрованным заявкам.
    // Затраты (материалы/замер/монтаж/менеджмент/кастомные из БД) уже посчитаны в base.
    const extraIncome = calcCustomIncomeTotal(list.map(c => c.id));
    return {
      ...base,
      total_received: base.total_received + extraIncome,
      total_profit:   base.total_profit   + extraIncome,
    };
  };

  // Показатели по потоку заявок (для «Обзора»)
  const s: Stats = useMemo(() => withCustomIncome(filteredClients), [filteredClients]);
  // Показатели по деньгам — период по дате закрытия сделки (для «Финансов» и «Расходов»)
  const sMoney: Stats = useMemo(() => withCustomIncome(moneyClients), [moneyClients]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Конверсии
  const convMeasure  = s.total_all     > 0 ? Math.round((s.went_measure  / s.total_all)     * 100) : 0;
  const convContract = s.went_measure  > 0 ? Math.round((s.went_contract / s.went_measure)  * 100) : 0;
  const convDone     = s.went_contract > 0 ? Math.round((s.total_done    / s.went_contract) * 100) : 0;
  const cancelRate   = s.total_all     > 0 ? Math.round((s.total_cancel  / s.total_all)     * 100) : 0;

  // Pie данные — по денежному срезу (период = дата закрытия сделки)
  const costPie = [
    { name: "Материалы",  value: sMoney.total_material,      color: "#ef4444" },
    { name: "Замеры",     value: sMoney.total_measure_cost,  color: "#f59e0b" },
    { name: "Монтажи",    value: sMoney.total_install_cost,  color: "#f97316" },
    { name: "Менеджмент", value: sMoney.total_management,    color: "#8b5cf6" },
    { name: "Прочее",     value: sMoney.total_custom_costs,  color: "#64748b" },
  ].filter(c => c.value > 0);

  const statusPie = s.status_dist
    .filter(x => x.status !== "deleted")
    .map(x => ({ name: STATUS_LABELS[x.status] || x.status, value: x.count, color: STATUS_COLORS[x.status] || "#666", status: x.status }));

  // Воронка
  const funnelData = [
    { label: "Заявки",            count: s.total_all,     color: "#8b5cf6", pct: s.total_all > 0 ? 100 : 0 },
    { label: "Ушли на замер",     count: s.went_measure,  color: "#f59e0b", pct: s.total_all > 0 ? Math.round(s.went_measure  / s.total_all * 100) : 0 },
    { label: "Подписали договор", count: s.went_contract, color: "#06b6d4", pct: s.total_all > 0 ? Math.round(s.went_contract / s.total_all * 100) : 0 },
    { label: "Завершённые",       count: s.total_done,    color: "#10b981", pct: s.total_all > 0 ? Math.round(s.total_done    / s.total_all * 100) : 0 },
    { label: "Отказников",        count: s.total_cancel,  color: "#ef4444", pct: s.total_all > 0 ? Math.round(s.total_cancel  / s.total_all * 100) : 0 },
  ];

  // Динамика денег по месяцам — денежный срез (период по дате закрытия сделки)
  const moneyMonths = sMoney.monthly_revenue.map(d => ({
    month:   d.month,
    revenue: d.revenue,
    costs:   sMoney.monthly_costs.find(x => x.month === d.month)?.costs   ?? 0,
    profit:  sMoney.monthly_profit.find(x => x.month === d.month)?.profit ?? 0,
  }));

  return (
    <div className="space-y-4">

      {/* Заголовок + подвкладки */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Аналитика</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            {(() => {
              const parts: string[] = [];
              if (sourceFilters.length === 1) parts.push(`источник «${sourceFilters[0]}»`);
              else if (sourceFilters.length > 1) parts.push(`источники: ${sourceFilters.join(", ")}`);
              if (stageFilters.length) parts.push(stagesLabel(stageFilters));
              if (periodFilter !== "all") parts.push(periodLabel(periodFilter, customRange));
              const money = tab === "finance" || tab === "expenses";
              const cnt = money ? sMoney.total_all : s.total_all;
              const tail = money && periodFilter !== "all" ? " · период по дате закрытия сделки" : "";
              return (parts.length
                ? `${parts.join(", ")} — ${cnt} заявок`
                : `Всего заявок: ${cnt}`) + tail;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Источники — множественный выбор */}
          <AnalyticsMultiSelect
            icon="Radio"
            allLabel="Все источники"
            values={sourceFilters}
            onChange={setSourceFilters}
            options={sources.map(src => ({ id: src.name, label: src.name }))}
          />

          {/* Стадии — можно отметить несколько (например Монтажи + Финал) */}
          <AnalyticsMultiSelect
            icon="GitBranch"
            allLabel="Все стадии"
            values={stageFilters}
            onChange={v => setStageFilters(v as StageFilter[])}
            options={STAGE_OPTIONS.filter(o => o.id !== "")}
          />

          {/* Период — одиночный выбор, «Выбрать период» внутри попапа */}
          <AnalyticsMultiSelect
            icon="CalendarDays"
            single
            allLabel="За всё время"
            values={periodFilter === "all" ? [] : [periodFilter]}
            onChange={v => {
              const next = (v[0] as PeriodFilter) || "all";
              setPeriodFilter(next);
              if (next !== "custom") setCustomRange(null);
            }}
            options={periodFilter === "custom"
              ? [...PERIOD_OPTIONS.filter(o => o.id !== "all"), { id: "custom", label: periodLabel("custom", customRange) }]
              : PERIOD_OPTIONS.filter(o => o.id !== "all")}
            footer={{
              label: "Выбрать период",
              icon: "CalendarRange",
              active: periodFilter === "custom",
              onClick: () => setRangeModal(true),
            }}
          />

          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            {ANALYTICS_TABS.map((tb, i) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition"
                style={{
                  background: tab === tb.id ? "#7c3aed22" : "transparent",
                  color: tab === tb.id ? "#a78bfa" : t.textMute,
                  borderRight: i !== ANALYTICS_TABS.length - 1 ? `1px solid ${t.border}` : undefined,
                }}>
                <Icon name={tb.icon} size={13} /> {tb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "overview" && (
        <AnalyticsOverview
          s={s}
          convMeasure={convMeasure}
          convContract={convContract}
          convDone={convDone}
          cancelRate={cancelRate}
          funnelData={funnelData}
          statusPie={statusPie}
          recentClients={recentClients}
          onSelectClient={setDrawerClient}
        />
      )}

      {tab === "finance" && (
        <AnalyticsFinance s={sMoney} costPie={costPie} moneyMonths={moneyMonths} funnelMonths={funnelMonths} />
      )}

      {tab === "expenses" && (
        <AnalyticsExpenses
          clients={moneyClients}
          expenses={filteredExpenses}
          categories={exp.categories}
          sources={sources}
          loading={exp.loading}
          income={sMoney.total_received}
          dealCosts={sMoney.total_costs}
          onCreate={exp.create}
          onUpdate={exp.update}
          onRemove={exp.remove}
          onAddCategory={exp.createCategory}
        />
      )}

      {tab === "touches" && (
        <TouchDashboard clients={filteredClients} sourceFilter={sourceFilters.length === 1 ? sourceFilters[0] : ""} onSelectClient={setDrawerClient} />
      )}

      {/* Модалка выбора произвольного периода */}
      {rangeModal && (
        <PeriodRangeModal
          initial={customRange}
          onClose={() => setRangeModal(false)}
          onApply={(r) => { setCustomRange(r); setPeriodFilter("custom"); setRangeModal(false); }}
        />
      )}

      {/* Drawer клиента */}
      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          allClientOrders={getClientOrders(drawerClient, allClients)}
          onClose={() => setDrawerClient(null)}
          onUpdated={() => {
            crmFetch("clients").then((d: unknown) => {
              if (Array.isArray(d)) setAllClients((d as Client[]).filter((c: Client) => c.status !== "deleted"));
            }).catch(() => {});
          }}
          onDeleted={(deletedId) => {
            setAllClients(prev => prev.filter(c => c.id !== deletedId));
            setDrawerClient(null);
          }}
        />
      )}
    </div>
  );
}
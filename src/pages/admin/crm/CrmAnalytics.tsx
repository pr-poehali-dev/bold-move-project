import { useEffect, useState, useMemo } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client, getClientOrders } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import { Stats, AnalyticsTab, ANALYTICS_TABS } from "./analyticsTypes";
import { loadCustomFinRows } from "./drawerTypes";
import { computeStats } from "./computeAnalytics";
import { useOrderSources } from "@/hooks/useOrderSources";
import { applyAnalyticsFilters, STAGE_OPTIONS, PERIOD_OPTIONS, periodLabel, StageFilter, PeriodFilter, CustomRange } from "./analyticsFilters";
import AnalyticsFilterSelect from "./AnalyticsFilterSelect";
import PeriodRangeModal from "./PeriodRangeModal";

// Суммирует кастомные строки доходов/затрат из localStorage по всем клиентам
function calcCustomFinTotals(clientIds: number[]): { extraIncome: number; extraCosts: number } {
  const rows = loadCustomFinRows();
  let extraIncome = 0;
  let extraCosts  = 0;
  for (const clientId of clientIds) {
    for (const row of rows) {
      const val = Number(localStorage.getItem(`fin_row_${clientId}_${row.key}`)) || 0;
      if (row.block === "income") extraIncome += val;
      else extraCosts += val;
    }
  }
  return { extraIncome, extraCosts };
}
import AnalyticsOverview from "./AnalyticsOverview";
import AnalyticsFinance from "./AnalyticsFinance";
import AnalyticsDynamics from "./AnalyticsDynamics";
import TouchDashboard from "./TouchDashboard";

export default function CrmAnalytics() {
  const t = useTheme();
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<AnalyticsTab>("overview");
  const [allClients,    setAllClients]    = useState<Client[]>([]);
  const [drawerClient,  setDrawerClient]  = useState<Client | null>(null);
  const [sourceFilter,  setSourceFilter]  = useState<string>(""); // "" = все источники
  const [stageFilter,   setStageFilter]   = useState<StageFilter>("final"); // по умолчанию — завершённые сделки
  const [periodFilter,  setPeriodFilter]  = useState<PeriodFilter>("all");
  const [customRange,   setCustomRange]   = useState<CustomRange | null>(null);
  const [rangeModal,    setRangeModal]    = useState(false);
  const { sources } = useOrderSources();

  useEffect(() => {
    crmFetch("clients").then((d: unknown) => {
      if (Array.isArray(d)) setAllClients((d as Client[]).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Заявки под выбранные фильтры (источник / стадия / период). Считаем в браузере — мгновенно.
  const filteredClients = useMemo(
    () => applyAnalyticsFilters(allClients, { source: sourceFilter, stage: stageFilter, period: periodFilter, range: customRange }),
    [allClients, sourceFilter, stageFilter, periodFilter, customRange],
  );

  const recentClients = filteredClients.slice(0, 10);

  const s: Stats = useMemo(() => {
    const base = computeStats(filteredClients);
    // Кастомные строки доходов/затрат из localStorage — по отфильтрованным заявкам
    const { extraIncome, extraCosts } = calcCustomFinTotals(filteredClients.map(c => c.id));
    return {
      ...base,
      total_received: base.total_received + extraIncome,
      total_costs:    base.total_costs    + extraCosts,
      total_profit:   base.total_profit   + extraIncome - extraCosts,
    };
  }, [filteredClients]);

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

  // Pie данные
  const costPie = [
    { name: "Материалы", value: s.total_material,     color: "#ef4444" },
    { name: "Замеры",    value: s.total_measure_cost, color: "#f59e0b" },
    { name: "Монтажи",   value: s.total_install_cost, color: "#f97316" },
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

  // Динамика по месяцам
  const allMerged = s.monthly_leads.map(d => ({
    month:   d.month,
    leads:   d.count,
    done:    s.monthly_done.find(x => x.month === d.month)?.count      ?? 0,
    revenue: s.monthly_revenue.find(x => x.month === d.month)?.revenue ?? 0,
    costs:   s.monthly_costs.find(x => x.month === d.month)?.costs     ?? 0,
    profit:  s.monthly_profit.find(x => x.month === d.month)?.profit   ?? 0,
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
              if (sourceFilter) parts.push(`источник «${sourceFilter}»`);
              if (stageFilter)  parts.push(STAGE_OPTIONS.find(o => o.id === stageFilter)!.label.toLowerCase());
              if (periodFilter !== "all") parts.push(periodLabel(periodFilter, customRange));
              return parts.length
                ? `${parts.join(", ")} — ${s.total_all} заявок`
                : `Всего заявок: ${s.total_all}`;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Фильтр по источнику заявок */}
          <AnalyticsFilterSelect
            icon="Radio"
            value={sourceFilter}
            onChange={v => setSourceFilter(v)}
            options={[{ id: "", label: "Все источники" }, ...sources.map(src => ({ id: src.name, label: src.name }))]}
          />

          {/* Фильтр по стадии сделки */}
          <AnalyticsFilterSelect
            icon="GitBranch"
            value={stageFilter}
            onChange={v => setStageFilter(v as StageFilter)}
            options={STAGE_OPTIONS}
          />

          {/* Фильтр по периоду */}
          <AnalyticsFilterSelect
            icon="CalendarDays"
            value={periodFilter}
            onChange={v => { setPeriodFilter(v as PeriodFilter); setCustomRange(null); }}
            options={periodFilter === "custom"
              ? [...PERIOD_OPTIONS, { id: "custom", label: periodLabel("custom", customRange) }]
              : PERIOD_OPTIONS}
            neutralValue="all"
          />

          {/* Произвольный период через модалку */}
          <button onClick={() => setRangeModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
            style={periodFilter === "custom"
              ? { background: t.accent + "1F", color: t.accentLight, border: `1px solid ${t.accent}55` }
              : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            <Icon name="CalendarRange" size={13} /> Выбрать период
          </button>

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
        <AnalyticsFinance s={s} costPie={costPie} />
      )}

      {tab === "dynamics" && (
        <AnalyticsDynamics s={s} allMerged={allMerged} />
      )}

      {tab === "touches" && (
        <TouchDashboard clients={filteredClients} sourceFilter={sourceFilter} onSelectClient={setDrawerClient} />
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
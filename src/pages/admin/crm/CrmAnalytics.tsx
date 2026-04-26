import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import { Stats, AnalyticsTab, ANALYTICS_TABS, EMPTY_STATS } from "./analyticsTypes";
import AnalyticsOverview from "./AnalyticsOverview";
import AnalyticsFinance from "./AnalyticsFinance";
import AnalyticsDynamics from "./AnalyticsDynamics";

export default function CrmAnalytics() {
  const t = useTheme();
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<AnalyticsTab>("overview");
  const [allClients,    setAllClients]    = useState<Client[]>([]);
  const [drawerClient,  setDrawerClient]  = useState<Client | null>(null);

  useEffect(() => {
    crmFetch("stats").then(d => { setStats(d as Stats); setLoading(false); }).catch(() => setLoading(false));
    crmFetch("clients").then((d: unknown) => {
      if (Array.isArray(d)) setAllClients((d as Client[]).filter((c: Client) => c.status !== "deleted"));
    }).catch(() => {});
  }, []);

  const recentClients = allClients.slice(0, 10);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const s = stats ?? EMPTY_STATS;

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
    { label: "Заявки",            count: s.total_all,     color: "#8b5cf6", pct: 100 },
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
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>Всего заявок: {s.total_all}</p>
        </div>
        <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
          {ANALYTICS_TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition"
              style={{
                background: tab === tb.id ? "#7c3aed22" : "transparent",
                color: tab === tb.id ? "#a78bfa" : t.textMute,
                borderRight: tb.id !== "dynamics" ? `1px solid ${t.border}` : undefined,
              }}>
              <Icon name={tb.icon} size={13} /> {tb.label}
            </button>
          ))}
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

      {/* Drawer клиента */}
      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          allClientOrders={(() => {
            const phone = (drawerClient.phone || "").trim().replace(/\D/g, "");
            return phone ? allClients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone) : [drawerClient];
          })()}
          onClose={() => setDrawerClient(null)}
          onUpdated={() => {
            crmFetch("clients").then((d: unknown) => {
              if (Array.isArray(d)) setAllClients((d as Client[]).filter((c: Client) => c.status !== "deleted"));
            }).catch(() => {});
          }}
          onDeleted={() => {
            setAllClients(prev => prev.filter(c => c.id !== drawerClient.id));
            setDrawerClient(null);
          }}
        />
      )}
    </div>
  );
}
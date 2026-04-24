import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";

// ── Полная цепочка статусов ─────────────────────────────────────────────────
const ALL_STATUSES = [...LEAD_STATUSES, ...ORDER_STATUSES];

const NEXT_STATUS: Record<string, string> = {
  new:               "call",
  call:              "measure",
  measure:           "measured",
  measured:          "contract",
  contract:          "prepaid",
  prepaid:           "install_scheduled",
  install_scheduled: "install_done",
  install_done:      "extra_paid",
  extra_paid:        "done",
};

const NEXT_LABEL: Record<string, string> = {
  new:               "Назначить звонок",
  call:              "Назначить замер",
  measure:           "Замер выполнен",
  measured:          "Подписать договор",
  contract:          "Предоплата получена",
  prepaid:           "Назначить монтаж",
  install_scheduled: "Монтаж выполнен",
  install_done:      "Доплата получена",
  extra_paid:        "Завершить заказ",
};

// ── Группировка по 4 табам ──────────────────────────────────────────────────
const TABS = [
  { id: "leads",    label: "Заявки",    icon: "Inbox",        color: "#8b5cf6", statuses: LEAD_STATUSES as readonly string[],                                   emptyText: "Новых заявок нет" },
  { id: "measures", label: "Замеры",    icon: "Ruler",        color: "#f59e0b", statuses: ["measure","measured"] as readonly string[],                          emptyText: "Нет замеров" },
  { id: "installs", label: "Монтажи",   icon: "Wrench",       color: "#f97316", statuses: ["contract","prepaid","install_scheduled","install_done","extra_paid"] as readonly string[], emptyText: "Нет активных монтажей" },
  { id: "done",     label: "Выполнено", icon: "CheckCircle2", color: "#10b981", statuses: ["done","cancelled"] as readonly string[],                             emptyText: "Нет завершённых заказов" },
] as const;

type TabId = typeof TABS[number]["id"];

const INSTALL_STEPS = [
  { status: "contract",          label: "Договор",    color: "#06b6d4" },
  { status: "prepaid",           label: "Предоплата", color: "#0ea5e9" },
  { status: "install_scheduled", label: "Назначен",   color: "#f97316" },
  { status: "install_done",      label: "Выполнен",   color: "#fb923c" },
  { status: "extra_paid",        label: "Доплата",    color: "#84cc16" },
];

function InstallProgress({ status }: { status: string }) {
  const idx = INSTALL_STEPS.findIndex(s => s.status === status);
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {INSTALL_STEPS.map((s, i) => (
        <div key={s.status} className="flex items-center gap-0.5">
          <div className="w-2 h-2 rounded-full transition-all"
            style={{ background: i <= idx ? s.color : "rgba(128,128,128,0.2)" }} />
          {i < INSTALL_STEPS.length - 1 && (
            <div className="w-3 h-px" style={{ background: i < idx ? s.color : "rgba(128,128,128,0.15)" }} />
          )}
        </div>
      ))}
      <span className="ml-1.5 text-[10px] font-medium" style={{ color: INSTALL_STEPS[idx]?.color || "#999" }}>
        {INSTALL_STEPS[idx]?.label || ""}
      </span>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "25", border: `1.5px solid ${color}40`, color: "#fff" }}>
      {initials}
    </div>
  );
}

// ── Карточка клиента ─────────────────────────────────────────────────────────
function ClientCard({ c, onClick, onNextStep }: {
  c: Client;
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const tab = TABS.find(tb => tb.statuses.includes(c.status));
  const isInstall   = tab?.id === "installs";
  const isCancelled = c.status === "cancelled";
  const isDone      = c.status === "done";
  const nextStatus  = NEXT_STATUS[c.status];
  const nextLabel   = NEXT_LABEL[c.status];

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden transition group"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Кликабельное тело */}
      <div className="p-4 cursor-pointer hover:brightness-[1.03] transition" onClick={onClick}>

        {/* Шапка */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={c.client_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</span>
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: t.textMute }}>#{c.id}</span>
            </div>
            <div className="text-xs truncate mt-0.5" style={{ color: t.textMute }}>{c.phone || "—"}</div>
            {isInstall && <InstallProgress status={c.status} />}
            {!isInstall && (
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            )}
          </div>
        </div>

        {/* Адрес */}
        {(c.address || c.area) && (
          <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: t.textMute }}>
            <Icon name="MapPin" size={10} className="flex-shrink-0" />
            <span className="truncate">{c.address || "—"}</span>
            {c.area && <span className="flex-shrink-0">· {c.area} м²</span>}
          </div>
        )}

        {/* Дата замера */}
        {c.measure_date && !isInstall && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500/70 mb-2">
            <Icon name="Calendar" size={10} />
            <span>{new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
        {/* Дата монтажа */}
        {c.install_date && isInstall && (
          <div className="flex items-center gap-1.5 text-xs text-orange-500/70 mb-2">
            <Icon name="Wrench" size={10} />
            <span>{new Date(c.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        {/* Финансы */}
        {(c.contract_sum || c.prepayment || c.extra_payment) && (
          <div className="flex items-center justify-between text-xs pt-2.5 mt-1"
            style={{ borderTop: `1px solid ${t.border2}` }}>
            {c.contract_sum
              ? <span className="font-bold text-emerald-500">{c.contract_sum.toLocaleString("ru-RU")} ₽</span>
              : <span />}
            {(c.prepayment || c.extra_payment) && (
              <span style={{ color: t.textMute }}>
                оплачено {((c.prepayment||0)+(c.extra_payment||0)).toLocaleString("ru-RU")} ₽
              </span>
            )}
          </div>
        )}

        {/* Причина отказа */}
        {isCancelled && c.cancel_reason && (
          <div className="mt-2 text-[11px] text-red-400/60 rounded-lg px-2.5 py-1.5"
            style={{ background: "rgba(239,68,68,0.07)" }}>
            Отказ: {c.cancel_reason}
          </div>
        )}
      </div>

      {/* ── Кнопка следующего шага ─────────────────────────────────────────── */}
      {nextStatus && !isDone && !isCancelled && (
        <button onClick={handleNext} disabled={stepping}
          className="w-full flex items-center justify-between px-4 py-2.5 transition group/btn disabled:opacity-60"
          style={{
            borderTop: `1px solid ${t.border2}`,
            background: STATUS_COLORS[nextStatus] + "0e",
            color: STATUS_COLORS[nextStatus],
          }}>
          <span className="text-xs font-semibold flex items-center gap-1.5">
            {stepping
              ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Сохраняем...</>
              : <><Icon name="ArrowRight" size={12} /> {nextLabel}</>}
          </span>
          <span className="text-[10px] opacity-60 font-mono"
            style={{ background: STATUS_COLORS[nextStatus] + "20", borderRadius: 4, padding: "1px 5px" }}>
            {STATUS_LABELS[nextStatus]}
          </span>
        </button>
      )}

      {isDone && (
        <div className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-500"
          style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
          <Icon name="CheckCircle2" size={12} /> Заказ завершён
        </div>
      )}
    </div>
  );
}

// ── Главный компонент ───────────────────────────────────────────────────────
export default function CrmOrders() {
  const t = useTheme();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [activeTab, setActiveTab]   = useState<TabId>("leads");
  const [selected, setSelected]     = useState<Client | null>(null);

  const load = () => {
    setLoading(true);
    crmFetch("clients").then(d => {
      setAllClients((Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);  

  // Переход на следующий шаг без открытия drawer
  const handleNextStep = async (id: number, nextStatus: string) => {
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
    // Оптимистично обновляем локально
    setAllClients(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus } : c));
  };

  const getTabClients = (tab: typeof TABS[number]) =>
    allClients.filter(c => tab.statuses.includes(c.status));

  const currentTab     = TABS.find(t => t.id === activeTab)!;
  const currentClients = getTabClients(currentTab);

  const filterSearch = (list: Client[]) => list.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.client_name || "").toLowerCase().includes(q)
      || (c.phone || "").includes(q)
      || (c.address || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Воронка заказов</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>Всего клиентов: {allClients.length}</p>
        </div>
        <div className="relative w-72">
          <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону..."
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
        </div>
      </div>

      {/* Табы */}
      <div className="grid grid-cols-4 gap-3">
        {TABS.map(tab => {
          const clients  = getTabClients(tab);
          const revenue  = clients.reduce((s, c) => s + (c.contract_sum || 0), 0);
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="relative overflow-hidden rounded-2xl p-4 text-left transition"
              style={{
                background: isActive ? tab.color + "12" : t.surface,
                border: `1px solid ${isActive ? tab.color + "45" : t.border}`,
              }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: tab.color + "20" }}>
                  <Icon name={tab.icon} size={13} style={{ color: tab.color }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: t.textSub }}>{tab.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: t.text }}>{clients.length}</div>
              {revenue > 0
                ? <div className="text-[11px] mt-0.5 font-medium" style={{ color: tab.color + "cc" }}>{revenue.toLocaleString("ru-RU")} ₽</div>
                : <div className="text-[11px] mt-0.5" style={{ color: t.textMute }}>клиентов</div>}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: tab.color }} />}
            </button>
          );
        })}
      </div>

      {/* Контент */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "installs" ? (
        <div>
          {/* Подсчёт по шагам */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            {INSTALL_STEPS.map(s => {
              const cnt = allClients.filter(c => c.status === s.status).length;
              return (
                <div key={s.status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border font-medium"
                  style={{ background: s.color + "10", borderColor: s.color + "30", color: s.color }}>
                  {s.label} <span className="font-bold">{cnt}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filterSearch(currentClients).map(c =>
              <ClientCard key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />)}
            {currentClients.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                <Icon name="Wrench" size={28} className="mb-2 opacity-30" />
                <span className="text-sm">Нет активных монтажей</span>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "done" ? (
        <div className="space-y-5">
          {[
            { label: "Завершённые", statuses: ["done"],      color: "#10b981", icon: "CheckCircle2" },
            { label: "Отказники",   statuses: ["cancelled"], color: "#ef4444", icon: "XCircle" },
          ].map(group => {
            const items = filterSearch(currentClients.filter(c => group.statuses.includes(c.status)));
            return (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name={group.icon} size={14} style={{ color: group.color }} />
                  <span className="text-sm font-bold" style={{ color: t.textSub }}>{group.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: group.color + "18", color: group.color }}>{items.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.length === 0
                    ? <div className="col-span-3 py-4 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                    : items.map(c => <ClientCard key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filterSearch(currentClients).map(c =>
            <ClientCard key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />)}
          {currentClients.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
              <Icon name={currentTab.icon} size={28} className="mb-2 opacity-30" />
              <span className="text-sm">{currentTab.emptyText}</span>
            </div>
          )}
        </div>
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); setSelected(null); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

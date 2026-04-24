import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";

// ── Группировка статусов по 4 табам ────────────────────────────────────────
const TABS = [
  {
    id: "leads",
    label: "Заявки",
    icon: "Inbox",
    color: "#8b5cf6",
    statuses: LEAD_STATUSES,
    desc: "Новые обращения до назначения замера",
    emptyText: "Новых заявок нет",
  },
  {
    id: "measures",
    label: "Замеры",
    icon: "Ruler",
    color: "#f59e0b",
    statuses: ["measure", "measured"],
    desc: "Замер назначен или уже выполнен",
    emptyText: "Нет замеров",
  },
  {
    id: "installs",
    label: "Монтажи",
    icon: "Wrench",
    color: "#f97316",
    statuses: ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"],
    desc: "Договор подписан, идёт монтаж",
    emptyText: "Нет активных монтажей",
  },
  {
    id: "done",
    label: "Выполнено",
    icon: "CheckCircle2",
    color: "#10b981",
    statuses: ["done", "cancelled"],
    desc: "Завершённые и отменённые заказы",
    emptyText: "Нет завершённых заказов",
  },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Прогресс внутри таба "Монтажи" ─────────────────────────────────────────
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
            style={{ background: i <= idx ? s.color : "#ffffff12" }} />
          {i < INSTALL_STEPS.length - 1 && (
            <div className="w-3 h-px" style={{ background: i < idx ? s.color : "#ffffff10" }} />
          )}
        </div>
      ))}
      <span className="ml-1.5 text-[10px]" style={{ color: INSTALL_STEPS[idx]?.color || "#666" }}>
        {INSTALL_STEPS[idx]?.label || ""}
      </span>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6", "#3b82f6", "#f59e0b", "#10b981", "#f97316", "#ec4899", "#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: color + "25", border: `1.5px solid ${color}40` }}>
      {initials}
    </div>
  );
}

function ClientCard({ c, onClick }: { c: Client; onClick: () => void }) {
  const tab = TABS.find(t => (t.statuses as readonly string[]).includes(c.status));
  const isInstall = tab?.id === "installs";
  const isDone = c.status === "done";
  const isCancelled = c.status === "cancelled";

  return (
    <div onClick={onClick}
      className="bg-[#0a0a16] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-4 cursor-pointer transition group">
      {/* Шапка */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={c.client_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white/90 truncate">{c.client_name || "Без имени"}</span>
            <span className="text-[10px] text-white/25 font-mono flex-shrink-0">#{c.id}</span>
          </div>
          <div className="text-xs text-white/35 truncate mt-0.5">{c.phone || "—"}</div>
          {isInstall && <InstallProgress status={c.status} />}
          {!isInstall && (
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
              {STATUS_LABELS[c.status] || c.status}
            </span>
          )}
        </div>
      </div>

      {/* Адрес + площадь */}
      {(c.address || c.area) && (
        <div className="flex items-center gap-1.5 text-xs text-white/30 mb-2">
          <Icon name="MapPin" size={10} className="flex-shrink-0" />
          <span className="truncate">{c.address || "Адрес не указан"}</span>
          {c.area && <span className="flex-shrink-0 text-white/20">· {c.area} м²</span>}
        </div>
      )}

      {/* Дата замера или монтажа */}
      {c.measure_date && !isInstall && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400/60 mb-2">
          <Icon name="Calendar" size={10} />
          <span>Замер: {new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
      {c.install_date && isInstall && (
        <div className="flex items-center gap-1.5 text-xs text-orange-400/60 mb-2">
          <Icon name="Calendar" size={10} />
          <span>Монтаж: {new Date(c.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}

      {/* Финансы */}
      {(c.contract_sum || c.prepayment || c.extra_payment) && (
        <div className="flex items-center justify-between text-xs pt-2.5 border-t border-white/[0.04]">
          {c.contract_sum ? (
            <span className="font-bold text-emerald-400">{c.contract_sum.toLocaleString("ru-RU")} ₽</span>
          ) : <span />}
          {(c.prepayment || c.extra_payment) && (
            <span className="text-white/30">оплачено {((c.prepayment||0)+(c.extra_payment||0)).toLocaleString("ru-RU")} ₽</span>
          )}
        </div>
      )}

      {/* Причина отказа */}
      {isCancelled && c.cancel_reason && (
        <div className="mt-2 text-[11px] text-red-400/50 bg-red-500/8 rounded-lg px-2.5 py-1.5">
          Отказ: {c.cancel_reason}
        </div>
      )}

      {/* Стрелка */}
      <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition">
        <Icon name="ChevronRight" size={13} className="text-white/25" />
      </div>
    </div>
  );
}

// ── Колонка таба ────────────────────────────────────────────────────────────
function TabColumn({
  tab, clients, search, onSelect,
}: {
  tab: typeof TABS[number];
  clients: Client[];
  search: string;
  onSelect: (c: Client) => void;
}) {
  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.client_name || "").toLowerCase().includes(q)
      || (c.phone || "").includes(q)
      || (c.address || "").toLowerCase().includes(q);
  });

  // Суммарные метрики
  const totalRevenue = filtered.reduce((s, c) => s + (c.contract_sum || 0), 0);

  return (
    <div className="flex-1 min-w-[280px] max-w-sm flex flex-col">
      {/* Заголовок колонки */}
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: tab.color + "18" }}>
          <Icon name={tab.icon} size={15} style={{ color: tab.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{tab.label}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: tab.color + "18", color: tab.color }}>
              {filtered.length}
            </span>
          </div>
          {totalRevenue > 0 && (
            <div className="text-[11px] text-white/25">{totalRevenue.toLocaleString("ru-RU")} ₽</div>
          )}
        </div>
      </div>

      {/* Разделитель-полоска */}
      <div className="h-0.5 rounded-full mb-3" style={{ background: tab.color + "30" }} />

      {/* Карточки */}
      <div className="space-y-2.5 flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-white/15">
            <Icon name={tab.icon} size={26} className="mb-2 opacity-30" />
            <span className="text-xs">{tab.emptyText}</span>
          </div>
        ) : filtered.map(c => (
          <ClientCard key={c.id} c={c} onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
}

// ── Главный компонент ───────────────────────────────────────────────────────
export default function CrmOrders() {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("leads");
  const [selected, setSelected] = useState<Client | null>(null);

  const load = () => {
    setLoading(true);
    crmFetch("clients", undefined, {}).then(d => {
      // Все кроме удалённых
      const all = (Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted");
      setAllClients(all);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);  

  const getTabClients = (tab: typeof TABS[number]) =>
    allClients.filter(c => (tab.statuses as readonly string[]).includes(c.status));

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const currentClients = getTabClients(currentTab);

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Воронка заказов</h2>
          <p className="text-xs text-white/25 mt-0.5">Всего клиентов: {allClients.length}</p>
        </div>
        {/* Поиск */}
        <div className="relative w-72">
          <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону..."
            className="w-full bg-[#0a0a16] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition" />
        </div>
      </div>

      {/* Табы с метриками */}
      <div className="grid grid-cols-4 gap-3">
        {TABS.map(tab => {
          const clients = getTabClients(tab);
          const revenue = clients.reduce((s, c) => s + (c.contract_sum || 0), 0);
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition border ${
                isActive ? "border-current" : "border-white/[0.05] hover:border-white/[0.1]"
              }`}
              style={isActive ? { background: tab.color + "12", borderColor: tab.color + "40" } : { background: "#0a0a16" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: tab.color + "20" }}>
                  <Icon name={tab.icon} size={13} style={{ color: tab.color }} />
                </div>
                <span className="text-xs font-semibold text-white/70">{tab.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{clients.length}</div>
              {revenue > 0 ? (
                <div className="text-[11px] mt-0.5" style={{ color: tab.color + "cc" }}>
                  {revenue.toLocaleString("ru-RU")} ₽
                </div>
              ) : (
                <div className="text-[11px] mt-0.5 text-white/20">{tab.desc}</div>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: tab.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Контент таба */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Один таб — одна колонка с доп. фильтром по под-статусам */}
          {activeTab === "installs" ? (
            // Монтажи — показываем подгруппы по шагам
            <div>
              {/* Под-фильтр по шагу */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                {INSTALL_STEPS.map(s => {
                  const cnt = allClients.filter(c => c.status === s.status).length;
                  return (
                    <div key={s.status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border"
                      style={{ background: s.color + "10", borderColor: s.color + "30", color: s.color }}>
                      <span>{s.label}</span>
                      <span className="font-bold">{cnt}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {currentClients
                  .filter(c => {
                    if (!search) return true;
                    const q = search.toLowerCase();
                    return (c.client_name || "").toLowerCase().includes(q)
                      || (c.phone || "").includes(q)
                      || (c.address || "").toLowerCase().includes(q);
                  })
                  .map(c => <ClientCard key={c.id} c={c} onClick={() => setSelected(c)} />)}
                {currentClients.length === 0 && (
                  <div className="col-span-3 flex flex-col items-center justify-center py-12 text-white/15">
                    <Icon name="Wrench" size={28} className="mb-2 opacity-30" />
                    <span className="text-sm">Нет активных монтажей</span>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "done" ? (
            // Выполнено — разделяем done и cancelled
            <div className="space-y-5">
              {[
                { label: "Завершённые", statuses: ["done"], color: "#10b981", icon: "CheckCircle2" },
                { label: "Отказники", statuses: ["cancelled"], color: "#ef4444", icon: "XCircle" },
              ].map(group => {
                const items = currentClients.filter(c => group.statuses.includes(c.status) && (
                  !search || (c.client_name||"").toLowerCase().includes(search.toLowerCase())
                    || (c.phone||"").includes(search) || (c.address||"").toLowerCase().includes(search.toLowerCase())
                ));
                return (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name={group.icon} size={14} style={{ color: group.color }} />
                      <span className="text-sm font-bold text-white/70">{group.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background: group.color + "18", color: group.color }}>{items.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {items.length === 0 ? (
                        <div className="col-span-3 py-4 text-white/20 text-sm text-center">Нет записей</div>
                      ) : items.map(c => <ClientCard key={c.id} c={c} onClick={() => setSelected(c)} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Заявки и Замеры — простая сетка
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {currentClients
                .filter(c => {
                  if (!search) return true;
                  const q = search.toLowerCase();
                  return (c.client_name || "").toLowerCase().includes(q)
                    || (c.phone || "").includes(q)
                    || (c.address || "").toLowerCase().includes(q);
                })
                .map(c => <ClientCard key={c.id} c={c} onClick={() => setSelected(c)} />)}
              {currentClients.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-12 text-white/15">
                  <Icon name={currentTab.icon} size={28} className="mb-2 opacity-30" />
                  <span className="text-sm">{currentTab.emptyText}</span>
                </div>
              )}
            </div>
          )}
        </>
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

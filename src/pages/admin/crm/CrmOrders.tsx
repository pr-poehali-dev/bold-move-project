import { useState, useRef, useEffect } from "react";
import type React from "react";
import { crmFetch, Client, getClientOrders } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";
import {
  ORDERS_TABS, INSTALL_STEPS, CustomOrdersTab,
  loadTabLabels, saveTabLabels, loadTabColors, saveTabColors,
  loadTabHidden, saveTabHidden, loadCustomTabs, saveCustomTabs,
} from "./ordersTypes";
import {
  KANBAN_COLS, DROP_STATUS, CustomKanbanCol,
  LS_LABELS,
  loadLabels, loadColors, saveColors,
  loadGlobalWidth, saveGlobalWidth,
} from "./kanbanTypes";
import {
  loadSyncedCustomCols, saveSyncedCustomCols,
  loadSyncedHidden, saveSyncedHidden,
  loadSyncedLabels, saveSyncedLabels,
  loadSyncedColors, saveSyncedColors,
  addSyncedCol, deleteSyncedCol, SyncedCol,
} from "./syncedCols";
import { OrdersClientCard } from "./OrdersClientCard";
import { OrdersClientRow } from "./OrdersClientRow";
import { OrdersTabs } from "./OrdersTabs";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanHeader } from "./KanbanHeader";

interface Props {
  clients: Client[];
  loading: boolean;
  onStatusChange: (id: number, status: string) => void;
  onClientRemoved: (id: number) => void;
  onReload: () => void;
  initialOrderId?: number | null;
}

export default function CrmOrders({ clients: allClients, loading, onStatusChange, onClientRemoved, onReload, initialOrderId }: Props) {
  const t = useTheme();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("leads");
  const [selected, setSelected]   = useState<Client | null>(null);

  useEffect(() => {
    if (!initialOrderId || loading || allClients.length === 0) return;
    const found = allClients.find(c => c.id === initialOrderId);
    if (found) {
      setSelected(found);
      // Убираем ?order= из URL без перезагрузки
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
  }, [initialOrderId, loading, allClients]);
  const [viewMode, setViewMode]   = useState<"grid" | "list" | "kanban">("grid");

  // ── Настройки табов/колонок — ЕДИНЫЙ источник правды ────────────────────────
  const [tabLabels,   setTabLabels]   = useState<Record<string, string>>(loadSyncedLabels);
  const [tabColors,   setTabColors]   = useState<Record<string, string>>(loadSyncedColors);
  const [hiddenTabs,  setHiddenTabs]  = useState<Set<string>>(loadSyncedHidden);
  const [customTabs,  setCustomTabs]  = useState<SyncedCol[]>(loadSyncedCustomCols);

  const handleSaveLabel = (id: string, val: string) => {
    setTabLabels(prev => { const next = { ...prev, [id]: val }; saveSyncedLabels(next); return next; });
  };
  const handleSaveColor = (id: string, color: string) => {
    setTabColors(prev => { const next = { ...prev, [id]: color }; saveSyncedColors(next); return next; });
  };
  const handleDeleteTab = (id: string) => {
    const isBuiltin = ORDERS_TABS.some(t => t.id === id);
    const msg = isBuiltin
      ? `Скрыть этап «${tabLabels[id] || id}»? Он исчезнет из воронки и из канбан-доски.`
      : `Удалить этап «${tabLabels[id] || id}»? Он удалится из воронки и из канбан-доски.`;
    if (!window.confirm(msg)) return;
    deleteSyncedCol(id, isBuiltin);
    if (isBuiltin) {
      setHiddenTabs(prev => { const next = new Set(prev); next.add(id); return next; });
    } else {
      setCustomTabs(prev => prev.filter(c => c.id !== id));
    }
  };
  const handleAddTab = () => {
    const col = addSyncedCol("Новый этап", "#8b5cf6", "Layers");
    setCustomTabs(prev => [...prev, col]);
  };

  // ── Канбан-колонки — читаем из того же хранилища ─────────────────────────────
  const [colLabels,   setColLabels]   = useState<Record<string, string>>(loadSyncedLabels);
  const [colColors,   setColColors]   = useState<Record<string, string>>(loadSyncedColors);
  const [hiddenCols,  setHiddenCols]  = useState<Set<string>>(loadSyncedHidden);
  const [customCols,  setCustomCols]  = useState<CustomKanbanCol[]>(() =>
    loadSyncedCustomCols().map(c => ({ id: c.id, label: c.label, color: c.color, statuses: [] }))
  );
  const [globalWidth, setGlobalWidth] = useState<number>(loadGlobalWidth);
  const [dragging,    setDragging]    = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragRef = useRef<Client | null>(null);

  const saveLabel = (colId: string, val: string) => {
    const next = { ...colLabels, [colId]: val.trim() };
    setColLabels(next); setTabLabels(next); saveSyncedLabels(next);
  };
  const saveColor = (colId: string, color: string) => {
    const next = { ...colColors, [colId]: color };
    setColColors(next); setTabColors(next); saveSyncedColors(next);
  };
  const deleteCol = (colId: string) => {
    const isBuiltin = KANBAN_COLS.some(c => c.id === colId);
    const label = colLabels[colId] || colId;
    const msg = isBuiltin
      ? `Скрыть колонку «${label}»? Она исчезнет из канбана и из воронки.`
      : `Удалить колонку «${label}»? Она удалится из канбана и из воронки.`;
    if (!window.confirm(msg)) return;
    deleteSyncedCol(colId, isBuiltin);
    if (isBuiltin) {
      setHiddenCols(prev => { const next = new Set(prev); next.add(colId); return next; });
      setHiddenTabs(prev => { const next = new Set(prev); next.add(colId); return next; });
    } else {
      setCustomCols(prev => prev.filter(c => c.id !== colId));
      setCustomTabs(prev => prev.filter(c => c.id !== colId));
    }
  };
  const addCol = () => {
    const col = addSyncedCol("Новая колонка", "#8b5cf6", "Layers");
    const kanbanCol: CustomKanbanCol = { id: col.id, label: col.label, color: col.color, statuses: [] };
    setCustomCols(prev => [...prev, kanbanCol]);
    setCustomTabs(prev => [...prev, col]);
  };

  const getColColor = (colId: string, def: string) => colColors[colId] || def;
  const getColLabel = (colId: string, def: string) => colLabels[colId] || def;

  const allKanbanCols = [
    ...KANBAN_COLS.filter(col => !hiddenCols.has(col.id)).map(col => ({
      id: col.id, label: getColLabel(col.id, col.label), color: getColColor(col.id, col.color),
      statuses: col.statuses as readonly string[],
    })),
    ...customCols.map(col => ({
      id: col.id, label: getColLabel(col.id, col.label), color: getColColor(col.id, col.color),
      statuses: [] as readonly string[],
    })),
  ];

  const clientsForCol = (col: { statuses: readonly string[] }) =>
    allClients.filter(c => {
      if (!col.statuses.includes(c.status)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.client_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    });

  const onDragStart = (client: Client) => { dragRef.current = client; setDragging(client); };
  const onDragOver  = (e: React.DragEvent, colId: string) => { e.preventDefault(); setDragOverCol(colId); };
  const onDrop = async (colId: string) => {
    const client = dragRef.current;
    setDragging(null); setDragOverCol(null);
    if (!client) return;
    const newStatus = DROP_STATUS[colId];
    if (!newStatus || client.status === newStatus) return;
    onStatusChange(client.id, newStatus);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: newStatus }) }, { id: String(client.id) });
  };

  // ── Общая логика ─────────────────────────────────────────────────────────────
  const handleNextStep = async (id: number, nextStatus: string) => {
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
    onStatusChange(id, nextStatus);
  };

  const allTabDefs = [
    ...ORDERS_TABS.filter(tab => !hiddenTabs.has(tab.id)).map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: tab.icon,
      color: tabColors[tab.id] || tab.color, statuses: tab.statuses as readonly string[], emptyText: tab.emptyText,
    })),
    ...customTabs.map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: (tab as { icon?: string }).icon || "Layers",
      color: tabColors[tab.id] || tab.color, statuses: [] as readonly string[], emptyText: "Нет данных",
    })),
  ];

  const currentTab     = allTabDefs.find(tab => tab.id === activeTab) ?? allTabDefs[0];
  const currentClients = currentTab ? allClients.filter(c => currentTab.statuses.includes(c.status)) : [];

  const filterSearch = (list: Client[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      (c.client_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    );
  };

  const renderCard = (c: Client) => (
    <OrdersClientCard key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />
  );
  const renderRow = (c: Client) => (
    <OrdersClientRow key={c.id} c={c} onClick={() => setSelected(c)} onNextStep={handleNextStep} />
  );

  // ── Предстоящие и просроченные события ──────────────────────────────────────
  const [eventDays, setEventDays] = useState<1 | 2 | 3 | 7>(3);
  const [pushAsked, setPushAsked] = useState(false);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(now.getDate() + eventDays);

  const upcomingMeasures = allClients.filter(c => {
    if (c.status !== "measure" || !c.measure_date) return false;
    const d = new Date(c.measure_date);
    return d >= now && d <= endDate;
  }).sort((a, b) => new Date(a.measure_date!).getTime() - new Date(b.measure_date!).getTime());

  const upcomingInstalls = allClients.filter(c => {
    if (c.status !== "install_scheduled" || !c.install_date) return false;
    const d = new Date(c.install_date);
    return d >= now && d <= endDate;
  }).sort((a, b) => new Date(a.install_date!).getTime() - new Date(b.install_date!).getTime());

  // Просроченные — дата прошла, статус не сменился
  const overdueM = allClients.filter(c =>
    c.status === "measure" && c.measure_date && new Date(c.measure_date) < now
  ).sort((a, b) => new Date(a.measure_date!).getTime() - new Date(b.measure_date!).getTime());

  const overdueI = allClients.filter(c =>
    c.status === "install_scheduled" && c.install_date && new Date(c.install_date) < now
  ).sort((a, b) => new Date(a.install_date!).getTime() - new Date(b.install_date!).getTime());

  const overdueCount = overdueM.length + overdueI.length;
  const hasEvents = upcomingMeasures.length > 0 || upcomingInstalls.length > 0;

  // Push-уведомление при загрузке если есть просроченные
  useEffect(() => {
    if (loading || pushAsked || overdueCount === 0) return;
    setPushAsked(true);
    if (!("Notification" in window)) return;
    const send = () => {
      new Notification("⚠️ Просроченные события в CRM", {
        body: `${overdueCount} ${overdueCount === 1 ? "событие требует внимания" : "события требуют внимания"} — замеры или монтажи без обновления статуса`,
        icon: "/favicon.ico",
      });
    };
    if (Notification.permission === "granted") {
      send();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => { if (p === "granted") send(); });
    }
  }, [loading, overdueCount, pushAsked]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0,0,0,0);
    const tom   = new Date(today); tom.setDate(today.getDate() + 1);
    const dd    = new Date(d); dd.setHours(0,0,0,0);
    const time  = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (dd.getTime() === today.getTime()) return `Сегодня ${time}`;
    if (dd.getTime() === tom.getTime())   return `Завтра ${time}`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " " + time;
  };

  const fmtOverdue = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Сегодня (не обновлён)";
    if (diff === 1) return "Вчера";
    return `${diff} дн. назад`;
  };

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Воронка заказов</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>Всего клиентов: {allClients.length}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Переключатель вида */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            {([
              { mode: "grid",   icon: "LayoutGrid", label: "Карточки" },
              { mode: "list",   icon: "List",       label: "Список" },
              { mode: "kanban", icon: "Kanban",     label: "Канбан" },
            ] as const).map(({ mode, icon, label }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition"
                style={{
                  background: viewMode === mode ? "#7c3aed22" : "transparent",
                  color: viewMode === mode ? "#7c3aed" : t.textMute,
                  borderRight: mode !== "kanban" ? `1px solid ${t.border}` : undefined,
                }}>
                <Icon name={icon} size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Поиск */}
          <div className="relative w-64">
            <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону..."
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
      </div>

      {/* ── ПРОСРОЧЕННЫЕ СОБЫТИЯ ────────────────────────────────────────────── */}
      {!loading && overdueCount > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "#ef444408", border: "1px solid #ef444430" }}>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="AlertTriangle" size={15} style={{ color: "#ef4444" }} />
            <span className="text-sm font-bold" style={{ color: "#ef4444" }}>Просроченные события</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: "#ef444420", color: "#ef4444" }}>
              {overdueCount}
            </span>
            <span className="text-xs ml-1" style={{ color: "#f87171" }}>— статус не обновлён, дата прошла</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {overdueM.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="Ruler" size={12} style={{ color: "#ef4444" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>
                    Замеры ({overdueM.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overdueM.map(c => (
                    <button key={c.id} onClick={() => setSelected(c)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                      style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#ef4444" }} />
                      <div className="min-w-0 pl-2">
                        <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                        {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                      </div>
                      <div className="text-xs font-semibold whitespace-nowrap ml-3" style={{ color: "#ef4444" }}>
                        {fmtOverdue(c.measure_date!)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {overdueI.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="Wrench" size={12} style={{ color: "#ef4444" }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#ef4444" }}>
                    Монтажи ({overdueI.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overdueI.map(c => (
                    <button key={c.id} onClick={() => setSelected(c)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                      style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#ef4444" }} />
                      <div className="min-w-0 pl-2">
                        <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                        {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                      </div>
                      <div className="text-xs font-semibold whitespace-nowrap ml-3" style={{ color: "#ef4444" }}>
                        {fmtOverdue(c.install_date!)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ПРЕДСТОЯЩИЕ СОБЫТИЯ ─────────────────────────────────────────────── */}
      {!loading && (
        <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Icon name="CalendarClock" size={15} style={{ color: "#a78bfa" }} />
              <span className="text-sm font-bold" style={{ color: t.text }}>Предстоящие события</span>
              {hasEvents && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                  {upcomingMeasures.length + upcomingInstalls.length}
                </span>
              )}
            </div>
            {/* Фильтр дней */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              {([
                { val: 1, label: "Сегодня" },
                { val: 2, label: "Завтра" },
                { val: 3, label: "3 дня" },
                { val: 7, label: "7 дней" },
              ] as const).map(({ val, label }) => (
                <button key={val} onClick={() => setEventDays(val)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                  style={eventDays === val
                    ? { background: "#7c3aed", color: "#fff" }
                    : { color: t.textMute, background: "transparent" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!hasEvents ? (
            <div className="flex items-center gap-2 py-3 text-sm" style={{ color: t.textMute }}>
              <Icon name="CheckCircle2" size={14} className="opacity-50" />
              Нет замеров и монтажей на выбранный период
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Замеры */}
              {upcomingMeasures.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon name="Ruler" size={12} style={{ color: "#f59e0b" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>
                      Замеры ({upcomingMeasures.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {upcomingMeasures.map(c => {
                      const isToday = eventDays >= 1 && new Date(c.measure_date!).toDateString() === now.toDateString();
                      return (
                        <button key={c.id} onClick={() => setSelected(c)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                          style={{
                            background: isToday ? "#f59e0b22" : "#f59e0b12",
                            border: `1px solid ${isToday ? "#f59e0b60" : "#f59e0b30"}`,
                          }}>
                          {isToday && <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#f59e0b" }} />}
                          <div className={`min-w-0 ${isToday ? "pl-2" : ""}`}>
                            <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                            {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                          </div>
                          <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                            {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#f59e0b30", color: "#f59e0b" }}>СЕГОДНЯ</span>}
                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#f59e0b" }}>
                              {fmtDate(c.measure_date!)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Монтажи */}
              {upcomingInstalls.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon name="Wrench" size={12} style={{ color: "#f97316" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f97316" }}>
                      Монтажи ({upcomingInstalls.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {upcomingInstalls.map(c => {
                      const isToday = eventDays >= 1 && new Date(c.install_date!).toDateString() === now.toDateString();
                      return (
                        <button key={c.id} onClick={() => setSelected(c)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition hover:opacity-80 relative overflow-hidden"
                          style={{
                            background: isToday ? "#f9731622" : "#f9731612",
                            border: `1px solid ${isToday ? "#f9731660" : "#f9731630"}`,
                          }}>
                          {isToday && <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: "#f97316" }} />}
                          <div className={`min-w-0 ${isToday ? "pl-2" : ""}`}>
                            <div className="text-sm font-medium truncate" style={{ color: t.text }}>{c.client_name || "Без имени"}</div>
                            {c.phone && <div className="text-xs" style={{ color: t.textMute }}>{c.phone}</div>}
                          </div>
                          <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                            {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#f9731630", color: "#f97316" }}>СЕГОДНЯ</span>}
                            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#f97316" }}>
                              {fmtDate(c.install_date!)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── КАНБАН-ВИД ───────────────────────────────────────────────────────── */}
      {viewMode === "kanban" ? (
        <>
          <KanbanHeader
            clientCount={allClients.length}
            globalWidth={globalWidth}
            search={search}
            onSearch={setSearch}
            onWidthChange={w => { setGlobalWidth(w); saveGlobalWidth(w); }}
            onAddCol={addCol}
          />
          <div className="flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
            {allKanbanCols.map((col, colIdx) => (
              <KanbanColumn
                key={col.id}
                col={col}
                label={col.label}
                colClients={clientsForCol(col)}
                width={globalWidth}
                isLast={colIdx === allKanbanCols.length - 1}
                isOver={dragOverCol === col.id}
                dragging={dragging}
                canDelete={true}
                onDragStart={onDragStart}
                onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
                onDragOver={onDragOver}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={onDrop}
                onOpen={setSelected}
                onNextStep={handleNextStep}
                onStartResize={() => {}}
                resizeBorderColor={t.border}
                onSaveLabel={saveLabel}
                onSaveColor={saveColor}
                onDelete={deleteCol}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Табы */}
          <OrdersTabs
            allClients={allClients}
            activeTab={activeTab}
            onSelect={setActiveTab}
            tabLabels={tabLabels}
            tabColors={tabColors}
            hiddenTabs={hiddenTabs}
            customTabs={customTabs}
            onSaveLabel={handleSaveLabel}
            onSaveColor={handleSaveColor}
            onDeleteTab={handleDeleteTab}
            onAddTab={handleAddTab}
          />

          {/* ── КОНТЕНТ КАРТОЧКИ / СПИСОК ────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === "installs" ? (
            <div>
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
              {viewMode === "list" ? (
                <div className="space-y-2">
                  {filterSearch(currentClients).map(renderRow)}
                  {currentClients.length === 0 && <div className="py-12 text-sm text-center" style={{ color: t.textMute }}>Нет активных монтажей</div>}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filterSearch(currentClients).map(renderCard)}
                  {currentClients.length === 0 && (
                    <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                      <Icon name="Wrench" size={28} className="mb-2 opacity-30" />
                      <span className="text-sm">Нет активных монтажей</span>
                    </div>
                  )}
                </div>
              )}
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
                    {viewMode === "list" ? (
                      <div className="space-y-2">
                        {items.length === 0
                          ? <div className="py-4 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                          : items.map(renderRow)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {items.length === 0
                          ? <div className="col-span-3 py-4 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                          : items.map(renderCard)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {filterSearch(currentClients).map(renderRow)}
              {currentClients.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                  <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
                  <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filterSearch(currentClients).map(renderCard)}
              {currentClients.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                  <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
                  <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          defaultTab="orders"
          defaultOrderId={selected.id}
          allClientOrders={getClientOrders(selected, allClients)}
          onClose={() => setSelected(null)}
          onUpdated={() => { onReload(); }}
          onDeleted={() => { setSelected(null); onClientRemoved(selected.id); }}
        />
      )}
    </div>
  );
}
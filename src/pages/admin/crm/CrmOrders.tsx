import { useState, useRef } from "react";
import type React from "react";
import { crmFetch, Client } from "./crmApi";
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
  LS_HIDDEN, LS_LABELS, LS_COLORS,
  loadHidden, loadLabels, loadColors, saveColors,
  loadCustomCols, saveCustomCols,
  loadGlobalWidth, saveGlobalWidth,
} from "./kanbanTypes";
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
}

export default function CrmOrders({ clients: allClients, loading, onStatusChange, onClientRemoved, onReload }: Props) {
  const t = useTheme();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("leads");
  const [selected, setSelected]   = useState<Client | null>(null);
  const [viewMode, setViewMode]   = useState<"grid" | "list" | "kanban">("grid");

  // ── Настройки табов ──────────────────────────────────────────────────────────
  const [tabLabels,  setTabLabels]  = useState<Record<string, string>>(loadTabLabels);
  const [tabColors,  setTabColors]  = useState<Record<string, string>>(loadTabColors);
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(loadTabHidden);
  const [customTabs, setCustomTabs] = useState<CustomOrdersTab[]>(loadCustomTabs);

  const handleSaveLabel = (id: string, val: string) => {
    setTabLabels(prev => { const next = { ...prev, [id]: val }; saveTabLabels(next); return next; });
  };
  const handleSaveColor = (id: string, color: string) => {
    setTabColors(prev => { const next = { ...prev, [id]: color }; saveTabColors(next); return next; });
  };
  const handleDeleteTab = (id: string) => {
    const isDefault = ORDERS_TABS.some(t => t.id === id);
    if (isDefault) {
      setHiddenTabs(prev => { const next = new Set(prev); next.add(id); saveTabHidden(next); return next; });
    } else {
      setCustomTabs(prev => { const next = prev.filter(t => t.id !== id); saveCustomTabs(next); return next; });
    }
  };
  const handleAddTab = () => {
    const id = `custom_tab_${Date.now()}`;
    const newTab: CustomOrdersTab = { id, label: "Новый таб", color: "#8b5cf6", icon: "Layers", statuses: [], emptyText: "Нет данных" };
    setCustomTabs(prev => { const next = [...prev, newTab]; saveCustomTabs(next); return next; });
  };

  // ── Настройки канбан-колонок ─────────────────────────────────────────────────
  const [hiddenCols,  setHiddenCols]  = useState<Set<string>>(loadHidden);
  const [colLabels,   setColLabels]   = useState<Record<string, string>>(loadLabels);
  const [colColors,   setColColors]   = useState<Record<string, string>>(loadColors);
  const [customCols,  setCustomCols]  = useState<CustomKanbanCol[]>(loadCustomCols);
  const [globalWidth, setGlobalWidth] = useState<number>(loadGlobalWidth);
  const [dragging,    setDragging]    = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragRef = useRef<Client | null>(null);

  const saveLabel = (colId: string, val: string) => {
    setColLabels(prev => { const next = { ...prev, [colId]: val.trim() }; localStorage.setItem(LS_LABELS, JSON.stringify(next)); return next; });
  };
  const saveColor = (colId: string, color: string) => {
    setColColors(prev => { const next = { ...prev, [colId]: color }; saveColors(next); return next; });
  };
  const deleteCol = (colId: string) => {
    if (KANBAN_COLS.some(c => c.id === colId)) {
      setHiddenCols(prev => { const next = new Set(prev); next.add(colId); localStorage.setItem(LS_HIDDEN, JSON.stringify([...next])); return next; });
    } else {
      setCustomCols(prev => { const next = prev.filter(c => c.id !== colId); saveCustomCols(next); return next; });
    }
  };
  const addCol = () => {
    const id = `custom_col_${Date.now()}`;
    const newCol: CustomKanbanCol = { id, label: "Новая колонка", color: "#8b5cf6", statuses: [] };
    setCustomCols(prev => { const next = [...prev, newCol]; saveCustomCols(next); return next; });
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
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: tab.icon,
      color: tabColors[tab.id] || tab.color, statuses: tab.statuses as readonly string[], emptyText: tab.emptyText,
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
          allClientOrders={(() => {
            const phone = (selected.phone || "").trim().replace(/\D/g, "");
            return phone ? allClients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone) : [selected];
          })()}
          onClose={() => setSelected(null)}
          onUpdated={() => { onReload(); }}
          onDeleted={() => { setSelected(null); onClientRemoved(selected.id); }}
        />
      )}
    </div>
  );
}

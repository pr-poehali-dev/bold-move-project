import { useState, useRef } from "react";
import type React from "react";
import Icon from "@/components/ui/icon";
import { crmFetch, Client, getClientOrders } from "./crmApi";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";
import { KanbanHeader } from "./KanbanHeader";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanMobileView } from "./KanbanMobileView";
import {
  KANBAN_COLS, DROP_STATUS, CustomKanbanCol,
  loadGlobalWidth, saveGlobalWidth,
} from "./kanbanTypes";
import {
  loadSyncedCustomCols, loadSyncedHidden, loadSyncedLabels, loadSyncedColors,
  saveSyncedLabels, saveSyncedColors, addSyncedCol, deleteSyncedCol,
} from "./syncedCols";

interface Props {
  clients: Client[];
  loading: boolean;
  onStatusChange: (id: number, status: string) => void;
  onClientRemoved: (id: number) => void;
  onReload: () => void;
  onRemoveBoard?: () => void;
}

const LS_LOCAL_CARDS = "kanban_board_local_cards";

function loadLocalCards(): Client[] {
  try { return JSON.parse(localStorage.getItem(LS_LOCAL_CARDS) || "[]"); } catch { return []; }
}
function saveLocalCards(cards: Client[]) {
  localStorage.setItem(LS_LOCAL_CARDS, JSON.stringify(cards));
}

export default function CrmKanban({ clients, loading, onStatusChange, onClientRemoved, onReload, onRemoveBoard }: Props) {
  const t = useTheme();
  const [selected, setSelected]       = useState<Client | null>(null);
  const [dragging, setDragging]       = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const dragRef = useRef<Client | null>(null);

  // Локальные карточки (заметки) — хранятся в localStorage
  const [localCards, setLocalCards] = useState<Client[]>(loadLocalCards);

  const [globalWidth, setGlobalWidth] = useState<number>(loadGlobalWidth);
  const [hiddenCols,  setHiddenCols]  = useState<Set<string>>(loadSyncedHidden);
  const [colLabels,   setColLabels]   = useState<Record<string, string>>(loadSyncedLabels);
  const [colColors,   setColColors]   = useState<Record<string, string>>(loadSyncedColors);
  const [customCols,  setCustomCols]  = useState<CustomKanbanCol[]>(() =>
    loadSyncedCustomCols().map(c => ({ id: c.id, label: c.label, color: c.color, statuses: [] }))
  );

  const handleWidthChange = (w: number) => { setGlobalWidth(w); saveGlobalWidth(w); };

  const saveLabel = (colId: string, val: string) => {
    setColLabels(prev => { const next = { ...prev, [colId]: val.trim() }; saveSyncedLabels(next); return next; });
  };

  const saveColor = (colId: string, color: string) => {
    setColColors(prev => { const next = { ...prev, [colId]: color }; saveSyncedColors(next); return next; });
  };

  // Удаление колонки — синхронизируется с Заказами
  const deleteCol = (colId: string) => {
    const isBuiltin = KANBAN_COLS.some(c => c.id === colId);
    const label = colLabels[colId] || colId;
    const msg = isBuiltin
      ? `Скрыть колонку «${label}»? Она исчезнет из канбана и из воронки заказов.`
      : `Удалить колонку «${label}»? Она удалится из канбана и из воронки заказов.`;
    if (!window.confirm(msg)) return;
    deleteSyncedCol(colId, isBuiltin);
    if (isBuiltin) {
      setHiddenCols(prev => { const next = new Set(prev); next.add(colId); return next; });
    } else {
      setCustomCols(prev => prev.filter(c => c.id !== colId));
    }
  };

  // Добавление — синхронизируется с Заказами
  const addCol = () => {
    const col = addSyncedCol("Новая колонка", "#8b5cf6", "Layers");
    setCustomCols(prev => [...prev, { id: col.id, label: col.label, color: col.color, statuses: [] }]);
  };

  const getColColor = (colId: string, defaultColor: string) => colColors[colId] || defaultColor;
  const getColLabel = (colId: string, defaultLabel: string) => colLabels[colId] || defaultLabel;



  // Все видимые колонки: дефолтные (не скрытые) + кастомные
  const defaultCols = KANBAN_COLS
    .filter(col => !hiddenCols.has(col.id))
    .map(col => ({
      id: col.id,
      label: getColLabel(col.id, col.label),
      color: getColColor(col.id, col.color),
      statuses: col.statuses as readonly string[],
      isDefault: true,
    }));

  const customColsMapped = customCols.map(col => ({
    id: col.id,
    label: getColLabel(col.id, col.label),
    color: getColColor(col.id, col.color),
    statuses: [] as readonly string[],
    isDefault: false,
  }));

  const allCols = [...defaultCols, ...customColsMapped];

  // Все карточки: реальные клиенты + локальные заметки
  const allCards = [...clients, ...localCards];

  const clientsForCol = (col: { id: string; statuses: readonly string[] }) => {
    const colStatus = DROP_STATUS[col.id] || col.id;
    return allCards.filter(c => {
      const match = col.statuses.length > 0
        ? col.statuses.includes(c.status)
        : c.status === colStatus;
      if (!match) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.client_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    });
  };

  const addCard = (colId: string, providedName?: string) => {
    const name = providedName ?? prompt("Имя / название карточки:");
    if (!name?.trim()) return;
    const colStatus = DROP_STATUS[colId] || colId;
    const newCard: Client = {
      id: -(Date.now()),
      session_id: "",
      client_name: name.trim(),
      phone: "",
      status: colStatus,
      measure_date: null, install_date: null, notes: null, address: null,
      area: null, budget: null, source: null, created_at: new Date().toISOString(),
      contract_sum: null, prepayment: null, extra_payment: null, extra_agreement_sum: null,
      responsible_phone: null, map_link: null, tags: null,
      photo_before_url: null, photo_after_url: null, document_url: null,
      material_cost: null, measure_cost: null, install_cost: null, cancel_reason: null,
    };
    setLocalCards(prev => { const next = [...prev, newCard]; saveLocalCards(next); return next; });
  };

  const onDragStart = (client: Client) => { dragRef.current = client; setDragging(client); };
  const onDragOver  = (e: React.DragEvent, colId: string) => { e.preventDefault(); setDragOverCol(colId); };
  const onDrop = async (colId: string) => {
    const client = dragRef.current;
    setDragging(null); setDragOverCol(null);
    if (!client) return;
    const newStatus = DROP_STATUS[colId] || colId;
    // Локальная карточка — обновляем только в localStorage
    if (client.id < 0) {
      setLocalCards(prev => { const next = prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c); saveLocalCards(next); return next; });
      return;
    }
    if (client.status === newStatus) return;
    onStatusChange(client.id, newStatus);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: newStatus }) }, { id: String(client.id) });
  };

  const handleNextStep = async (id: number, nextStatus: string) => {
    if (id < 0) {
      setLocalCards(prev => { const next = prev.map(c => c.id === id ? { ...c, status: nextStatus } : c); saveLocalCards(next); return next; });
      return;
    }
    onStatusChange(id, nextStatus);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      <KanbanHeader
        clientCount={allCards.length}
        globalWidth={globalWidth}
        search={search}
        onSearch={setSearch}
        onWidthChange={handleWidthChange}
        onAddCol={addCol}
        onRemoveBoard={onRemoveBoard}
      />

      {/* ── МОБИЛЕ ── */}
      <div className="sm:hidden">
        <KanbanMobileView
          cols={allCols}
          clientsForCol={clientsForCol}
          onOpen={setSelected}
          onNextStep={handleNextStep}
          onDrop={onDrop}
          onDragStart={onDragStart}
          onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
          dragging={dragging}
          onAddCard={(colId, name) => addCard(colId, name)}
        />
      </div>

      {/* ── ДЕСКТОП ── */}
      <div className="hidden sm:flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
        {allCols.map((col, colIdx) => (
          <KanbanColumn
            key={col.id}
            col={col}
            label={col.label}
            colClients={clientsForCol(col)}
            width={globalWidth}
            isLast={colIdx === allCols.length - 1}
            isOver={dragOverCol === col.id}
            dragging={dragging}
            canDelete={true}
            onAddCard={addCard}
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

      {selected && (
        <ClientDrawer
          client={selected}
          allClientOrders={getClientOrders(selected, allCards)}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            if (selected.id < 0) return;
            onReload();
          }}
          onDeleted={() => {
            setSelected(null);
            if (selected.id < 0) {
              setLocalCards(prev => { const next = prev.filter(c => c.id !== selected.id); saveLocalCards(next); return next; });
            } else {
              onClientRemoved(selected.id);
            }
          }}
          isLocalCard={selected.id < 0}
        />
      )}
    </div>
  );
}
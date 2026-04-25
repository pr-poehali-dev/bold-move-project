import { useEffect, useState, useRef, useCallback } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import ClientDrawer from "./ClientDrawer";

// Колонки канбана жёстко привязаны к статусам воронки — синхронизация с Заказами
const KANBAN_COLS = [
  { id: "new",               label: "Новые заявки", color: "#8b5cf6", statuses: ["new"]                                                          },
  { id: "working",           label: "В работе",     color: "#a78bfa", statuses: ["call"]                                                         },
  { id: "measures",          label: "Замеры",        color: "#f59e0b", statuses: ["measure", "measured"]                                          },
  { id: "installs",          label: "Монтажи",       color: "#f97316", statuses: ["contract","prepaid","install_scheduled","install_done","extra_paid"] },
  { id: "done",              label: "Выполнено",     color: "#10b981", statuses: ["done"]                                                         },
  { id: "cancelled",         label: "Отказники",     color: "#ef4444", statuses: ["cancelled"]                                                    },
] as const;

type ColId = typeof KANBAN_COLS[number]["id"];

// При переносе в колонку — ставим этот статус
const DROP_STATUS: Record<ColId, string> = {
  new:       "new",
  working:   "call",
  measures:  "measure",
  installs:  "contract",
  done:      "done",
  cancelled: "cancelled",
};

// Следующий шаг воронки
const NEXT_STATUS: Record<string, string> = {
  new: "call", call: "measure", measure: "measured", measured: "contract",
  contract: "prepaid", prepaid: "install_scheduled",
  install_scheduled: "install_done", install_done: "extra_paid", extra_paid: "done",
};
const NEXT_LABEL: Record<string, string> = {
  new: "Взять в работу", call: "Назначить замер", measure: "Замер выполнен",
  measured: "Подписать договор", contract: "Предоплата", prepaid: "Назначить монтаж",
  install_scheduled: "Монтаж выполнен", install_done: "Доплата", extra_paid: "Завершить",
};

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white"
      style={{ background: color + "40", border: `1.5px solid ${color}60` }}>
      {initials}
    </div>
  );
}

function KanbanCard({ client, onOpen, onNextStep, dragging }: {
  client: Client;
  onOpen: () => void;
  onNextStep: (id: number, status: string) => void;
  dragging: boolean;
}) {
  const t = useTheme();
  const [stepping, setStepping] = useState(false);
  const color = STATUS_COLORS[client.status] || "#8b5cf6";
  const next = NEXT_STATUS[client.status];
  const nextLabel = NEXT_LABEL[client.status];

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!next || stepping) return;
    setStepping(true);
    await onNextStep(client.id, next);
    setStepping(false);
  };

  return (
    <div
      draggable
      onClick={onOpen}
      className={`rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition select-none ${dragging ? "opacity-40 scale-95" : ""}`}
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Тело карточки */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <Avatar name={client.client_name || "?"} color={color} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: t.text }}>
              {client.client_name || "Без имени"}
            </div>
            {client.phone && (
              <div className="text-[10px] truncate mt-0.5" style={{ color: t.textMute }}>{client.phone}</div>
            )}
          </div>
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: t.textMute }}>#{client.id}</span>
        </div>

        {/* Статус бейдж */}
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md font-medium mb-2"
          style={{ background: color + "20", color }}>
          {STATUS_LABELS[client.status] || client.status}
        </span>

        {/* Адрес */}
        {client.address && (
          <div className="flex items-center gap-1 text-[10px] mb-1.5" style={{ color: t.textMute }}>
            <Icon name="MapPin" size={9} />
            <span className="truncate">{client.address}</span>
          </div>
        )}

        {/* Сумма */}
        {client.contract_sum ? (
          <div className="text-xs font-bold text-emerald-500">{client.contract_sum.toLocaleString("ru-RU")} ₽</div>
        ) : null}
      </div>

      {/* Кнопка следующего шага */}
      {next && client.status !== "done" && client.status !== "cancelled" && (
        <button onClick={handleNext} disabled={stepping}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold transition disabled:opacity-50"
          style={{ borderTop: `1px solid ${t.border2}`, background: color + "0c", color }}>
          <span className="flex items-center gap-1">
            {stepping
              ? <><div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> Сохраняем...</>
              : <><Icon name="ArrowRight" size={10} /> {nextLabel}</>}
          </span>
          <span className="opacity-50">{STATUS_LABELS[next]}</span>
        </button>
      )}
      {client.status === "done" && (
        <div className="px-3 py-2 text-[10px] font-semibold text-emerald-500 flex items-center gap-1"
          style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
          <Icon name="CheckCircle2" size={10} /> Завершён
        </div>
      )}
    </div>
  );
}

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const LS_KEY = "kanban_col_widths";

function loadWidths(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function saveWidths(w: Record<string, number>) {
  localStorage.setItem(LS_KEY, JSON.stringify(w));
}

export default function CrmKanban() {
  const t = useTheme();
  const [clients, setClients]       = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Client | null>(null);
  const [dragging, setDragging]     = useState<Client | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColId | null>(null);
  const [search, setSearch]         = useState("");
  const dragRef = useRef<Client | null>(null);

  // Ширины колонок
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadWidths);
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  const getWidth = (colId: string) => colWidths[colId] ?? DEFAULT_WIDTH;

  const startResize = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { colId, startX: e.clientX, startW: getWidth(colId) };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.startW + delta));
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colId]: newW }));
    };
    const onUp = () => {
      if (resizeRef.current) {
        setColWidths(prev => {
          saveWidths(prev);
          return prev;
        });
        resizeRef.current = null;
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]); // eslint-disable-line

  const load = () => {
    crmFetch("clients").then(d => {
      setClients((Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const clientsForCol = (col: typeof KANBAN_COLS[number]) =>
    clients.filter(c => {
      if (!col.statuses.includes(c.status as never)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.client_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    });

  // Drag & drop
  const onDragStart = (client: Client) => {
    dragRef.current = client;
    setDragging(client);
  };
  const onDragOver = (e: React.DragEvent, colId: ColId) => {
    e.preventDefault();
    setDragOverCol(colId);
  };
  const onDrop = async (colId: ColId) => {
    const client = dragRef.current;
    setDragging(null);
    setDragOverCol(null);
    if (!client) return;
    const newStatus = DROP_STATUS[colId];
    if (client.status === newStatus) return;
    // Оптимистичное обновление
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: newStatus }) }, { id: String(client.id) });
  };

  const handleNextStep = async (id: number, nextStatus: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus } : c));
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({ status: nextStatus }) }, { id: String(id) });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: t.text }}>Канбан-доска</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            {clients.length} клиентов · перетащи карточку для смены этапа
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(colWidths).length > 0 && (
            <button
              onClick={() => { setColWidths({}); localStorage.removeItem(LS_KEY); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textMute }}
              title="Сбросить ширины колонок">
              <Icon name="RotateCcw" size={12} /> Сбросить
            </button>
          )}
          <div className="relative w-64">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону..."
              className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
      </div>

      {/* Колонки */}
      <div className="flex overflow-x-auto pb-4 select-none" style={{ minHeight: 520, gap: 0 }}>
        {KANBAN_COLS.map((col, colIdx) => {
          const colClients = clientsForCol(col);
          const revenue = colClients.reduce((s, c) => s + (c.contract_sum || 0), 0);
          const isOver = dragOverCol === col.id;
          const w = getWidth(col.id);

          return (
            <div key={col.id} className="flex flex-shrink-0" style={{ width: w }}>
              {/* Колонка */}
              <div
                className="flex flex-col rounded-2xl transition-all"
                style={{ width: "100%", margin: "0 6px" }}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => onDrop(col.id)}>

                {/* Заголовок */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-t-2xl"
                  style={{ background: col.color + "18", borderBottom: `2px solid ${col.color}` }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                    <span className="text-xs font-bold truncate" style={{ color: t.text }}>{col.label}</span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: col.color + "25", color: col.color }}>{colClients.length}</span>
                  </div>
                  {revenue > 0 && w > 180 && (
                    <span className="text-[10px] font-semibold flex-shrink-0 ml-1" style={{ color: col.color + "bb" }}>
                      {revenue.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>

                {/* Карточки */}
                <div
                  className="flex-1 p-2 space-y-2 rounded-b-2xl transition-all"
                  style={{
                    background: isOver ? col.color + "08" : t.surface2,
                    border: isOver ? `2px dashed ${col.color}60` : `2px solid transparent`,
                    borderTop: "none",
                  }}>
                  {colClients.map(c => (
                    <div key={c.id}
                      onDragStart={() => onDragStart(c)}
                      onDragEnd={() => { setDragging(null); setDragOverCol(null); }}>
                      <KanbanCard
                        client={c}
                        dragging={dragging?.id === c.id}
                        onOpen={() => setSelected(c)}
                        onNextStep={handleNextStep}
                      />
                    </div>
                  ))}

                  {colClients.length === 0 && !isOver && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-40">
                      <Icon name="Inbox" size={20} style={{ color: t.textMute }} />
                      <span className="text-xs" style={{ color: t.textMute }}>Нет клиентов</span>
                    </div>
                  )}

                  {isOver && (
                    <div className="rounded-xl border-2 border-dashed py-6 flex items-center justify-center"
                      style={{ borderColor: col.color, background: col.color + "08" }}>
                      <span className="text-xs font-semibold" style={{ color: col.color }}>Переместить сюда</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ручка resize — между колонками */}
              {colIdx < KANBAN_COLS.length - 1 && (
                <div
                  className="flex-shrink-0 flex items-center justify-center group"
                  style={{ width: 8, cursor: "col-resize", zIndex: 10 }}
                  onMouseDown={e => startResize(e, col.id)}>
                  <div
                    className="rounded-full transition-all group-hover:opacity-100 opacity-0"
                    style={{
                      width: 3,
                      height: 40,
                      background: t.border,
                      transition: "opacity 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#7c3aed")}
                    onMouseLeave={e => (e.currentTarget.style.background = t.border)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      {selected && (
        <ClientDrawer
          client={selected}
          allClientOrders={(() => {
            const phone = (selected.phone || "").trim().replace(/\D/g, "");
            return phone ? clients.filter(c => (c.phone || "").trim().replace(/\D/g, "") === phone) : [selected];
          })()}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); setSelected(null); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
import { useEffect, useState, useRef } from "react";
import { crmFetch, PRIORITY_LABELS, PRIORITY_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";

interface KanbanColumn {
  id: number;
  title: string;
  color: string;
  position: number;
}

interface KanbanCard {
  id: number;
  column_id: number;
  client_id: number | null;
  title: string;
  description: string;
  phone: string;
  amount: number | null;
  priority: string;
  position: number;
  due_date: string | null;
  client_name?: string;
}

const DEFAULT_COLORS = ["#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#f97316","#10b981","#ef4444","#ec4899"];

export default function CrmKanban() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [dragging, setDragging] = useState<KanbanCard | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [editCol, setEditCol] = useState<KanbanColumn | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState("#8b5cf6");
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [addCardCol, setAddCardCol] = useState<number | null>(null);
  const [newCard, setNewCard] = useState({ title: "", description: "", phone: "", amount: "", priority: "medium", due_date: "" });
  const dragRef = useRef<KanbanCard | null>(null);

  const loadAll = () => {
    Promise.all([
      crmFetch("kanban-columns"),
      crmFetch("kanban-cards"),
    ]).then(([cols, cds]) => {
      setColumns(Array.isArray(cols) ? cols.sort((a: KanbanColumn, b: KanbanColumn) => a.position - b.position) : []);
      setCards(Array.isArray(cds) ? cds : []);
    });
  };

  useEffect(() => { loadAll(); }, []);

  const cardsForCol = (colId: number) => cards.filter(c => c.column_id === colId).sort((a, b) => a.position - b.position);

  // Drag & drop
  const onDragStart = (card: KanbanCard) => { dragRef.current = card; setDragging(card); };
  const onDragOver = (e: React.DragEvent, colId: number) => { e.preventDefault(); setDragOver(colId); };
  const onDrop = async (colId: number) => {
    const card = dragRef.current;
    setDragging(null); setDragOver(null);
    if (!card || card.column_id === colId) return;
    await crmFetch("kanban-cards", { method: "PUT", body: JSON.stringify({ column_id: colId }) }, { id: String(card.id) });
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, column_id: colId } : c));
  };

  const addColumn = async () => {
    if (!newColTitle.trim()) return;
    await crmFetch("kanban-columns", { method: "POST", body: JSON.stringify({ title: newColTitle, color: newColColor }) });
    setShowAddCol(false); setNewColTitle(""); setNewColColor("#8b5cf6");
    loadAll();
  };

  const saveCol = async () => {
    if (!editCol) return;
    await crmFetch("kanban-columns", { method: "PUT", body: JSON.stringify({ title: editCol.title, color: editCol.color }) }, { id: String(editCol.id) });
    setEditCol(null); loadAll();
  };

  const addCard = async () => {
    if (!newCard.title.trim() || !addCardCol) return;
    await crmFetch("kanban-cards", { method: "POST", body: JSON.stringify({ ...newCard, column_id: addCardCol, amount: newCard.amount ? +newCard.amount : null }) });
    setAddCardCol(null); setNewCard({ title: "", description: "", phone: "", amount: "", priority: "medium", due_date: "" });
    loadAll();
  };

  const saveCard = async () => {
    if (!editCard) return;
    await crmFetch("kanban-cards", { method: "PUT", body: JSON.stringify(editCard) }, { id: String(editCard.id) });
    setEditCard(null); loadAll();
  };

  const deleteCard = async (id: number) => {
    await crmFetch("kanban-cards", { method: "DELETE" }, { id: String(id) });
    setEditCard(null); loadAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Канбан-доска</h2>
        <button onClick={() => setShowAddCol(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">
          <Icon name="Plus" size={14} /> Добавить колонку
        </button>
      </div>

      {/* Колонки */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {columns.map(col => (
          <div key={col.id} className={`flex-shrink-0 w-72 rounded-xl flex flex-col transition-all ${dragOver === col.id ? "ring-2 ring-violet-500" : ""}`}
            onDragOver={e => onDragOver(e, col.id)} onDrop={() => onDrop(col.id)}>
            {/* Заголовок */}
            <div className="flex items-center justify-between px-4 py-3 rounded-t-xl" style={{ background: col.color + "22", borderBottom: `2px solid ${col.color}` }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                <span className="text-sm font-semibold text-white">{col.title}</span>
                <span className="text-xs text-white/40 ml-1">{cardsForCol(col.id).length}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setAddCardCol(col.id)} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition"><Icon name="Plus" size={13} /></button>
                <button onClick={() => setEditCol(col)} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition"><Icon name="Settings" size={13} /></button>
              </div>
            </div>

            {/* Карточки */}
            <div className="flex-1 bg-[#080812] rounded-b-xl p-2 space-y-2 min-h-32">
              {cardsForCol(col.id).map(card => (
                <div key={card.id} draggable
                  onDragStart={() => onDragStart(card)}
                  onDragEnd={() => { setDragging(null); setDragOver(null); }}
                  onClick={() => setEditCard(card)}
                  className={`bg-[#0e0e1c] border border-white/[0.06] rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-white/[0.12] transition ${dragging?.id === card.id ? "opacity-40" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-white leading-tight">{card.title}</span>
                    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: PRIORITY_COLORS[card.priority] + "33", color: PRIORITY_COLORS[card.priority] }}>
                      {PRIORITY_LABELS[card.priority]}
                    </span>
                  </div>
                  {card.description && <p className="text-xs text-white/40 mb-2 line-clamp-2">{card.description}</p>}
                  <div className="flex flex-wrap gap-2 text-xs text-white/40">
                    {card.phone && <span className="flex items-center gap-1"><Icon name="Phone" size={11} />{card.phone}</span>}
                    {card.amount && <span className="flex items-center gap-1 text-emerald-400"><Icon name="Banknote" size={11} />{card.amount.toLocaleString("ru-RU")} ₽</span>}
                    {card.due_date && <span className="flex items-center gap-1"><Icon name="Calendar" size={11} />{new Date(card.due_date).toLocaleDateString("ru-RU")}</span>}
                  </div>
                </div>
              ))}

              {/* Добавить карточку */}
              <button onClick={() => setAddCardCol(col.id)}
                className="w-full py-2 rounded-xl border border-dashed border-white/[0.06] hover:border-white/[0.15] text-xs text-white/25 hover:text-white/50 transition flex items-center justify-center gap-1">
                <Icon name="Plus" size={12} /> Добавить карточку
              </button>
            </div>
          </div>
        ))}

        {/* Кнопка новой колонки */}
        <button onClick={() => setShowAddCol(true)}
          className="flex-shrink-0 w-72 min-h-32 rounded-xl border-2 border-dashed border-white/[0.05] hover:border-violet-500/30 text-white/20 hover:text-violet-400 transition flex items-center justify-center gap-2 text-sm">
          <Icon name="Plus" size={16} /> Новая колонка
        </button>
      </div>

      {/* Модалка добавления колонки */}
      {showAddCol && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAddCol(false)}>
          <div className="bg-[#0e0e1c] border border-white/[0.07] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Новая колонка</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Название</label>
                <input value={newColTitle} onChange={e => setNewColTitle(e.target.value)} placeholder="Например: В обработке"
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block">Цвет</label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition ${newColColor === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addColumn} disabled={!newColTitle.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-lg transition">Создать</button>
              <button onClick={() => setShowAddCol(false)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка редактирования колонки */}
      {editCol && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditCol(null)}>
          <div className="bg-[#0e0e1c] border border-white/[0.07] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Редактировать колонку</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Название</label>
                <input value={editCol.title} onChange={e => setEditCol({ ...editCol, title: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block">Цвет</label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => setEditCol({ ...editCol, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition ${editCol.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveCol} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">Сохранить</button>
              <button onClick={() => setEditCol(null)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка добавления карточки */}
      {addCardCol !== null && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setAddCardCol(null)}>
          <div className="bg-[#0e0e1c] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Новая карточка</h3>
            <div className="space-y-3">
              {[["title","Название *"],["phone","Телефон"],["description","Описание"]].map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs text-white/40 mb-1 block">{l}</label>
                  {f === "description" ? (
                    <textarea value={(newCard as Record<string,string>)[f]} onChange={e => setNewCard(p => ({ ...p, [f]: e.target.value }))} rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
                  ) : (
                    <input value={(newCard as Record<string,string>)[f]} onChange={e => setNewCard(p => ({ ...p, [f]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                  )}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Бюджет (₽)</label>
                  <input type="number" value={newCard.amount} onChange={e => setNewCard(p => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Приоритет</label>
                  <select value={newCard.priority} onChange={e => setNewCard(p => ({ ...p, priority: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#1a1a2e]">{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Срок</label>
                <input type="datetime-local" value={newCard.due_date} onChange={e => setNewCard(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addCard} disabled={!newCard.title.trim()} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-lg transition">Добавить</button>
              <button onClick={() => setAddCardCol(null)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка редактирования карточки */}
      {editCard && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditCard(null)}>
          <div className="bg-[#0e0e1c] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Редактировать карточку</h3>
            <div className="space-y-3">
              {[["title","Название"],["phone","Телефон"],["description","Описание"]].map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs text-white/40 mb-1 block">{l}</label>
                  {f === "description" ? (
                    <textarea value={(editCard as Record<string,string>)[f] || ""} onChange={e => setEditCard(p => p ? { ...p, [f]: e.target.value } : p)} rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
                  ) : (
                    <input value={(editCard as Record<string,string>)[f] || ""} onChange={e => setEditCard(p => p ? { ...p, [f]: e.target.value } : p)}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                  )}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Бюджет (₽)</label>
                  <input type="number" value={editCard.amount || ""} onChange={e => setEditCard(p => p ? { ...p, amount: +e.target.value } : p)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Приоритет</label>
                  <select value={editCard.priority} onChange={e => setEditCard(p => p ? { ...p, priority: e.target.value } : p)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40">
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#1a1a2e]">{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Срок</label>
                <input type="datetime-local" value={editCard.due_date ? editCard.due_date.slice(0, 16) : ""}
                  onChange={e => setEditCard(p => p ? { ...p, due_date: e.target.value } : p)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveCard} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition">Сохранить</button>
              <button onClick={() => deleteCard(editCard.id)} className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition">Удалить</button>
              <button onClick={() => setEditCard(null)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
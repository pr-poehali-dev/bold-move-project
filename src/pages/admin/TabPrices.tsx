import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import EditableCell from "./EditableCell";
import TruncatedCell from "./TruncatedCell";
import { usePriceList } from "./usePriceList";
import { apiFetch } from "./api";
import { PRICE_UNITS } from "./constants";
import type { PriceItem } from "./types";

const EMPTY_NEW = { name: "", price: "", purchase_price: "", unit: "шт", description: "" };
const EMPTY_CAT = { name: "", firstItem: "", price: "", unit: "шт", description: "" };

interface Props { token: string; onItemAdded?: (name: string) => void; isDark?: boolean; }

export default function TabPrices({ token, onItemAdded, isDark = true }: Props) {
  const text    = isDark ? "text-white"     : "text-gray-900";
  const muted   = isDark ? "text-white/40"  : "text-gray-500";
  const muted2  = isDark ? "text-white/30"  : "text-gray-400";
  const border  = isDark ? "border-white/10" : "border-gray-200";
  const border2 = isDark ? "border-white/5"  : "border-gray-100";
  const bg      = isDark ? "bg-white/[0.03]" : "bg-white";
  const bgInput = isDark ? "bg-white/5"      : "bg-gray-50";
  const borderInput = isDark ? "border-white/15" : "border-gray-200";
  const selectBg = isDark ? "#0b0b11" : "#ffffff";
  const { prices, loading, aiLoadingId, aiDescLoadingId, byCategory, saveField, toggleActive, deleteItem, renameCategory, generateSynonyms, generateDescription, moveItem, load } = usePriceList(token);
  const dragItem = useRef<PriceItem | null>(null);
  const dragOver = useRef<PriceItem | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (item: PriceItem) => { dragItem.current = item; };
  const handleDragEnter = (item: PriceItem) => { dragOver.current = item; setDragOverId(item.id); };
  const handleDragEnd = async () => {
    setDragOverId(null);
    if (!dragItem.current || !dragOver.current) return;
    if (dragItem.current.id === dragOver.current.id) return;
    if (dragItem.current.category !== dragOver.current.category) return;
    await moveItem(dragItem.current, dragOver.current);
    dragItem.current = null;
    dragOver.current = null;
  };

  const [addingInCat, setAddingInCat] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(EMPTY_NEW);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState(EMPTY_CAT);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatVal, setEditingCatVal] = useState("");

  const handleAddItem = async (category: string) => {
    if (!newItem.name.trim()) return;
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({ ...newItem, category, price: parseInt(newItem.price) || 0, purchase_price: parseInt(newItem.purchase_price) || 0 }),
    }, token);
    if (r.ok) { setAddingInCat(null); setNewItem(EMPTY_NEW); load(); onItemAdded?.(newItem.name.trim()); }
  };

  const handleAddCategory = async () => {
    if (!newCat.name.trim() || !newCat.firstItem.trim()) return;
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({
        category: newCat.name.trim(), name: newCat.firstItem.trim(),
        price: parseInt(newCat.price) || 0, unit: newCat.unit, description: newCat.description,
      }),
    }, token);
    if (r.ok) { setAddingCat(false); setNewCat(EMPTY_CAT); load(); }
  };

  const handleRenameCategory = async (category: string) => {
    const newName = editingCatVal.trim();
    if (!newName || newName === category) { setEditingCat(null); return; }
    await renameCategory(category, newName);
    setEditingCat(null);
  };

  const handleDeleteItem = async (item: PriceItem) => {
    if (!confirm("Удалить позицию?")) return;
    await deleteItem(item.id);
  };

  if (loading) return <p className={`${muted2} text-sm`}>Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <p className={`${muted} text-sm`}>Нажмите на ячейку — сохраняется мгновенно. Кружок = включить/выключить позицию.</p>

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2 px-1 group">
            {editingCat === category ? (
              <input autoFocus value={editingCatVal}
                onChange={e => setEditingCatVal(e.target.value)}
                onBlur={() => handleRenameCategory(category)}
                onKeyDown={e => { if (e.key === "Enter") handleRenameCategory(category); if (e.key === "Escape") setEditingCat(null); }}
                className={`text-violet-500 text-xs font-semibold uppercase tracking-wider bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 outline-none w-64 ${isDark ? "" : "bg-violet-50"}`}
              />
            ) : (
              <h3 className={`${isDark ? "text-violet-300 hover:text-violet-200" : "text-violet-600 hover:text-violet-700"} text-xs font-semibold uppercase tracking-wider cursor-pointer transition flex items-center gap-1.5`}
                onClick={() => { setEditingCat(category); setEditingCatVal(category); }}
                title="Нажмите чтобы переименовать группу">
                {category}
                <Icon name="Pencil" size={10} className="opacity-0 group-hover:opacity-40 transition" />
              </h3>
            )}
          </div>

          <div className={`${bg} border ${border} rounded-xl overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${border}`}>
                  <th className="px-2 py-2.5 w-6" />
                  <th className={`text-left ${muted2} font-normal px-4 py-2.5 w-[32%]`}>Название</th>
                  <th className={`text-right ${muted2} font-normal px-4 py-2.5 w-[9%] whitespace-nowrap`}>Продажа ₽</th>
                  <th className={`text-right ${muted2} font-normal px-4 py-2.5 w-[9%] whitespace-nowrap`}>Закупка ₽</th>
                  <th className={`text-left ${muted2} font-normal px-4 py-2.5 w-[6%] whitespace-nowrap`}>Ед.</th>
                  <th className={`text-left ${muted2} font-normal px-4 py-2.5 w-[20%] whitespace-nowrap`}>Описание (AI)</th>
                  <th className={`text-left ${muted2} font-normal px-4 py-2.5 whitespace-nowrap`}>Синонимы</th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item)}
                    onDragEnter={() => handleDragEnter(item)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className={`border-b ${border2} last:border-0 transition-colors cursor-grab active:cursor-grabbing
                      ${!item.active ? "opacity-40" : ""}
                      ${idx % 2 ? (isDark ? "bg-white/[0.01]" : "bg-gray-50/50") : ""}
                      ${dragOverId === item.id ? "bg-violet-500/10 border-violet-500/30" : ""}
                    `}>
                    {/* Drag handle */}
                    <td className="px-2 py-2.5 w-6">
                      <Icon name="GripVertical" size={14} className={`${isDark ? "text-white/15 hover:text-white/40" : "text-gray-300 hover:text-gray-500"} transition mx-auto`} />
                    </td>
                    {/* Название + кружок активности */}
                    <td className={`px-4 py-2.5 ${text}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); toggleActive(item); }}
                          title={item.active ? "Отключить" : "Включить"}
                          className={`w-3 h-3 rounded-full border flex-shrink-0 transition ${item.active ? "bg-green-400 border-green-400" : isDark ? "border-white/20 hover:border-white/40" : "border-gray-300 hover:border-gray-400"}`} />
                        <EditableCell value={item.name} onSave={v => saveField(item, "name", v)} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-400">
                      <EditableCell value={item.price} type="number" onSave={v => saveField(item, "price", v)} className="text-right" />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-400">
                      <EditableCell value={item.purchase_price ?? ""} type="number" onSave={v => saveField(item, "purchase_price", v)} className="text-right" placeholder="—" />
                    </td>
                    <td className={`px-4 py-2.5 ${muted} text-xs`}>
                      <select value={item.unit} onChange={e => saveField(item, "unit", e.target.value)}
                        className={`bg-transparent text-sm outline-none cursor-pointer transition appearance-none ${muted}`}
                        style={{ colorScheme: isDark ? "dark" : "light" }}>
                        {PRICE_UNITS.map(u => <option key={u} value={u} style={{ background: selectBg }}>{u}</option>)}
                      </select>
                    </td>
                    <td className={`px-4 py-2.5 ${muted} text-xs`}>
                      <div className="flex items-center gap-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <TruncatedCell value={item.description} onSave={v => saveField(item, "description", v)} placeholder="Как AI понимает позицию..." maxChars={28} />
                        </div>
                        <button onClick={() => generateDescription(item)} disabled={aiDescLoadingId === item.id}
                          title="Сгенерировать описание через AI"
                          className="flex-shrink-0 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 rounded px-1.5 py-0.5 disabled:opacity-40 transition flex items-center gap-1">
                          {aiDescLoadingId === item.id
                            ? <Icon name="Loader" size={11} className="animate-spin" />
                            : <Icon name="Sparkles" size={11} />}
                          <span className="text-[10px]">AI</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-amber-400/60 text-xs w-[180px] max-w-[180px]">
                      <div className="flex items-center gap-1 min-w-0">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <TruncatedCell value={item.synonyms || ""} onSave={v => saveField(item, "synonyms", v)} placeholder="карниз, гардина..." maxChars={25} />
                        </div>
                        <button onClick={() => generateSynonyms(item)} disabled={aiLoadingId === item.id}
                          title="Сгенерировать синонимы через AI"
                          className="flex-shrink-0 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 rounded px-1.5 py-0.5 disabled:opacity-40 transition flex items-center gap-1">
                          {aiLoadingId === item.id
                            ? <Icon name="Loader" size={11} className="animate-spin" />
                            : <Icon name="Sparkles" size={11} />}
                          <span className="text-[10px]">AI</span>
                        </button>
                      </div>
                    </td>
                    {/* Только удаление — активность теперь в колонке названия */}
                    <td className="px-3 py-2.5 w-8">
                      <button onClick={() => handleDeleteItem(item)} title="Удалить"
                        className={`${isDark ? "text-white/20" : "text-gray-300"} hover:text-red-400 transition`}>
                        <Icon name="X" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {addingInCat === category ? (
              <div className={`border-t ${border} px-4 py-3 flex gap-2 items-end flex-wrap bg-violet-500/5`}>
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <span className={`${muted2} text-xs`}>Название</span>
                  <input autoFocus value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleAddItem(category)}
                    placeholder="Новая позиция..."
                    className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 ${text} text-sm outline-none focus:border-violet-500`} />
                </div>
                <div className="flex flex-col gap-1 w-24">
                  <span className={`${muted2} text-xs`}>Цена продажи ₽</span>
                  <input type="number" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                    placeholder="0"
                    className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 text-green-500 text-sm outline-none focus:border-violet-500 font-mono`} />
                </div>
                <div className="flex flex-col gap-1 w-24">
                  <span className={`${muted2} text-xs`}>Цена закупки ₽</span>
                  <input type="number" value={newItem.purchase_price} onChange={e => setNewItem(p => ({ ...p, purchase_price: e.target.value }))}
                    placeholder="0"
                    className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 text-blue-500 text-sm outline-none focus:border-violet-500 font-mono`} />
                </div>
                <div className="flex flex-col gap-1 w-24">
                  <span className={`${muted2} text-xs`}>Единица</span>
                  <select value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                    className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 ${text} text-sm outline-none focus:border-violet-500 cursor-pointer`}>
                    {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-[2] min-w-[150px]">
                  <span className={`${muted2} text-xs`}>Описание для AI</span>
                  <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                    placeholder="Как AI понимает позицию..."
                    className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 ${text} text-sm outline-none focus:border-violet-500`} />
                </div>
                <div className="flex gap-2 pb-0.5">
                  <button onClick={() => handleAddItem(category)}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
                  <button onClick={() => { setAddingInCat(null); setNewItem(EMPTY_NEW); }}
                    className={`${muted} hover:${text} text-sm transition`}>Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAddingInCat(category); setNewItem(EMPTY_NEW); }}
                className={`w-full py-2.5 ${isDark ? "text-violet-400/60" : "text-violet-500/70"} hover:text-violet-400 text-xs flex items-center justify-center gap-1.5 border-t ${border2} transition hover:bg-violet-500/5`}>
                <Icon name="Plus" size={13} /> Добавить позицию в «{category}»
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Новая категория */}
      {addingCat ? (
        <div className={`${bg} border border-violet-500/30 rounded-xl p-5 flex flex-col gap-4`}>
          <h3 className={`${isDark ? "text-violet-300" : "text-violet-600"} text-sm font-semibold flex items-center gap-2`}>
            <Icon name="FolderPlus" size={16} /> Новая категория
          </h3>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className={`${muted2} text-xs`}>Название категории</span>
              <input autoFocus value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                placeholder="Например: Акции, Доп. услуги..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`} />
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[160px]">
              <span className={`${muted2} text-xs`}>Первая позиция</span>
              <input value={newCat.firstItem} onChange={e => setNewCat(p => ({ ...p, firstItem: e.target.value }))}
                placeholder="Название первого товара/услуги..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`} />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-28">
              <span className={`${muted2} text-xs`}>Цена ₽</span>
              <input type="number" value={newCat.price} onChange={e => setNewCat(p => ({ ...p, price: e.target.value }))}
                placeholder="0"
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500 font-mono`} />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <span className={`${muted2} text-xs`}>Единица</span>
              <select value={newCat.unit} onChange={e => setNewCat(p => ({ ...p, unit: e.target.value }))}
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500 cursor-pointer`}>
                {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className={`${muted2} text-xs`}>Описание для AI</span>
              <input value={newCat.description} onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))}
                placeholder="Как AI понимает эту позицию..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddCategory}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-5 py-2 text-sm font-medium transition">Создать категорию</button>
            <button onClick={() => { setAddingCat(false); setNewCat(EMPTY_CAT); }}
              className={`${muted} hover:${text} text-sm transition`}>Отмена</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)}
          className={`border border-dashed border-violet-500/30 hover:border-violet-500/60 rounded-xl py-3 ${isDark ? "text-violet-400/60" : "text-violet-500/70"} hover:text-violet-400 text-sm flex items-center justify-center gap-2 transition`}>
          <Icon name="FolderPlus" size={15} /> Добавить новую категорию
        </button>
      )}
    </div>
  );
}
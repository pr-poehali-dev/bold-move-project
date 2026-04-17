import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import EditableCell from "./EditableCell";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

const EMPTY_NEW = { name: "", price: "", unit: "шт", description: "" };
const EMPTY_CAT = { name: "", firstItem: "", price: "", unit: "шт", description: "" };

interface Props { token: string; onItemAdded?: (name: string) => void; }

export default function TabPrices({ token, onItemAdded }: Props) {
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingInCat, setAddingInCat] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(EMPTY_NEW);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState(EMPTY_CAT);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatVal, setEditingCatVal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("prices");
      console.log("[prices] status:", r.status, r.ok);
      if (r.ok) {
        const d = await r.json();
        console.log("[prices] items:", d.items?.length);
        setPrices(d.items);
      }
    } catch(e) {
      console.error("[prices] error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveField = async (item: PriceItem, field: keyof PriceItem, val: string) => {
    const updated = { ...item, [field]: field === "price" ? parseInt(val) || 0 : val };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setPrices(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const toggleActive = async (item: PriceItem) => {
    const updated = { ...item, active: !item.active };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setPrices(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const addItem = async (category: string) => {
    if (!newItem.name.trim()) return;
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({ ...newItem, category, price: parseInt(newItem.price) || 0 }),
    }, token);
    if (r.ok) { setAddingInCat(null); setNewItem(EMPTY_NEW); load(); onItemAdded?.(newItem.name.trim()); }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Удалить позицию?")) return;
    await apiFetch("prices", { method: "DELETE" }, token, id);
    setPrices(prev => prev.filter(p => p.id !== id));
  };

  const renameCategory = async (oldName: string) => {
    const newName = editingCatVal.trim();
    if (!newName || newName === oldName) { setEditingCat(null); return; }
    const r = await apiFetch("prices&rename_category", { method: "PUT", body: JSON.stringify({ old_name: oldName, new_name: newName }) }, token);
    if (r.ok) {
      setPrices(prev => prev.map(p => p.category === oldName ? { ...p, category: newName } : p));
    }
    setEditingCat(null);
  };

  const addCategory = async () => {
    if (!newCat.name.trim() || !newCat.firstItem.trim()) return;
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({
        category: newCat.name.trim(),
        name: newCat.firstItem.trim(),
        price: parseInt(newCat.price) || 0,
        unit: newCat.unit,
        description: newCat.description,
      }),
    }, token);
    if (r.ok) { setAddingCat(false); setNewCat(EMPTY_CAT); load(); }
  };

  const byCategory = prices.reduce<Record<string, PriceItem[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-white/50 text-sm">Нажмите на ячейку — сохраняется мгновенно. Кружок = включить/выключить позицию.</p>

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2 px-1 group">
            {editingCat === category ? (
              <input
                autoFocus
                value={editingCatVal}
                onChange={e => setEditingCatVal(e.target.value)}
                onBlur={() => renameCategory(category)}
                onKeyDown={e => { if (e.key === "Enter") renameCategory(category); if (e.key === "Escape") setEditingCat(null); }}
                className="text-violet-300 text-xs font-semibold uppercase tracking-wider bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 outline-none w-64"
              />
            ) : (
              <h3
                className="text-violet-300 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-violet-200 transition flex items-center gap-1.5"
                onClick={() => { setEditingCat(category); setEditingCatVal(category); }}
                title="Нажмите чтобы переименовать группу">
                {category}
                <Icon name="Pencil" size={10} className="opacity-0 group-hover:opacity-40 transition" />
              </h3>
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[34%]">Название</th>
                  <th className="text-right text-white/30 font-normal px-4 py-2.5 w-[9%]">Цена ₽</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[7%]">Ед.</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[22%]">Описание (как AI понимает)</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5">Синонимы (через запятую)</th>
                  <th className="px-3 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}
                    className={`border-b border-white/5 last:border-0 ${!item.active ? "opacity-40" : ""} ${idx % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-4 py-2.5 text-white">
                      <EditableCell value={item.name} onSave={v => saveField(item, "name", v)} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-400">
                      <EditableCell value={item.price} type="number" onSave={v => saveField(item, "price", v)} className="text-right" />
                    </td>
                    <td className="px-4 py-2.5 text-white/50">
                      <select
                        value={item.unit}
                        onChange={e => saveField(item, "unit", e.target.value)}
                        className="bg-transparent text-white/50 text-sm outline-none cursor-pointer hover:text-white transition appearance-none">
                        <option value="м²" className="bg-[#0b0b11]">м²</option>
                        <option value="шт" className="bg-[#0b0b11]">шт</option>
                        <option value="пог.м" className="bg-[#0b0b11]">пог.м</option>
                        <option value="уп" className="bg-[#0b0b11]">уп</option>
                        <option value="катушка" className="bg-[#0b0b11]">катушка</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-white/40 text-xs">
                      <EditableCell value={item.description} onSave={v => saveField(item, "description", v)} />
                    </td>
                    <td className="px-4 py-2.5 text-amber-400/60 text-xs">
                      <EditableCell value={item.synonyms || ""} onSave={v => saveField(item, "synonyms", v)} placeholder="карниз, гардина, штора..." />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleActive(item)} title={item.active ? "Отключить" : "Включить"}
                          className={`w-4 h-4 rounded-full border transition flex-shrink-0 ${item.active ? "bg-green-400 border-green-400" : "border-white/20 hover:border-white/40"}`} />
                        <button onClick={() => deleteItem(item.id)} title="Удалить"
                          className="text-white/20 hover:text-red-400 transition">
                          <Icon name="X" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {addingInCat === category ? (
              <div className="border-t border-white/10 px-4 py-3 flex gap-2 items-end flex-wrap bg-violet-500/5">
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <span className="text-white/30 text-xs">Название</span>
                  <input autoFocus value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addItem(category)}
                    placeholder="Новая позиция..."
                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
                </div>
                <div className="flex flex-col gap-1 w-24">
                  <span className="text-white/30 text-xs">Цена ₽</span>
                  <input type="number" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                    placeholder="0"
                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500 font-mono" />
                </div>
                <div className="flex flex-col gap-1 w-24">
                  <span className="text-white/30 text-xs">Единица</span>
                  <select value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500 cursor-pointer">
                    <option value="м²">м²</option>
                    <option value="шт">шт</option>
                    <option value="пог.м">пог.м</option>
                    <option value="уп">уп</option>
                    <option value="катушка">катушка</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-[2] min-w-[150px]">
                  <span className="text-white/30 text-xs">Описание для AI</span>
                  <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                    placeholder="Как AI понимает позицию..."
                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
                </div>
                <div className="flex gap-2 pb-0.5">
                  <button onClick={() => addItem(category)}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">
                    Добавить
                  </button>
                  <button onClick={() => { setAddingInCat(null); setNewItem(EMPTY_NEW); }}
                    className="text-white/40 hover:text-white/70 text-sm transition">
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingInCat(category); setNewItem(EMPTY_NEW); }}
                className="w-full py-2.5 text-violet-400/60 hover:text-violet-400 text-xs flex items-center justify-center gap-1.5 border-t border-white/5 transition hover:bg-violet-500/5">
                <Icon name="Plus" size={13} />
                Добавить позицию в «{category}»
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Новая категория */}
      {addingCat ? (
        <div className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-violet-300 text-sm font-semibold flex items-center gap-2">
            <Icon name="FolderPlus" size={16} /> Новая категория
          </h3>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-white/30 text-xs">Название категории</span>
              <input autoFocus value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                placeholder="Например: Акции, Доп. услуги..."
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[160px]">
              <span className="text-white/30 text-xs">Первая позиция</span>
              <input value={newCat.firstItem} onChange={e => setNewCat(p => ({ ...p, firstItem: e.target.value }))}
                placeholder="Название первого товара/услуги..."
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-28">
              <span className="text-white/30 text-xs">Цена ₽</span>
              <input type="number" value={newCat.price} onChange={e => setNewCat(p => ({ ...p, price: e.target.value }))}
                placeholder="0"
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 font-mono" />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <span className="text-white/30 text-xs">Единица</span>
              <select value={newCat.unit} onChange={e => setNewCat(p => ({ ...p, unit: e.target.value }))}
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 cursor-pointer">
                <option value="м²">м²</option>
                <option value="шт">шт</option>
                <option value="пог.м">пог.м</option>
                <option value="уп">уп</option>
                <option value="катушка">катушка</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-white/30 text-xs">Описание для AI</span>
              <input value={newCat.description} onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))}
                placeholder="Как AI понимает эту позицию..."
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCategory}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-5 py-2 text-sm font-medium transition">
              Создать категорию
            </button>
            <button onClick={() => { setAddingCat(false); setNewCat(EMPTY_CAT); }}
              className="text-white/40 hover:text-white/70 text-sm transition">
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)}
          className="flex items-center gap-2 text-white/30 hover:text-violet-400 text-sm transition border border-dashed border-white/10 hover:border-violet-500/40 rounded-xl py-4 justify-center hover:bg-violet-500/5">
          <Icon name="FolderPlus" size={16} />
          Создать новую категорию
        </button>
      )}
    </div>
  );
}
import React, { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { usePriceList } from "./usePriceList";
import { apiFetch } from "./api";
import { PRICE_UNITS } from "./constants";
import type { PriceItem } from "./types";
import { buildTheme, EMPTY_NEW, EMPTY_CAT } from "./TabPricesShared";
import TabPriceCategoryBlock from "./TabPriceCategoryBlock";

interface Props { token: string; onItemAdded?: (name: string) => void; isDark?: boolean; readOnly?: boolean; }

export default function TabPrices({ token, onItemAdded, isDark = true, readOnly = false }: Props) {
  const theme   = buildTheme(isDark);
  const { text, muted, muted2, border, bg, bgInput, borderInput } = theme;

  const {
    prices, loading, aiLoadingId, aiDescLoadingId, byCategory,
    saveField, toggleActive, deleteItem, renameCategory,
    generateSynonyms, generateDescription, moveItem, load,
  } = usePriceList(token);

  // ── Картинки ───────────────────────────────────────────────────────────────
  const [itemImages, setItemImages] = useState<Record<number, string>>({});
  const [catImages,  setCatImages]  = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (prices.length === 0) return;
    const imgs: Record<number, string> = {};
    const cats: Record<string, string> = {};
    prices.forEach((p: PriceItem & { image_url?: string; category_image_url?: string }) => {
      if (p.image_url) imgs[p.id] = p.image_url;
      if (p.category_image_url && !cats[p.category]) cats[p.category] = p.category_image_url;
    });
    // БД-данные приоритетнее локального state (иначе после перезагрузки картинки не восстанавливались)
    setItemImages(prev => ({ ...prev, ...imgs }));
    setCatImages(prev => ({ ...prev, ...cats }));
  }, [prices]);  

  const uploadItemImage = (item: PriceItem, url: string) => setItemImages(prev => ({ ...prev, [item.id]: url }));
  const uploadCatImage  = (category: string, url: string) => setCatImages(prev => ({ ...prev, [category]: url }));

  // ── Drag-and-drop сортировка ───────────────────────────────────────────────
  const dragItemRef = useRef<PriceItem | null>(null);
  const dragOverRef = useRef<PriceItem | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (item: PriceItem) => { dragItemRef.current = item; };
  const handleDragEnter = (item: PriceItem) => { dragOverRef.current = item; setDragOverId(item.id); };
  const handleDragEnd   = async () => {
    setDragOverId(null);
    if (!dragItemRef.current || !dragOverRef.current) return;
    if (dragItemRef.current.id === dragOverRef.current.id) return;
    if (dragItemRef.current.category !== dragOverRef.current.category) return;
    await moveItem(dragItemRef.current, dragOverRef.current);
    dragItemRef.current = null;
    dragOverRef.current = null;
  };

  // ── Добавление позиции ─────────────────────────────────────────────────────
  const [addingInCat, setAddingInCat] = useState<string | null>(null);
  const [newItem,     setNewItem]     = useState(EMPTY_NEW);

  const handleAddItem = async (category: string) => {
    if (!newItem.name.trim()) return;
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({
        ...newItem,
        category,
        price: parseInt(newItem.price) || 0,
        purchase_price: parseInt(newItem.purchase_price) || 0,
      }),
    }, token);
    if (r.ok) { setAddingInCat(null); setNewItem(EMPTY_NEW); load(); onItemAdded?.(newItem.name.trim()); }
  };

  // ── Добавление категории ───────────────────────────────────────────────────
  const [addingCat, setAddingCat] = useState(false);
  const [newCat,    setNewCat]    = useState(EMPTY_CAT);

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

  // ── Переименование категории ───────────────────────────────────────────────
  const [editingCat,    setEditingCat]    = useState<string | null>(null);
  const [editingCatVal, setEditingCatVal] = useState("");

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
        <TabPriceCategoryBlock
          key={category}
          category={category}
          items={items}
          isDark={isDark}
          readOnly={readOnly}
          theme={theme}
          dragOverId={dragOverId}
          itemImages={itemImages}
          catImages={catImages}
          aiLoadingId={aiLoadingId}
          aiDescLoadingId={aiDescLoadingId}
          addingInCat={addingInCat}
          newItem={newItem}
          editingCat={editingCat}
          editingCatVal={editingCatVal}
          onDragStart={handleDragStart}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
          onToggleActive={toggleActive}
          onSaveField={saveField}
          onDelete={handleDeleteItem}
          onGenerateDescription={generateDescription}
          onGenerateSynonyms={generateSynonyms}
          onImageUploaded={uploadItemImage}
          onCatImageUploaded={uploadCatImage}
          onSetAddingInCat={setAddingInCat}
          onSetNewItem={setNewItem}
          onAddItem={handleAddItem}
          onSetEditingCat={setEditingCat}
          onSetEditingCatVal={setEditingCatVal}
          onRenameCategory={handleRenameCategory}
          token={token}
        />
      ))}

      {/* Новая категория */}
      {!readOnly && addingCat ? (
        <div className={`${bg} border border-violet-500/30 rounded-xl p-5 flex flex-col gap-4`}>
          <h3 className={`${isDark ? "text-violet-300" : "text-violet-600"} text-sm font-semibold flex items-center gap-2`}>
            <Icon name="FolderPlus" size={16} /> Новая категория
          </h3>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className={`${muted2} text-xs`}>Название категории</span>
              <input
                autoFocus
                value={newCat.name}
                onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                placeholder="Например: Акции, Доп. услуги..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`}
              />
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[160px]">
              <span className={`${muted2} text-xs`}>Первая позиция</span>
              <input
                value={newCat.firstItem}
                onChange={e => setNewCat(p => ({ ...p, firstItem: e.target.value }))}
                placeholder="Название первого товара/услуги..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`}
              />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-28">
              <span className={`${muted2} text-xs`}>Цена ₽</span>
              <input
                type="number"
                value={newCat.price}
                onChange={e => setNewCat(p => ({ ...p, price: e.target.value }))}
                placeholder="0"
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500 font-mono`}
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <span className={`${muted2} text-xs`}>Единица</span>
              <select
                value={newCat.unit}
                onChange={e => setNewCat(p => ({ ...p, unit: e.target.value }))}
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500 cursor-pointer`}
              >
                {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className={`${muted2} text-xs`}>Описание для AI</span>
              <input
                value={newCat.description}
                onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))}
                placeholder="Как AI понимает эту позицию..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddCategory}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-5 py-2 text-sm font-medium transition"
            >
              Создать категорию
            </button>
            <button
              onClick={() => { setAddingCat(false); setNewCat(EMPTY_CAT); }}
              className={`${muted} hover:${text} text-sm transition`}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        !readOnly && (
          <button
            onClick={() => setAddingCat(true)}
            className={`border border-dashed border-violet-500/30 hover:border-violet-500/60 rounded-xl py-3 ${isDark ? "text-violet-400/60" : "text-violet-500/70"} hover:text-violet-400 text-sm flex items-center justify-center gap-2 transition`}
          >
            <Icon name="FolderPlus" size={15} /> Добавить новую категорию
          </button>
        )
      )}
    </div>
  );
}
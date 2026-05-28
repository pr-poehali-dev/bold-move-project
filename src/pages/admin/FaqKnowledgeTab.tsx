import { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { FaqItem, FaqProduct } from "./types";
import { nanoid } from "./faq-utils";
import FaqProductRow from "./FaqProductRow";

interface TabProps { token: string; isDark?: boolean; readOnly?: boolean; }

export default function FaqKnowledgeTab({ token, isDark = true, readOnly = false }: TabProps) {
  const bg     = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text   = isDark ? "#ffffff"                : "#111827";
  const muted  = isDark ? "rgba(255,255,255,0.4)"  : "#6b7280";

  const [items,     setItems]     = useState<FaqItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adding,    setAdding]    = useState(false);
  const [newTitle,  setNewTitle]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("faq", undefined, token);
    if (r.ok) { const d = await r.json(); setItems(d.items); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const saveCategory = async (item: FaqItem) => {
    await apiFetch("faq", {
      method: "PUT",
      body: JSON.stringify({ ...item, items: item.items ?? [], images: item.images ?? [] }),
    }, token, item.id);
    // Обновляем только конкретный элемент — не перезагружаем всё,
    // чтобы не сбрасывать expandedProductId внутри CategoryCard
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...item } : i));
  };

  const removeCategory = async (id: number) => {
    if (!confirm("Удалить категорию со всеми товарами?")) return;
    await apiFetch("faq", { method: "DELETE" }, token, id);
    load();
  };

  const addCategory = async () => {
    if (!newTitle.trim()) return;
    await apiFetch("faq", {
      method: "POST",
      body: JSON.stringify({ title: newTitle.trim(), content: "", items: [], images: [] }),
    }, token);
    setNewTitle(""); setAdding(false); load();
  };

  if (loading) return <p style={{ color: muted, fontSize: 13 }}>Загрузка...</p>;

  return (
    <div className="flex flex-col gap-3">
      <p style={{ color: muted, fontSize: 13 }}>AI читает эти записи при каждом вопросе клиента для точных ответов.</p>

      {items.map(item => (
        <CategoryCard
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          onSave={saveCategory}
          onRemove={() => removeCategory(item.id)}
          token={token}
          isDark={isDark}
          readOnly={readOnly}
          bg={bg} border={border} text={text} muted={muted}
        />
      ))}

      {!readOnly && (
        adding ? (
          <div className="flex gap-2 items-center p-3 rounded-xl" style={{ background: bg, border: `1px dashed rgba(139,92,246,0.5)` }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") { setAdding(false); setNewTitle(""); } }}
              placeholder="Название категории, напр. «Полотна ПВХ и ткань»"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: text }}
            />
            <button onClick={addCategory} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition">Добавить</button>
            <button onClick={() => { setAdding(false); setNewTitle(""); }} className="px-2 py-1.5 rounded-lg text-xs transition" style={{ color: muted }}>Отмена</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm transition py-3 rounded-xl justify-center"
            style={{ color: "#a78bfa", border: "1px dashed rgba(139,92,246,0.3)" }}>
            <Icon name="Plus" size={16} /> Добавить категорию
          </button>
        )
      )}
    </div>
  );
}

/* ── Карточка категории ──────────────────────────────────────────────────── */
interface CardProps {
  item: FaqItem;
  expanded: boolean;
  onToggle: () => void;
  onSave: (item: FaqItem) => void;
  onRemove: () => void;
  token: string;
  isDark: boolean;
  readOnly: boolean;
  bg: string; border: string; text: string; muted: string;
}

function CategoryCard({ item, expanded, onToggle, onSave, onRemove, token, isDark, readOnly, bg, border, text, muted }: CardProps) {
  const [localItem, setLocalItem] = useState<FaqItem>(item);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setLocalItem(item); setDirty(false); }, [item]);

  const products = localItem.items ?? [];

  const updateProducts = (newProducts: FaqProduct[]) => {
    setLocalItem(p => ({ ...p, items: newProducts }));
    setDirty(true);
  };

  const addProduct = () => {
    const newProd: FaqProduct = { id: nanoid(), name: "Новый товар", description: "", images: [] };
    const newProducts = [...products, newProd];
    updateProducts(newProducts);
    setExpandedProductId(newProd.id);
  };

  const removeProduct = (prodId: string) => {
    updateProducts(products.filter(p => p.id !== prodId));
    if (expandedProductId === prodId) setExpandedProductId(null);
  };

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateProduct = (updated: FaqProduct, immediate = false) => {
    const newProducts = products.map(p => p.id === updated.id ? updated : p);
    const newItem = { ...localItem, items: newProducts };
    setLocalItem(newItem);
    setDirty(true);
    if (immediate) {
      // Картинки — сохраняем сразу
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      onSave(newItem).then(() => setDirty(false));
    } else {
      // Текст — дебаунс 1.5с
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave(newItem).then(() => setDirty(false));
      }, 1500);
    }
  };

  const save = async () => {
    await onSave(localItem);
    setDirty(false);
  };

  const productCount = products.length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
      {/* Шапка категории */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:brightness-110 transition"
        onClick={onToggle}
      >
        <div className="transition-transform duration-200" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
          <Icon name="ChevronRight" size={14} style={{ color: muted }} />
        </div>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: localItem.used ? "#4ade80" : isDark ? "rgba(255,255,255,0.2)" : "#d1d5db" }}
        />
        <span className="flex-1 text-sm font-semibold" style={{ color: text }}>{localItem.title}</span>
        {productCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? "rgba(139,92,246,0.15)" : "#ede9fe", color: "#a78bfa" }}>
            {productCount} {productCount === 1 ? "товар" : productCount < 5 ? "товара" : "товаров"}
          </span>
        )}
        {!readOnly && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded transition opacity-40 hover:opacity-100"
            style={{ color: "#ef4444" }}>
            <Icon name="Trash2" size={13} />
          </button>
        )}
      </div>

      {/* Раскрытое содержимое */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${border}` }}>

          {/* Переключатель активности + кнопка сохранить */}
          <div className="flex items-center gap-3 pt-3 pb-1">
            {!readOnly && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={localItem.used}
                  onChange={e => { setLocalItem(p => ({ ...p, used: e.target.checked })); setDirty(true); }}
                  className="w-3.5 h-3.5 accent-violet-500"
                />
                <span className="text-xs" style={{ color: muted }}>Активна</span>
              </label>
            )}
            {dirty && !readOnly && (
              <button onClick={save} className="ml-auto px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition">
                Сохранить
              </button>
            )}
          </div>

          {/* Список товаров */}
          {products.length === 0 && (
            <p className="text-xs py-2" style={{ color: muted }}>Нет товаров — добавьте первый</p>
          )}

          {products.map(prod => (
            <FaqProductRow
              key={prod.id}
              product={prod}
              expanded={expandedProductId === prod.id}
              onToggle={() => setExpandedProductId(expandedProductId === prod.id ? null : prod.id)}
              onChange={(updated, immediate) => { updateProduct(updated, immediate); }}
              onRemove={() => removeProduct(prod.id)}
              token={token}
              isDark={isDark}
              readOnly={readOnly}
              border={border} text={text} muted={muted}
            />
          ))}

          {!readOnly && (
            <button
              onClick={addProduct}
              className="flex items-center gap-1.5 text-xs mt-1 transition py-2 rounded-lg justify-center"
              style={{ color: "#a78bfa", border: "1px dashed rgba(139,92,246,0.3)" }}>
              <Icon name="Plus" size={13} /> Добавить товар
            </button>
          )}

          {dirty && !readOnly && (
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={save} className="px-4 py-1.5 text-xs font-bold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition">
                Сохранить изменения
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
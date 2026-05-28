import { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import func2url from "@/../backend/func2url.json";
import type { FaqItem, FaqProduct, QuickQuestion } from "./types";

const UPLOAD_URL       = (func2url as Record<string, string>)["parse-xlsx"];
const GENERATE_IMG_URL = (func2url as Record<string, string>)["generate-image"];

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function uploadFaqImage(token: string, file: File): Promise<string> {
  const b64 = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload  = () => res((fr.result as string).split(",")[1] ?? "");
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const r = await fetch(`${UPLOAD_URL}?r=faq-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ data: b64, content_type: file.type || "image/jpeg" }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || "Ошибка загрузки");
  return d.url as string;
}

async function generateProductImage(productName: string): Promise<string> {
  const prompt = `Профессиональное фото товара: "${productName}". Натяжные потолки, интерьер, белый фон, студийная съёмка, высокое качество.`;
  const r = await fetch(GENERATE_IMG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size: "1024x1024", quality: "standard" }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || "Ошибка генерации");
  return d.url as string;
}

type FaqSub = "knowledge" | "questions";
interface Props { token: string; isDark?: boolean; readOnly?: boolean; }

export default function TabFaq({ token, isDark = true, readOnly = false }: Props) {
  const [sub, setSub] = useState<FaqSub>("knowledge");

  const SUB_TABS: { id: FaqSub; label: string; icon: string }[] = [
    { id: "knowledge", label: "Знания агента",  icon: "Database" },
    { id: "questions", label: "Быстрые ответы", icon: "MessageCircle" },
  ];

  const activeCls = isDark
    ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
    : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600";
  const inactiveCls = isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800";

  return (
    <div className="flex flex-col gap-0 h-full">
      <div className="flex gap-0.5 mb-5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${sub === t.id ? activeCls : inactiveCls}`}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>
      {sub === "knowledge" && <KnowledgeTab token={token} isDark={isDark} readOnly={readOnly} />}
      {sub === "questions" && <QuestionsTab token={token} isDark={isDark} readOnly={readOnly} />}
    </div>
  );
}

/* ── Знания бота ─────────────────────────────────────────────────────────── */
function KnowledgeTab({ token, isDark = true, readOnly = false }: { token: string; isDark?: boolean; readOnly?: boolean }) {
  const bg     = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text   = isDark ? "#ffffff"                : "#111827";
  const muted  = isDark ? "rgba(255,255,255,0.4)"  : "#6b7280";

  const [items,   setItems]   = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adding, setAdding]   = useState(false);
  const [newTitle, setNewTitle] = useState("");

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
    load();
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
function CategoryCard({ item, expanded, onToggle, onSave, onRemove, token, isDark, readOnly, bg, border, text, muted }: {
  item: FaqItem;
  expanded: boolean;
  onToggle: () => void;
  onSave: (item: FaqItem) => void;
  onRemove: () => void;
  token: string;
  isDark: boolean;
  readOnly: boolean;
  bg: string; border: string; text: string; muted: string;
}) {
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

  const updateProduct = (updated: FaqProduct) => {
    updateProducts(products.map(p => p.id === updated.id ? updated : p));
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
            <ProductRow
              key={prod.id}
              product={prod}
              expanded={expandedProductId === prod.id}
              onToggle={() => setExpandedProductId(expandedProductId === prod.id ? null : prod.id)}
              onChange={updated => { updateProduct(updated); }}
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

/* ── Строка товара ───────────────────────────────────────────────────────── */
function ProductRow({ product, expanded, onToggle, onChange, onRemove, token, isDark, readOnly, border, text, muted }: {
  product: FaqProduct;
  expanded: boolean;
  onToggle: () => void;
  onChange: (p: FaqProduct) => void;
  onRemove: () => void;
  token: string;
  isDark: boolean;
  readOnly: boolean;
  border: string; text: string; muted: string;
}) {
  const [local, setLocal] = useState<FaqProduct>(product);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(product); }, [product]);

  // Нормализуем: старое поле image_url → images[]
  const images: string[] = local.images?.length
    ? local.images
    : (local as unknown as { image_url?: string }).image_url
      ? [(local as unknown as { image_url: string }).image_url]
      : [];

  const update = (patch: Partial<FaqProduct>) => {
    const updated = { ...local, ...patch };
    setLocal(updated);
    onChange(updated);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length >= 5) return;
    setUploading(true);
    try {
      const available = 5 - images.length;
      const toUpload = Array.from(files).slice(0, available);
      const urls = await Promise.all(toUpload.map(f => uploadFaqImage(token, f)));
      update({ images: [...images, ...urls] });
    } catch (e) { console.error(e); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const removeImage = (idx: number) => {
    update({ images: images.filter((_, i) => i !== idx) });
  };

  const handleAiImage = async () => {
    if (images.length >= 5) return;
    setGenerating(true);
    try {
      const url = await generateProductImage(local.name || "натяжной потолок");
      update({ images: [...images, url] });
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const firstImage = images[0] || "";

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb", border: `1px solid ${border}` }}>
      {/* Миниатюра + название — всегда видно */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none hover:brightness-110 transition"
        onClick={onToggle}
      >
        <div
          className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}>
          {firstImage
            ? <img src={firstImage} alt="" className="w-full h-full object-cover" />
            : <Icon name="Image" size={16} style={{ color: muted }} />
          }
        </div>
        <span className="flex-1 text-sm" style={{ color: text }}>
          {local.name || <span style={{ color: muted }}>Без названия</span>}
        </span>
        {images.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: muted }}>
            <Icon name="Image" size={9} /> {images.length}
          </span>
        )}
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded transition opacity-30 hover:opacity-100" style={{ color: "#ef4444" }}>
              <Icon name="X" size={12} />
            </button>
          )}
          <div className="transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Icon name="ChevronDown" size={13} style={{ color: muted }} />
          </div>
        </div>
      </div>

      {/* Редактор товара */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3" style={{ borderTop: `1px solid ${border}` }}>

          {/* Поля названия и описания */}
          <div className="pt-3 flex flex-col gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: muted }}>Название</div>
              <input
                value={local.name}
                onChange={e => update({ name: e.target.value })}
                disabled={readOnly}
                placeholder="MSD Classic"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition disabled:opacity-60"
                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", border: `1px solid ${border}`, color: text }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: muted }}>Описание</div>
              <textarea
                value={local.description}
                onChange={e => update({ description: e.target.value })}
                disabled={readOnly}
                placeholder="Цена, особенности, применение..."
                rows={4}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y transition disabled:opacity-60"
                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", border: `1px solid ${border}`, color: text }}
              />
            </div>
          </div>

          {/* Галерея картинок */}
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: muted }}>
              Фотографии
              <span style={{ color: muted, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                ({images.length}/5)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Существующие картинки */}
              {images.map((url, i) => (
                <div key={i} className="relative w-16 h-16 flex-shrink-0 group rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${border}` }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {!readOnly && (
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white transition opacity-0 group-hover:opacity-100"
                      style={{ background: "rgba(239,68,68,0.9)", fontSize: 10 }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {/* Кнопка добавить */}
              {!readOnly && images.length < 5 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-16 h-16 rounded-xl flex flex-col items-center justify-center transition disabled:opacity-40"
                  style={{ border: `2px dashed ${isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"}`, color: muted }}>
                  {uploading
                    ? <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    : <Icon name="Plus" size={18} />
                  }
                </button>
              )}

              {/* AI-кнопка */}
              {!readOnly && images.length < 5 && (
                <button
                  onClick={handleAiImage}
                  disabled={generating}
                  title="AI сгенерирует картинку по названию товара"
                  className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 transition disabled:opacity-40"
                  style={{ border: `2px dashed rgba(139,92,246,0.4)`, background: "rgba(139,92,246,0.08)", color: "#a78bfa" }}>
                  {generating
                    ? <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    : <Icon name="Sparkles" size={16} />
                  }
                  <span style={{ fontSize: 9, fontWeight: 700 }}>{generating ? "..." : "AI"}</span>
                </button>
              )}
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => handleFileUpload(e.target.files)} />
        </div>
      )}
    </div>
  );
}

/* ── Быстрые ответы ──────────────────────────────────────────────────────── */
function QuestionsTab({ token, isDark = true, readOnly = false }: { token: string; isDark?: boolean; readOnly?: boolean }) {
  const bg     = isDark ? "bg-white/5"      : "bg-white";
  const border = isDark ? "border-white/10"  : "border-gray-200";
  const text   = isDark ? "text-white"       : "text-gray-900";
  const muted  = isDark ? "text-white/40"    : "text-gray-500";
  const [items,   setItems]   = useState<QuickQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<QuickQuestion | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [newItem, setNewItem] = useState({ pattern: "", answer: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("questions", undefined, token);
    if (r.ok) { const d = await r.json(); setItems(d.items ?? []); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async (item: QuickQuestion) => {
    await apiFetch("questions", { method: "PUT", body: JSON.stringify(item) }, token, item.id);
    setEditing(null); load();
  };
  const remove = async (id: number) => {
    if (!confirm("Удалить?")) return;
    await apiFetch("questions", { method: "DELETE" }, token, id); load();
  };
  const add = async () => {
    if (!newItem.pattern.trim() || !newItem.answer.trim()) return;
    await apiFetch("questions", { method: "POST", body: JSON.stringify({ ...newItem, active: true }) }, token);
    setNewItem({ pattern: "", answer: "" }); setAdding(false); load();
  };

  if (loading) return <p className={`${muted} text-sm`}>Загрузка...</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className={`${muted} text-sm`}>Шаблоны вопросов и готовые ответы для быстрой реакции бота.</p>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.id} className={`${bg} border ${border} rounded-xl p-4`}>
            {editing?.id === item.id ? (
              <div className="flex flex-col gap-3">
                <input value={editing.pattern} onChange={e => setEditing({ ...editing, pattern: e.target.value })}
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`}
                  placeholder="Шаблон вопроса" />
                <textarea value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })}
                  rows={4}
                  className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm resize-y outline-none focus:border-violet-500`}
                  placeholder="Готовый ответ" />
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 text-sm ${muted} cursor-pointer`}>
                    <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                    Активен
                  </label>
                  <button onClick={() => save(editing)} className="ml-auto bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Сохранить</button>
                  <button onClick={() => setEditing(null)} className={`${muted} text-sm`}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.active ? "bg-green-400" : isDark ? "bg-white/20" : "bg-gray-300"}`} />
                    <span className={`font-medium text-sm ${text}`}>{item.pattern}</span>
                  </div>
                  <p className={`${muted} text-xs line-clamp-2`}>{item.answer}</p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditing(item)} className={`${isDark ? "text-white/30" : "text-gray-300"} hover:text-violet-400 p-1.5 transition`}><Icon name="Pencil" size={15} /></button>
                    <button onClick={() => remove(item.id)} className={`${isDark ? "text-white/30" : "text-gray-300"} hover:text-red-400 p-1.5 transition`}><Icon name="Trash2" size={15} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!readOnly && adding ? (
          <div className={`${bg} border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3`}>
            <input value={newItem.pattern} onChange={e => setNewItem(p => ({ ...p, pattern: e.target.value }))}
              placeholder="Шаблон вопроса" autoFocus
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm outline-none focus:border-violet-500`} />
            <textarea value={newItem.answer} onChange={e => setNewItem(p => ({ ...p, answer: e.target.value }))}
              rows={4} placeholder="Готовый ответ"
              className={`${bg} border ${border} rounded-lg px-3 py-2 ${text} text-sm resize-y outline-none focus:border-violet-500`} />
            <div className="flex gap-2">
              <button onClick={add} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition">Добавить</button>
              <button onClick={() => { setAdding(false); setNewItem({ pattern: "", answer: "" }); }} className={`${muted} text-sm`}>Отмена</button>
            </div>
          </div>
        ) : (
          !readOnly && (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition border border-dashed border-violet-500/30 rounded-xl py-3 justify-center hover:border-violet-500/60">
              <Icon name="Plus" size={16} /> Добавить ответ
            </button>
          )
        )}
      </div>
    </div>
  );
}
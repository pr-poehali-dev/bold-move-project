import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { PRODUCTION } from "../data/content";
import { PROD_FEATURES } from "../chatConfig";
import type { ProductionItem } from "@/context/AuthContext";
import { PanelHeader } from "./PanelHeader";
import { uploadBrandImage } from "../admin/own-agent/brandApi";

export function PanelProduction({
  onClose,
  canEdit,
  startInEditMode,
  items: externalItems,
  pageTitle: externalTitle,
  pageHidden: externalHidden,
  token,
  onSave,
}: {
  onClose:           () => void;
  canEdit?:          boolean;
  startInEditMode?:  boolean;
  items?:            ProductionItem[] | null;
  pageTitle?:        string | null;
  pageHidden?:       boolean | null;
  token?:            string | null;
  onSave?:           (items: ProductionItem[], title: string, hidden: boolean) => void;
}) {
  const baseItems = (externalItems && externalItems.length > 0) ? externalItems : PRODUCTION;
  const [editMode, setEditMode]           = useState(!!startInEditMode);
  const [items, setItems]                 = useState<ProductionItem[]>(baseItems);
  const [pageTitle, setPageTitle]         = useState(externalTitle || "Собственное производство");
  const [pageHidden, setPageHidden]       = useState(!!externalHidden);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading]         = useState<number | null>(null);
  const [saving, setSaving]               = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prodImages = items.map((item) => ({ src: item.img, alt: item.title }));

  const handleEnterEdit = () => {
    setItems((externalItems && externalItems.length > 0) ? [...externalItems] : [...PRODUCTION]);
    setPageTitle(externalTitle || "Собственное производство");
    setPageHidden(!!externalHidden);
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave?.(items, pageTitle, pageHidden);
    setSaving(false);
    setEditMode(false);
  };

  const updateItem = (i: number, patch: Partial<ProductionItem>) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const removeItem = (i: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    setItems(prev => [...prev, { img: "", title: "Новая карточка", desc: "" }]);
  };

  const handleUpload = async (i: number, file: File) => {
    setUploading(i);
    try {
      const url = await uploadBrandImage(token ?? null, file);
      updateItem(i, { img: url });
    } finally {
      setUploading(null);
    }
  };

  /* ── Режим редактирования ── */
  if (editMode) {
    return (
      <div className="h-full flex flex-col">
        {/* Шапка редактора */}
        <div className="shrink-0 border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <Icon name="Pencil" size={15} className="text-violet-400" />
              <span className="text-sm font-semibold text-white/80">Редактирование страницы</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditMode(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 transition">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-60"
                style={{ background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa" }}>
                {saving
                  ? <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  : <Icon name="Check" size={12} />}
                Сохранить
              </button>
            </div>
          </div>
          {/* Название страницы + видимость */}
          <div className="flex items-center gap-2 px-5 pb-3">
            <input
              value={pageTitle}
              onChange={e => setPageTitle(e.target.value)}
              placeholder="Название страницы"
              className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold focus:outline-none transition"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
            <button
              onClick={() => setPageHidden(v => !v)}
              title={pageHidden ? "Страница скрыта — нажмите чтобы показать" : "Страница видна — нажмите чтобы скрыть"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0"
              style={{
                background: pageHidden ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                border: `1px solid ${pageHidden ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                color: pageHidden ? "#f87171" : "#4ade80",
              }}>
              <Icon name={pageHidden ? "EyeOff" : "Eye"} size={13} />
              {pageHidden ? "Скрыта" : "Видна"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex gap-3">
              {/* Фото */}
              <div className="shrink-0 w-20 h-16 rounded-lg overflow-hidden relative"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {item.img
                  ? <img src={item.img} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Icon name="Image" size={16} className="text-white/20" />
                    </div>
                }
                <button
                  onClick={() => fileRefs.current[i]?.click()}
                  disabled={uploading === i}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition rounded-lg">
                  {uploading === i
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Icon name="Upload" size={14} className="text-white" />}
                </button>
                <input ref={el => { fileRefs.current[i] = el; }} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(i, f); e.target.value = ""; }} />
              </div>

              {/* Поля */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <input
                  value={item.title}
                  onChange={e => updateItem(i, { title: e.target.value })}
                  placeholder="Заголовок"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                />
                <textarea
                  value={item.desc}
                  onChange={e => updateItem(i, { desc: e.target.value })}
                  placeholder="Описание"
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none resize-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                />
              </div>

              {/* Удалить */}
              <button onClick={() => removeItem(i)}
                className="shrink-0 p-1 text-white/20 hover:text-red-400 transition self-start">
                <Icon name="X" size={14} />
              </button>
            </div>
          ))}

          {/* Добавить карточку */}
          <button onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs text-white/30 hover:text-white/50 transition"
            style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
            <Icon name="Plus" size={14} /> Добавить карточку
          </button>
        </div>
      </div>
    );
  }

  /* ── Режим просмотра ── */
  const displayTitle = externalTitle || "Собственное производство";
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Factory" title={displayTitle} onClose={onClose}
        onEdit={canEdit ? handleEnterEdit : undefined} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden group cursor-pointer"
              onClick={() => setLightboxIndex(i)}>
              <div className="aspect-[4/3] overflow-hidden">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-2.5">
                <div className="text-white font-medium text-xs mb-1">{item.title}</div>
                <div className="text-white/35 text-[10px] leading-relaxed line-clamp-2">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {lightboxIndex !== null && (
          <Lightbox
            images={prodImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((lightboxIndex - 1 + prodImages.length) % prodImages.length)}
            onNext={() => setLightboxIndex((lightboxIndex + 1) % prodImages.length)}
          />
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROD_FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Icon name={f.icon} size={13} className="text-orange-400" />
              </div>
              <span className="text-white/50 text-[11px] font-medium leading-tight">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

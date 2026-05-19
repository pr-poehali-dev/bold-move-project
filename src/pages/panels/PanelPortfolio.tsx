import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { PORTFOLIO_ITEMS } from "../data/portfolio";
import type { PortfolioItem } from "@/context/AuthContext";
import { PanelHeader } from "./PanelHeader";
import { uploadBrandImage } from "../admin/own-agent/brandApi";

export function PanelPortfolio({
  onClose,
  canEdit,
  startInEditMode,
  items: externalItems,
  pageTitle: externalTitle,
  pageHidden: externalHidden,
  token,
  onSave,
}: {
  onClose:          () => void;
  canEdit?:         boolean;
  startInEditMode?: boolean;
  items?:           PortfolioItem[] | null;
  pageTitle?:       string | null;
  pageHidden?:      boolean | null;
  token?:           string | null;
  onSave?:          (items: PortfolioItem[], title: string, hidden: boolean) => void;
}) {
  const defaultItems: PortfolioItem[] = PORTFOLIO_ITEMS.slice(0, 12).map(i => ({
    img: i.img, room: i.room, type: i.type, district: i.district, area: i.area,
  }));
  const baseItems = (externalItems && externalItems.length > 0) ? externalItems : defaultItems;

  const [editMode, setEditMode]           = useState(!!startInEditMode);
  const [items, setItems]                 = useState<PortfolioItem[]>(baseItems);
  const [pageTitle, setPageTitle]         = useState(externalTitle || "Наши работы");
  const [pageHidden, setPageHidden]       = useState(!!externalHidden);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading]         = useState<number | null>(null);
  const [saving, setSaving]               = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const portImages = items.map(item => ({ src: item.img, alt: `${item.room} · ${item.type}` }));

  const handleEnterEdit = () => {
    setItems((externalItems && externalItems.length > 0) ? [...externalItems] : [...defaultItems]);
    setPageTitle(externalTitle || "Наши работы");
    setPageHidden(!!externalHidden);
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave?.(items, pageTitle, pageHidden);
    setSaving(false);
    setEditMode(false);
  };

  const updateItem = (i: number, patch: Partial<PortfolioItem>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const removeItem = (i: number) =>
    setItems(prev => prev.filter((_, idx) => idx !== i));

  const addItem = () =>
    setItems(prev => [...prev, { img: "", room: "Комната", type: "Тип потолка", district: "Район", area: 0 }]);

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
          <div className="flex items-center gap-2 px-5 pb-3">
            <input value={pageTitle} onChange={e => setPageTitle(e.target.value)}
              placeholder="Название страницы"
              className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold focus:outline-none transition"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
            <button onClick={() => setPageHidden(v => !v)}
              title={pageHidden ? "Скрыта — нажмите чтобы показать" : "Видна — нажмите чтобы скрыть"}
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
              <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden relative"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {item.img
                  ? <img src={item.img} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Icon name="Image" size={16} className="text-white/20" />
                    </div>}
                <button onClick={() => fileRefs.current[i]?.click()} disabled={uploading === i}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition rounded-lg">
                  {uploading === i
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Icon name="Upload" size={14} className="text-white" />}
                </button>
                <input ref={el => { fileRefs.current[i] = el; }} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(i, f); e.target.value = ""; }} />
              </div>

              {/* Поля */}
              <div className="flex-1 grid grid-cols-2 gap-1.5 min-w-0">
                <input value={item.room} onChange={e => updateItem(i, { room: e.target.value })}
                  placeholder="Комната" className="col-span-2 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
                <input value={item.type} onChange={e => updateItem(i, { type: e.target.value })}
                  placeholder="Тип потолка" className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />
                <input value={item.district} onChange={e => updateItem(i, { district: e.target.value })}
                  placeholder="Район" className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />
                <input value={item.area || ""} onChange={e => updateItem(i, { area: parseFloat(e.target.value) || 0 })}
                  placeholder="Площадь м²" type="number" className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />
              </div>

              <button onClick={() => removeItem(i)}
                className="shrink-0 p-1 text-white/20 hover:text-red-400 transition self-start">
                <Icon name="X" size={14} />
              </button>
            </div>
          ))}

          <button onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs text-white/30 hover:text-white/50 transition"
            style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
            <Icon name="Plus" size={14} /> Добавить фото
          </button>
        </div>
      </div>
    );
  }

  /* ── Режим просмотра ── */
  const displayTitle = externalTitle || "Наши работы";
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Image" title={displayTitle} onClose={onClose}
        onEdit={canEdit ? handleEnterEdit : undefined} />
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((item, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
              onClick={() => setLightboxIndex(i)}>
              <img src={item.img} alt={item.room} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <div>
                  <div className="text-white text-[10px] font-semibold">{item.type}</div>
                  <div className="text-white/50 text-[9px]">{item.district} · {item.area} м²</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {lightboxIndex !== null && (
          <Lightbox images={portImages} index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((lightboxIndex - 1 + portImages.length) % portImages.length)}
            onNext={() => setLightboxIndex((lightboxIndex + 1) % portImages.length)}
          />
        )}
      </div>
    </div>
  );
}

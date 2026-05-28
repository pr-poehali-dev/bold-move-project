import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { FaqProduct } from "./types";
import { uploadFaqImage, searchProductImage } from "./faq-utils";

interface Props {
  product: FaqProduct;
  expanded: boolean;
  onToggle: () => void;
  onChange: (p: FaqProduct) => void;
  onRemove: () => void;
  token: string;
  isDark: boolean;
  readOnly: boolean;
  border: string;
  text: string;
  muted: string;
}

export default function FaqProductRow({ product, expanded, onToggle, onChange, onRemove, token, isDark, readOnly, border, text, muted }: Props) {
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
      const url = await searchProductImage(token, local.name || "натяжной потолок");
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

              {!readOnly && images.length < 5 && (
                <button
                  onClick={handleAiImage}
                  disabled={generating}
                  title="AI найдёт картинку по названию товара"
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

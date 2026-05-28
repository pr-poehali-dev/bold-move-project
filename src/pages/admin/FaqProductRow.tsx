import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { FaqProduct } from "./types";
import { uploadFaqImage, searchProductImages, getRejectedSources, addRejectedSource, enrichProductData } from "./faq-utils";

interface Props {
  product: FaqProduct;
  expanded: boolean;
  onToggle: () => void;
  onChange: (p: FaqProduct, immediate?: boolean) => void;
  onRemove: () => void;
  token: string;
  isDark: boolean;
  readOnly: boolean;
  border: string;
  text: string;
  muted: string;
  categoryName?: string;
}

export default function FaqProductRow({ product, expanded, onToggle, onChange, onRemove, token, isDark, readOnly, border, text, muted, categoryName = "" }: Props) {
  const [local, setLocal] = useState<FaqProduct>(product);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichPreview, setEnrichPreview] = useState<string | null>(null);
  const [sliderIdx, setSliderIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Source-URL каждой добавленной картинки: cdn → source (для исключения повторов)
  const cdnToSource = useRef<Map<string, string>>(new Map());
  // Счётчик активных операций сохранения — пока > 0, не перезатираем local из родителя
  const savingCount = useRef(0);

  useEffect(() => {
    if (savingCount.current === 0) {
      setLocal(product);
    }
  }, [product]);

  // Нормализуем: старое поле image_url → images[]
  const images: string[] = local.images?.length
    ? local.images
    : (local as unknown as { image_url?: string }).image_url
      ? [(local as unknown as { image_url: string }).image_url]
      : [];

  const update = (patch: Partial<FaqProduct>, immediate = false) => {
    const updated = { ...local, ...patch };
    setLocal(updated);
    if (immediate) {
      onChange(updated, true);
    } else {
      onChange(updated, false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length >= 5) return;
    savingCount.current += 1;
    setUploading(true);
    try {
      const available = 5 - images.length;
      const toUpload = Array.from(files).slice(0, available);
      const urls = await Promise.all(toUpload.map(f => uploadFaqImage(token, f)));
      update({ images: [...images, ...urls] }, true);
    } catch (e) { console.error(e); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; savingCount.current = Math.max(0, savingCount.current - 1); }
  };

  const removeImage = (idx: number) => {
    const removedCdn = images[idx];
    if (removedCdn) {
      const src = cdnToSource.current.get(removedCdn) || removedCdn;
      addRejectedSource(local.id, src);
    }
    update({ images: images.filter((_, i) => i !== idx) }, true);
  };

  const handleEnrich = async () => {
    if (!local.name) return;
    setEnriching(true);
    setEnrichPreview(null);
    try {
      const { description } = await enrichProductData(token, local.name, local.description || "", categoryName);
      // Если описания нет — сразу вставляем, иначе — показываем превью с выбором
      if (!local.description?.trim()) {
        update({ description }, true);
      } else {
        setEnrichPreview(description);
      }
    } catch (e) { console.error(e); }
    finally { setEnriching(false); }
  };

  const applyEnrich = (mode: "replace" | "append") => {
    if (!enrichPreview) return;
    const newDesc = mode === "replace"
      ? enrichPreview
      : (local.description?.trim() ? local.description.trim() + "\n\n" + enrichPreview : enrichPreview);
    update({ description: newDesc }, true);
    setEnrichPreview(null);
  };

  const handleAiImage = async () => {
    if (images.length >= 5) return;
    savingCount.current += 1;
    setGenerating(true);
    try {
      const available = 5 - images.length;
      const rejectedSources = getRejectedSources(local.id);
      const currentSources = images.map(cdn => cdnToSource.current.get(cdn) || cdn);
      const excludeAll = [...new Set([...rejectedSources, ...currentSources])];
      const { cdns, sources } = await searchProductImages(
        token, local.name || "натяжной потолок", available, excludeAll
      );
      if (cdns.length > 0) {
        cdns.forEach((cdn, i) => { if (sources[i]) cdnToSource.current.set(cdn, sources[i]); });
        update({ images: [...images, ...cdns] }, true);
      }
    } catch (e) { console.error(e); }
    finally { setGenerating(false); savingCount.current = Math.max(0, savingCount.current - 1); }
  };

  const firstImage = images[0] || "";

  return (
    <>
      <div className="rounded-lg overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb", border: `1px solid ${border}` }}>
        {/* Миниатюра + название — всегда видно */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none hover:brightness-110 transition"
          onClick={onToggle}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center cursor-pointer"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}
            onClick={e => { if (firstImage) { e.stopPropagation(); setSliderIdx(0); } }}>
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
                  onChange={e => update({ name: e.target.value }, false)}
                  disabled={readOnly}
                  placeholder="MSD Classic"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none transition disabled:opacity-60"
                  style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", border: `1px solid ${border}`, color: text }}
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-2" style={{ color: muted }}>
                  Описание
                  {!readOnly && (
                    <button
                      onClick={handleEnrich}
                      disabled={enriching || !local.name}
                      title="AI соберёт данные о товаре из интернета и заполнит описание"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition disabled:opacity-40"
                      style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)", textTransform: "none", letterSpacing: 0 }}>
                      {enriching
                        ? <><div className="w-2.5 h-2.5 border border-violet-400 border-t-transparent rounded-full animate-spin" /> Ищу в интернете...</>
                        : <><Icon name="Globe" size={10} /> AI из интернета</>
                      }
                    </button>
                  )}
                </div>
                <textarea
                  value={local.description}
                  onChange={e => { update({ description: e.target.value }, false); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  ref={el => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                  disabled={readOnly}
                  placeholder="Цена, особенности, применение..."
                  rows={1}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition disabled:opacity-60"
                  style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", border: `1px solid ${border}`, color: text, overflow: "hidden" }}
                />

                {/* Превью AI-описания с выбором действия */}
                {enrichPreview && (
                  <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.07)" }}>
                    <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.1)" }}>
                      <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: "#a78bfa" }}>
                        <Icon name="Sparkles" size={10} /> AI нашёл новое описание
                      </span>
                      <button onClick={() => setEnrichPreview(null)} className="opacity-50 hover:opacity-100 transition" style={{ color: "#a78bfa" }}>
                        <Icon name="X" size={12} />
                      </button>
                    </div>
                    <p className="px-3 py-2 text-xs leading-relaxed" style={{ color: text }}>{enrichPreview}</p>
                    <div className="flex gap-2 px-3 pb-2.5">
                      <button
                        onClick={() => applyEnrich("replace")}
                        className="flex-1 py-1.5 rounded-md text-[11px] font-bold transition hover:brightness-110"
                        style={{ background: "rgba(139,92,246,0.8)", color: "#fff" }}>
                        Заменить
                      </button>
                      <button
                        onClick={() => applyEnrich("append")}
                        className="flex-1 py-1.5 rounded-md text-[11px] font-bold transition hover:brightness-110"
                        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb", color: text }}>
                        Добавить в конец
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Галерея картинок */}
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: muted }}>
                Фотографии
                <span style={{ color: muted, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  ({images.length}/5)
                </span>
                {images.length > 1 && !readOnly && (
                  <span style={{ color: muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>
                    · перетащи чтобы изменить порядок
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div
                    key={url}
                    draggable={!readOnly && images.length > 1}
                    onDragStart={() => { dragFrom.current = i; }}
                    onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(null);
                      const from = dragFrom.current;
                      if (from === null || from === i) return;
                      const reordered = [...images];
                      const [moved] = reordered.splice(from, 1);
                      reordered.splice(i, 0, moved);
                      update({ images: reordered }, true);
                      dragFrom.current = null;
                    }}
                    onDragEnd={() => { setDragOver(null); dragFrom.current = null; }}
                    className="relative w-16 h-16 flex-shrink-0 group rounded-xl overflow-hidden"
                    style={{
                      border: dragOver === i
                        ? "2px solid #a78bfa"
                        : i === 0
                          ? "2px solid rgba(139,92,246,0.6)"
                          : `1px solid ${border}`,
                      cursor: images.length > 1 && !readOnly ? "grab" : "pointer",
                      opacity: dragFrom.current === i ? 0.4 : 1,
                      transition: "border 0.15s, opacity 0.15s",
                    }}
                    onClick={() => setSliderIdx(i)}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                    {/* Метка обложки */}
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-0.5"
                        style={{ background: "rgba(139,92,246,0.75)", fontSize: 8, color: "#fff", fontWeight: 700, letterSpacing: 0.5 }}>
                        ОБЛОЖКА
                      </div>
                    )}
                    {!readOnly && (
                      <button
                        onClick={e => { e.stopPropagation(); removeImage(i); }}
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
                    title="AI найдёт картинки по названию товара"
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

      {/* Слайдер */}
      {sliderIdx !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setSliderIdx(null)}>
          {/* Закрыть */}
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white transition hover:bg-white/10"
            onClick={() => setSliderIdx(null)}>
            <Icon name="X" size={22} />
          </button>

          {/* Стрелка влево */}
          {images.length > 1 && (
            <button
              className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center text-white transition hover:bg-white/10"
              onClick={e => { e.stopPropagation(); setSliderIdx(((sliderIdx - 1) + images.length) % images.length); }}>
              <Icon name="ChevronLeft" size={28} />
            </button>
          )}

          {/* Картинка */}
          <img
            src={images[sliderIdx]}
            alt=""
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* Стрелка вправо */}
          {images.length > 1 && (
            <button
              className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center text-white transition hover:bg-white/10"
              onClick={e => { e.stopPropagation(); setSliderIdx((sliderIdx + 1) % images.length); }}>
              <Icon name="ChevronRight" size={28} />
            </button>
          )}

          {/* Точки-индикаторы */}
          {images.length > 1 && (
            <div className="absolute bottom-6 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setSliderIdx(i); }}
                  className="w-2 h-2 rounded-full transition"
                  style={{ background: i === sliderIdx ? "#fff" : "rgba(255,255,255,0.35)" }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
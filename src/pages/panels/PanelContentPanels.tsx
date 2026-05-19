import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { PRODUCTION } from "../data/content";
import { PORTFOLIO_ITEMS } from "../data/portfolio";
import { PROD_FEATURES } from "../chatConfig";
import type { NavButton, PageBlock, PageSettings, PageBlockStyle, ProductionItem } from "@/context/AuthContext";
import { PanelHeader } from "./PanelHeader";
import { uploadBrandImage } from "../admin/own-agent/brandApi";

// ── helpers ───────────────────────────────────────────────────────────────────
function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function blockWidthClass(w?: number): string {
  switch (w) {
    case 25: return "w-1/4";
    case 33: return "w-1/3";
    case 50: return "w-1/2";
    case 67: return "w-2/3";
    case 75: return "w-3/4";
    default: return "w-full";
  }
}

function blockStyleToCss(s?: PageBlockStyle): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};
  if (s.bgType === "color" && s.bgColor) {
    const op = s.bgOpacity ?? 100;
    const r = parseInt(s.bgColor.slice(1,3),16), g = parseInt(s.bgColor.slice(3,5),16), b = parseInt(s.bgColor.slice(5,7),16);
    css.backgroundColor = `rgba(${r},${g},${b},${op/100})`;
  } else if (s.bgType === "gradient" && s.bgGradFrom && s.bgGradTo) {
    css.background = `linear-gradient(${s.bgGradAngle ?? 135}deg, ${s.bgGradFrom}, ${s.bgGradTo})`;
  }
  if (s.borderWidth && s.borderWidth > 0) {
    css.border = `${s.borderWidth}px ${s.borderStyle ?? "solid"} ${s.borderColor ?? "#ffffff33"}`;
  }
  if (s.borderRadius !== undefined) css.borderRadius = s.borderRadius;
  if ((s.shadowBlur ?? 0) > 0 || (s.shadowX ?? 0) !== 0 || (s.shadowY ?? 0) !== 0) {
    css.boxShadow = `${s.shadowX ?? 0}px ${s.shadowY ?? 0}px ${s.shadowBlur ?? 0}px ${s.shadowColor ?? "rgba(0,0,0,0.4)"}`;
  }
  if (s.padTop || s.padRight || s.padBottom || s.padLeft) {
    css.padding = `${s.padTop ?? 0}px ${s.padRight ?? 0}px ${s.padBottom ?? 0}px ${s.padLeft ?? 0}px`;
  }
  if (s.opacity !== undefined && s.opacity < 100) css.opacity = s.opacity / 100;
  return css;
}

// ── Block content renderer (shared) ──────────────────────────────────────────
function BlockContent({ block, blockW, blockH, onLightbox }: { block: PageBlock; blockW?: number; blockH?: number; onLightbox?: (photos: string[], idx: number) => void }) {
  const ac = (a: string) => a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
  const bh = blockH ?? (block.h ?? 48);
  const bw = blockW ?? (block.w ?? 200);
  const isHtml = (s: string) => /<[a-z][\s\S]*>/i.test(s);

  if (block.type === "heading") {
    const pct = block.size === "xl" ? 0.07 : block.size === "lg" ? 0.055 : 0.042;
    const fw  = block.size === "xl" ? 900 : 700;
    const fs  = Math.max(11, Math.min(Math.round(bw * pct), bh - 4));
    return (
      <div className={`w-full ${ac(block.align)}`} style={{ overflowWrap: "break-word" }}>
        {isHtml(block.text)
          ? <div className="text-white w-full" style={{ fontSize: fs, fontWeight: fw, lineHeight: 1.2, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: block.text }} />
          : <p className="text-white w-full" style={{ fontSize: fs, fontWeight: fw, lineHeight: 1.2, wordBreak: "break-word" }}>{block.text}</p>
        }
      </div>
    );
  }
  if (block.type === "text") {
    const fs = Math.max(9, Math.min(Math.round(bw * 0.04), 18));
    return (
      <div className={`w-full ${ac(block.align)}`}>
        {isHtml(block.text)
          ? <div className="text-white/80 leading-relaxed w-full" style={{ fontSize: fs }} dangerouslySetInnerHTML={{ __html: block.text }} />
          : <p className="text-white/80 whitespace-pre-wrap leading-relaxed w-full" style={{ fontSize: fs }}>{block.text}</p>
        }
      </div>
    );
  }
  if (block.type === "gallery") {
    const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[block.cols];
    const ratio = block.ratio === "square" ? "aspect-square" : block.ratio === "16/9" ? "aspect-video" : "aspect-[4/3]";
    if (!block.photos.length) return null;
    return (
      <div className={`grid ${cols} gap-1.5 h-full`}>
        {block.photos.map((url, i) => (
          <div key={i} className={`${ratio} rounded-lg overflow-hidden cursor-pointer`}
            onClick={() => onLightbox?.(block.photos, i)}>
            <img src={url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "buttons") {
    const jc = block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : "justify-start";
    return (
      <div className={`flex flex-wrap gap-2 ${jc}`}>
        {block.items.map((btn, i) => {
          const click = () => {
            if (!btn.value) return;
            if (btn.action === "phone") { window.location.href = `tel:${btn.value.replace(/\D/g,"").replace(/^8/,"+7")}`; return; }
            if (btn.action === "whatsapp") { window.open(`https://wa.me/${btn.value.replace(/\D/g,"")}`, "_blank"); return; }
            if (btn.action === "telegram") { window.open(btn.value.startsWith("http") ? btn.value : `https://t.me/${btn.value.replace("@","")}`, "_blank"); return; }
            window.open(btn.value, "_blank");
          };
          return (
            <button key={i} onClick={click}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 ${
                btn.style === "primary"
                  ? "text-white bg-gradient-to-r from-orange-500 to-rose-500"
                  : "text-orange-400 border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20"
              }`}>
              {btn.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (block.type === "divider") {
    if (block.style === "dots") return <div className="flex justify-center items-center gap-2 h-full"><span className="w-1.5 h-1.5 rounded-full bg-white/20" /><span className="w-1.5 h-1.5 rounded-full bg-white/20" /><span className="w-1.5 h-1.5 rounded-full bg-white/20" /></div>;
    if (block.style === "space") return <div className="w-full h-full" />;
    return <div className="w-full h-px bg-white/10 self-center" />;
  }
  if (block.type === "video") {
    const embed = getYouTubeEmbed(block.url);
    if (!embed && block.url && (block.url.endsWith(".mp4") || block.url.endsWith(".webm") || block.url.includes("/bucket/"))) {
      return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><video src={block.url} className="w-full h-full object-cover" controls /></div>;
    }
    if (!embed) return null;
    return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><iframe src={embed} className="w-full h-full" allowFullScreen /></div>;
  }
  if (block.type === "card") {
    const side    = block.photoSide ?? "left";
    const hasPhoto = !!block.photoUrl;
    if (side === "top") return (
      <div className={`flex flex-col w-full ${ac(block.align ?? "left")}`}>
        {hasPhoto && <img src={block.photoUrl} alt="" className="w-full object-cover rounded-xl mb-2" style={{ maxHeight: 160 }} />}
        <p className="text-white font-bold text-sm leading-tight">{block.title}</p>
        <p className="text-white/60 text-xs leading-relaxed mt-1">{block.text}</p>
      </div>
    );
    if (!hasPhoto || side === "none") return (
      <div className={`w-full ${ac(block.align ?? "left")}`}>
        <p className="text-white font-bold text-sm leading-tight">{block.title}</p>
        <p className="text-white/60 text-xs leading-relaxed mt-1">{block.text}</p>
      </div>
    );
    return (
      <div className={`flex gap-3 w-full h-full ${side === "right" ? "flex-row-reverse" : "flex-row"}`}>
        <img src={block.photoUrl} alt="" className="rounded-xl object-cover shrink-0" style={{ width: "38%", maxHeight: "100%" }} />
        <div className={`flex flex-col justify-center min-w-0 ${ac(block.align ?? "left")}`}>
          <p className="text-white font-bold text-sm leading-tight">{block.title}</p>
          <p className="text-white/60 text-xs leading-relaxed mt-1">{block.text}</p>
        </div>
      </div>
    );
  }
  if (block.type === "price") {
    return (
      <div className="w-full">
        {block.title && <p className="text-white font-bold text-sm mb-2">{block.title}</p>}
        <div className="space-y-1.5">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-white/[0.05] last:border-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.icon && <span className="text-base">{item.icon}</span>}
                <div className="min-w-0">
                  <span className="text-white/80 text-sm">{item.name}</span>
                  {item.desc && <p className="text-white/35 text-[10px]">{item.desc}</p>}
                </div>
              </div>
              <span className="text-emerald-400 font-bold text-sm whitespace-nowrap shrink-0">{item.price}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === "quote") {
    return (
      <div className="w-full h-full flex flex-col justify-between">
        <p className="text-white/90 text-sm leading-relaxed italic">«{block.text}»</p>
        {(block.author || block.avatar) && (
          <div className="flex items-center gap-2 mt-3">
            {block.avatar && <img src={block.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />}
            <div>
              {block.author && <p className="text-white text-xs font-semibold">{block.author}</p>}
              {block.role   && <p className="text-white/40 text-[10px]">{block.role}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (block.type === "ai-image") {
    if (!block.imageUrl) return null;
    return (
      <img
        src={block.imageUrl}
        alt={block.alt || block.prompt || "AI изображение"}
        className="w-full h-full rounded-xl"
        style={{ objectFit: block.fit ?? "cover" }}
      />
    );
  }
  return null;
}

// ── Renderer для блоков конструктора ─────────────────────────────────────────
function RenderBlocks({ blocks, pageSettings }: { blocks: PageBlock[]; pageSettings?: PageSettings | null }) {
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const isFree = pageSettings?.freeCanvas ?? false;
  const cw = pageSettings?.canvasWidth ?? 390;
  const ch = pageSettings?.canvasHeight ?? 1200;

  if (isFree) {
    // Free-canvas: absolute positioning, container = canvas size, scales to panel width
    return (
      <div className="w-full overflow-x-hidden overflow-y-auto">
        <div style={{ position: "relative", width: cw, height: ch, maxWidth: "100%" }}
          className="mx-auto">
          {[...blocks]
            .filter(b => !b.hidden)
            .sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1))
            .map(block => {
              const es = blockStyleToCss(block.style_);
              const padStyle = block.style_ ? { padding: es.padding } : { padding: "8px" };
              return (
                <div
                  key={block.id}
                  style={{
                    position: "absolute",
                    left: block.x ?? 0, top: block.y ?? 0,
                    width: block.w ?? 240, height: block.h ?? 80,
                    zIndex: block.zIndex ?? 1,
                    background: es.background ?? (block.bg || undefined),
                    backgroundColor: es.background ? undefined : es.backgroundColor,
                    border: es.border,
                    borderRadius: es.borderRadius ?? 12,
                    boxShadow: es.boxShadow,
                    opacity: es.opacity,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ width: "100%", height: "100%", overflow: "hidden", ...padStyle }}>
                    <BlockContent block={block} blockW={block.w ?? 240} blockH={block.h ?? 80} onLightbox={(photos, idx) => setLightbox({ photos, idx })} />
                  </div>
                </div>
              );
            })}
          {lightbox && (
            <Lightbox
              images={lightbox.photos.map(s => ({ src: s, alt: "" }))}
              index={lightbox.idx}
              onClose={() => setLightbox(null)}
              onPrev={() => setLightbox(l => l ? { ...l, idx: (l.idx - 1 + l.photos.length) % l.photos.length } : null)}
              onNext={() => setLightbox(l => l ? { ...l, idx: (l.idx + 1) % l.photos.length } : null)}
            />
          )}
        </div>
      </div>
    );
  }

  // Flow-режим (блочный, обратная совместимость)
  const maxWClass: Record<string, string> = {
    sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl", full: "max-w-full"
  };

  return (
    <div className={`p-4 mx-auto ${maxWClass[pageSettings?.maxWidth ?? "md"] ?? "max-w-md"}`}>
      <div className="flex flex-wrap gap-2">
        {blocks.map(block => {
          if (block.hidden) return null;
          const wClass = blockWidthClass(block.width);
          const blockStyle: React.CSSProperties = {
            paddingTop: block.paddingTop ?? 0,
            paddingBottom: block.paddingBottom ?? 0,
            background: block.bg || undefined,
          };
          return (
            <div key={block.id} className={wClass} style={blockStyle}>
              <BlockContent block={block} onLightbox={(photos, idx) => setLightbox({ photos, idx })} />
            </div>
          );
        })}
      </div>
      {lightbox && (
        <Lightbox
          images={lightbox.photos.map(s => ({ src: s, alt: "" }))}
          index={lightbox.idx}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(l => l ? { ...l, idx: (l.idx - 1 + l.photos.length) % l.photos.length } : null)}
          onNext={() => setLightbox(l => l ? { ...l, idx: (l.idx + 1) % l.photos.length } : null)}
        />
      )}
    </div>
  );
}

export function PanelProduction({
  onClose,
  canEdit,
  items: externalItems,
  pageTitle: externalTitle,
  pageHidden: externalHidden,
  token,
  onSave,
}: {
  onClose:      () => void;
  canEdit?:     boolean;
  items?:       ProductionItem[] | null;
  pageTitle?:   string | null;
  pageHidden?:  boolean | null;
  token?:       string | null;
  onSave?:      (items: ProductionItem[], title: string, hidden: boolean) => void;
}) {
  const baseItems = (externalItems && externalItems.length > 0) ? externalItems : PRODUCTION;
  const [editMode, setEditMode]           = useState(false);
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

export function PanelPortfolio({ onClose, onEdit }: { onClose: () => void; onEdit?: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const portfolioSlice = PORTFOLIO_ITEMS.slice(0, 12);
  const portImages = portfolioSlice.map((item) => ({ src: item.img, alt: `${item.room} · ${item.type}` }));

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Image" title="Наши работы" onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {portfolioSlice.map((item, i) => (
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
          <Lightbox
            images={portImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((lightboxIndex - 1 + portImages.length) % portImages.length)}
            onNext={() => setLightboxIndex((lightboxIndex + 1) % portImages.length)}
          />
        )}
      </div>
    </div>
  );
}

export function PanelCustom({ btn, onClose, onEdit }: { btn: NavButton; onClose: () => void; onEdit?: () => void }) {
  const c = btn.content || {};
  const hasBlocks = !!(c.blocks?.length);

  const handleBtnClick = () => {
    if (!c.btn_action || !c.btn_value) return;
    if (c.btn_action === "phone") { window.location.href = `tel:${c.btn_value.replace(/\D/g, "").replace(/^8/, "+7")}`; return; }
    if (c.btn_action === "whatsapp") { window.open(`https://wa.me/${c.btn_value.replace(/\D/g, "")}`, "_blank"); return; }
    if (c.btn_action === "telegram") { window.open(c.btn_value.startsWith("http") ? c.btn_value : `https://t.me/${c.btn_value.replace("@", "")}`, "_blank"); return; }
    if (c.btn_action === "url") { window.open(c.btn_value, "_blank"); return; }
  };

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon={btn.icon} title={c.title || btn.label} onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto">
        {hasBlocks ? (
          <RenderBlocks blocks={c.blocks!} pageSettings={c.pageSettings} />
        ) : (
          <>
            {c.photo_url && (
              <div className="w-full" style={{ aspectRatio: "16/7" }}>
                <img src={c.photo_url} className="w-full h-full object-cover" alt={btn.label} />
              </div>
            )}
            <div className="p-4 space-y-4">
              {c.text && <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{c.text}</p>}
              {!c.text && !c.photo_url && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-white/20 text-sm mb-2">Страница пустая</p>
                  {onEdit && <p className="text-white/15 text-xs">Нажмите ✏️ чтобы добавить контент</p>}
                </div>
              )}
              {c.btn_label && c.btn_action && c.btn_value && (
                <button onClick={handleBtnClick}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition active:scale-95"
                  style={{ background: "linear-gradient(135deg, #f97316, #e11d48)" }}>
                  {c.btn_label}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
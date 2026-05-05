import { useState } from "react";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { PRODUCTION } from "../data/content";
import { PORTFOLIO_ITEMS } from "../data/portfolio";
import { PROD_FEATURES } from "../chatConfig";
import type { NavButton, PageBlock, PageSettings } from "@/context/AuthContext";
import { PanelHeader } from "./PanelHeader";

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

// ── Block content renderer (shared) ──────────────────────────────────────────
function BlockContent({ block, onLightbox }: { block: PageBlock; onLightbox?: (photos: string[], idx: number) => void }) {
  const ac = (a: string) => a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

  if (block.type === "heading") {
    const sz = block.size === "xl" ? "text-2xl font-black" : block.size === "lg" ? "text-xl font-bold" : "text-base font-bold";
    return <p className={`${sz} text-white ${ac(block.align)} break-words leading-tight`}>{block.text}</p>;
  }
  if (block.type === "text") {
    return <p className={`text-white/70 text-sm leading-relaxed whitespace-pre-wrap ${ac(block.align)}`}>{block.text}</p>;
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
    if (!embed) return null;
    return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><iframe src={embed} className="w-full h-full" allowFullScreen /></div>;
  }
  if (block.type === "spacer") return <div className="w-full h-full" />;
  if (block.type === "card") {
    return (
      <div className={`flex flex-col gap-1.5 p-3 h-full rounded-2xl bg-white/[0.03] border border-white/[0.06] ${ac(block.align)}`}>
        <span className="text-3xl">{block.icon}</span>
        <p className="text-white font-bold text-sm">{block.title}</p>
        <p className="text-white/50 text-xs leading-relaxed">{block.text}</p>
      </div>
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
            .map(block => (
              <div
                key={block.id}
                style={{
                  position: "absolute",
                  left: block.x ?? 0, top: block.y ?? 0,
                  width: block.w ?? 240, height: block.h ?? 80,
                  zIndex: block.zIndex ?? 1,
                  background: block.bg || undefined,
                  overflow: "hidden",
                }}
                className="rounded-xl"
              >
                <BlockContent block={block} onLightbox={(photos, idx) => setLightbox({ photos, idx })} />
              </div>
            ))}
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

export function PanelProduction({ onClose, onEdit }: { onClose: () => void; onEdit?: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const prodImages = PRODUCTION.map((item) => ({ src: item.img, alt: item.title }));

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Factory" title="Собственное производство" onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {PRODUCTION.map((item, i) => (
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
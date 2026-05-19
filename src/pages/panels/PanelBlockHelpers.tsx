import { useState } from "react";
import Lightbox from "@/components/ui/lightbox";
import type { PageBlock, PageSettings, PageBlockStyle } from "@/context/AuthContext";

// ── helpers ───────────────────────────────────────────────────────────────────
export function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export function blockWidthClass(w?: number): string {
  switch (w) {
    case 25: return "w-1/4";
    case 33: return "w-1/3";
    case 50: return "w-1/2";
    case 67: return "w-2/3";
    case 75: return "w-3/4";
    default: return "w-full";
  }
}

export function blockStyleToCss(s?: PageBlockStyle): React.CSSProperties {
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
export function BlockContent({ block, blockW, blockH, onLightbox }: { block: PageBlock; blockW?: number; blockH?: number; onLightbox?: (photos: string[], idx: number) => void }) {
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
export function RenderBlocks({ blocks, pageSettings }: { blocks: PageBlock[]; pageSettings?: PageSettings | null }) {
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const isFree = pageSettings?.freeCanvas ?? false;
  const cw = pageSettings?.canvasWidth ?? 390;
  const ch = pageSettings?.canvasHeight ?? 1200;

  if (isFree) {
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

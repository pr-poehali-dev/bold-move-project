import type { PageBlock } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { getYouTubeEmbed } from "./editorTypes";

const isHtml = (s: string) => /<[a-z][\s\S]*>/i.test(s);
const ac = (a: string) => a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

export function HeadingBlock({ block, bw, bh }: { block: PageBlock & { type: "heading" }; bw: number; bh: number }) {
  const pct = block.size === "xl" ? 0.07 : block.size === "lg" ? 0.055 : 0.042;
  const fw  = block.size === "xl" ? 900 : 700;
  const fs  = Math.max(11, Math.min(Math.round(bw * pct), bh - 4));
  const text = block.text || "Заголовок";
  return (
    <div className={`w-full ${ac(block.align)}`} style={{ overflowWrap: "break-word" }}>
      {isHtml(text)
        ? <div className="text-white leading-tight w-full" style={{ fontSize: fs, fontWeight: fw, lineHeight: 1.2, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: text }} />
        : <p className="text-white leading-tight w-full" style={{ fontSize: fs, fontWeight: fw, lineHeight: 1.2, wordBreak: "break-word" }}>{text}</p>
      }
    </div>
  );
}

export function TextBlock({ block, bw }: { block: PageBlock & { type: "text" }; bw: number }) {
  const fs = Math.max(9, Math.min(Math.round(bw * 0.04), 18));
  const text = block.text || "Текст";
  return (
    <div className={`w-full ${ac(block.align)}`}>
      {isHtml(text)
        ? <div className="text-white/80 leading-relaxed w-full" style={{ fontSize: fs }} dangerouslySetInnerHTML={{ __html: text }} />
        : <p className="text-white/80 whitespace-pre-wrap leading-relaxed w-full" style={{ fontSize: fs }}>{text}</p>
      }
    </div>
  );
}

export function GalleryBlock({ block }: { block: PageBlock & { type: "gallery" } }) {
  const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[block.cols];
  const ratio = block.ratio === "square" ? "aspect-square" : block.ratio === "16/9" ? "aspect-video" : "aspect-[4/3]";
  if (!block.photos.length) return (
    <div className="w-full h-full rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs">Нет фото</div>
  );
  return <div className={`grid ${cols} gap-1`}>{block.photos.map((u, i) => <div key={i} className={`${ratio} rounded overflow-hidden`}><img src={u} className="w-full h-full object-cover" /></div>)}</div>;
}

export function ButtonsBlock({ block, bh }: { block: PageBlock & { type: "buttons" }; bh: number }) {
  const jc = block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : "justify-start";
  const btnH = Math.min(Math.max(24, Math.round(bh * 0.6)), bh - 8);
  const fs = Math.max(9, Math.round(btnH * 0.35));
  const px = Math.max(8, Math.round(btnH * 0.4));
  return (
    <div className={`flex flex-wrap gap-1.5 w-full h-full items-center ${jc}`}>
      {block.items.map((btn, i) => (
        <div key={i}
          className={`rounded-xl font-bold whitespace-nowrap ${
            btn.style === "primary" ? "text-white bg-gradient-to-r from-orange-500 to-rose-500" : "text-orange-400 border border-orange-500/40 bg-orange-500/10"
          }`}
          style={{ fontSize: fs, paddingTop: btnH * 0.2, paddingBottom: btnH * 0.2, paddingLeft: px, paddingRight: px }}
        >
          {btn.label}
        </div>
      ))}
    </div>
  );
}

export function VideoBlock({ block }: { block: PageBlock & { type: "video" } }) {
  const embed = getYouTubeEmbed(block.url);
  if (!embed && block.url && (block.url.endsWith(".mp4") || block.url.endsWith(".webm") || block.url.includes("/bucket/"))) {
    return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><video src={block.url} className="w-full h-full object-cover" controls /></div>;
  }
  if (!embed) return <div className="w-full h-full rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center gap-2 text-white/20 text-xs"><Icon name="Play" size={14} />Ссылка или видео-файл</div>;
  return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><iframe src={embed} className="w-full h-full" allowFullScreen /></div>;
}

export function CardBlock({ block, bw, bh }: { block: PageBlock & { type: "card" }; bw: number; bh: number }) {
  const side     = block.photoSide ?? "left";
  const titleFs  = Math.max(11, Math.min(Math.round(bw * 0.045), 22));
  const descFs   = Math.max(9,  Math.min(Math.round(bw * 0.032), 14));
  const hasPhoto = !!block.photoUrl;

  const renderTitle = (fs: number) => isHtml(block.title)
    ? <div className="text-white font-bold leading-tight" style={{ fontSize: fs }} dangerouslySetInnerHTML={{ __html: block.title }} />
    : <p className="text-white font-bold leading-tight" style={{ fontSize: fs }}>{block.title}</p>;
  const renderDesc = (fs: number) => isHtml(block.text)
    ? <div className="text-white/60 leading-relaxed mt-0.5" style={{ fontSize: fs }} dangerouslySetInnerHTML={{ __html: block.text }} />
    : <p className="text-white/60 leading-relaxed mt-0.5" style={{ fontSize: fs }}>{block.text}</p>;

  if (side === "top") {
    return (
      <div className={`flex flex-col w-full overflow-hidden ${ac(block.align ?? "left")}`}>
        {hasPhoto && <img src={block.photoUrl} alt="" className="w-full object-cover rounded-lg mb-2" style={{ height: Math.round(bh * 0.5) }} />}
        {renderTitle(titleFs)}{renderDesc(descFs)}
      </div>
    );
  }
  if (side === "none" || !hasPhoto) {
    return (
      <div className={`flex flex-col justify-center w-full h-full ${ac(block.align ?? "left")}`}>
        {renderTitle(titleFs)}{renderDesc(descFs)}
      </div>
    );
  }
  const imgW = Math.round(bw * 0.38);
  return (
    <div className={`flex gap-3 w-full h-full overflow-hidden ${side === "right" ? "flex-row-reverse" : "flex-row"}`}>
      <img src={block.photoUrl} alt="" className="rounded-lg object-cover shrink-0" style={{ width: imgW, height: "100%" }} />
      <div className={`flex flex-col justify-center min-w-0 ${ac(block.align ?? "left")}`}>
        {renderTitle(titleFs)}{renderDesc(descFs)}
      </div>
    </div>
  );
}

export function PriceBlock({ block, bw }: { block: PageBlock & { type: "price" }; bw: number }) {
  const titleFs = Math.max(10, Math.min(Math.round(bw * 0.04), 16));
  const itemFs  = Math.max(9,  Math.min(Math.round(bw * 0.035), 13));
  return (
    <div className="w-full">
      {block.title && <p className="text-white font-bold mb-1.5" style={{ fontSize: titleFs + 2 }}>{block.title}</p>}
      <div className="space-y-1">
        {block.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              {item.icon && <span style={{ fontSize: itemFs + 2 }}>{item.icon}</span>}
              <span className="text-white/80 truncate" style={{ fontSize: itemFs }}>{item.name}</span>
            </div>
            <span className="text-emerald-400 font-bold whitespace-nowrap shrink-0" style={{ fontSize: itemFs }}>{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuoteBlock({ block, bw }: { block: PageBlock & { type: "quote" }; bw: number }) {
  const textFs   = Math.max(10, Math.min(Math.round(bw * 0.038), 16));
  const authorFs = Math.max(9,  Math.min(Math.round(bw * 0.03),  12));
  return (
    <div className="w-full h-full flex flex-col justify-between">
      {isHtml(block.text)
        ? <div className="text-white/90 leading-relaxed italic" style={{ fontSize: textFs }} dangerouslySetInnerHTML={{ __html: `«${block.text}»` }} />
        : <p className="text-white/90 leading-relaxed italic" style={{ fontSize: textFs }}>«{block.text}»</p>
      }
      {(block.author || block.avatar) && (
        <div className="flex items-center gap-2 mt-2">
          {block.avatar && <img src={block.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />}
          <div>
            {block.author && <p className="text-white font-semibold leading-none" style={{ fontSize: authorFs }}>{block.author}</p>}
            {block.role   && <p className="text-white/40 leading-none mt-0.5" style={{ fontSize: authorFs - 1 }}>{block.role}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AiImageBlock({ block }: { block: PageBlock & { type: "ai-image" } }) {
  if (!block.imageUrl) {
    return (
      <div className="w-full h-full rounded-xl border-2 border-dashed border-fuchsia-500/30 bg-fuchsia-500/5 flex flex-col items-center justify-center gap-2 text-fuchsia-400/70">
        <Icon name="Sparkles" size={20} />
        <span className="text-xs font-medium">Нажмите для генерации</span>
        {block.prompt && <span className="text-[10px] text-fuchsia-400/40 text-center px-2 line-clamp-2">{block.prompt}</span>}
      </div>
    );
  }
  return (
    <img
      src={block.imageUrl}
      alt={block.alt || block.prompt || "AI изображение"}
      className="w-full h-full rounded-xl"
      style={{ objectFit: block.fit ?? "cover" }}
    />
  );
}

export function DividerBlock({ block }: { block: PageBlock & { type: "divider" } }) {
  if (block.style === "dots") return <div className="flex items-center justify-center gap-2 h-full"><span className="w-1.5 h-1.5 rounded-full bg-white/20" /><span className="w-1.5 h-1.5 rounded-full bg-white/20" /><span className="w-1.5 h-1.5 rounded-full bg-white/20" /></div>;
  if (block.style === "space") return <div className="w-full h-full" />;
  return <div className="w-full h-px bg-white/10 self-center" />;
}

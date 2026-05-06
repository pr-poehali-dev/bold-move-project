import React from "react";
import type { PageBlock, PageBlockStyle } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import {
  HeadingBlock,
  TextBlock,
  GalleryBlock,
  ButtonsBlock,
  VideoBlock,
  CardBlock,
  PriceBlock,
  QuoteBlock,
  AiImageBlock,
  DividerBlock,
} from "./BlockContentRenderers";
import { StylePanelBackground } from "./StylePanelBackground";
import { StylePanelBorderShadow } from "./StylePanelBorderShadow";
import { StylePanelPaddingOpacity } from "./StylePanelPaddingOpacity";

export function BlockContent({ block, blockW, blockH }: { block: PageBlock; blockW?: number; blockH?: number }) {
  const bh = blockH ?? (block.h ?? 48);
  const bw = blockW ?? (block.w ?? 200);

  if (block.type === "heading") return <HeadingBlock block={block} bw={bw} bh={bh} />;
  if (block.type === "text")    return <TextBlock block={block} bw={bw} />;
  if (block.type === "gallery") return <GalleryBlock block={block} />;
  if (block.type === "buttons") return <ButtonsBlock block={block} bh={bh} />;
  if (block.type === "video")   return <VideoBlock block={block} />;
  if (block.type === "card")    return <CardBlock block={block} bw={bw} bh={bh} />;
  if (block.type === "price")   return <PriceBlock block={block} bw={bw} />;
  if (block.type === "quote")   return <QuoteBlock block={block} bw={bw} />;
  if (block.type === "ai-image") return <AiImageBlock block={block} />;
  if (block.type === "divider") return <DividerBlock block={block} />;
  return null;
}

// localStorage-ключ для буфера стилей
const STYLE_CLIPBOARD_KEY = "pe_style_clipboard";

export function StylePanel({ s, onChange }: { s: PageBlockStyle; onChange: (p: Partial<PageBlockStyle>) => void }) {
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block";
  const numInp = "w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none";
  const tab2 = (v: boolean) => `flex-1 py-1.5 rounded-lg text-xs font-bold transition ${v ? "bg-violet-500/30 text-violet-300 border border-violet-500/40" : "bg-white/[0.04] text-white/30 border border-white/[0.07] hover:bg-white/[0.08]"}`;

  const [copied, setCopied] = React.useState(false);
  const [hasPaste, setHasPaste] = React.useState(!!localStorage.getItem(STYLE_CLIPBOARD_KEY));

  const handleCopy = () => {
    localStorage.setItem(STYLE_CLIPBOARD_KEY, JSON.stringify(s));
    setCopied(true);
    setHasPaste(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePaste = () => {
    try {
      const raw = localStorage.getItem(STYLE_CLIPBOARD_KEY);
      if (!raw) return;
      onChange(JSON.parse(raw) as PageBlockStyle);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">

      {/* ── Копировать / Вставить стиль ── */}
      <div className="flex gap-2">
        <button onClick={handleCopy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition border ${
            copied
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : "bg-white/[0.04] text-white/50 border-white/[0.08] hover:bg-white/[0.08] hover:text-white/80"
          }`}>
          <Icon name={copied ? "CheckCircle2" : "Copy"} size={12} />
          {copied ? "Скопировано!" : "Копировать стиль"}
        </button>
        <button onClick={handlePaste} disabled={!hasPaste}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition border bg-violet-500/[0.06] text-violet-400 border-violet-500/20 hover:bg-violet-500/15 disabled:opacity-30 disabled:cursor-not-allowed">
          <Icon name="ClipboardPaste" size={12} />
          Вставить стиль
        </button>
      </div>

      <StylePanelBackground s={s} onChange={onChange} tab2={tab2} lbl={lbl} />
      <StylePanelBorderShadow s={s} onChange={onChange} tab2={tab2} lbl={lbl} numInp={numInp} />
      <StylePanelPaddingOpacity s={s} onChange={onChange} lbl={lbl} />

    </div>
  );
}

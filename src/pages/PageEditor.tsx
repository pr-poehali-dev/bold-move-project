import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBrand } from "@/context/BrandContext";
import type { NavButton, PageBlock, PageSettings, PageBlockStyle } from "@/context/AuthContext";
import { updateBrand, uploadBrandImage } from "./admin/own-agent/brandApi";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const PAGE_AI_URL = (func2url as Record<string, string>)["page-ai"];

// ── helpers ───────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9); }

function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function snap(val: number, grid: number, enabled: boolean) {
  if (!enabled || grid < 1) return val;
  return Math.round(val / grid) * grid;
}

const SNAP_EDGE = 6; // px — расстояние для примагничивания к соседним блокам

// Default sizes per block type
const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  heading: { w: 300, h: 60 },
  text:    { w: 300, h: 100 },
  gallery: { w: 300, h: 200 },
  buttons: { w: 240, h: 60 },
  card:    { w: 160, h: 140 },
  video:   { w: 300, h: 180 },
  divider: { w: 300, h: 24 },
  spacer:  { w: 300, h: 48 },
};

function defaultBlock(type: PageBlock["type"], x = 40, y = 40): PageBlock {
  const sz = DEFAULT_SIZES[type] ?? { w: 240, h: 80 };
  const base = { id: genId(), x, y, w: sz.w, h: sz.h, zIndex: 1 };
  if (type === "heading")  return { ...base, type, text: "Заголовок", size: "lg", align: "left" };
  if (type === "text")     return { ...base, type, text: "Введите текст...", align: "left" };
  if (type === "gallery")  return { ...base, type, photos: [], cols: 2, ratio: "4/3" };
  if (type === "buttons")  return { ...base, type, items: [{ label: "Позвонить", action: "phone", value: "", style: "primary" }] };
  if (type === "video")    return { ...base, type, url: "" };
  if (type === "spacer")   return { ...base, type, height: 32 };
  if (type === "card")     return { ...base, type, icon: "⭐", title: "Карточка", text: "Описание", align: "center" };
  return { ...base, type: "divider", style: "line" };
}

// ── Palette ────────────────────────────────────────────────────────────────────
const ADD_BLOCKS: { type: PageBlock["type"]; icon: string; label: string; color: string; bg: string }[] = [
  { type: "heading",  icon: "Heading",       label: "Заголовок",   color: "#c4b5fd", bg: "rgba(139,92,246,0.15)" },
  { type: "text",     icon: "AlignLeft",     label: "Текст",       color: "#93c5fd", bg: "rgba(59,130,246,0.15)" },
  { type: "gallery",  icon: "Image",         label: "Галерея",     color: "#6ee7b7", bg: "rgba(16,185,129,0.15)" },
  { type: "buttons",  icon: "MousePointer",  label: "Кнопки",      color: "#fca5a5", bg: "rgba(239,68,68,0.15)"  },
  { type: "card",     icon: "LayoutList",    label: "Карточка",    color: "#fcd34d", bg: "rgba(245,158,11,0.15)" },
  { type: "video",    icon: "Play",          label: "Видео",       color: "#f9a8d4", bg: "rgba(236,72,153,0.15)" },
  { type: "divider",  icon: "Minus",         label: "Разделитель", color: "#94a3b8", bg: "rgba(148,163,184,0.12)"},
  { type: "spacer",   icon: "ArrowUpDown",   label: "Отступ",      color: "#67e8f9", bg: "rgba(6,182,212,0.13)"  },
];

const BLOCK_LABELS: Record<string, string> = {
  heading: "Заголовок", text: "Текст", gallery: "Галерея",
  buttons: "Кнопки", divider: "Разделитель", video: "Видео",
  spacer: "Отступ", card: "Карточка",
};

// ── Block content renderer ─────────────────────────────────────────────────────
function BlockContent({ block }: { block: PageBlock }) {
  const ac = (a: string) => a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

  if (block.type === "heading") {
    const sz = block.size === "xl" ? "text-2xl font-black" : block.size === "lg" ? "text-xl font-bold" : "text-base font-bold";
    return <p className={`${sz} text-white ${ac(block.align)} break-words leading-tight`}>{block.text || "Заголовок"}</p>;
  }
  if (block.type === "text") {
    return <p className={`text-white/70 text-sm leading-relaxed whitespace-pre-wrap ${ac(block.align)}`}>{block.text || "Текст"}</p>;
  }
  if (block.type === "gallery") {
    const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[block.cols];
    const ratio = block.ratio === "square" ? "aspect-square" : block.ratio === "16/9" ? "aspect-video" : "aspect-[4/3]";
    if (!block.photos.length) return (
      <div className="w-full h-full rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs">Нет фото</div>
    );
    return <div className={`grid ${cols} gap-1 h-full`}>{block.photos.slice(0,8).map((u,i) => <div key={i} className={`${ratio} rounded overflow-hidden`}><img src={u} className="w-full h-full object-cover" /></div>)}</div>;
  }
  if (block.type === "buttons") {
    const jc = block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : "justify-start";
    return (
      <div className={`flex flex-wrap gap-1.5 ${jc}`}>
        {block.items.map((btn, i) => (
          <div key={i} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
            btn.style === "primary" ? "text-white bg-gradient-to-r from-orange-500 to-rose-500" : "text-orange-400 border border-orange-500/40 bg-orange-500/10"
          }`}>{btn.label}</div>
        ))}
      </div>
    );
  }
  if (block.type === "video") {
    const embed = getYouTubeEmbed(block.url);
    if (!embed) return <div className="w-full h-full rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center gap-2 text-white/20 text-xs"><Icon name="Play" size={14} />YouTube / Vimeo</div>;
    return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><iframe src={embed} className="w-full h-full" allowFullScreen /></div>;
  }
  if (block.type === "spacer") {
    return <div className="w-full h-full flex items-center justify-center text-white/15 text-[10px] border border-dashed border-white/10 rounded-lg">↕ {block.height}px</div>;
  }
  if (block.type === "card") {
    return (
      <div className={`flex flex-col gap-1 h-full justify-center ${ac(block.align)}`}>
        <span className="text-2xl">{block.icon}</span>
        <p className="text-white font-bold text-sm leading-tight">{block.title}</p>
        <p className="text-white/50 text-xs leading-relaxed">{block.text}</p>
      </div>
    );
  }
  if (block.type === "divider") {
    if (block.style === "dots") return <div className="flex items-center justify-center gap-2 h-full"><span className="w-1.5 h-1.5 rounded-full bg-white/20" /><span className="w-1.5 h-1.5 rounded-full bg-white/20" /><span className="w-1.5 h-1.5 rounded-full bg-white/20" /></div>;
    if (block.style === "space") return <div className="w-full h-full" />;
    return <div className="w-full h-px bg-white/10 self-center" />;
  }
  return null;
}

// ── blockStyleToCss: PageBlockStyle → React.CSSProperties ─────────────────────
function blockStyleToCss(s?: PageBlockStyle): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};

  // Фон
  if (s.bgType === "color" && s.bgColor) {
    css.backgroundColor = s.bgColor;
    if (s.bgOpacity !== undefined) css.backgroundColor = hexWithOpacity(s.bgColor, s.bgOpacity);
  } else if (s.bgType === "gradient" && s.bgGradFrom && s.bgGradTo) {
    const angle = s.bgGradAngle ?? 135;
    css.background = `linear-gradient(${angle}deg, ${s.bgGradFrom}, ${s.bgGradTo})`;
  }

  // Рамка
  if (s.borderWidth && s.borderWidth > 0) {
    css.border = `${s.borderWidth}px ${s.borderStyle ?? "solid"} ${s.borderColor ?? "#ffffff33"}`;
  }
  if (s.borderRadius !== undefined) css.borderRadius = s.borderRadius;

  // Тень
  if ((s.shadowBlur ?? 0) > 0 || (s.shadowX ?? 0) !== 0 || (s.shadowY ?? 0) !== 0) {
    css.boxShadow = `${s.shadowX ?? 0}px ${s.shadowY ?? 0}px ${s.shadowBlur ?? 0}px ${s.shadowColor ?? "rgba(0,0,0,0.4)"}`;
  }

  // Внутренние отступы
  if (s.padTop || s.padRight || s.padBottom || s.padLeft) {
    css.padding = `${s.padTop ?? 0}px ${s.padRight ?? 0}px ${s.padBottom ?? 0}px ${s.padLeft ?? 0}px`;
  }

  // Прозрачность
  if (s.opacity !== undefined && s.opacity < 100) {
    css.opacity = s.opacity / 100;
  }

  return css;
}

function hexWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${opacity/100})`;
}

// ── StylePanel — панель стилизации блока ──────────────────────────────────────
const PRESET_GRADIENTS: { label: string; from: string; to: string; angle: number }[] = [
  { label: "Закат",    from: "#f97316", to: "#e11d48", angle: 135 },
  { label: "Ночь",     from: "#6366f1", to: "#0f172a", angle: 135 },
  { label: "Океан",    from: "#0ea5e9", to: "#6366f1", angle: 135 },
  { label: "Лес",      from: "#10b981", to: "#0f172a", angle: 135 },
  { label: "Малина",   from: "#ec4899", to: "#8b5cf6", angle: 135 },
  { label: "Золото",   from: "#f59e0b", to: "#ef4444", angle: 135 },
  { label: "Лёд",      from: "#e0f2fe", to: "#6366f1", angle: 180 },
  { label: "Туман",    from: "#374151", to: "#111827", angle: 135 },
];

const PRESET_SHADOWS = [
  { label: "Нет",       x:0, y:0, blur:0,  color:"rgba(0,0,0,0.4)" },
  { label: "Мягкая",    x:0, y:4, blur:12, color:"rgba(0,0,0,0.3)" },
  { label: "Чёткая",    x:2, y:4, blur:6,  color:"rgba(0,0,0,0.5)" },
  { label: "Свечение",  x:0, y:0, blur:20, color:"rgba(139,92,246,0.5)" },
  { label: "Красная",   x:0, y:0, blur:16, color:"rgba(239,68,68,0.5)" },
];

function StylePanel({ s, onChange }: { s: PageBlockStyle; onChange: (p: Partial<PageBlockStyle>) => void }) {
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block";
  const numInp = "w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none";
  const tab2 = (v: boolean) => `flex-1 py-1.5 rounded-lg text-xs font-bold transition ${v ? "bg-violet-500/30 text-violet-300 border border-violet-500/40" : "bg-white/[0.04] text-white/30 border border-white/[0.07] hover:bg-white/[0.08]"}`;

  const bgType = s.bgType ?? "none";

  return (
    <div className="space-y-4">

      {/* ── Фон ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500 to-violet-600 flex items-center justify-center">
            <Icon name="Palette" size={11} className="text-white" />
          </div>
          <span className="text-xs font-bold text-white/70">Фон</span>
        </div>
        <div className="px-3 pb-3 space-y-2.5">
          {/* Тип */}
          <div className="flex gap-1.5">
            {(["none","color","gradient"] as const).map(t => (
              <button key={t} onClick={() => onChange({ bgType: t })} className={tab2(bgType === t)}>
                {t === "none" ? "Нет" : t === "color" ? "Цвет" : "Градиент"}
              </button>
            ))}
          </div>

          {bgType === "color" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="color" value={s.bgColor || "#1e1e2e"}
                  onChange={e => onChange({ bgColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-white/10 bg-transparent" />
                <input value={s.bgColor || ""}
                  onChange={e => onChange({ bgColor: e.target.value })}
                  placeholder="#1e1e2e"
                  className="flex-1 px-2 py-2 rounded-xl text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
              </div>
              <div>
                <label className={lbl}>Прозрачность {s.bgOpacity ?? 100}%</label>
                <input type="range" min={0} max={100} step={1}
                  value={s.bgOpacity ?? 100}
                  onChange={e => onChange({ bgOpacity: Number(e.target.value) })}
                  className="w-full accent-violet-500" />
              </div>
            </div>
          )}

          {bgType === "gradient" && (
            <div className="space-y-2.5">
              {/* Пресеты */}
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_GRADIENTS.map(p => (
                  <button key={p.label}
                    onClick={() => onChange({ bgGradFrom: p.from, bgGradTo: p.to, bgGradAngle: p.angle })}
                    title={p.label}
                    style={{ background: `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})` }}
                    className="h-8 rounded-lg border-2 border-transparent hover:border-white/40 transition" />
                ))}
              </div>
              {/* Цвета */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Цвет 1</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={s.bgGradFrom || "#6366f1"}
                      onChange={e => onChange({ bgGradFrom: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
                    <input value={s.bgGradFrom || ""}
                      onChange={e => onChange({ bgGradFrom: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Цвет 2</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={s.bgGradTo || "#0f172a"}
                      onChange={e => onChange({ bgGradTo: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
                    <input value={s.bgGradTo || ""}
                      onChange={e => onChange({ bgGradTo: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
                  </div>
                </div>
              </div>
              {/* Угол */}
              <div>
                <label className={lbl}>Угол {s.bgGradAngle ?? 135}°</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={360} step={15}
                    value={s.bgGradAngle ?? 135}
                    onChange={e => onChange({ bgGradAngle: Number(e.target.value) })}
                    className="flex-1 accent-violet-500" />
                  <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center shrink-0"
                    style={{ background: `conic-gradient(from ${(s.bgGradAngle??135)}deg, ${s.bgGradFrom||"#6366f1"}, ${s.bgGradTo||"#0f172a"})` }} />
                </div>
              </div>
              {/* Превью */}
              <div className="w-full h-8 rounded-xl"
                style={{ background: `linear-gradient(${s.bgGradAngle??135}deg, ${s.bgGradFrom||"#6366f1"}, ${s.bgGradTo||"#0f172a"})` }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Рамка ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-500/30 flex items-center justify-center">
            <Icon name="Square" size={11} className="text-blue-400" />
          </div>
          <span className="text-xs font-bold text-white/70">Рамка</span>
        </div>
        <div className="px-3 pb-3 space-y-2.5">
          {/* Стиль */}
          <div className="flex gap-1.5">
            {(["solid","dashed","dotted"] as const).map(st => (
              <button key={st} onClick={() => onChange({ borderStyle: st })}
                className={tab2((s.borderStyle ?? "solid") === st)}>
                {st === "solid" ? "—" : st === "dashed" ? "- -" : "···"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Толщина</label>
              <div className="flex items-center gap-1.5">
                <input type="range" min={0} max={12} step={1}
                  value={s.borderWidth ?? 0}
                  onChange={e => onChange({ borderWidth: Number(e.target.value) })}
                  className="flex-1 accent-blue-500" />
                <span className="text-white/40 text-[10px] w-6 text-right">{s.borderWidth ?? 0}</span>
              </div>
            </div>
            <div>
              <label className={lbl}>Скругление</label>
              <div className="flex items-center gap-1.5">
                <input type="range" min={0} max={48} step={2}
                  value={s.borderRadius ?? 12}
                  onChange={e => onChange({ borderRadius: Number(e.target.value) })}
                  className="flex-1 accent-blue-500" />
                <span className="text-white/40 text-[10px] w-6 text-right">{s.borderRadius ?? 12}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className={lbl + " mb-0"}>Цвет рамки</label>
            <input type="color" value={s.borderColor || "#ffffff"}
              onChange={e => onChange({ borderColor: e.target.value })}
              className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 ml-auto" />
            <input value={s.borderColor || ""}
              onChange={e => onChange({ borderColor: e.target.value })}
              placeholder="#ffffff"
              className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
          </div>
          {/* Превью рамки */}
          {(s.borderWidth ?? 0) > 0 && (
            <div className="h-8 rounded-xl w-full"
              style={{
                border: `${s.borderWidth}px ${s.borderStyle ?? "solid"} ${s.borderColor ?? "#fff"}`,
                borderRadius: s.borderRadius ?? 12,
              }} />
          )}
        </div>
      </div>

      {/* ── Тень ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-purple-500/30 flex items-center justify-center">
            <Icon name="Layers" size={11} className="text-purple-400" />
          </div>
          <span className="text-xs font-bold text-white/70">Тень</span>
        </div>
        <div className="px-3 pb-3 space-y-2.5">
          {/* Пресеты */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SHADOWS.map(p => (
              <button key={p.label}
                onClick={() => onChange({ shadowX: p.x, shadowY: p.y, shadowBlur: p.blur, shadowColor: p.color })}
                className="px-2.5 py-1 rounded-lg text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 hover:text-white/80 transition">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([["shadowX","X"],["shadowY","Y"],["shadowBlur","Размытие"]] as const).map(([k, l]) => (
              <div key={k}>
                <label className={lbl}>{l}</label>
                <input type="number" step={1} value={(s as Record<string, number>)[k] ?? 0}
                  onChange={e => onChange({ [k]: Number(e.target.value) })}
                  className={numInp} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className={lbl + " mb-0"}>Цвет тени</label>
            <input type="color" value={s.shadowColor?.startsWith("#") ? s.shadowColor : "#000000"}
              onChange={e => onChange({ shadowColor: e.target.value })}
              className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 ml-auto" />
          </div>
        </div>
      </div>

      {/* ── Отступы ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/30 flex items-center justify-center">
            <Icon name="Frame" size={11} className="text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-white/70">Внутренние отступы</span>
        </div>
        <div className="px-3 pb-3">
          {/* Диаграмма отступов */}
          <div className="relative w-full aspect-square max-w-[160px] mx-auto mb-2">
            <div className="absolute inset-0 border border-white/10 rounded-xl flex items-center justify-center">
              <div className="w-1/2 h-1/2 border border-violet-500/30 rounded-lg bg-violet-500/10" />
            </div>
            {/* Top */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padTop ?? 8}
                onChange={e => onChange({ padTop: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
            {/* Bottom */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padBottom ?? 8}
                onChange={e => onChange({ padBottom: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
            {/* Left */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padLeft ?? 8}
                onChange={e => onChange({ padLeft: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
            {/* Right */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padRight ?? 8}
                onChange={e => onChange({ padRight: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
          </div>
          <button onClick={() => onChange({ padTop:8, padRight:12, padBottom:8, padLeft:12 })}
            className="w-full py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/60 border border-white/[0.07] hover:bg-white/[0.04] transition">
            Сбросить
          </button>
        </div>
      </div>

      {/* ── Прозрачность блока ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
            <Icon name="Eye" size={11} className="text-white/60" />
          </div>
          <span className="text-xs font-bold text-white/70">Прозрачность блока</span>
          <span className="ml-auto text-xs text-violet-300 font-bold">{s.opacity ?? 100}%</span>
        </div>
        <input type="range" min={10} max={100} step={5}
          value={s.opacity ?? 100}
          onChange={e => onChange({ opacity: Number(e.target.value) })}
          className="w-full accent-violet-500" />
        <div className="flex justify-between text-[9px] text-white/20 mt-1">
          <span>10%</span><span>Видимый</span><span>100%</span>
        </div>
      </div>

    </div>
  );
}

// ── Resize handles ─────────────────────────────────────────────────────────────
const HANDLES = ["n","ne","e","se","s","sw","w","nw"] as const;
type Handle = typeof HANDLES[number];
const HANDLE_CURSOR: Record<Handle, string> = {
  n:"ns-resize", ne:"nesw-resize", e:"ew-resize", se:"nwse-resize",
  s:"ns-resize", sw:"nesw-resize", w:"ew-resize", nw:"nwse-resize",
};
const HANDLE_POS: Record<Handle, string> = {
  n:  "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
  ne: "top-0 right-0 -translate-y-1/2 translate-x-1/2",
  e:  "top-1/2 right-0 -translate-y-1/2 translate-x-1/2",
  se: "bottom-0 right-0 translate-y-1/2 translate-x-1/2",
  s:  "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  sw: "bottom-0 left-0 translate-y-1/2 -translate-x-1/2",
  w:  "top-1/2 left-0 -translate-y-1/2 -translate-x-1/2",
  nw: "top-0 left-0 -translate-y-1/2 -translate-x-1/2",
};

// ── Block Editor (sidebar) ─────────────────────────────────────────────────────
function BlockEditor({
  block, onChange, onDelete, onDuplicate, onBringFront, onSendBack, token,
}: {
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
  token: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editorTab, setEditorTab] = useState<"content" | "style">("content");

  const inp = "w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none bg-white/[0.06] border border-white/[0.1]";
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 block";

  const st = block.style_ ?? {};
  const updateStyle = (patch: Partial<PageBlockStyle>) =>
    onChange({ ...block, style_: { ...st, ...patch } });

  const handlePhotos = async (files: FileList) => {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadBrandImage(token, f));
      if (block.type === "gallery") onChange({ ...block, photos: [...block.photos, ...urls] });
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-3">

      {/* ── Табы Содержимое / Стиль ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {(["content","style"] as const).map(t => (
          <button key={t} onClick={() => setEditorTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
              editorTab === t
                ? t === "style"
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow"
                  : "bg-white/[0.08] text-white"
                : "text-white/30 hover:text-white/60"
            }`}>
            <Icon name={t === "content" ? "AlignLeft" : "Palette"} size={11} />
            {t === "content" ? "Содержимое" : "Стиль"}
          </button>
        ))}
      </div>

      {editorTab === "content" && (<>
      {/* Position & size */}
      <div className="grid grid-cols-2 gap-1.5">
        {(["x","y","w","h"] as const).map(k => (
          <div key={k}>
            <label className={lbl}>{k === "x" ? "X" : k === "y" ? "Y" : k === "w" ? "Ширина" : "Высота"}</label>
            <input type="number" step={1}
              value={Math.round((block as Record<string,number>)[k] ?? 0)}
              onChange={e => onChange({ ...block, [k]: Number(e.target.value) })}
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
          </div>
        ))}
      </div>

      {/* Layer controls */}
      <div className="flex gap-1.5">
        <button onClick={onBringFront} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/40 hover:text-white/70 text-[10px] transition">
          <Icon name="BringToFront" size={11} /> Вперёд
        </button>
        <button onClick={onSendBack} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/40 hover:text-white/70 text-[10px] transition">
          <Icon name="SendToBack" size={11} /> Назад
        </button>
      </div>

      {/* Hidden toggle */}
      <div className="flex items-center justify-between py-1.5 px-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <label className={lbl + " mb-0"}>Скрыть блок</label>
        <button onClick={() => onChange({ ...block, hidden: !block.hidden })}
          className={`w-10 h-5 rounded-full transition-colors relative ${block.hidden ? "bg-white/10" : "bg-violet-600"}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${block.hidden ? "left-0.5" : "left-5"}`} />
        </button>
      </div>

      <div className="border-t border-white/[0.07]" />

      {/* Content-specific editors */}
      {block.type === "heading" && (<>
        <div><label className={lbl}>Текст</label>
          <input className={inp} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} /></div>
        <div><label className={lbl}>Размер</label>
          <div className="flex gap-1">
            {(["xl","lg","md"] as const).map(s => (
              <button key={s} onClick={() => onChange({ ...block, size: s })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${block.size===s?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                {s==="xl"?"XL":s==="lg"?"LG":"MD"}
              </button>
            ))}
          </div>
        </div>
        <div><label className={lbl}>Выравнивание</label>
          <div className="flex gap-1">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${block.align===a?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                <Icon name={a==="left"?"AlignLeft":a==="center"?"AlignCenter":"AlignRight"} size={12} />
              </button>
            ))}
          </div>
        </div>
      </>)}

      {block.type === "text" && (<>
        <div><label className={lbl}>Текст</label>
          <textarea className={`${inp} resize-none`} rows={5} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} /></div>
        <div><label className={lbl}>Выравнивание</label>
          <div className="flex gap-1">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${block.align===a?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                <Icon name={a==="left"?"AlignLeft":a==="center"?"AlignCenter":"AlignRight"} size={12} />
              </button>
            ))}
          </div>
        </div>
      </>)}

      {block.type === "gallery" && (<>
        <div><label className={lbl}>Колонок</label>
          <div className="flex gap-1">
            {([1,2,3,4] as const).map(c => (
              <button key={c} onClick={() => onChange({ ...block, cols: c })}
                className={`flex-1 h-9 rounded-lg text-sm font-bold transition ${block.cols===c?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div><label className={lbl}>Пропорции</label>
          <div className="flex gap-1">
            {(["square","4/3","16/9"] as const).map(r => (
              <button key={r} onClick={() => onChange({ ...block, ratio: r })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${block.ratio===r?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                {r==="square"?"1:1":r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl}>Фото ({block.photos.length})</label>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {block.photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                <img src={url} className="w-full h-full object-cover" />
                <button onClick={() => onChange({ ...block, photos: block.photos.filter((_,j)=>j!==i) })}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Icon name="Trash2" size={13} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => e.target.files && handlePhotos(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 text-white/30 hover:text-violet-400 text-xs transition">
            <Icon name={uploading?"Loader":"Upload"} size={12} className={uploading?"animate-spin":""} />
            {uploading?"Загрузка...":"Добавить фото"}
          </button>
        </div>
      </>)}

      {block.type === "buttons" && (<>
        <div><label className={lbl}>Выравнивание</label>
          <div className="flex gap-1">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${(block.align??"left")===a?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                <Icon name={a==="left"?"AlignLeft":a==="center"?"AlignCenter":"AlignRight"} size={12} />
              </button>
            ))}
          </div>
        </div>
        {block.items.map((btn, i) => (
          <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Кнопка {i+1}</span>
              <button onClick={() => onChange({ ...block, items: block.items.filter((_,j)=>j!==i) })} className="text-red-400/50 hover:text-red-400"><Icon name="X" size={12} /></button>
            </div>
            <input value={btn.label} onChange={e => onChange({ ...block, items: block.items.map((b,j)=>j===i?{...b,label:e.target.value}:b) })} className={inp} placeholder="Текст кнопки" />
            <div className="flex gap-1">
              {(["phone","whatsapp","telegram","url"] as const).map(a => (
                <button key={a} onClick={() => onChange({ ...block, items: block.items.map((b,j)=>j===i?{...b,action:a}:b) })}
                  className={`flex-1 py-1 rounded-lg text-[10px] transition ${btn.action===a?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/30 border border-white/10"}`}>
                  {a==="phone"?"📞":a==="whatsapp"?"💬":a==="telegram"?"✈️":"🔗"}
                </button>
              ))}
            </div>
            <input value={btn.value} onChange={e => onChange({ ...block, items: block.items.map((b,j)=>j===i?{...b,value:e.target.value}:b) })} className={inp} placeholder={btn.action==="phone"?"+7...":btn.action==="telegram"?"@username":"https://..."} />
            <div className="flex gap-1">
              {(["primary","outline"] as const).map(s => (
                <button key={s} onClick={() => onChange({ ...block, items: block.items.map((b,j)=>j===i?{...b,style:s}:b) })}
                  className={`flex-1 py-1 rounded-lg text-xs transition ${btn.style===s?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/30 border border-white/10"}`}>
                  {s==="primary"?"Заполненная":"Контурная"}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => onChange({ ...block, items: [...block.items,{label:"Кнопка",action:"url",value:"",style:"primary"}] })}
          className="w-full py-2 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 text-white/30 hover:text-violet-400 text-xs transition">
          + Добавить кнопку
        </button>
      </>)}

      {block.type === "video" && (
        <div><label className={lbl}>Ссылка YouTube / Vimeo</label>
          <input className={inp} value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
        </div>
      )}

      {block.type === "spacer" && (
        <div><label className={lbl}>Высота (px)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={8} max={200} step={4} value={block.height} onChange={e => onChange({ ...block, height: Number(e.target.value) })} className="flex-1" />
            <span className="text-white/50 text-xs w-10 text-right">{block.height}px</span>
          </div>
        </div>
      )}

      {block.type === "card" && (<>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>Иконка</label>
            <input className={inp} value={block.icon} onChange={e => onChange({ ...block, icon: e.target.value })} /></div>
          <div><label className={lbl}>Выравнивание</label>
            <div className="flex gap-1">
              {(["left","center","right"] as const).map(a => (
                <button key={a} onClick={() => onChange({ ...block, align: a })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition ${block.align===a?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/30 border border-white/10"}`}>
                  <Icon name={a==="left"?"AlignLeft":a==="center"?"AlignCenter":"AlignRight"} size={11} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div><label className={lbl}>Заголовок</label>
          <input className={inp} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} /></div>
        <div><label className={lbl}>Текст</label>
          <textarea className={`${inp} resize-none`} rows={3} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} /></div>
      </>)}

      {block.type === "divider" && (
        <div><label className={lbl}>Стиль</label>
          <div className="flex gap-1">
            {(["line","dots","space"] as const).map(s => (
              <button key={s} onClick={() => onChange({ ...block, style: s })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${(block.style??"line")===s?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                {s==="line"?"Линия":s==="dots"?"Точки":"Пробел"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-white/[0.07]">
        <button onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 hover:text-white/80 text-xs transition">
          <Icon name="Copy" size={12} /> Дублировать
        </button>
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-500/[0.06] hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-400/60 hover:text-red-400 text-xs transition">
          <Icon name="Trash2" size={12} /> Удалить
        </button>
      </div>
      </>)}

      {/* ── Вкладка Стиль ── */}
      {editorTab === "style" && (
        <>
          <StylePanel s={st} onChange={updateStyle} />
          <div className="flex gap-2 pt-2 border-t border-white/[0.07]">
            <button onClick={onDuplicate}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 hover:text-white/80 text-xs transition">
              <Icon name="Copy" size={12} /> Дублировать
            </button>
            <button onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-500/[0.06] hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-400/60 hover:text-red-400 text-xs transition">
              <Icon name="Trash2" size={12} /> Удалить
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Canvas Settings Panel ──────────────────────────────────────────────────────
function CanvasSettingsPanel({ settings, onChange }: { settings: PageSettings; onChange: (s: PageSettings) => void }) {
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block";
  return (
    <div className="p-4 space-y-4">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Настройки холста</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Ширина (px)</label>
          <input type="number" step={10} value={settings.canvasWidth ?? 390}
            onChange={e => onChange({ ...settings, canvasWidth: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
        </div>
        <div>
          <label className={lbl}>Высота (px)</label>
          <input type="number" step={50} value={settings.canvasHeight ?? 1200}
            onChange={e => onChange({ ...settings, canvasHeight: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
        </div>
      </div>

      <div>
        <label className={lbl}>Сетка (px)</label>
        <div className="flex gap-1.5">
          {[4,8,16,32].map(g => (
            <button key={g} onClick={() => onChange({ ...settings, gridSize: g })}
              className={`flex-1 py-1.5 rounded-lg text-xs transition ${(settings.gridSize??8)===g?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/[0.03] text-white/40 border border-white/[0.07] hover:bg-white/[0.06]"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
        <div>
          <p className="text-xs text-white/60 font-medium">Примагничивание</p>
          <p className="text-[10px] text-white/25">К сетке и к краям блоков</p>
        </div>
        <button onClick={() => onChange({ ...settings, snap: !settings.snap })}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.snap?"bg-violet-600":"bg-white/10"}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.snap?"left-6":"left-1"}`} />
        </button>
      </div>

      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
        <div>
          <p className="text-xs text-white/60 font-medium">Показать сетку</p>
          <p className="text-[10px] text-white/25">Направляющие на холсте</p>
        </div>
        <button onClick={() => onChange({ ...settings, snap: settings.snap })}
          className="text-[10px] text-white/30 hover:text-white/60 transition">визуально</button>
      </div>
    </div>
  );
}

// ── Main PageEditor ────────────────────────────────────────────────────────────
interface Props { panelId: string; onBack: () => void; }

export default function PageEditor({ panelId, onBack }: Props) {
  const { token } = useAuth();
  const { brand } = useBrand();

  const navBtn = brand.nav_config?.find(b => b.id === panelId) as NavButton | undefined;
  const initialBlocks: PageBlock[] = navBtn?.content?.blocks ?? [];
  const initialTitle = navBtn?.content?.title ?? navBtn?.label ?? "";
  const initialSettings: PageSettings = {
    freeCanvas: true, snap: true, gridSize: 8,
    canvasWidth: 390, canvasHeight: 1200,
    ...navBtn?.content?.pageSettings,
  };

  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [title, setTitle] = useState(initialTitle);
  const [settings, setSettings] = useState<PageSettings>(initialSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"blocks" | "settings">("blocks");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Canvas zoom/pan
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const dragState = useRef<{
    type: "move" | "resize";
    id: string;
    handle?: Handle;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null>(null);

  // Palette drag
  const paletteType = useRef<PageBlock["type"] | null>(null);
  const [isDroppingFromPalette, setIsDroppingFromPalette] = useState(false);

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const GRID = settings.gridSize ?? 8;
  const SNAP = settings.snap ?? true;
  const CW = settings.canvasWidth ?? 390;
  const CH = settings.canvasHeight ?? 1200;

  const updateBlock = useCallback((id: string, updated: PageBlock) => {
    setBlocks(bs => bs.map(b => b.id === id ? updated : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(bs => {
      const b = bs.find(x => x.id === id);
      if (!b) return bs;
      const copy = { ...b, id: genId(), x: (b.x ?? 0) + 16, y: (b.y ?? 0) + 16, zIndex: Math.max(...bs.map(x => x.zIndex ?? 1)) + 1 };
      return [...bs, copy];
    });
  }, []);

  const bringToFront = useCallback((id: string) => {
    setBlocks(bs => {
      const maxZ = Math.max(...bs.map(b => b.zIndex ?? 1));
      return bs.map(b => b.id === id ? { ...b, zIndex: maxZ + 1 } : b);
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setBlocks(bs => {
      const minZ = Math.min(...bs.map(b => b.zIndex ?? 1));
      return bs.map(b => b.id === id ? { ...b, zIndex: Math.max(0, minZ - 1) } : b);
    });
  }, []);

  const addBlock = (type: PageBlock["type"], cx?: number, cy?: number) => {
    const x = snap(cx ?? 40, GRID, SNAP);
    const y = snap(cy ?? 40, GRID, SNAP);
    const maxZ = blocks.length ? Math.max(...blocks.map(b => b.zIndex ?? 1)) + 1 : 1;
    const nb = { ...defaultBlock(type, x, y), zIndex: maxZ };
    setBlocks(bs => [...bs, nb]);
    setSelectedId(nb.id);
    setSidebarTab("blocks");
  };

  // ── Snap helpers ──────────────────────────────────────────────────────────
  function snapToEdges(id: string, nx: number, ny: number, nw: number, nh: number) {
    if (!SNAP) return { nx, ny };
    let rx = nx, ry = ny;
    for (const b of blocks) {
      if (b.id === id) continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.w ?? 100, bh = b.h ?? 60;
      // snap left to right edge
      if (Math.abs(nx - (bx + bw)) < SNAP_EDGE) rx = bx + bw;
      // snap right to left edge
      if (Math.abs((nx + nw) - bx) < SNAP_EDGE) rx = bx - nw;
      // snap top to bottom edge
      if (Math.abs(ny - (by + bh)) < SNAP_EDGE) ry = by + bh;
      // snap bottom to top edge
      if (Math.abs((ny + nh) - by) < SNAP_EDGE) ry = by - nh;
      // snap left to left
      if (Math.abs(nx - bx) < SNAP_EDGE) rx = bx;
      // snap top to top
      if (Math.abs(ny - by) < SNAP_EDGE) ry = by;
    }
    return { nx: rx, ny: ry };
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  const onBlockMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setSidebarTab("blocks");
    const b = blocks.find(x => x.id === id)!;
    dragState.current = {
      type: "move", id,
      startX: e.clientX, startY: e.clientY,
      origX: b.x ?? 0, origY: b.y ?? 0,
      origW: b.w ?? 100, origH: b.h ?? 60,
    };
  };

  const onHandleMouseDown = (e: React.MouseEvent, id: string, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    const b = blocks.find(x => x.id === id)!;
    dragState.current = {
      type: "resize", id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: b.x ?? 0, origY: b.y ?? 0,
      origW: b.w ?? 100, origH: b.h ?? 60,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const dx = (e.clientX - ds.startX) / zoom;
      const dy = (e.clientY - ds.startY) / zoom;

      setBlocks(bs => bs.map(b => {
        if (b.id !== ds.id) return b;
        if (ds.type === "move") {
          let nx = snap(ds.origX + dx, GRID, SNAP);
          let ny = snap(ds.origY + dy, GRID, SNAP);
          const ed = snapToEdges(ds.id, nx, ny, b.w ?? 100, b.h ?? 60);
          nx = Math.max(0, Math.min(CW - (b.w ?? 100), ed.nx));
          ny = Math.max(0, ed.ny);
          return { ...b, x: nx, y: ny };
        }
        // resize
        const handle = ds.handle!;
        let nx = ds.origX, ny = ds.origY;
        let nw = ds.origW, nh = ds.origH;
        if (handle.includes("e")) nw = Math.max(60, snap(ds.origW + dx, GRID, SNAP));
        if (handle.includes("w")) { nw = Math.max(60, snap(ds.origW - dx, GRID, SNAP)); nx = ds.origX + ds.origW - nw; }
        if (handle.includes("s")) nh = Math.max(30, snap(ds.origH + dy, GRID, SNAP));
        if (handle.includes("n")) { nh = Math.max(30, snap(ds.origH - dy, GRID, SNAP)); ny = ds.origY + ds.origH - nh; }
        return { ...b, x: Math.max(0, nx), y: Math.max(0, ny), w: nw, h: nh };
      }));
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [zoom, GRID, SNAP, CW, blocks]);

  // ── Canvas click (deselect) ───────────────────────────────────────────────
  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as Element).classList.contains("canvas-bg")) {
      setSelectedId(null);
    }
  };

  // ── Palette drop onto canvas ──────────────────────────────────────────────
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!paletteType.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / zoom;
    const cy = (e.clientY - rect.top) / zoom;
    addBlock(paletteType.current, cx, cy);
    paletteType.current = null;
    setIsDroppingFromPalette(false);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!brand.nav_config) return;
    setSaving(true);
    try {
      const newNav = brand.nav_config.map(b =>
        b.id === panelId
          ? { ...b, content: { ...(b.content || {}), title, blocks, pageSettings: settings } }
          : b
      );
      await updateBrand(token, { ...brand, nav_config: newNav } as Parameters<typeof updateBrand>[1]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const cid = new URLSearchParams(window.location.search).get("c");
      if (cid) localStorage.removeItem(`mp_brand_${cid}`);
    } finally { setSaving(false); }
  };

  const handleAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true); setAiError("");
    try {
      const res = await fetch(PAGE_AI_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, prompt: aiPrompt }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setAiError(d.error || "Ошибка AI"); return; }
      setBlocks(d.blocks as PageBlock[]);
      setAiPrompt(""); setSelectedId(null);
    } catch { setAiError("Не удалось подключиться к AI"); }
    finally { setAiLoading(false); }
  };

  // Grid dots bg
  const gridBg = SNAP
    ? `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`
    : undefined;

  return (
    <div className="fixed inset-0 z-[200] bg-[#07070f] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.08] bg-[#0e0e1a]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white/80 transition">
              <Icon name="ArrowLeft" size={17} />
            </button>
            <div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="bg-transparent text-white font-bold text-sm focus:outline-none border-b border-transparent focus:border-white/20 transition min-w-[140px]"
                placeholder="Название страницы" />
              <p className="text-white/20 text-[10px]">{navBtn?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="text-white/40 hover:text-white/70 transition w-5 text-center">−</button>
              <span className="text-xs text-white/40 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="text-white/40 hover:text-white/70 transition w-5 text-center">+</button>
              <button onClick={() => setZoom(1)} className="text-white/20 hover:text-white/50 text-[9px] ml-1 transition">1:1</button>
            </div>
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50 ${
                saved ? "bg-emerald-500/80" : "bg-gradient-to-r from-orange-500 to-rose-500"
              }`}>
              <Icon name={saved ? "CheckCircle2" : saving ? "Loader" : "Save"} size={14} className={saving ? "animate-spin" : ""} />
              {saved ? "Сохранено!" : saving ? "..." : "Сохранить"}
            </button>
          </div>
        </div>
        {/* AI */}
        <div className="px-4 pb-2.5 flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/[0.07] border border-violet-500/20 focus-within:border-violet-500/40 transition">
            <Icon name="Sparkles" size={13} className="text-violet-400 shrink-0" />
            <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAi()}
              placeholder="Попросите AI изменить страницу..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none" />
          </div>
          <button onClick={handleAi} disabled={aiLoading || !aiPrompt.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition shrink-0">
            <Icon name={aiLoading ? "Loader" : "Wand2"} size={13} className={aiLoading ? "animate-spin" : ""} />
            {aiLoading ? "..." : "Применить"}
          </button>
        </div>
        {aiError && <p className="px-4 pb-2 text-xs text-red-400">{aiError}</p>}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-[#07070f] flex items-start justify-center p-8"
          onDrop={onCanvasDrop} onDragOver={e => e.preventDefault()}>
          {/* Canvas frame */}
          <div
            style={{
              width: CW * zoom,
              height: CH * zoom,
              position: "relative",
              flexShrink: 0,
            }}
            className={`rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden transition-shadow ${isDroppingFromPalette ? "ring-2 ring-violet-500/50" : ""}`}
          >
            {/* Scrollable canvas inner (zoom) */}
            <div
              ref={canvasRef}
              style={{
                width: CW,
                height: CH,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                position: "relative",
                background: "#0a0a14",
                backgroundImage: gridBg,
                backgroundSize: `${GRID * (SNAP ? 1 : 1)}px ${GRID}px`,
              }}
              className="canvas-bg"
              onClick={onCanvasClick}
            >
              {/* Empty state */}
              {blocks.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                    <Icon name="MousePointerClick" size={24} className="text-white/15" />
                  </div>
                  <p className="text-white/20 text-sm">Перетащите блок из панели</p>
                  <p className="text-white/10 text-xs mt-1">или нажмите на тип блока</p>
                </div>
              )}

              {/* Blocks */}
              {[...blocks].sort((a,b) => (a.zIndex??1)-(b.zIndex??1)).map(block => {
                const bx = block.x ?? 0;
                const by = block.y ?? 0;
                const bw = block.w ?? DEFAULT_SIZES[block.type]?.w ?? 240;
                const bh = block.h ?? DEFAULT_SIZES[block.type]?.h ?? 80;
                const isSelected = selectedId === block.id;

                const extraStyle = blockStyleToCss(block.style_);
                const padStyle = block.style_
                  ? { padding: extraStyle.padding }
                  : { padding: "8px" };

                return (
                  <div
                    key={block.id}
                    style={{
                      position: "absolute",
                      left: bx, top: by,
                      width: bw, height: bh,
                      zIndex: block.zIndex ?? 1,
                      opacity: block.hidden ? 0.25 : (extraStyle.opacity ?? 1),
                      background: extraStyle.background ?? (block.bg || "transparent"),
                      backgroundColor: extraStyle.background ? undefined : (extraStyle.backgroundColor ?? (block.bg || undefined)),
                      border: extraStyle.border,
                      borderRadius: extraStyle.borderRadius ?? 12,
                      boxShadow: extraStyle.boxShadow,
                    }}
                    className={`group overflow-hidden transition-shadow ${
                      isSelected
                        ? "ring-2 ring-violet-500 shadow-lg shadow-violet-500/20"
                        : "ring-1 ring-white/[0.04] hover:ring-white/[0.12]"
                    }`}
                    onMouseDown={e => onBlockMouseDown(e, block.id)}
                  >
                    {/* Content */}
                    <div className="w-full h-full overflow-hidden" style={{ cursor: "move", ...padStyle }}>
                      <BlockContent block={block} />
                    </div>

                    {/* Block label (hover) */}
                    {!isSelected && (
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                        <span className="text-[8px] text-white/30 bg-black/60 px-1.5 py-0.5 rounded-full">
                          {BLOCK_LABELS[block.type]}
                        </span>
                      </div>
                    )}

                    {/* Resize handles (only when selected) */}
                    {isSelected && HANDLES.map(handle => (
                      <div
                        key={handle}
                        className={`absolute w-3 h-3 rounded-sm bg-violet-500 border-2 border-white shadow-sm z-10 ${HANDLE_POS[handle]}`}
                        style={{ cursor: HANDLE_CURSOR[handle] }}
                        onMouseDown={e => onHandleMouseDown(e, block.id, handle)}
                      />
                    ))}

                    {/* Top toolbar when selected */}
                    {isSelected && (
                      <div className="absolute -top-8 left-0 flex items-center gap-1 z-20 pointer-events-none">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a1a2e] border border-violet-500/30 shadow-lg pointer-events-auto">
                          <span className="text-[9px] text-violet-400 font-bold mr-1">{BLOCK_LABELS[block.type]}</span>
                          <button onClick={e => { e.stopPropagation(); bringToFront(block.id); }}
                            className="text-white/40 hover:text-white/80 transition p-0.5" title="На передний план">
                            <Icon name="BringToFront" size={10} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); sendToBack(block.id); }}
                            className="text-white/40 hover:text-white/80 transition p-0.5" title="На задний план">
                            <Icon name="SendToBack" size={10} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }}
                            className="text-white/40 hover:text-white/80 transition p-0.5" title="Дублировать">
                            <Icon name="Copy" size={10} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteBlock(block.id); }}
                            className="text-red-400/60 hover:text-red-400 transition p-0.5" title="Удалить">
                            <Icon name="Trash2" size={10} />
                          </button>
                        </div>
                        <span className="text-[8px] text-white/20 ml-1">{Math.round(bx)},{Math.round(by)} · {Math.round(bw)}×{Math.round(bh)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-l border-white/[0.07] bg-[#0c0c18] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="shrink-0 flex border-b border-white/[0.07]">
            {(["blocks","settings"] as const).map(tab => (
              <button key={tab} onClick={() => { setSidebarTab(tab); if (tab==="settings") setSelectedId(null); }}
                className={`flex-1 py-2.5 text-xs font-bold transition ${
                  (sidebarTab === tab && !selectedId) || (sidebarTab === tab && tab === "settings")
                    ? "text-violet-300 border-b-2 border-violet-500"
                    : "text-white/25 hover:text-white/50"
                }`}>
                {tab === "blocks" ? "Элементы" : "Холст"}
              </button>
            ))}
          </div>

          {selectedBlock ? (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">{BLOCK_LABELS[selectedBlock.type]}</span>
                <button onClick={() => setSelectedId(null)} className="text-white/20 hover:text-white/50 transition"><Icon name="X" size={13} /></button>
              </div>
              <BlockEditor
                block={selectedBlock}
                onChange={updated => updateBlock(selectedBlock.id, updated)}
                onDelete={() => deleteBlock(selectedBlock.id)}
                onDuplicate={() => duplicateBlock(selectedBlock.id)}
                onBringFront={() => bringToFront(selectedBlock.id)}
                onSendBack={() => sendToBack(selectedBlock.id)}
                token={token}
              />
            </div>

          ) : sidebarTab === "settings" ? (
            <div className="flex-1 overflow-y-auto">
              <CanvasSettingsPanel settings={settings} onChange={setSettings} />
            </div>

          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2.5">Перетащить или нажать</p>
              <div className="grid grid-cols-2 gap-2">
                {ADD_BLOCKS.map(({ type, icon, label, color, bg }) => (
                  <div key={type}
                    draggable
                    onDragStart={() => { paletteType.current = type; setIsDroppingFromPalette(true); }}
                    onDragEnd={() => { paletteType.current = null; setIsDroppingFromPalette(false); }}
                    onClick={() => addBlock(type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/[0.07] hover:border-white/20 transition-all group cursor-grab active:cursor-grabbing select-none hover:scale-[1.03] active:scale-95"
                    style={{ background: "rgba(255,255,255,0.025)" }}>
                    {/* Иконка с цветным фоном */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: bg }}>
                      <Icon name={icon} size={17} style={{ color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-white/50 group-hover:text-white/80 transition text-center leading-tight">{label}</span>
                    {/* Полоска-цвет снизу */}
                    <div className="w-6 h-0.5 rounded-full opacity-50 group-hover:opacity-100 transition" style={{ background: color }} />
                  </div>
                ))}
              </div>

              {blocks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Слои ({blocks.length})</p>
                  <div className="space-y-0.5">
                    {[...blocks].sort((a,b)=>(b.zIndex??1)-(a.zIndex??1)).map(block => {
                      const pal = ADD_BLOCKS.find(b => b.type === block.type);
                      return (
                        <button key={block.id} onClick={() => { setSelectedId(block.id); setSidebarTab("blocks"); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition group ${selectedId===block.id?"bg-violet-500/10 border border-violet-500/20":"hover:bg-white/[0.04] border border-transparent"}`}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: pal?.bg ?? "rgba(255,255,255,0.05)" }}>
                            <Icon name={pal?.icon ?? "Box"} size={10} style={{ color: pal?.color ?? "#ffffff60" }} />
                          </div>
                          <span className="text-[11px] text-white/40 group-hover:text-white/70 truncate flex-1">
                            {block.type==="heading"?block.text:block.type==="text"?block.text.slice(0,24)+(block.text.length>24?"…":""):block.type==="card"?block.title:BLOCK_LABELS[block.type]}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {block.hidden && <Icon name="EyeOff" size={8} className="text-orange-400/60" />}
                            {block.style_?.bgType && block.style_.bgType !== "none" && (
                              <div className="w-2 h-2 rounded-full" style={{
                                background: block.style_.bgType === "gradient"
                                  ? `linear-gradient(135deg,${block.style_.bgGradFrom},${block.style_.bgGradTo})`
                                  : block.style_.bgColor
                              }} />
                            )}
                            <span className="text-[8px] text-white/15">{block.zIndex??1}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
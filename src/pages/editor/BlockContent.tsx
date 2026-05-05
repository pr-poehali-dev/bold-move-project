import React from "react";
import type { PageBlock, PageBlockStyle } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { getYouTubeEmbed } from "./editorTypes";

export function BlockContent({ block, blockW, blockH }: { block: PageBlock; blockW?: number; blockH?: number }) {
  const ac = (a: string) => a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
  const bh = blockH ?? (block.h ?? 48);
  const bw = blockW ?? (block.w ?? 200);

  if (block.type === "heading") {
    // Размер шрифта от ширины блока — текст всегда видим, не обрезается
    // xl ≈ 6% ширины, lg ≈ 5%, md ≈ 4% — но не меньше 11px и не больше bh
    const pct = block.size === "xl" ? 0.07 : block.size === "lg" ? 0.055 : 0.042;
    const fw  = block.size === "xl" ? 900 : 700;
    const fs  = Math.max(11, Math.min(Math.round(bw * pct), bh - 4));
    return (
      <div className={`w-full ${ac(block.align)}`} style={{ overflowWrap: "break-word" }}>
        <p
          className="text-white leading-tight w-full"
          style={{ fontSize: fs, fontWeight: fw, lineHeight: 1.2, wordBreak: "break-word" }}
        >
          {block.text || "Заголовок"}
        </p>
      </div>
    );
  }

  if (block.type === "text") {
    // Размер шрифта от ширины: ≈4% ширины, минимум 9px
    const fs = Math.max(9, Math.min(Math.round(bw * 0.04), 18));
    return (
      <div className={`w-full ${ac(block.align)}`}>
        <p
          className="text-white/80 whitespace-pre-wrap leading-relaxed w-full"
          style={{ fontSize: fs }}
        >
          {block.text || "Текст"}
        </p>
      </div>
    );
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
    // Кнопки масштабируются от высоты блока
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

  if (block.type === "video") {
    const embed = getYouTubeEmbed(block.url);
    if (!embed) return <div className="w-full h-full rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center gap-2 text-white/20 text-xs"><Icon name="Play" size={14} />YouTube / Vimeo</div>;
    return <div className="w-full h-full rounded-xl overflow-hidden bg-black/40"><iframe src={embed} className="w-full h-full" allowFullScreen /></div>;
  }

  if (block.type === "spacer") {
    return <div className="w-full h-full flex items-center justify-center text-white/15 text-[10px] border border-dashed border-white/10 rounded-lg">↕ {block.height}px</div>;
  }

  if (block.type === "card") {
    const iconSz = Math.max(16, Math.round(bh * 0.2));
    const titleFs = Math.max(10, Math.round(bh * 0.12));
    const descFs  = Math.max(9,  Math.round(bh * 0.09));
    return (
      <div className={`flex flex-col gap-1 w-full h-full justify-center overflow-hidden ${ac(block.align)}`}>
        <span style={{ fontSize: iconSz }}>{block.icon}</span>
        <p className="text-white font-bold leading-tight" style={{ fontSize: titleFs }}>{block.title}</p>
        <p className="text-white/50 leading-relaxed" style={{ fontSize: descFs }}>{block.text}</p>
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

export function StylePanel({ s, onChange }: { s: PageBlockStyle; onChange: (p: Partial<PageBlockStyle>) => void }) {
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
          {/* Цвет рамки */}
          <div className="flex items-center gap-2">
            <label className={lbl + " mb-0"}>Цвет</label>
            <input type="color" value={s.borderColor?.startsWith("#") ? s.borderColor : "#ffffff"}
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
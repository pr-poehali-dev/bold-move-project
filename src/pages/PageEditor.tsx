import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBrand } from "@/context/BrandContext";
import type {
  NavButton, PageBlock, PageBlockHeading, PageBlockText,
  PageBlockGallery, PageBlockButtons, PageBlockDivider,
  PageBlockVideo, PageBlockSpacer, PageBlockCard,
  PageSettings,
} from "@/context/AuthContext";
import { updateBrand } from "./admin/own-agent/brandApi";
import { uploadBrandImage } from "./admin/own-agent/brandApi";
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

function defaultBlock(type: PageBlock["type"]): PageBlock {
  if (type === "heading")  return { type, id: genId(), text: "Заголовок", size: "lg", align: "left", width: 100 };
  if (type === "text")     return { type, id: genId(), text: "Введите текст...", align: "left", width: 100 };
  if (type === "gallery")  return { type, id: genId(), photos: [], cols: 2, ratio: "4/3", width: 100 };
  if (type === "buttons")  return { type, id: genId(), items: [{ label: "Позвонить", action: "phone", value: "", style: "primary" }], width: 100 };
  if (type === "video")    return { type, id: genId(), url: "", width: 100 };
  if (type === "spacer")   return { type, id: genId(), height: 32, width: 100 };
  if (type === "card")     return { type, id: genId(), icon: "⭐", title: "Заголовок", text: "Описание карточки", align: "center", width: 50 };
  return { type: "divider", id: genId(), style: "line", width: 100 };
}

// ── Block types palette ────────────────────────────────────────────────────────
const ADD_BLOCKS: { type: PageBlock["type"]; icon: string; label: string }[] = [
  { type: "heading",  icon: "Heading",       label: "Заголовок" },
  { type: "text",     icon: "AlignLeft",     label: "Текст" },
  { type: "gallery",  icon: "Image",         label: "Галерея" },
  { type: "buttons",  icon: "MousePointer",  label: "Кнопки" },
  { type: "card",     icon: "LayoutList",    label: "Карточка" },
  { type: "video",    icon: "Play",          label: "Видео" },
  { type: "divider",  icon: "Minus",         label: "Разделитель" },
  { type: "spacer",   icon: "ArrowUpDown",   label: "Отступ" },
];

const BLOCK_LABELS: Record<string, string> = {
  heading: "Заголовок", text: "Текст", gallery: "Галерея",
  buttons: "Кнопки", divider: "Разделитель", video: "Видео",
  spacer: "Отступ", card: "Карточка",
};

// ── Max-width classes ──────────────────────────────────────────────────────────
const MAX_WIDTH_CLASSES: Record<string, string> = {
  sm:   "max-w-sm",
  md:   "max-w-md",
  lg:   "max-w-lg",
  xl:   "max-w-2xl",
  full: "max-w-full",
};
const MAX_WIDTH_LABELS: Record<string, string> = {
  sm: "Узко", md: "Нормально", lg: "Шире", xl: "Широко", full: "На всю"
};

// Block width → Tailwind
function blockWidthClass(w?: number): string {
  switch (w) {
    case 25:  return "w-1/4";
    case 33:  return "w-1/3";
    case 50:  return "w-1/2";
    case 67:  return "w-2/3";
    case 75:  return "w-3/4";
    default:  return "w-full";
  }
}

// ── Block Preview (editor canvas) ─────────────────────────────────────────────
function BlockPreview({ block }: { block: PageBlock }) {
  const alignCls = (a: string) => a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

  if (block.type === "heading") {
    const size = block.size === "xl" ? "text-2xl font-black" : block.size === "lg" ? "text-xl font-bold" : "text-base font-bold";
    return <p className={`${size} text-white ${alignCls(block.align)} break-words`}>{block.text || "Заголовок"}</p>;
  }
  if (block.type === "text") {
    return <p className={`text-white/70 text-sm leading-relaxed whitespace-pre-wrap ${alignCls(block.align)}`}>{block.text || "Текст"}</p>;
  }
  if (block.type === "gallery") {
    const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[block.cols];
    const ratio = block.ratio === "square" ? "aspect-square" : block.ratio === "16/9" ? "aspect-video" : "aspect-[4/3]";
    if (block.photos.length === 0) return (
      <div className="w-full h-16 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs">Нет фото</div>
    );
    return (
      <div className={`grid ${cols} gap-1`}>
        {block.photos.slice(0, 6).map((url, i) => (
          <div key={i} className={`${ratio} rounded-lg overflow-hidden`}>
            <img src={url} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "buttons") {
    const alignCls2 = block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : "justify-start";
    return (
      <div className={`flex flex-wrap gap-1.5 ${alignCls2}`}>
        {block.items.map((btn, i) => (
          <div key={i} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
            btn.style === "primary"
              ? "text-white bg-gradient-to-r from-orange-500 to-rose-500"
              : "text-orange-400 border border-orange-500/40 bg-orange-500/10"
          }`}>{btn.label}</div>
        ))}
      </div>
    );
  }
  if (block.type === "video") {
    const embed = getYouTubeEmbed(block.url);
    if (!embed) return (
      <div className="w-full h-16 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center gap-2 text-white/20 text-xs">
        <Icon name="Play" size={14} />Вставьте ссылку на YouTube / Vimeo
      </div>
    );
    return (
      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black/40">
        <iframe src={embed} className="w-full h-full" allowFullScreen />
      </div>
    );
  }
  if (block.type === "spacer") {
    return (
      <div className="w-full flex items-center justify-center text-white/15 text-[10px] border border-dashed border-white/10 rounded-lg"
        style={{ height: Math.max(16, block.height) }}>
        ↕ {block.height}px
      </div>
    );
  }
  if (block.type === "card") {
    return (
      <div className={`flex flex-col gap-1 ${alignCls(block.align)}`}>
        <span className="text-2xl">{block.icon}</span>
        <p className="text-white font-bold text-sm">{block.title}</p>
        <p className="text-white/50 text-xs leading-relaxed">{block.text}</p>
      </div>
    );
  }
  if (block.type === "divider") {
    if (block.style === "dots") return <div className="flex justify-center gap-1.5"><span className="w-1 h-1 rounded-full bg-white/20" /><span className="w-1 h-1 rounded-full bg-white/20" /><span className="w-1 h-1 rounded-full bg-white/20" /></div>;
    if (block.style === "space") return <div className="h-4" />;
    return <div className="w-full h-px bg-white/10" />;
  }
  return null;
}

// ── Shared style controls (width, padding, bg, hidden) ─────────────────────────
function BlockStyleControls({ block, onChange }: { block: PageBlock; onChange: (b: PageBlock) => void }) {
  const label = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 block";
  const widths: { v: PageBlock["width"]; l: string }[] = [
    { v: 25, l: "¼" }, { v: 33, l: "⅓" }, { v: 50, l: "½" },
    { v: 67, l: "⅔" }, { v: 75, l: "¾" }, { v: 100, l: "Полный" },
  ];

  return (
    <div className="space-y-3 pt-3 border-t border-white/[0.07]">
      {/* Width */}
      <div>
        <label className={label}>Ширина блока</label>
        <div className="flex flex-wrap gap-1">
          {widths.map(({ v, l }) => (
            <button key={v} onClick={() => onChange({ ...block, width: v })}
              className={`px-2 py-1 rounded-lg text-xs transition ${(block.width ?? 100) === v ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {/* Padding */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Отступ сверху</label>
          <input type="number" min={0} max={120} step={4}
            value={block.paddingTop ?? 0}
            onChange={e => onChange({ ...block, paddingTop: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
        </div>
        <div>
          <label className={label}>Отступ снизу</label>
          <input type="number" min={0} max={120} step={4}
            value={block.paddingBottom ?? 0}
            onChange={e => onChange({ ...block, paddingBottom: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
        </div>
      </div>
      {/* Background */}
      <div>
        <label className={label}>Фон блока</label>
        <div className="flex items-center gap-2">
          <input type="color" value={block.bg || "#ffffff"}
            onChange={e => onChange({ ...block, bg: e.target.value })}
            className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
          <input value={block.bg || ""}
            onChange={e => onChange({ ...block, bg: e.target.value })}
            placeholder="прозрачный"
            className="flex-1 px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
          {block.bg && (
            <button onClick={() => onChange({ ...block, bg: "" })}
              className="text-white/30 hover:text-white/60 transition">
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
      </div>
      {/* Hidden toggle */}
      <div className="flex items-center justify-between">
        <label className={label + " mb-0"}>Скрыть блок</label>
        <button onClick={() => onChange({ ...block, hidden: !block.hidden })}
          className={`w-10 h-5 rounded-full transition-colors relative ${block.hidden ? "bg-white/10" : "bg-violet-600"}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${block.hidden ? "left-0.5" : "left-5"}`} />
        </button>
      </div>
    </div>
  );
}

// ── Block Editor Panel ────────────────────────────────────────────────────────
function BlockEditor({
  block, onChange, onDelete, onDuplicate, token,
}: {
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  token: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const inp = "w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none bg-white/[0.06] border border-white/[0.1]";
  const label = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 block";

  const handlePhotos = async (files: FileList) => {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const url = await uploadBrandImage(token, f);
        urls.push(url);
      }
      if (block.type === "gallery") onChange({ ...block, photos: [...block.photos, ...urls] });
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-3">

      {/* Heading editor */}
      {block.type === "heading" && (<>
        <div><label className={label}>Текст заголовка</label>
          <input className={inp} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} /></div>
        <div><label className={label}>Размер</label>
          <div className="flex gap-1.5">
            {(["xl","lg","md"] as const).map(s => (
              <button key={s} onClick={() => onChange({ ...block, size: s })}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${block.size === s ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                {s === "xl" ? "Большой" : s === "lg" ? "Средний" : "Малый"}
              </button>
            ))}
          </div>
        </div>
        <div><label className={label}>Выравнивание</label>
          <div className="flex gap-1.5">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${block.align === a ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                <Icon name={a === "left" ? "AlignLeft" : a === "center" ? "AlignCenter" : "AlignRight"} size={13} />
              </button>
            ))}
          </div>
        </div>
      </>)}

      {/* Text editor */}
      {block.type === "text" && (<>
        <div><label className={label}>Текст</label>
          <textarea className={`${inp} resize-none`} rows={5} value={block.text}
            onChange={e => onChange({ ...block, text: e.target.value })} /></div>
        <div><label className={label}>Выравнивание</label>
          <div className="flex gap-1.5">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${block.align === a ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                <Icon name={a === "left" ? "AlignLeft" : a === "center" ? "AlignCenter" : "AlignRight"} size={13} />
              </button>
            ))}
          </div>
        </div>
      </>)}

      {/* Gallery editor */}
      {block.type === "gallery" && (<>
        <div><label className={label}>Колонок в ряду</label>
          <div className="flex gap-1.5">
            {([1,2,3,4] as const).map(c => (
              <button key={c} onClick={() => onChange({ ...block, cols: c })}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition ${block.cols === c ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div><label className={label}>Пропорции</label>
          <div className="flex gap-1.5">
            {(["square","4/3","16/9"] as const).map(r => (
              <button key={r} onClick={() => onChange({ ...block, ratio: r })}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${block.ratio === r ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                {r === "square" ? "Квадрат" : r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={label}>Фото ({block.photos.length})</label>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {block.photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                <img src={url} className="w-full h-full object-cover" />
                <button
                  onClick={() => onChange({ ...block, photos: block.photos.filter((_, j) => j !== i) })}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Icon name="Trash2" size={14} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => e.target.files && handlePhotos(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 text-white/30 hover:text-violet-400 text-xs transition disabled:opacity-50">
            <Icon name={uploading ? "Loader" : "Upload"} size={13} className={uploading ? "animate-spin" : ""} />
            {uploading ? "Загрузка..." : "Добавить фото"}
          </button>
        </div>
      </>)}

      {/* Buttons editor */}
      {block.type === "buttons" && (<>
        <div><label className={label}>Выравнивание кнопок</label>
          <div className="flex gap-1.5">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${(block.align ?? "left") === a ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                <Icon name={a === "left" ? "AlignLeft" : a === "center" ? "AlignCenter" : "AlignRight"} size={13} />
              </button>
            ))}
          </div>
        </div>
        {block.items.map((btn, i) => (
          <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Кнопка {i + 1}</span>
              <button onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                className="text-red-400/50 hover:text-red-400 transition"><Icon name="X" size={12} /></button>
            </div>
            <input value={btn.label} onChange={e => onChange({ ...block, items: block.items.map((b, j) => j === i ? { ...b, label: e.target.value } : b) })}
              className={inp} placeholder="Текст кнопки" />
            <div className="flex gap-1.5">
              {(["phone","whatsapp","telegram","url"] as const).map(a => (
                <button key={a} onClick={() => onChange({ ...block, items: block.items.map((b, j) => j === i ? { ...b, action: a } : b) })}
                  className={`px-2 py-1 rounded-lg text-[10px] transition ${btn.action === a ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/30 border border-white/10"}`}>
                  {a === "phone" ? "📞" : a === "whatsapp" ? "💬" : a === "telegram" ? "✈️" : "🔗"}
                </button>
              ))}
            </div>
            <input value={btn.value} onChange={e => onChange({ ...block, items: block.items.map((b, j) => j === i ? { ...b, value: e.target.value } : b) })}
              className={inp} placeholder={btn.action === "phone" ? "+7..." : btn.action === "telegram" ? "@username" : "https://..."} />
            <div className="flex gap-1.5">
              {(["primary","outline"] as const).map(s => (
                <button key={s} onClick={() => onChange({ ...block, items: block.items.map((b, j) => j === i ? { ...b, style: s } : b) })}
                  className={`px-3 py-1 rounded-lg text-xs transition ${btn.style === s ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/30 border border-white/10"}`}>
                  {s === "primary" ? "Заполненная" : "Контурная"}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => onChange({ ...block, items: [...block.items, { label: "Кнопка", action: "url", value: "", style: "primary" }] })}
          className="w-full py-2 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 text-white/30 hover:text-violet-400 text-xs transition">
          + Добавить кнопку
        </button>
      </>)}

      {/* Video editor */}
      {block.type === "video" && (
        <div><label className={label}>Ссылка на YouTube или Vimeo</label>
          <input className={inp} value={block.url}
            onChange={e => onChange({ ...block, url: e.target.value })}
            placeholder="https://youtube.com/watch?v=..." />
          {block.url && !getYouTubeEmbed(block.url) && (
            <p className="text-red-400 text-xs mt-1">Не удалось распознать ссылку</p>
          )}
        </div>
      )}

      {/* Spacer editor */}
      {block.type === "spacer" && (
        <div><label className={label}>Высота отступа (px)</label>
          <div className="flex items-center gap-3">
            <input type="range" min={8} max={200} step={4} value={block.height}
              onChange={e => onChange({ ...block, height: Number(e.target.value) })}
              className="flex-1" />
            <span className="text-white/60 text-sm w-12 text-right">{block.height}px</span>
          </div>
        </div>
      )}

      {/* Card editor */}
      {block.type === "card" && (<>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Иконка (эмодзи)</label>
            <input className={inp} value={block.icon} onChange={e => onChange({ ...block, icon: e.target.value })} placeholder="⭐" /></div>
          <div><label className={label}>Выравнивание</label>
            <div className="flex gap-1">
              {(["left","center","right"] as const).map(a => (
                <button key={a} onClick={() => onChange({ ...block, align: a })}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition ${block.align === a ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/30 border border-white/10"}`}>
                  <Icon name={a === "left" ? "AlignLeft" : a === "center" ? "AlignCenter" : "AlignRight"} size={11} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div><label className={label}>Заголовок</label>
          <input className={inp} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} /></div>
        <div><label className={label}>Описание</label>
          <textarea className={`${inp} resize-none`} rows={3} value={block.text}
            onChange={e => onChange({ ...block, text: e.target.value })} /></div>
      </>)}

      {/* Divider editor */}
      {block.type === "divider" && (
        <div><label className={label}>Стиль</label>
          <div className="flex gap-1.5">
            {(["line","dots","space"] as const).map(s => (
              <button key={s} onClick={() => onChange({ ...block, style: s })}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${(block.style ?? "line") === s ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/40 border border-white/10"}`}>
                {s === "line" ? "Линия" : s === "dots" ? "Точки" : "Пробел"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Common style controls */}
      <BlockStyleControls block={block} onChange={onChange} />

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-white/[0.07]">
        <button onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 hover:text-white/80 text-xs transition">
          <Icon name="Copy" size={12} /> Дублировать
        </button>
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/[0.06] hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-400/60 hover:text-red-400 text-xs transition">
          <Icon name="Trash2" size={12} /> Удалить
        </button>
      </div>
    </div>
  );
}

// ── Page Settings Panel ────────────────────────────────────────────────────────
function PageSettingsPanel({ settings, onChange }: { settings: PageSettings; onChange: (s: PageSettings) => void }) {
  const label = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block";
  return (
    <div className="p-4 space-y-4">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Настройки страницы</p>
      <div>
        <label className={label}>Максимальная ширина страницы</label>
        <div className="space-y-1.5">
          {(["sm","md","lg","xl","full"] as const).map(w => (
            <button key={w} onClick={() => onChange({ ...settings, maxWidth: w })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${(settings.maxWidth ?? "md") === w ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "bg-white/[0.03] text-white/40 border border-white/[0.07] hover:bg-white/[0.06]"}`}>
              <span>{MAX_WIDTH_LABELS[w]}</span>
              <span className="text-white/25 text-[9px]">{w === "sm" ? "360px" : w === "md" ? "448px" : w === "lg" ? "512px" : w === "xl" ? "672px" : "100%"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
        <div>
          <p className="text-xs text-white/60 font-medium">Примагничивание</p>
          <p className="text-[10px] text-white/25 mt-0.5">Блоки выравниваются по сетке</p>
        </div>
        <button onClick={() => onChange({ ...settings, snap: !settings.snap })}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.snap ? "bg-violet-600" : "bg-white/10"}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.snap ? "left-6" : "left-1"}`} />
        </button>
      </div>
    </div>
  );
}

// ── Main PageEditor ────────────────────────────────────────────────────────────
interface Props {
  panelId: string;
  onBack: () => void;
}

export default function PageEditor({ panelId, onBack }: Props) {
  const { token } = useAuth();
  const { brand } = useBrand();

  const navBtn = brand.nav_config?.find(b => b.id === panelId) as NavButton | undefined;
  const initialBlocks: PageBlock[] = navBtn?.content?.blocks ?? [];
  const initialTitle = navBtn?.content?.title ?? navBtn?.label ?? "";
  const initialSettings: PageSettings = navBtn?.content?.pageSettings ?? { maxWidth: "md", snap: false };

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

  // DnD state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDraggingFromPalette, setIsDraggingFromPalette] = useState(false);
  const [paletteDropIdx, setPaletteDropIdx] = useState<number | null>(null);
  const dragTypeRef = useRef<PageBlock["type"] | null>(null);

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const updateBlock = useCallback((id: string, updated: PageBlock) => {
    setBlocks(bs => bs.map(b => b.id === id ? updated : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b.id === id);
      if (idx === -1) return bs;
      const copy = { ...bs[idx], id: genId() };
      const next = [...bs];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const addBlock = (type: PageBlock["type"], atIdx?: number) => {
    const nb = defaultBlock(type);
    setBlocks(bs => {
      if (atIdx !== undefined) {
        const next = [...bs];
        next.splice(atIdx, 0, nb);
        return next;
      }
      return [...bs, nb];
    });
    setSelectedId(nb.id);
    setSidebarTab("blocks");
  };

  // ── Canvas DnD (reorder) ──────────────────────────────────────────────────
  const handleDragStart = (i: number) => {
    setDragIdx(i);
    setIsDraggingFromPalette(false);
  };
  const handleDragEnter = (i: number) => {
    if (isDraggingFromPalette) {
      setPaletteDropIdx(i);
    } else {
      setDragOverIdx(i);
    }
  };
  const handleDragEnd = () => {
    if (!isDraggingFromPalette && dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setBlocks(bs => {
        const next = [...bs];
        const [item] = next.splice(dragIdx, 1);
        next.splice(dragOverIdx, 0, item);
        return next;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
    setIsDraggingFromPalette(false);
    setPaletteDropIdx(null);
    dragTypeRef.current = null;
  };

  // ── Palette DnD (add from sidebar) ───────────────────────────────────────
  const handlePaletteDragStart = (type: PageBlock["type"]) => {
    dragTypeRef.current = type;
    setIsDraggingFromPalette(true);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isDraggingFromPalette && dragTypeRef.current) {
      addBlock(dragTypeRef.current, paletteDropIdx ?? undefined);
    }
    setIsDraggingFromPalette(false);
    setPaletteDropIdx(null);
    dragTypeRef.current = null;
  };

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
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("c");
      if (cid) localStorage.removeItem(`mp_brand_${cid}`);
    } finally { setSaving(false); }
  };

  const handleAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(PAGE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, prompt: aiPrompt }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setAiError(d.error || "Ошибка AI"); return; }
      setBlocks(d.blocks as PageBlock[]);
      setAiPrompt("");
      setSelectedId(null);
    } catch { setAiError("Не удалось подключиться к AI"); }
    finally { setAiLoading(false); }
  };

  const maxWClass = MAX_WIDTH_CLASSES[settings.maxWidth ?? "md"];

  // Snap: block widths snap to grid (25/33/50/67/75/100)
  const snapWidths = settings.snap
    ? blocks.map(b => ({ ...b, width: (b.width ?? 100) as PageBlock["width"] }))
    : blocks;

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a12] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.08] bg-[#0e0e1a]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white/80 transition">
              <Icon name="ArrowLeft" size={18} />
            </button>
            <div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="bg-transparent text-white font-bold text-base focus:outline-none border-b border-transparent focus:border-white/20 transition min-w-[160px]"
                placeholder="Название страницы" />
              <p className="text-white/25 text-[10px]">{navBtn?.label}</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${
              saved ? "bg-emerald-500/80" : "bg-gradient-to-r from-orange-500 to-rose-500"
            }`}>
            <Icon name={saved ? "CheckCircle2" : saving ? "Loader" : "Save"} size={15} className={saving ? "animate-spin" : ""} />
            {saved ? "Сохранено!" : saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>

        {/* AI строка */}
        <div className="px-4 pb-3 flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/[0.08] border border-violet-500/20 focus-within:border-violet-500/40 transition">
            <Icon name="Sparkles" size={14} className="text-violet-400 shrink-0" />
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAi()}
              placeholder="Попросите AI улучшить страницу..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>
          <button onClick={handleAi} disabled={aiLoading || !aiPrompt.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition shrink-0">
            <Icon name={aiLoading ? "Loader" : "Wand2"} size={15} className={aiLoading ? "animate-spin" : ""} />
            {aiLoading ? "Думаю..." : "Применить"}
          </button>
        </div>
        {aiError && <p className="px-4 pb-2 text-xs text-red-400">{aiError}</p>}
      </div>

      {/* ── Body: canvas + sidebar ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Canvas */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-6"
          onDrop={handleCanvasDrop}
          onDragOver={e => e.preventDefault()}
        >
          <div className={`${maxWClass} mx-auto`}>

            {blocks.length === 0 && !isDraggingFromPalette && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                  <Icon name="LayoutTemplate" size={28} className="text-white/20" />
                </div>
                <p className="text-white/30 text-sm mb-1">Страница пустая</p>
                <p className="text-white/15 text-xs">Перетащите блок из панели справа или нажмите +</p>
              </div>
            )}

            {/* Drop zone at top when dragging from palette */}
            {isDraggingFromPalette && (
              <div
                onDragEnter={() => setPaletteDropIdx(0)}
                className={`h-12 mb-2 rounded-xl border-2 border-dashed transition flex items-center justify-center text-xs ${
                  paletteDropIdx === 0 ? "border-violet-500/70 bg-violet-500/10 text-violet-400" : "border-white/10 text-white/15"
                }`}>
                {paletteDropIdx === 0 ? "Отпустите здесь" : "↑ В начало"}
              </div>
            )}

            {/* Flex-wrap layout: блоки выстраиваются в ряды по width */}
            <div className={`flex flex-wrap ${settings.snap ? "gap-2" : "gap-2"}`}>
              {snapWidths.map((block, i) => (
                <div
                  key={block.id}
                  className={`${blockWidthClass(block.width)} transition-all`}
                >
                  {/* Drop indicator above block when dragging from palette */}
                  {isDraggingFromPalette && (
                    <div
                      onDragEnter={() => setPaletteDropIdx(i)}
                      className={`h-2 mb-1 rounded transition ${paletteDropIdx === i ? "bg-violet-500/40" : ""}`}
                    />
                  )}

                  <div
                    draggable={!isDraggingFromPalette}
                    onDragStart={() => handleDragStart(i)}
                    onDragEnter={() => handleDragEnter(i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => { if (!isDraggingFromPalette) setSelectedId(block.id === selectedId ? null : block.id); setSidebarTab("blocks"); }}
                    style={{
                      paddingTop: block.paddingTop ?? 0,
                      paddingBottom: block.paddingBottom ?? 0,
                      background: block.bg || undefined,
                      opacity: block.hidden ? 0.3 : 1,
                    }}
                    className={`relative group p-3 rounded-2xl border transition-all cursor-pointer ${
                      selectedId === block.id
                        ? "border-violet-500/50 bg-violet-500/[0.06]"
                        : dragOverIdx === i && !isDraggingFromPalette
                        ? "border-orange-500/40 bg-orange-500/[0.04]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                    }`}
                  >
                    {/* Drag handle */}
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition cursor-grab active:cursor-grabbing z-10">
                      <Icon name="GripVertical" size={14} className="text-white" />
                    </div>

                    {/* Badges */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 z-10">
                      {block.hidden && <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">скрыт</span>}
                      <span className="text-[9px] text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        {BLOCK_LABELS[block.type]}
                      </span>
                      {(block.width ?? 100) < 100 && (
                        <span className="text-[9px] text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded-full">{block.width}%</span>
                      )}
                    </div>

                    <div className="pl-4 pr-2">
                      <BlockPreview block={block} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Drop zone at bottom when dragging from palette */}
            {isDraggingFromPalette && (
              <div
                onDragEnter={() => setPaletteDropIdx(blocks.length)}
                className={`h-16 mt-2 rounded-xl border-2 border-dashed transition flex items-center justify-center text-xs ${
                  paletteDropIdx === blocks.length ? "border-violet-500/70 bg-violet-500/10 text-violet-400" : "border-white/10 text-white/15"
                }`}>
                {paletteDropIdx === blocks.length ? "Отпустите — добавить в конец" : "↓ В конец"}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-l border-white/[0.07] bg-[#0c0c18] flex flex-col overflow-hidden">

          {/* Sidebar tabs */}
          <div className="shrink-0 flex border-b border-white/[0.07]">
            {(["blocks","settings"] as const).map(tab => (
              <button key={tab} onClick={() => { setSidebarTab(tab); if (tab === "settings") setSelectedId(null); }}
                className={`flex-1 py-2.5 text-xs font-bold transition ${sidebarTab === tab && !selectedId ? "text-violet-300 border-b-2 border-violet-500" : sidebarTab === tab ? "text-violet-300 border-b-2 border-violet-500" : "text-white/25 hover:text-white/50"}`}>
                {tab === "blocks" ? "Блоки" : "Страница"}
              </button>
            ))}
          </div>

          {selectedBlock ? (
            /* Block editor */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  {BLOCK_LABELS[selectedBlock.type]}
                </span>
                <button onClick={() => setSelectedId(null)} className="text-white/20 hover:text-white/50 transition">
                  <Icon name="X" size={14} />
                </button>
              </div>
              <BlockEditor
                block={selectedBlock}
                onChange={updated => updateBlock(selectedBlock.id, updated)}
                onDelete={() => deleteBlock(selectedBlock.id)}
                onDuplicate={() => duplicateBlock(selectedBlock.id)}
                token={token}
              />
            </div>

          ) : sidebarTab === "settings" ? (
            <div className="flex-1 overflow-y-auto">
              <PageSettingsPanel settings={settings} onChange={setSettings} />
            </div>

          ) : (
            /* Add blocks */
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">Перетащите или нажмите</p>
              <div className="grid grid-cols-2 gap-2">
                {ADD_BLOCKS.map(({ type, icon, label }) => (
                  <div key={type}
                    draggable
                    onDragStart={() => handlePaletteDragStart(type)}
                    onDragEnd={handleDragEnd}
                    onClick={() => addBlock(type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-violet-500/30 transition group cursor-grab active:cursor-grabbing select-none">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] group-hover:bg-violet-500/15 flex items-center justify-center transition">
                      <Icon name={icon} size={16} className="text-white/40 group-hover:text-violet-400 transition" />
                    </div>
                    <span className="text-[10px] text-white/40 group-hover:text-white/70 transition text-center">{label}</span>
                  </div>
                ))}
              </div>

              {blocks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-2">Слои ({blocks.length})</p>
                  <div className="space-y-0.5">
                    {blocks.map((block, i) => (
                      <button key={block.id} onClick={() => setSelectedId(block.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition group ${selectedId === block.id ? "bg-violet-500/10 border border-violet-500/20" : "hover:bg-white/[0.05]"}`}>
                        <Icon name={ADD_BLOCKS.find(b => b.type === block.type)?.icon ?? "Box"} size={11} className="text-white/25 group-hover:text-white/50 shrink-0" />
                        <span className="text-xs text-white/35 group-hover:text-white/60 truncate flex-1">
                          {block.type === "heading" ? block.text :
                           block.type === "text" ? block.text.slice(0, 28) + (block.text.length > 28 ? "…" : "") :
                           block.type === "gallery" ? `${block.photos.length} фото` :
                           block.type === "buttons" ? `${block.items.length} кноп.` :
                           block.type === "video" ? (block.url ? "Видео" : "Без ссылки") :
                           block.type === "spacer" ? `${block.height}px` :
                           block.type === "card" ? block.title :
                           "Разделитель"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {block.hidden && <Icon name="EyeOff" size={9} className="text-orange-400/60" />}
                          {(block.width ?? 100) < 100 && <span className="text-[8px] text-blue-400/50">{block.width}%</span>}
                          <span className="text-[9px] text-white/15">#{i + 1}</span>
                        </div>
                      </button>
                    ))}
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

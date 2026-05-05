import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBrand } from "@/context/BrandContext";
import type {
  NavButton, PageBlock, PageBlockHeading, PageBlockText,
  PageBlockGallery, PageBlockButtons, PageBlockDivider,
} from "@/context/AuthContext";
import { updateBrand } from "./admin/own-agent/brandApi";
import { uploadBrandImage } from "./admin/own-agent/brandApi";
import Icon from "@/components/ui/icon";

// ── helpers ───────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9); }

function defaultBlock(type: PageBlock["type"]): PageBlock {
  if (type === "heading")  return { type, id: genId(), text: "Заголовок", size: "lg", align: "left" };
  if (type === "text")     return { type, id: genId(), text: "Введите текст...", align: "left" };
  if (type === "gallery")  return { type, id: genId(), photos: [], cols: 2, ratio: "4/3" };
  if (type === "buttons")  return { type, id: genId(), items: [{ label: "Позвонить", action: "phone", value: "", style: "primary" }] };
  return { type: "divider", id: genId() };
}

// ── Block Add Panel ────────────────────────────────────────────────────────────
const ADD_BLOCKS: { type: PageBlock["type"]; icon: string; label: string }[] = [
  { type: "heading",  icon: "Heading",     label: "Заголовок" },
  { type: "text",     icon: "AlignLeft",   label: "Текст" },
  { type: "gallery",  icon: "Image",       label: "Галерея" },
  { type: "buttons",  icon: "MousePointer",label: "Кнопки" },
  { type: "divider",  icon: "Minus",       label: "Разделитель" },
];

// ── Block renderer (preview inside editor) ────────────────────────────────────
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
      <div className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs">Фото не добавлены</div>
    );
    return (
      <div className={`grid ${cols} gap-1.5`}>
        {block.photos.map((url, i) => (
          <div key={i} className={`${ratio} rounded-lg overflow-hidden`}>
            <img src={url} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "buttons") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.items.map((btn, i) => (
          <div key={i} className={`px-4 py-2 rounded-xl text-sm font-bold ${
            btn.style === "primary"
              ? "text-white bg-gradient-to-r from-orange-500 to-rose-500"
              : "text-orange-400 border border-orange-500/40 bg-orange-500/10"
          }`}>{btn.label}</div>
        ))}
      </div>
    );
  }
  if (block.type === "divider") {
    return <div className="w-full h-px bg-white/10 my-1" />;
  }
  return null;
}

// ── Block Editor Panel ────────────────────────────────────────────────────────
function BlockEditor({
  block, onChange, onDelete, token,
}: {
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  onDelete: () => void;
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
                <button onClick={() => onChange({ ...block, photos: block.photos.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hidden group-hover:flex items-center justify-center">
                  <Icon name="X" size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) handlePhotos(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 bg-white/[0.06] border border-white/[0.1] disabled:opacity-50 transition">
            <Icon name={uploading ? "Loader" : "Upload"} size={13} className={uploading ? "animate-spin" : ""} />
            {uploading ? "Загружаем..." : "Добавить фото"}
          </button>
        </div>
      </>)}

      {/* Buttons editor */}
      {block.type === "buttons" && (
        <div className="space-y-2">
          {block.items.map((btn, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Кнопка {i + 1}</span>
                {block.items.length > 1 && (
                  <button onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                    className="text-white/20 hover:text-red-400 transition"><Icon name="Trash2" size={12} /></button>
                )}
              </div>
              <input className={inp} placeholder="Текст кнопки" value={btn.label}
                onChange={e => { const items = [...block.items]; items[i] = { ...btn, label: e.target.value }; onChange({ ...block, items }); }} />
              <div className="flex gap-1.5">
                {(["phone","whatsapp","telegram","url"] as const).map(a => (
                  <button key={a} onClick={() => { const items = [...block.items]; items[i] = { ...btn, action: a }; onChange({ ...block, items }); }}
                    className={`px-2 py-1 rounded-lg text-[10px] transition ${btn.action === a ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/30 border border-white/10"}`}>
                    {a}
                  </button>
                ))}
              </div>
              <input className={inp} placeholder={btn.action === "phone" ? "+7 999..." : btn.action === "url" ? "https://..." : "@username"} value={btn.value}
                onChange={e => { const items = [...block.items]; items[i] = { ...btn, value: e.target.value }; onChange({ ...block, items }); }} />
              <div className="flex gap-1.5">
                {(["primary","outline"] as const).map(s => (
                  <button key={s} onClick={() => { const items = [...block.items]; items[i] = { ...btn, style: s }; onChange({ ...block, items }); }}
                    className={`px-3 py-1 rounded-lg text-xs transition ${btn.style === s ? "bg-violet-500/30 text-violet-300 border border-violet-500/50" : "bg-white/5 text-white/30 border border-white/10"}`}>
                    {s === "primary" ? "Заливка" : "Контур"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {block.items.length < 3 && (
            <button onClick={() => onChange({ ...block, items: [...block.items, { label: "Кнопка", action: "url", value: "", style: "outline" }] })}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
              <Icon name="Plus" size={12} /> Добавить кнопку
            </button>
          )}
        </div>
      )}

      {block.type === "divider" && (
        <p className="text-white/30 text-xs">Разделитель — горизонтальная линия</p>
      )}

      <button onClick={onDelete}
        className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition mt-2">
        <Icon name="Trash2" size={12} /> Удалить блок
      </button>
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

  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [title, setTitle] = useState(initialTitle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const updateBlock = useCallback((id: string, updated: PageBlock) => {
    setBlocks(bs => bs.map(b => b.id === id ? updated : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const addBlock = (type: PageBlock["type"]) => {
    const nb = defaultBlock(type);
    setBlocks(bs => [...bs, nb]);
    setSelectedId(nb.id);
  };

  // drag-and-drop
  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragEnter = (i: number) => setDragOverIdx(i);
  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setBlocks(bs => {
        const next = [...bs];
        const [item] = next.splice(dragIdx, 1);
        next.splice(dragOverIdx, 0, item);
        return next;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleSave = async () => {
    if (!brand.nav_config) return;
    setSaving(true);
    try {
      const newNav = brand.nav_config.map(b =>
        b.id === panelId
          ? { ...b, content: { ...(b.content || {}), title, blocks } }
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

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a12] flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#0e0e1a]">
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

      {/* Body: canvas + sidebar */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Canvas — preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md mx-auto space-y-2">
            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                  <Icon name="LayoutTemplate" size={28} className="text-white/20" />
                </div>
                <p className="text-white/30 text-sm mb-1">Страница пустая</p>
                <p className="text-white/15 text-xs">Добавьте блоки из панели справа</p>
              </div>
            )}

            {blocks.map((block, i) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onClick={() => setSelectedId(block.id === selectedId ? null : block.id)}
                className={`relative group p-3 rounded-2xl border transition-all cursor-pointer ${
                  selectedId === block.id
                    ? "border-violet-500/50 bg-violet-500/[0.06]"
                    : dragOverIdx === i
                    ? "border-orange-500/40 bg-orange-500/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                {/* drag handle */}
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition cursor-grab active:cursor-grabbing">
                  <Icon name="GripVertical" size={14} className="text-white" />
                </div>

                {/* block type badge */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                  <span className="text-[9px] text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {block.type}
                  </span>
                </div>

                <div className="pl-4">
                  <BlockPreview block={block} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 border-l border-white/[0.07] bg-[#0c0c18] flex flex-col overflow-hidden">

          {selectedBlock ? (
            /* Block editor */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  {{heading:"Заголовок",text:"Текст",gallery:"Галерея",buttons:"Кнопки",divider:"Разделитель"}[selectedBlock.type]}
                </span>
                <button onClick={() => setSelectedId(null)} className="text-white/20 hover:text-white/50 transition">
                  <Icon name="X" size={14} />
                </button>
              </div>
              <BlockEditor
                block={selectedBlock}
                onChange={updated => updateBlock(selectedBlock.id, updated)}
                onDelete={() => deleteBlock(selectedBlock.id)}
                token={token}
              />
            </div>
          ) : (
            /* Add blocks */
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">Добавить блок</p>
              <div className="grid grid-cols-2 gap-2">
                {ADD_BLOCKS.map(({ type, icon, label }) => (
                  <button key={type} onClick={() => addBlock(type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-violet-500/30 transition group">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] group-hover:bg-violet-500/15 flex items-center justify-center transition">
                      <Icon name={icon} size={16} className="text-white/40 group-hover:text-violet-400 transition" />
                    </div>
                    <span className="text-[10px] text-white/40 group-hover:text-white/70 transition">{label}</span>
                  </button>
                ))}
              </div>

              {blocks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-2">Блоки ({blocks.length})</p>
                  <div className="space-y-1">
                    {blocks.map((block, i) => (
                      <button key={block.id} onClick={() => setSelectedId(block.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] text-left transition group">
                        <Icon name={ADD_BLOCKS.find(b => b.type === block.type)?.icon ?? "Box"} size={12} className="text-white/25 group-hover:text-white/50 shrink-0" />
                        <span className="text-xs text-white/35 group-hover:text-white/60 truncate">
                          {block.type === "heading" ? block.text :
                           block.type === "text" ? block.text.slice(0, 30) + (block.text.length > 30 ? "..." : "") :
                           block.type === "gallery" ? `${block.photos.length} фото` :
                           block.type === "buttons" ? `${block.items.length} кнопок` : "Разделитель"}
                        </span>
                        <span className="text-[9px] text-white/15 ml-auto shrink-0">#{i + 1}</span>
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

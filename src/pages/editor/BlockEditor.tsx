import React, { useState, useRef } from "react";
import type { PageBlock, PageSettings, PageBlockStyle } from "@/context/AuthContext";
import { uploadBrandImage } from "@/pages/admin/own-agent/brandApi";
import Icon from "@/components/ui/icon";
import { StylePanel } from "./BlockContent";

export function BlockEditor({
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
              <button onClick={() => onChange({ ...block, items: block.items.filter((_,j)=>j!==i) })} className="text-red-400/50 hover:text-red-400 transition">
                <Icon name="X" size={12} />
              </button>
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

export function CanvasSettingsPanel({ settings, onChange }: { settings: PageSettings; onChange: (s: PageSettings) => void }) {
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

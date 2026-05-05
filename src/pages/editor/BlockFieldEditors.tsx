import React, { useRef, useState } from "react";
import type { PageBlock } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { uploadBrandImage } from "@/pages/admin/own-agent/brandApi";

interface Props {
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  token: string | null;
}

export function BlockFieldEditors({ block, onChange, token }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const inp = "w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none bg-white/[0.06] border border-white/[0.1]";
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 block";

  const handlePhotos = async (files: FileList) => {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadBrandImage(token, f));
      if (block.type === "gallery") onChange({ ...block, photos: [...block.photos, ...urls] });
    } finally { setUploading(false); }
  };

  return (
    <>
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
    </>
  );
}

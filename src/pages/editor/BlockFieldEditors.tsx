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
  const fileRef    = useRef<HTMLInputElement>(null);
  const cardImgRef = useRef<HTMLInputElement>(null);
  const videoRef   = useRef<HTMLInputElement>(null);
  const avatarRef  = useRef<HTMLInputElement>(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadingCard,  setUploadingCard]  = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAvatar,setUploadingAvatar]= useState(false);

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

      {block.type === "video" && (<>
        <div><label className={lbl}>Ссылка (YouTube, Vimeo, прямой URL)</label>
          <input className={inp} value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} placeholder="https://youtube.com/watch?v=... или https://..." />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-white/30">или загрузить файл</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <input ref={videoRef} type="file" accept="video/*" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            setUploadingVideo(true);
            try { const url = await uploadBrandImage(token, f); onChange({ ...block, url }); }
            finally { setUploadingVideo(false); }
          }} />
        <button onClick={() => videoRef.current?.click()} disabled={uploadingVideo}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/10 hover:border-pink-500/40 text-white/30 hover:text-pink-400 text-xs transition">
          <Icon name={uploadingVideo?"Loader":"Upload"} size={12} className={uploadingVideo?"animate-spin":""} />
          {uploadingVideo?"Загрузка...":"Загрузить видео-файл (.mp4, .webm)"}
        </button>
      </>)}

      {block.type === "card" && (<>
        {/* Фото */}
        <div>
          <label className={lbl}>Фото</label>
          {block.photoUrl && (
            <div className="relative mb-2 rounded-xl overflow-hidden" style={{ aspectRatio: "16/7" }}>
              <img src={block.photoUrl} className="w-full h-full object-cover" alt="" />
              <button onClick={() => onChange({ ...block, photoUrl: "" })}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-white">
                <Icon name="X" size={11} />
              </button>
            </div>
          )}
          <input ref={cardImgRef} type="file" accept="image/*" className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              setUploadingCard(true);
              try { const url = await uploadBrandImage(token, f); onChange({ ...block, photoUrl: url }); }
              finally { setUploadingCard(false); }
            }} />
          <button onClick={() => cardImgRef.current?.click()} disabled={uploadingCard}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 text-white/30 hover:text-violet-400 text-xs transition">
            <Icon name={uploadingCard?"Loader":"Image"} size={12} className={uploadingCard?"animate-spin":""} />
            {uploadingCard?"Загрузка...":"Загрузить фото"}
          </button>
        </div>
        {/* Расположение фото */}
        <div><label className={lbl}>Фото относительно текста</label>
          <div className="flex gap-1">
            {(["left","right","top","none"] as const).map(s => (
              <button key={s} onClick={() => onChange({ ...block, photoSide: s })}
                className={`flex-1 py-1.5 rounded-lg text-[10px] transition ${(block.photoSide??"left")===s?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/40 border border-white/10"}`}>
                {s==="left"?"← Лево":s==="right"?"Право →":s==="top"?"↑ Верх":"Нет"}
              </button>
            ))}
          </div>
        </div>
        <div><label className={lbl}>Заголовок</label>
          <input className={inp} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} /></div>
        <div><label className={lbl}>Текст</label>
          <textarea className={`${inp} resize-none`} rows={3} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} /></div>
        <div><label className={lbl}>Выравнивание текста</label>
          <div className="flex gap-1">
            {(["left","center","right"] as const).map(a => (
              <button key={a} onClick={() => onChange({ ...block, align: a })}
                className={`flex-1 py-1.5 rounded-lg text-xs transition ${(block.align??"left")===a?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/5 text-white/30 border border-white/10"}`}>
                <Icon name={a==="left"?"AlignLeft":a==="center"?"AlignCenter":"AlignRight"} size={11} />
              </button>
            ))}
          </div>
        </div>
      </>)}

      {block.type === "price" && (<>
        <div><label className={lbl}>Заголовок (необязательно)</label>
          <input className={inp} value={block.title ?? ""} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Наши цены" /></div>
        {block.items.map((item, i) => (
          <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Позиция {i+1}</span>
              <button onClick={() => onChange({ ...block, items: block.items.filter((_,j)=>j!==i) })} className="text-red-400/50 hover:text-red-400"><Icon name="X" size={12} /></button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <div><label className={lbl}>Значок</label>
                <input className={inp} value={item.icon??""} onChange={e => onChange({ ...block, items: block.items.map((it,j)=>j===i?{...it,icon:e.target.value}:it) })} placeholder="✅" /></div>
              <div className="col-span-3"><label className={lbl}>Название</label>
                <input className={inp} value={item.name} onChange={e => onChange({ ...block, items: block.items.map((it,j)=>j===i?{...it,name:e.target.value}:it) })} placeholder="Натяжной потолок" /></div>
            </div>
            <input className={inp} value={item.price} onChange={e => onChange({ ...block, items: block.items.map((it,j)=>j===i?{...it,price:e.target.value}:it) })} placeholder="от 1 200 ₽/м²" />
            <input className={inp} value={item.desc??""} onChange={e => onChange({ ...block, items: block.items.map((it,j)=>j===i?{...it,desc:e.target.value}:it) })} placeholder="Пояснение (необязательно)" />
          </div>
        ))}
        <button onClick={() => onChange({ ...block, items: [...block.items, { icon: "✅", name: "Услуга", price: "от 0 ₽", desc: "" }] })}
          className="w-full py-2 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/40 text-white/30 hover:text-emerald-400 text-xs transition">
          + Добавить позицию
        </button>
      </>)}

      {block.type === "quote" && (<>
        <div><label className={lbl}>Текст цитаты / отзыва</label>
          <textarea className={`${inp} resize-none`} rows={4} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Отличная работа! Рекомендую всем." /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>Автор</label>
            <input className={inp} value={block.author??""} onChange={e => onChange({ ...block, author: e.target.value })} placeholder="Иван Иванов" /></div>
          <div><label className={lbl}>Должность</label>
            <input className={inp} value={block.role??""} onChange={e => onChange({ ...block, role: e.target.value })} placeholder="Клиент" /></div>
        </div>
        {/* Аватар */}
        {block.avatar && (
          <div className="flex items-center gap-2">
            <img src={block.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
            <button onClick={() => onChange({ ...block, avatar: "" })} className="text-red-400/50 hover:text-red-400 text-xs"><Icon name="X" size={11} /> Удалить</button>
          </div>
        )}
        <input ref={avatarRef} type="file" accept="image/*" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            setUploadingAvatar(true);
            try { const url = await uploadBrandImage(token, f); onChange({ ...block, avatar: url }); }
            finally { setUploadingAvatar(false); }
          }} />
        <button onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/10 hover:border-amber-500/40 text-white/30 hover:text-amber-400 text-xs transition">
          <Icon name={uploadingAvatar?"Loader":"UserCircle"} size={12} className={uploadingAvatar?"animate-spin":""} />
          {uploadingAvatar?"Загрузка...":"Загрузить аватар автора"}
        </button>
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
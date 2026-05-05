import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { PRODUCTION } from "../data/content";
import { PORTFOLIO_ITEMS } from "../data/portfolio";
import { PROD_FEATURES } from "../chatConfig";
import { useBrand } from "@/context/BrandContext";
import { useAuth } from "@/context/AuthContext";
import type { NavButton } from "@/context/AuthContext";
import { PanelHeader } from "./PanelHeader";

export function PanelProduction({ onClose, onEdit }: { onClose: () => void; onEdit?: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const prodImages = PRODUCTION.map((item) => ({ src: item.img, alt: item.title }));

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Factory" title="Собственное производство" onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {PRODUCTION.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden group cursor-pointer"
              onClick={() => setLightboxIndex(i)}>
              <div className="aspect-[4/3] overflow-hidden">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-2.5">
                <div className="text-white font-medium text-xs mb-1">{item.title}</div>
                <div className="text-white/35 text-[10px] leading-relaxed line-clamp-2">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {lightboxIndex !== null && (
          <Lightbox
            images={prodImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((lightboxIndex - 1 + prodImages.length) % prodImages.length)}
            onNext={() => setLightboxIndex((lightboxIndex + 1) % prodImages.length)}
          />
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROD_FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Icon name={f.icon} size={13} className="text-orange-400" />
              </div>
              <span className="text-white/50 text-[11px] font-medium leading-tight">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PanelPortfolio({ onClose, onEdit }: { onClose: () => void; onEdit?: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const portfolioSlice = PORTFOLIO_ITEMS.slice(0, 12);
  const portImages = portfolioSlice.map((item) => ({ src: item.img, alt: `${item.room} · ${item.type}` }));

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Image" title="Наши работы" onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {portfolioSlice.map((item, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
              onClick={() => setLightboxIndex(i)}>
              <img src={item.img} alt={item.room} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <div>
                  <div className="text-white text-[10px] font-semibold">{item.type}</div>
                  <div className="text-white/50 text-[9px]">{item.district} · {item.area} м²</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {lightboxIndex !== null && (
          <Lightbox
            images={portImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((lightboxIndex - 1 + portImages.length) % portImages.length)}
            onNext={() => setLightboxIndex((lightboxIndex + 1) % portImages.length)}
          />
        )}
      </div>
    </div>
  );
}

export function PanelCustom({ btn, onClose, onEdit }: { btn: NavButton; onClose: () => void; onEdit?: () => void }) {
  const { token } = useAuth();
  const { brand } = useBrand();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState({ ...btn.content });

  const c = editing ? draft : (btn.content || {});

  const updateDraft = (patch: Partial<typeof draft>) => setDraft(d => ({ ...d, ...patch }));

  const handlePhotoUpload = async (file: File) => {
    const { uploadBrandImage } = await import("../admin/own-agent/brandApi");
    setUploading(true);
    try {
      const url = await uploadBrandImage(token, file);
      updateDraft({ photo_url: url });
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!brand.nav_config) return;
    const { updateBrand } = await import("../admin/own-agent/brandApi");
    setSaving(true);
    try {
      const newNav = brand.nav_config.map(b => b.id === btn.id ? { ...b, content: draft } : b);
      await updateBrand(token, { ...brand, nav_config: newNav } as import("@/context/AuthContext").Brand);
      setEditing(false);
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("c");
      if (cid) localStorage.removeItem(`mp_brand_${cid}`);
    } finally { setSaving(false); }
  };

  const handleBtnClick = () => {
    const content = btn.content || {};
    if (!content.btn_action || !content.btn_value) return;
    if (content.btn_action === "phone") { window.location.href = `tel:${content.btn_value.replace(/\D/g, "").replace(/^8/, "+7")}`; return; }
    if (content.btn_action === "whatsapp") { window.open(`https://wa.me/${content.btn_value.replace(/\D/g, "")}`, "_blank"); return; }
    if (content.btn_action === "telegram") { window.open(content.btn_value.startsWith("http") ? content.btn_value : `https://t.me/${content.btn_value.replace("@", "")}`, "_blank"); return; }
    if (content.btn_action === "url") { window.open(content.btn_value, "_blank"); return; }
  };

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon={btn.icon} title={editing ? "Редактирование" : (c.title || btn.label)} onClose={onClose}
        onEdit={onEdit ? () => { setDraft({ ...btn.content }); setEditing(e => !e); } : undefined} />
      <div className="flex-1 overflow-y-auto">
        {!editing ? (
          <>
            {c.photo_url && (
              <div className="w-full" style={{ aspectRatio: "16/7" }}>
                <img src={c.photo_url} className="w-full h-full object-cover" alt={btn.label} />
              </div>
            )}
            <div className="p-4 space-y-4">
              {c.text && <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{c.text}</p>}
              {!c.text && !c.photo_url && <p className="text-white/30 text-sm text-center py-8">Контент не настроен</p>}
              {c.btn_label && c.btn_action && c.btn_value && (
                <button onClick={handleBtnClick}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition active:scale-95"
                  style={{ background: "linear-gradient(135deg, #f97316, #e11d48)" }}>
                  {c.btn_label}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">Заголовок</div>
              <input value={draft.title || ""} onChange={e => updateDraft({ title: e.target.value })}
                placeholder="Заголовок панели"
                className="w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">Текст</div>
              <textarea value={draft.text || ""} onChange={e => updateDraft({ text: e.target.value })}
                placeholder="Расскажите о себе..."
                rows={5} className="w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">Фото</div>
              {draft.photo_url && (
                <div className="relative mb-2 rounded-xl overflow-hidden" style={{ aspectRatio: "16/7" }}>
                  <img src={draft.photo_url} className="w-full h-full object-cover" />
                  <button onClick={() => updateDraft({ photo_url: null })}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                    <Icon name="X" size={12} className="text-white" />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 transition disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon name={uploading ? "Loader" : "Upload"} size={13} className={uploading ? "animate-spin" : ""} />
                {uploading ? "Загружаем..." : draft.photo_url ? "Заменить фото" : "Загрузить фото"}
              </button>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">Кнопка (необязательно)</div>
              <input value={draft.btn_label || ""} onChange={e => updateDraft({ btn_label: e.target.value })}
                placeholder="Текст кнопки"
                className="w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none mb-1.5"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <input value={draft.btn_value || ""} onChange={e => updateDraft({ btn_value: e.target.value })}
                placeholder="+7 999... или https://... или @username"
                className="w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #f97316, #e11d48)" }}>
                {saving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 py-2.5 rounded-xl text-sm text-white/40 transition"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

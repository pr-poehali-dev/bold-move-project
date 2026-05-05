import { useState, useRef } from "react";
import { usePhone } from "@/hooks/use-phone";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { PRODUCTION } from "./data/content";
import { SharedPanelReviews, SharedPanelFaq } from "./sharedPanels";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import { TIPS, PROD_FEATURES, BOOKING_TIMES, Panel } from "./chatConfig";
import { useBrand } from "@/context/BrandContext";
import { useAuth } from "@/context/AuthContext";
import type { NavButton } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const LIVE_CHAT_URL = func2url["live-chat"];

export function PanelBooking({ onClose, onEdit }: { onClose: () => void; onEdit?: () => void }) {
  const [name, setName]   = useState("");
  const { phone, setPhone, handleChange: handlePhone, handleFocus: focusPhone, handleBlur: blurPhone, isValid: phoneValid } = usePhone("+7 (");
  const [date, setDate]   = useState("");
  const [time, setTime]   = useState("");
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const minDate = new Date().toISOString().split("T")[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phoneValid) return;
    setLoading(true);
    fetch(`${LIVE_CHAT_URL}?action=booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, date, time }),
    })
      .finally(() => { setLoading(false); setSent(true); });
  };

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="CalendarCheck" title="Заказать замер" onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto p-4">
        {sent ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Icon name="CalendarCheck" size={30} className="text-orange-400" />
            </div>
            <div className="text-white font-semibold text-base">Замер записан!</div>
            <div className="text-white/40 text-sm max-w-xs">
              {date ? `${date.split("-").reverse().join(".")}${time ? ` в ${time}` : ""}` : "Дата будет согласована"}
              <br />Замерщик свяжется с вами за час до приезда
            </div>
            <div className="mt-1 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white/30 text-xs">
              Замер бесплатный · 20–30 минут · 3D-визуализация в подарок
            </div>
            <button onClick={() => { setSent(false); setName(""); setPhone(""); setDate(""); setTime(""); }}
              className="mt-1 text-orange-400 text-xs hover:text-orange-300 underline">
              Записаться ещё раз
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
            {/* Benefits */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "Ruler",       label: "Точные замеры" },
                { icon: "Box",         label: "3D-визуализация" },
                { icon: "BadgeCheck",  label: "Бесплатно" },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-xl py-3 px-2 text-center">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Icon name={b.icon} size={15} className="text-orange-400" />
                  </div>
                  <span className="text-white/50 text-[10px] leading-tight">{b.label}</span>
                </div>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" required
                  className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20" />
                <input type="tel" value={phone} onChange={handlePhone} onFocus={focusPhone} onBlur={blurPhone} placeholder="+7 (___) ___-__-__" required
                  className={`w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20 ${phone && !phoneValid ? "border-rose-500/60 focus:border-rose-500" : "border-white/[0.07] focus:border-orange-500/40"}`} />
              </div>
              {phone && !phoneValid && <p className="text-rose-400 text-[10px] -mt-1">Введите 10 цифр номера</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Дата</label>
                  <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Время</label>
                  <select value={time} onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all">
                    <option value="" className="bg-[#111118]">Любое</option>
                    {BOOKING_TIMES.map((t) => <option key={t} value={t} className="bg-[#111118]">{t}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Icon name={loading ? "Loader" : "CalendarCheck"} size={16} className={loading ? "animate-spin" : ""} />
                {loading ? "Отправляем..." : "Заказать бесплатный замер"}
              </button>
              <p className="text-center text-white/20 text-[10px]">Замерщик приедет в удобное для вас время</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared panel header ──────────────────────────────────────────────────────
function PanelHeader({ icon, title, onClose, onEdit }: { icon: string; title: string; onClose: () => void; onEdit?: () => void }) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={15} className="text-orange-400" />
        <span className="text-sm font-semibold text-white/80">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {onEdit && (
          <button onClick={onEdit} title="Редактировать"
            className="p-1.5 rounded-lg hover:bg-violet-500/15 text-white/20 hover:text-violet-400 transition-all">
            <Icon name="Pencil" size={15} />
          </button>
        )}
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Production ───────────────────────────────────────────────────────────────
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

// ─── Portfolio ────────────────────────────────────────────────────────────────
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

// ─── PanelCustom — универсальная кастомная панель ────────────────────────────
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
    const { uploadBrandImage } = await import("./admin/own-agent/brandApi");
    setUploading(true);
    try {
      const url = await uploadBrandImage(token, file);
      updateDraft({ photo_url: url });
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!brand.nav_config) return;
    const { updateBrand } = await import("./admin/own-agent/brandApi");
    setSaving(true);
    try {
      const newNav = brand.nav_config.map(b => b.id === btn.id ? { ...b, content: draft } : b);
      await updateBrand(token, { ...brand, nav_config: newNav } as import("@/context/AuthContext").Brand);
      setEditing(false);
      // Сбрасываем кеш бренда
      const params = new URLSearchParams(window.location.search);
      const cid = params.get("c");
      if (cid) localStorage.removeItem(`mp_brand_${cid}`);
    } finally { setSaving(false); }
  };

  const handleBtnClick = () => {
    const content = btn.content || {};
    if (!content.btn_action || !content.btn_value) return;
    if (content.btn_action === "phone") { window.location.href = `tel:${content.btn_value.replace(/\D/g,"").replace(/^8/,"+7")}`; return; }
    if (content.btn_action === "whatsapp") { window.open(`https://wa.me/${content.btn_value.replace(/\D/g,"")}`, "_blank"); return; }
    if (content.btn_action === "telegram") { window.open(content.btn_value.startsWith("http") ? content.btn_value : `https://t.me/${content.btn_value.replace("@","")}`, "_blank"); return; }
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

// ─── Tips ─────────────────────────────────────────────────────────────────────
export function PanelTips({ onAsk, onClose }: { onAsk: (q: string) => void; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Sparkles" title="Спросите Женю" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIPS.map((t, i) => (
            <button key={i} onClick={() => onAsk(t.q)}
              className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-orange-500/20 rounded-xl px-4 py-3 text-left transition-all group">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-orange-500/10 flex items-center justify-center shrink-0 transition-colors">
                <Icon name={t.icon} size={14} className="text-white/30 group-hover:text-orange-400 transition-colors" />
              </div>
              <span className="text-white/50 group-hover:text-white/80 text-xs transition-colors">{t.q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export function PanelReviews({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Heart" title="Отзывы клиентов" onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <SharedPanelReviews />
      </div>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
export function PanelFaq({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="HelpCircle" title="Частые вопросы" onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <SharedPanelFaq />
      </div>
    </div>
  );
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export function PanelContacts({ onClose, onPanel }: { onClose: () => void; onPanel?: (p: string) => void }) {
  const { brand } = useBrand();
  const [name, setName] = useState("");
  const { phone, setPhone, handleChange: handlePhone, handleFocus: focusPhone, handleBlur: blurPhone, isValid: phoneValid } = usePhone("+7 (");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const contactItems = [
    { icon: "Phone",         label: "Телефон",      val: brand.support_phone,                  href: `tel:${(brand.support_phone || "").replace(/\D/g, "")}` },
    { icon: "Send",          label: "Telegram",     val: "Написать в Telegram",                href: brand.telegram_url },
    { icon: "MessageSquare", label: "MAX",          val: "Написать в MAX",                     href: brand.max_url },
    { icon: "MessageCircle", label: "Чат на сайте", val: "Написать менеджеру",                 href: "#livechat" },
    { icon: "MapPin",        label: "Адрес",        val: brand.pdf_footer_address || brand.company_name || "—", href: "#" },
    { icon: "Clock",         label: "Часы",         val: brand.working_hours,                  href: "#" },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phoneValid) return;
    setLoading(true);
    fetch(`${LIVE_CHAT_URL}?action=booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, comment: msg }),
    }).finally(() => { setLoading(false); setSent(true); });
  };

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Phone" title="Контакты" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        {sent ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Icon name="CheckCircle" size={28} className="text-orange-400" />
            </div>
            <div className="text-white font-semibold">Заявка отправлена!</div>
            <div className="text-white/40 text-sm">Перезвоним в течение 15 минут</div>
            <button onClick={() => { setSent(false); setName(""); setPhone(""); setMsg(""); }}
              className="mt-1 text-orange-400 text-xs hover:text-orange-300 underline">
              Отправить ещё
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              {contactItems.map((c, i) => {
                const isLiveChat = c.href === "#livechat";
                const Tag = isLiveChat ? "button" : "a";
                const extra = isLiveChat
                  ? { onClick: () => { onPanel?.("livechat"); } }
                  : { href: c.href, target: c.href.startsWith("http") ? "_blank" : undefined, rel: "noreferrer" };
                return (
                  <Tag key={i} {...(extra as object)}
                    className="flex items-start gap-2.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-orange-500/20 rounded-xl p-3 transition-all group text-left w-full">
                    <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Icon name={c.icon} size={13} className="text-orange-400" />
                    </div>
                    <div>
                      <div className="text-white/30 text-[9px] uppercase tracking-wider">{c.label}</div>
                      <div className="text-white text-[11px] font-medium mt-0.5 group-hover:text-orange-300 transition-colors">{c.val}</div>
                    </div>
                  </Tag>
                );
              })}
            </div>
            <form onSubmit={submit} className="space-y-2.5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Обратная связь</div>
              <div className="grid grid-cols-2 gap-2.5">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" required
                  className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20" />
                <input type="tel" value={phone} onChange={handlePhone} onFocus={focusPhone} onBlur={blurPhone} placeholder="+7 (___) ___-__-__" required
                  className={`w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20 ${phone && !phoneValid ? "border-rose-500/60 focus:border-rose-500" : "border-white/[0.07] focus:border-orange-500/40"}`} />
              </div>
              {phone && !phoneValid && <p className="text-rose-400 text-[10px] -mt-1">Введите 10 цифр номера</p>}
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Комментарий (необязательно)" rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20 resize-none" />
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Icon name={loading ? "Loader" : "Send"} size={14} className={loading ? "animate-spin" : ""} />
                {loading ? "Отправляем..." : "Отправить заявку"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Other (Отзывы + AI-советы + FAQ) ─────────────────────────────────────────
export function PanelOther({ onClose, onPanel }: { onClose: () => void; onPanel: (p: Panel) => void }) {
  const ITEMS = [
    { id: "contacts" as Panel, icon: "Phone",      label: "Контакты",  desc: "Телефон, WhatsApp, Telegram, адрес" },
    { id: "reviews"  as Panel, icon: "Heart",      label: "Отзывы",    desc: "2800+ отзывов, рейтинг 4.9★"       },
    { id: "tips"     as Panel, icon: "Sparkles",   label: "AI-советы", desc: "Умные подсказки для расчёта"       },
    { id: "faq"      as Panel, icon: "HelpCircle", label: "FAQ",       desc: "Частые вопросы о потолках"         },
  ];
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="LayoutGrid" title="Другое" onClose={onClose} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-5">
        {ITEMS.map((item) => (
          <button key={item.id} onClick={() => onPanel(item.id)}
            className="flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-orange-500/25 rounded-2xl px-4 py-4 transition-all group text-left w-full">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center shrink-0">
              <Icon name={item.icon} size={20} className="text-orange-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm group-hover:text-orange-300 transition-colors">{item.label}</div>
              <div className="text-white/40 text-xs mt-0.5">{item.desc}</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-white/20 ml-auto group-hover:text-orange-400 transition-colors" />
          </button>
        ))}
        <div className="mt-auto pt-4 flex justify-center">
          <a href="/company" target="_blank" rel="noopener noreferrer"
            className="text-white/10 hover:text-white/30 transition-colors p-2 rounded-lg">
            <Icon name="Settings" size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
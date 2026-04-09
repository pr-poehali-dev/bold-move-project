import { useState } from "react";
import Icon from "@/components/ui/icon";
import Lightbox from "@/components/ui/lightbox";
import { REVIEWS, FAQ, PRODUCTION } from "./data/content";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import { TIPS, CONTACTS, PROD_FEATURES, BOOKING_TIMES, Panel } from "./chatConfig";
import func2url from "@/../backend/func2url.json";

const LIVE_CHAT_URL = func2url["live-chat"];

export function PanelBooking({ onClose }: { onClose: () => void }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate]   = useState("");
  const [time, setTime]   = useState("");
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const minDate = new Date().toISOString().split("T")[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
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
      <PanelHeader icon="CalendarCheck" title="Заказать замер" onClose={onClose} />
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
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" required
                  className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20" />
              </div>

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
function PanelHeader({ icon, title, onClose }: { icon: string; title: string; onClose: () => void }) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={15} className="text-orange-400" />
        <span className="text-sm font-semibold text-white/80">{title}</span>
      </div>
      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
        <Icon name="X" size={16} />
      </button>
    </div>
  );
}

// ─── Production ───────────────────────────────────────────────────────────────
export function PanelProduction({ onClose }: { onClose: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const prodImages = PRODUCTION.map((item) => ({ src: item.img, alt: item.title }));

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Factory" title="Собственное производство" onClose={onClose} />
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
export function PanelPortfolio({ onClose }: { onClose: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const portfolioSlice = PORTFOLIO_ITEMS.slice(0, 12);
  const portImages = portfolioSlice.map((item) => ({ src: item.img, alt: `${item.room} · ${item.type}` }));

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Image" title="Наши работы" onClose={onClose} />
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {REVIEWS.slice(0, 5).map((r, i) => (
          <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/60 to-rose-500/60 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {r.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white font-medium text-xs">{r.name}</span>
                <span className="text-white/20 text-[10px]">{r.date}</span>
              </div>
              <div className="text-amber-400 text-[10px] mb-1.5">
                {"★".repeat(r.rating)} <span className="text-white/20 ml-1">{r.city}</span>
              </div>
              <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2">{r.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
export function PanelFaq({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="HelpCircle" title="Частые вопросы" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {FAQ.map((item, i) => (
          <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
              <span className="text-white text-xs font-medium">{item.q}</span>
              <Icon name={open === i ? "ChevronUp" : "ChevronDown"} size={14} className="text-white/25 shrink-0" />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-40" : "max-h-0"}`}>
              <p className="px-4 pb-3 text-white/35 text-[11px] leading-relaxed">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export function PanelContacts({ onClose, onPanel }: { onClose: () => void; onPanel?: (p: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setSent(true);
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
              {CONTACTS.map((c, i) => {
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
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" required
                  className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20" />
              </div>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Комментарий (необязательно)" rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20 resize-none" />
              <button type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]">
                Отправить заявку
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
      </div>
    </div>
  );
}
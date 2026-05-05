import { useState } from "react";
import { usePhone } from "@/hooks/use-phone";
import Icon from "@/components/ui/icon";
import { BOOKING_TIMES } from "../chatConfig";
import { useBrand } from "@/context/BrandContext";
import { PanelHeader } from "./PanelHeader";
import func2url from "@/../backend/func2url.json";

const LIVE_CHAT_URL = func2url["live-chat"];

export function PanelBooking({ onClose, onEdit }: { onClose: () => void; onEdit?: () => void }) {
  const [name, setName] = useState("");
  const { phone, setPhone, handleChange: handlePhone, handleFocus: focusPhone, handleBlur: blurPhone, isValid: phoneValid } = usePhone("+7 (");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [sent, setSent] = useState(false);
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
    }).finally(() => { setLoading(false); setSent(true); });
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
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "Ruler",      label: "Точные замеры" },
                { icon: "Box",        label: "3D-визуализация" },
                { icon: "BadgeCheck", label: "Бесплатно" },
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

export function PanelContacts({ onClose, onPanel }: { onClose: () => void; onPanel?: (p: string) => void }) {
  const { brand } = useBrand();
  const [name, setName] = useState("");
  const { phone, setPhone, handleChange: handlePhone, handleFocus: focusPhone, handleBlur: blurPhone, isValid: phoneValid } = usePhone("+7 (");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const contactItems = [
    { icon: "Phone",         label: "Телефон",      val: brand.support_phone,                                  href: `tel:${(brand.support_phone || "").replace(/\D/g, "")}` },
    { icon: "Send",          label: "Telegram",     val: "Написать в Telegram",                                href: brand.telegram_url },
    { icon: "MessageSquare", label: "MAX",          val: "Написать в MAX",                                     href: brand.max_url },
    { icon: "MessageCircle", label: "Чат на сайте", val: "Написать менеджеру",                                 href: "#livechat" },
    { icon: "MapPin",        label: "Адрес",        val: brand.pdf_footer_address || brand.company_name || "—", href: "#" },
    { icon: "Clock",         label: "Часы",         val: brand.working_hours,                                  href: "#" },
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

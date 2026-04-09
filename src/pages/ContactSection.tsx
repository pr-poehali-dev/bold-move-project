import Icon from "@/components/ui/icon";
import { CITIES } from "./data";
import func2url from "@/../backend/func2url.json";
import { formatPhone, isPhoneValid } from "@/hooks/use-phone";

const LIVE_CHAT_URL = func2url["live-chat"];

interface Props {
  citiesRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
  contactRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  sent: boolean;
  setSent: (v: boolean) => void;
}

export default function ContactSection({
  citiesRef, contactRef,
  name, setName, phone, setPhone, comment, setComment, sent, setSent,
}: Props) {
  return (
    <>
      {/* ─── CITIES ─── */}
      <section className="py-12 md:py-16 border-y border-white/5">
        <div ref={citiesRef.ref} className="max-w-7xl mx-auto px-4">
          <div className={`transition-all duration-700 ${citiesRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-white/40 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-3">
                <div className="w-6 h-px bg-white/20" />Работаем по всей Москве и области<div className="w-6 h-px bg-white/20" />
              </div>
              <p className="text-white/35 text-sm">Бесплатный выезд замерщика в радиусе 30 км от МКАД</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {CITIES.map((city, i) => (
                <div key={i} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/8 bg-white/3 text-white/50 text-sm hover:border-orange-500/30 hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer">
                  <Icon name="MapPin" size={12} className="text-orange-400" />{city}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section id="contact" className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(234,88,12,0.12),transparent)]" />
        <div ref={contactRef.ref} className="relative max-w-7xl mx-auto px-4">
          <div className={`mb-10 text-center transition-all duration-700 ${contactRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Бесплатный замер<div className="w-8 h-px bg-orange-400" />
            </div>
            <h2 className="font-montserrat font-black text-3xl md:text-5xl mb-3">Получите расчёт за 15 минут</h2>
            <p className="text-white/40 text-base">Замерщик приедет на следующий день. Расчёт и 3D-визуализация — бесплатно.</p>
          </div>
          <div className={`grid grid-cols-1 lg:grid-cols-5 gap-8 transition-all duration-700 delay-200 ${contactRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="lg:col-span-2 space-y-5">
              {[
                { icon: "Phone", title: "Телефон", val: "+7 (977) 606-89-01", sub: "Ежедневно 8:00–22:00", href: "tel:+79776068901" },
                { icon: "MessageCircle", title: "WhatsApp", val: "Написать в WhatsApp", sub: "Отвечаем за 5 минут", href: "https://wa.me/79776068901" },
                { icon: "MapPin", title: "Адрес", val: "Мытищи, Пограничная 24", sub: "Выезд бесплатный до 30 км от МКАД", href: "#" },
              ].map((item, i) => (
                <a key={i} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3 hover:border-orange-500/25 hover:bg-white/5 transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500/25 to-rose-500/15 border border-orange-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Icon name={item.icon} size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <div className="text-white/40 text-xs">{item.title}</div>
                    <div className="font-montserrat font-bold text-sm text-white">{item.val}</div>
                    <div className="text-white/35 text-xs">{item.sub}</div>
                  </div>
                </a>
              ))}
              <div className="p-4 rounded-2xl border border-white/6 bg-white/2">
                <div className="text-white/40 text-xs font-montserrat uppercase tracking-widest mb-3">Наши гарантии</div>
                <div className="space-y-2">
                  {["Договор с фиксированной ценой", "Гарантийный талон на 12 лет", "Бесплатный выезд при гарантийном случае", "Возврат предоплаты если не понравится"].map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-white/55 text-xs">
                      <Icon name="CheckCircle" size={13} className="text-orange-400 shrink-0" />{g}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/15 to-violet-500/15 rounded-3xl blur-xl" />
              <div className="relative p-5 md:p-8 rounded-3xl border border-white/10 bg-[#08080d]/90 backdrop-blur">
                {sent ? (
                  <div className="text-center py-10">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-orange-500/30 animate-scale-in">
                      <Icon name="Check" size={36} className="text-white" />
                    </div>
                    <h3 className="font-montserrat font-black text-2xl mb-2">Заявка принята!</h3>
                    <p className="text-white/50">Перезвоним вам в течение 15 минут.<br />Или звоните сами: <a href="tel:+79776068901" className="text-orange-400 font-semibold">+7 (977) 606-89-01</a></p>
                  </div>
                ) : (
                  <form onSubmit={e => {
                    e.preventDefault();
                    if (!isPhoneValid(phone)) return;
                    fetch(`${LIVE_CHAT_URL}?action=booking`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, phone, date: "", time: "", comment }),
                    }).finally(() => setSent(true));
                  }} className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-montserrat font-black text-xl">Оставить заявку</h3>
                      <div className="flex items-center gap-1.5 text-green-400 text-xs font-montserrat font-semibold">
                        <span className="w-2 h-2 bg-green-400 rounded-full" />Скидка 10% онлайн
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/40 text-[11px] font-montserrat uppercase tracking-widest mb-2">Ваше имя</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван" required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/7 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-white/40 text-[11px] font-montserrat uppercase tracking-widest mb-2">Телефон</label>
                        <input type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="+7 (___) ___-__-__" required
                          className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:bg-white/7 transition-all text-sm ${phone && !isPhoneValid(phone) ? "border-rose-500/60 focus:border-rose-500" : "border-white/10 focus:border-orange-500/50"}`} />
                        {phone && !isPhoneValid(phone) && <p className="text-rose-400 text-[11px] mt-1">Введите 10 цифр номера</p>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-white/40 text-[11px] font-montserrat uppercase tracking-widest mb-2">Комментарий (необязательно)</label>
                      <textarea value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="Опишите задачу: кол-во комнат, площадь, предпочтения..." rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/7 transition-all text-sm resize-none" />
                    </div>
                    <button type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-black py-4 rounded-xl text-base hover:scale-[1.02] transition-transform shadow-xl shadow-orange-500/25">
                      Вызвать замерщика бесплатно →
                    </button>
                    <p className="text-white/20 text-[11px] text-center leading-relaxed">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности. Перезвоним в течение 15 минут.</p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-rose-600 flex items-center justify-center">
              <span className="text-white font-montserrat font-black text-xs">R</span>
            </div>
            <div>
              <span className="font-montserrat font-bold text-sm">MOS<span className="text-orange-400">POTOLKI</span></span>
              <div className="text-white/25 text-[11px]">Натяжные потолки с 2009 года</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-5 text-white/30 text-xs">
            {[["#catalog", "Каталог"], ["#calc", "Калькулятор"], ["#portfolio", "Портфолио"], ["#reviews", "Отзывы"], ["#contact", "Контакты"]].map(([h, l]) => (
              <a key={h} href={h} className="hover:text-white/60 transition-colors">{l}</a>
            ))}
          </div>
          <a href="tel:+79776068901" className="font-montserrat font-bold text-white/60 hover:text-orange-400 transition-colors text-sm">+7 (977) 606-89-01</a>
        </div>
        <div className="text-center text-white/15 text-[11px] mt-6">© 2009–2026 MOSPOTOLKI · Натяжные потолки в Москве и МО · Мытищи, Пограничная 24</div>
      </footer>
    </>
  );
}
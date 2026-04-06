import { useState } from "react";
import Icon from "@/components/ui/icon";
import { PORTFOLIO_ITEMS, PORTFOLIO_TABS, REVIEWS, FAQ, CITIES } from "./data";

type InViewResult = { ref: React.RefObject<HTMLDivElement>; inView: boolean };

interface Props {
  portfolioRef: InViewResult;
  reviewsRef: InViewResult;
  faqRef: InViewResult;
  citiesRef: InViewResult;
  contactRef: InViewResult;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  sent: boolean;
  setSent: (v: boolean) => void;
}

export default function SectionsBottom({
  portfolioRef, reviewsRef, faqRef, citiesRef, contactRef,
  name, setName, phone, setPhone, comment, setComment, sent, setSent,
}: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "living" | "bedroom" | "kitchen" | "design">("all");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const filteredPortfolio = activeTab === "all" ? PORTFOLIO_ITEMS : PORTFOLIO_ITEMS.filter(p => p.tab === activeTab);

  return (
    <>
      {/* ─── PORTFOLIO ─── */}
      <section id="portfolio" className="py-24 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div ref={portfolioRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`flex flex-wrap items-end justify-between gap-6 mb-10 transition-all duration-700 ${portfolioRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div>
              <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
                <div className="w-8 h-px bg-violet-400" />Портфолио
              </div>
              <h2 className="font-montserrat font-black text-4xl md:text-5xl">
                Наши реальные работы<br /><span className="text-white/30">фото с объектов</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PORTFOLIO_TABS) as [string, string][]).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-2 rounded-xl text-xs font-montserrat font-semibold transition-all ${activeTab === tab ? "bg-orange-500 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPortfolio.map((p, i) => (
              <div key={`${activeTab}-${i}`}
                onClick={() => setLightboxImg(p.img)}
                className={`relative rounded-2xl overflow-hidden group cursor-pointer transition-all duration-500 ${portfolioRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${Math.min(i, 7) * 55}ms`, aspectRatio: "4/3" }}>
                <img
                  src={p.img}
                  alt={`${p.room} — ${p.type}, ${p.district}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-108"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex flex-col justify-end p-3.5">
                  <div className="font-montserrat font-bold text-[13px] leading-snug text-white drop-shadow">{p.room}</div>
                  <div className="text-white/65 text-[11px] leading-tight">{p.type}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1 text-white/45 text-[10px]">
                      <Icon name="MapPin" size={9} className="text-orange-400" />{p.district}
                    </div>
                    <div className="text-[10px] font-montserrat font-black text-orange-400">{p.area} м²</div>
                  </div>
                </div>
                <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="ZoomIn" size={14} className="text-white" />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <a href="#contact" className="inline-flex items-center gap-2 border border-white/12 text-white/50 font-montserrat font-semibold px-6 py-3 rounded-2xl hover:bg-white/5 hover:text-white transition-all text-sm">
              Обсудить ваш проект <Icon name="ArrowRight" size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ─── LIGHTBOX ─── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxImg(null)}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            onClick={() => setLightboxImg(null)}
          >
            <Icon name="X" size={20} className="text-white" />
          </button>
          <img
            src={lightboxImg}
            alt="Фото работы"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ─── REVIEWS ─── */}
      <section id="reviews" className="py-24">
        <div ref={reviewsRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`flex flex-wrap items-end justify-between gap-6 mb-12 transition-all duration-700 ${reviewsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div>
              <div className="inline-flex items-center gap-2 text-rose-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
                <div className="w-8 h-px bg-rose-400" />Отзывы клиентов
              </div>
              <h2 className="font-montserrat font-black text-4xl md:text-5xl">
                Реальные отзывы<br /><span className="text-white/30">с Яндекс.Карт и 2ГИС</span>
              </h2>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3">
              <div>
                <div className="font-montserrat font-black text-4xl text-orange-400">4.9</div>
                <div className="flex gap-0.5 mt-1">{"★★★★★".split("").map((s, i) => <span key={i} className="text-orange-400 text-sm">{s}</span>)}</div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Средняя оценка</div>
                <div className="text-white/40 text-xs">на основе 2 800+ отзывов</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] bg-white/8 px-2 py-0.5 rounded-full text-white/40">Яндекс 4.9★</span>
                  <span className="text-[10px] bg-white/8 px-2 py-0.5 rounded-full text-white/40">2ГИС 4.8★</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <div key={i}
                className={`p-6 rounded-3xl border border-white/7 bg-white/2 hover:border-rose-500/20 hover:bg-white/4 transition-all duration-300 ${reviewsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 80}ms`, transitionProperty: "opacity, transform, border, background" }}>
                <div className="flex gap-0.5 mb-3">{"★★★★★".split("").map((s, j) => <span key={j} className="text-orange-400">{s}</span>)}</div>
                <p className="text-white/65 text-sm leading-relaxed mb-5 italic">"{r.text}"</p>
                <div className="pt-4 border-t border-white/6 flex items-center justify-between">
                  <div>
                    <div className="font-montserrat font-bold text-sm">{r.name}</div>
                    <div className="text-white/35 text-xs">{r.city} · {r.type} · {r.area} м²</div>
                  </div>
                  <div className="text-white/25 text-[11px] shrink-0">{r.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 bg-gradient-to-b from-transparent via-white/2 to-transparent">
        <div ref={faqRef.ref} className="max-w-4xl mx-auto px-5">
          <div className={`mb-12 text-center transition-all duration-700 ${faqRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Частые вопросы<div className="w-8 h-px bg-orange-400" />
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              Отвечаем на<br /><span className="text-white/30">ваши вопросы</span>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={i}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${activeFaq === i ? "border-orange-500/30 bg-orange-500/5" : "border-white/7 bg-white/2 hover:border-white/15"} ${faqRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${i * 60}ms` }}>
                <button className="w-full flex items-center justify-between p-5 text-left gap-4" onClick={() => setActiveFaq(activeFaq === i ? null : i)}>
                  <span className="font-montserrat font-semibold text-sm text-white/85">{f.q}</span>
                  <div className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${activeFaq === i ? "bg-orange-500 border-orange-500 rotate-45" : "border-white/15 bg-white/5"}`}>
                    <Icon name="Plus" size={14} className="text-white" />
                  </div>
                </button>
                {activeFaq === i && (
                  <div className="px-5 pb-5 text-white/50 text-sm leading-relaxed border-t border-white/6 pt-4 animate-fade-in">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CITIES ─── */}
      <section className="py-16 border-y border-white/5">
        <div ref={citiesRef.ref} className="max-w-7xl mx-auto px-5">
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
      <section id="contact" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(234,88,12,0.12),transparent)]" />
        <div ref={contactRef.ref} className="relative max-w-7xl mx-auto px-5">
          <div className={`mb-12 text-center transition-all duration-700 ${contactRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Бесплатный замер<div className="w-8 h-px bg-orange-400" />
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-3">Получите расчёт за 15 минут</h2>
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
              <div className="relative p-8 rounded-3xl border border-white/10 bg-[#08080d]/90 backdrop-blur">
                {sent ? (
                  <div className="text-center py-10">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-orange-500/30 animate-scale-in">
                      <Icon name="Check" size={36} className="text-white" />
                    </div>
                    <h3 className="font-montserrat font-black text-2xl mb-2">Заявка принята!</h3>
                    <p className="text-white/50">Перезвоним вам в течение 15 минут.<br />Или звоните сами: <a href="tel:+79776068901" className="text-orange-400 font-semibold">+7 (977) 606-89-01</a></p>
                  </div>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-montserrat font-black text-xl">Оставить заявку</h3>
                      <div className="flex items-center gap-1.5 text-green-400 text-xs font-montserrat font-semibold">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />Скидка 10% онлайн
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
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/7 transition-all text-sm" />
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

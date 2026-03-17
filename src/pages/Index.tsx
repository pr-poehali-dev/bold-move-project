import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const HERO_IMAGE = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/288b66f2-3117-4db9-b68d-ed2a82546b57.jpg";
const PORTFOLIO_IMAGE = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/77e31ffd-dcc5-4978-845c-35ecd8030c5e.jpg";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

const services = [
  { icon: "Sparkles", title: "Глянцевые потолки", desc: "Эффект зеркального отражения, визуально увеличивает пространство", price: "от 299 ₽/м²" },
  { icon: "Cloud", title: "Матовые потолки", desc: "Классическое решение, скрывает неровности перекрытий", price: "от 249 ₽/м²" },
  { icon: "Star", title: "Звёздное небо", desc: "Оптоволоконная подсветка — романтика каждый вечер", price: "от 1 200 ₽/м²" },
  { icon: "Layers", title: "Многоуровневые", desc: "Сложные конструкции любой формы и конфигурации", price: "от 499 ₽/м²" },
  { icon: "Zap", title: "Тканевые потолки", desc: "Экологичный материал, пропускает воздух, не боится влаги", price: "от 399 ₽/м²" },
  { icon: "Home", title: "Рисунки и фотопечать", desc: "Индивидуальный принт на потолке по вашему эскизу", price: "от 699 ₽/м²" },
];

const advantages = [
  { icon: "Clock", num: "1", unit: "день", label: "Установка за 1 день без грязи и пыли" },
  { icon: "Shield", num: "12", unit: "лет", label: "Гарантия на все виды работ" },
  { icon: "Users", num: "15 000+", unit: "", label: "Довольных клиентов по Москве и МО" },
  { icon: "Ruler", num: "0 ₽", unit: "", label: "Бесплатный замер и визуализация" },
];

const portfolio = [
  { room: "Гостиная", type: "Глянец белый", area: "28 м²", color: "from-blue-900 to-indigo-800" },
  { room: "Спальня", type: "Звёздное небо", area: "18 м²", color: "from-violet-900 to-purple-800" },
  { room: "Кухня", type: "Матовый бежевый", area: "12 м²", color: "from-amber-800 to-orange-700" },
  { room: "Детская", type: "Фотопечать", area: "14 м²", color: "from-cyan-800 to-teal-700" },
];

const reviews = [
  { name: "Анна К.", city: "Москва, Выхино", text: "Всё сделали за один день! Мастера аккуратные, убрали за собой. Потолок — просто сказка, глянцевый, отражает свет. Рекомендую!", rating: 5, date: "Февраль 2026" },
  { name: "Дмитрий М.", city: "Домодедово", text: "Заказывал звёздное небо в спальню. Результат превзошёл ожидания. Цена адекватная, работа качественная, всё в срок.", rating: 5, date: "Январь 2026" },
  { name: "Светлана П.", city: "Красногорск", text: "Делали потолки во всей квартире — 4 комнаты. Всё чисто, быстро, без запаха. Дали хорошую скидку за объём. Спасибо!", rating: 5, date: "Март 2026" },
];

export default function Index() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const heroSection = useInView(0.1);
  const advantagesSection = useInView(0.1);
  const servicesSection = useInView(0.1);
  const portfolioSection = useInView(0.1);
  const reviewsSection = useInView(0.1);
  const contactSection = useInView(0.1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="font-rubik bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* HEADER */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 60 ? "bg-[#0a0a0f]/95 backdrop-blur-md shadow-lg shadow-black/30 py-3" : "py-5"}`}>
        <div className="container max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
              <span className="text-white font-montserrat font-black text-sm">R</span>
            </div>
            <span className="font-montserrat font-bold text-lg tracking-wide">РУМ<span className="text-orange-400">ЭКСПЕРТ</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70 font-rubik">
            <a href="#services" className="hover:text-orange-400 transition-colors">Услуги</a>
            <a href="#portfolio" className="hover:text-orange-400 transition-colors">Портфолио</a>
            <a href="#reviews" className="hover:text-orange-400 transition-colors">Отзывы</a>
            <a href="#contact" className="hover:text-orange-400 transition-colors">Контакты</a>
          </nav>
          <a href="tel:+74951350036" className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-montserrat font-semibold px-4 py-2 rounded-full hover:scale-105 transition-transform animate-pulse-glow">
            <Icon name="Phone" size={14} />
            +7 (495) 135-00-36
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0">
          <img src={HERO_IMAGE} alt="Натяжной потолок" className="w-full h-full object-cover opacity-30" style={{ transform: `translateY(${scrollY * 0.3}px)` }} />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0a0a0f]/80 to-violet-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
        </div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-violet-500/15 rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: "1.5s" }} />

        <div ref={heroSection.ref} className="relative container max-w-6xl mx-auto px-6 py-20">
          <div className={`max-w-3xl transition-all duration-1000 ${heroSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-sm text-orange-300 mb-6">
              <Icon name="Zap" size={14} />
              Установка за 1 день · Бесплатный замер
            </div>
            <h1 className="font-montserrat font-black text-5xl md:text-7xl leading-none mb-6">
              Натяжные<br />
              <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-violet-400 bg-clip-text text-transparent">
                потолки
              </span>
              <br />под ключ
            </h1>
            <p className="text-white/60 text-lg md:text-xl mb-8 leading-relaxed max-w-xl font-rubik font-light">
              Производство и монтаж в Москве и МО. Более 15 000 реализованных проектов. Гарантия 12 лет.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#contact" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-bold px-8 py-4 rounded-2xl text-lg hover:scale-105 transition-transform shadow-lg shadow-orange-500/30 animate-pulse-glow">
                Получить расчёт
                <Icon name="ArrowRight" size={20} />
              </a>
              <a href="tel:+74951350036" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-montserrat font-semibold px-8 py-4 rounded-2xl text-lg hover:bg-white/10 transition-colors backdrop-blur">
                <Icon name="Phone" size={20} />
                Позвонить
              </a>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs">
          <span>листайте</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="py-16 border-y border-white/5 bg-gradient-to-r from-violet-950/20 via-transparent to-orange-950/20">
        <div ref={advantagesSection.ref} className="container max-w-6xl mx-auto px-6">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 transition-all duration-700 ${advantagesSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            {advantages.map((a, i) => (
              <div key={i} className="text-center group" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/20 mb-3 group-hover:scale-110 transition-transform">
                  <Icon name={a.icon} size={22} className="text-orange-400" />
                </div>
                <div className="font-montserrat font-black text-3xl text-white">{a.num}<span className="text-orange-400 text-xl ml-1">{a.unit}</span></div>
                <div className="text-white/50 text-sm mt-1 leading-snug">{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-24">
        <div ref={servicesSection.ref} className="container max-w-6xl mx-auto px-6">
          <div className={`mb-14 transition-all duration-700 ${servicesSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-sm font-montserrat font-semibold uppercase tracking-widest mb-4">
              <div className="w-8 h-px bg-orange-400" />
              Наши услуги
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              Любой потолок —<br /><span className="text-white/40">любая комната</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-3xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer ${servicesSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 80}ms`, transitionProperty: "opacity, transform, background, border" }}
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-500/0 to-violet-500/0 group-hover:from-orange-500/5 group-hover:to-violet-500/5 transition-all duration-300" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/10 border border-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon name={s.icon} size={22} className="text-orange-400" />
                  </div>
                  <h3 className="font-montserrat font-bold text-lg mb-2">{s.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed mb-4">{s.desc}</p>
                  <div className="font-montserrat font-black text-orange-400 text-xl">{s.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFOLIO */}
      <section id="portfolio" className="py-24 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div ref={portfolioSection.ref} className="container max-w-6xl mx-auto px-6">
          <div className={`mb-14 transition-all duration-700 ${portfolioSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-violet-400 text-sm font-montserrat font-semibold uppercase tracking-widest mb-4">
              <div className="w-8 h-px bg-violet-400" />
              Портфолио
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              Примеры<br /><span className="text-white/40">наших работ</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className={`relative rounded-3xl overflow-hidden h-72 transition-all duration-700 ${portfolioSection.inView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
              <img src={PORTFOLIO_IMAGE} alt="Портфолио натяжных потолков" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6">
                <div className="text-white/60 text-sm mb-1">Разные дизайны</div>
                <div className="font-montserrat font-bold text-xl">Более 50 вариантов</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {portfolio.map((p, i) => (
                <div
                  key={i}
                  className={`relative rounded-2xl overflow-hidden h-32 group cursor-pointer transition-all duration-500 ${portfolioSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                  style={{ transitionDelay: `${i * 100 + 200}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 flex flex-col justify-end p-3">
                    <div className="text-white/70 text-xs">{p.type}</div>
                    <div className="font-montserrat font-bold text-sm">{p.room}</div>
                    <div className="text-white/50 text-xs">{p.area}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <a href="#contact" className="inline-flex items-center gap-2 border border-white/15 text-white/70 font-montserrat font-semibold px-6 py-3 rounded-2xl hover:bg-white/5 hover:text-white transition-all">
              Смотреть все работы
              <Icon name="ArrowRight" size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="py-24">
        <div ref={reviewsSection.ref} className="container max-w-6xl mx-auto px-6">
          <div className={`mb-14 transition-all duration-700 ${reviewsSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-rose-400 text-sm font-montserrat font-semibold uppercase tracking-widest mb-4">
              <div className="w-8 h-px bg-rose-400" />
              Отзывы
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              Что говорят<br /><span className="text-white/40">наши клиенты</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reviews.map((r, i) => (
              <div
                key={i}
                className={`p-6 rounded-3xl border border-white/8 bg-white/3 hover:border-rose-500/20 transition-all duration-300 ${reviewsSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 120}ms`, transitionProperty: "opacity, transform, border" }}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <span key={j} className="text-orange-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-5 italic">"{r.text}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-montserrat font-bold text-sm">{r.name}</div>
                    <div className="text-white/40 text-xs">{r.city}</div>
                  </div>
                  <div className="text-white/30 text-xs">{r.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/30 via-transparent to-violet-950/30" />
        <div ref={contactSection.ref} className="relative container max-w-6xl mx-auto px-6">
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${contactSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div>
              <div className="inline-flex items-center gap-2 text-orange-400 text-sm font-montserrat font-semibold uppercase tracking-widest mb-4">
                <div className="w-8 h-px bg-orange-400" />
                Бесплатный замер
              </div>
              <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-6">
                Получите расчёт<br /><span className="bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">за 15 минут</span>
              </h2>
              <div className="space-y-4 mb-8">
                {[
                  "Бесплатный замер на следующий день",
                  "3D-визуализация вашего потолка",
                  "Фиксированная цена без доплат",
                  "Гарантия 12 лет письменно",
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 text-white/70">
                    <Icon name="CheckCircle" size={18} className="text-orange-400 shrink-0" />
                    <span className="text-sm">{text}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 w-fit">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
                  <Icon name="Phone" size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-white/50 text-xs">Звоните прямо сейчас</div>
                  <a href="tel:+74951350036" className="font-montserrat font-bold text-white hover:text-orange-400 transition-colors">+7 (495) 135-00-36</a>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-violet-500/20 rounded-3xl blur-xl" />
              <div className="relative p-8 rounded-3xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur">
                {sent ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mx-auto mb-4 animate-scale-in">
                      <Icon name="Check" size={30} className="text-white" />
                    </div>
                    <h3 className="font-montserrat font-bold text-xl mb-2">Заявка принята!</h3>
                    <p className="text-white/50 text-sm">Перезвоним вам в течение 15 минут</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="font-montserrat font-bold text-xl mb-6">Оставить заявку</h3>
                    <div>
                      <label className="block text-white/50 text-xs mb-2 font-montserrat uppercase tracking-wide">Ваше имя</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Иван Иванов"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 text-xs mb-2 font-montserrat uppercase tracking-wide">Телефон</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+7 (___) ___-__-__"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors text-sm"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-bold py-4 rounded-xl text-base hover:scale-[1.02] transition-transform shadow-lg shadow-orange-500/30 mt-2"
                    >
                      Рассчитать стоимость
                    </button>
                    <p className="text-white/25 text-xs text-center">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности</p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10">
        <div className="container max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
              <span className="text-white font-montserrat font-black text-xs">R</span>
            </div>
            <span className="font-montserrat font-bold text-sm">РУМ<span className="text-orange-400">ЭКСПЕРТ</span></span>
          </div>
          <div className="text-white/30 text-xs text-center">
            Натяжные потолки в Москве и МО · © 2026 РУМЭКСПЕРТ
          </div>
          <a href="tel:+74951350036" className="text-white/50 text-sm hover:text-orange-400 transition-colors font-montserrat font-semibold">
            +7 (495) 135-00-36
          </a>
        </div>
      </footer>
    </div>
  );
}

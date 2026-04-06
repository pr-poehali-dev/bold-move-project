import Icon from "@/components/ui/icon";
import CalculatorWidget from "./CalculatorWidget";
import { CATALOG, STATS, PROCESS } from "./data";

type InViewResult = { ref: React.RefObject<HTMLDivElement>; inView: boolean };

interface Props {
  scrollY: number;
  statsRef: InViewResult;
  heroRef: InViewResult;
  catalogRef: InViewResult;
  calcRef: InViewResult;
  processRef: InViewResult;
}

export default function SectionsTop({ scrollY, heroRef, statsRef, catalogRef, calcRef, processRef }: Props) {
  return (
    <>
      {/* ─── HEADER ─── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 60 ? "bg-[#08080d]/96 backdrop-blur-xl shadow-2xl shadow-black/50 py-3" : "py-4"}`}>
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <span className="font-montserrat font-black text-white text-sm">R</span>
            </div>
            <div>
              <span className="font-montserrat font-black text-base tracking-wide">MOS<span className="text-orange-400">POTOLKI</span></span>
              <div className="text-[10px] text-white/30 leading-none hidden sm:block">Натяжные потолки с 2009 года</div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-7 text-sm text-white/60">
            {[["#catalog", "Каталог"], ["#calc", "Калькулятор"], ["#portfolio", "Портфолио"], ["#reviews", "Отзывы"], ["#faq", "FAQ"], ["#contact", "Контакты"]].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-orange-400 transition-colors font-medium">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors">
              <Icon name="MessageCircle" size={16} className="text-green-400" />
            </a>
            <a href="tel:+79776068901" className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-montserrat font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-orange-500/20 animate-pulse-glow">
              <Icon name="Phone" size={14} />
              <span className="hidden sm:inline">+7 (977) 606-89-01</span>
              <span className="sm:hidden">Звонок</span>
            </a>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[100svh] flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(234,88,12,0.18),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(139,92,246,0.1),transparent)]" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="absolute top-1/3 right-10 w-[480px] h-[480px] bg-orange-500/8 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-[320px] h-[320px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div ref={heroRef.ref} className="relative max-w-7xl mx-auto px-5 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
          <div className={`transition-all duration-1000 ${heroRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-300 rounded-full px-4 py-1.5 text-xs font-montserrat font-semibold mb-6 uppercase tracking-widest">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              Производитель №1 в Москве и МО
            </div>
            <h1 className="font-montserrat font-black text-5xl md:text-6xl xl:text-7xl leading-[0.95] mb-6">
              Натяжные<br />
              <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-violet-400 bg-clip-text text-transparent">потолки</span>
              <br />
              <span className="text-white/25 text-4xl md:text-5xl">от производителя</span>
            </h1>
            <p className="text-white/55 text-lg leading-relaxed mb-8 max-w-lg">
              15 лет устанавливаем натяжные потолки в Москве и области. Монтаж за 1 день, гарантия 12 лет. Бесплатный замер с 3D-визуализацией.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#contact" className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-bold px-7 py-4 rounded-2xl text-base hover:scale-105 transition-transform shadow-xl shadow-orange-500/25">
                Вызвать замерщика бесплатно <Icon name="ArrowRight" size={18} />
              </a>
              <a href="#calc" className="inline-flex items-center gap-2 border border-white/15 text-white/70 font-montserrat font-semibold px-6 py-4 rounded-2xl text-base hover:bg-white/8 hover:text-white transition-all">
                <Icon name="Calculator" size={18} /> Рассчитать цену
              </a>
            </div>
            <div className="flex flex-wrap gap-6">
              {[["15 000+", "проектов"], ["12 лет", "гарантия"], ["1 день", "монтаж"], ["0 ₽", "замер"]].map(([n, l]) => (
                <div key={n} className="flex flex-col">
                  <span className="font-montserrat font-black text-2xl text-orange-400">{n}</span>
                  <span className="text-white/40 text-xs">{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-1000 delay-300 ${heroRef.inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-violet-500/20 rounded-3xl blur-2xl" />
              <div className="relative bg-white/4 border border-white/10 rounded-3xl p-7 backdrop-blur">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-300 text-sm font-montserrat font-semibold">Акция: скидка 10% при заявке онлайн</span>
                </div>
                <div className="space-y-3 mb-6">
                  {[
                    ["Тканевые потолки", "от 399 ₽/м²", "Экология"],
                    ["Глянцевые потолки", "от 299 ₽/м²", "Хит"],
                    ["Матовые потолки", "от 249 ₽/м²", "Классика"],
                    ["Звёздное небо", "от 1200 ₽/м²", "Wow"],
                    ["Двухуровневые", "от 499 ₽/м²", "Дизайн"],
                    ["Фотопечать", "от 699 ₽/м²", "Уник."],
                  ].map(([n, price, tag]) => (
                    <div key={n} className="flex items-center justify-between py-2.5 border-b border-white/6 last:border-0 hover:bg-white/3 rounded-xl px-2 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                        <span className="text-white/80 text-sm font-medium">{n}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-montserrat font-semibold">{tag}</span>
                        <span className="font-montserrat font-black text-orange-400 text-sm">{price}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="tel:+79776068901" className="flex items-center justify-center gap-2 w-full bg-white/8 border border-white/15 text-white font-montserrat font-bold py-3 rounded-xl hover:bg-white/15 transition-colors text-sm">
                  <Icon name="Phone" size={16} className="text-orange-400" /> Позвонить: +7 (977) 606-89-01
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/25 text-xs">
          <span className="text-[10px] uppercase tracking-widest">листайте</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-14 border-y border-white/5 bg-gradient-to-r from-orange-950/20 via-transparent to-violet-950/15">
        <div ref={statsRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 transition-all duration-700 ${statsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            {STATS.map((s, i) => (
              <div key={i} className="text-center group" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/5 border border-white/8 mb-2 group-hover:border-orange-500/30 group-hover:bg-orange-500/10 transition-all">
                  <Icon name={s.icon} size={20} className="text-orange-400" />
                </div>
                <div className="font-montserrat font-black text-2xl text-white leading-none">{s.num}</div>
                <div className="text-white/40 text-[11px] mt-1 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CATALOG ─── */}
      <section id="catalog" className="py-24">
        <div ref={catalogRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`mb-14 transition-all duration-700 ${catalogRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Каталог потолков
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-3">
              8 видов натяжных потолков<br /><span className="text-white/30">с ценами от производителя</span>
            </h2>
            <p className="text-white/50 text-base max-w-xl">Все виды полотна у нас в наличии. Работаем с проверенными производителями Франции, Германии и России.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATALOG.map((c, i) => (
              <div key={c.id}
                className={`relative p-6 rounded-3xl border bg-white/2 hover:bg-white/5 transition-all duration-300 group cursor-pointer overflow-hidden ${c.popular ? "border-orange-500/40 shadow-lg shadow-orange-500/10" : "border-white/7 hover:border-orange-500/25"} ${catalogRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 50}ms`, transitionProperty: "opacity, transform, background, border" }}>
                {c.popular && <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-montserrat font-black px-2.5 py-1 rounded-full">Хит</div>}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br ${c.color} opacity-10 group-hover:opacity-20 transition-opacity blur-2xl pointer-events-none`} />
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <Icon name="Layers" size={20} className="text-white" />
                </div>
                <div className="text-white/40 text-[10px] font-montserrat font-semibold uppercase tracking-wider mb-1">{c.tag}</div>
                <h3 className="font-montserrat font-black text-lg mb-2">{c.name}</h3>
                <p className="text-white/45 text-xs leading-relaxed mb-4">{c.desc}</p>
                <div className="space-y-1 mb-4">
                  {c.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-2 text-white/55 text-xs">
                      <Icon name="Check" size={12} className="text-orange-400 shrink-0" />{f}
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-white/6">
                  <div className="font-montserrat font-black text-2xl text-orange-400">{c.price} <span className="text-sm text-white/30">₽/м²</span></div>
                  <div className="text-white/30 text-[10px]">с теплом: {c.priceHeat} ₽/м²</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CALCULATOR ─── */}
      <section id="calc" className="py-16 bg-gradient-to-b from-transparent via-white/2 to-transparent">
        <div ref={calcRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`mb-10 transition-all duration-700 ${calcRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Калькулятор
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              Узнайте стоимость<br /><span className="text-white/30">прямо сейчас</span>
            </h2>
          </div>
          <div className={`transition-all duration-700 delay-200 ${calcRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <CalculatorWidget />
          </div>
        </div>
      </section>

      {/* ─── PROCESS ─── */}
      <section className="py-24">
        <div ref={processRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`mb-14 transition-all duration-700 ${processRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-violet-400" />Как мы работаем
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              5 шагов от заявки<br /><span className="text-white/30">до готового потолка</span>
            </h2>
          </div>
          <div className="relative">
            <div className="absolute top-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent hidden lg:block" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {PROCESS.map((p, i) => (
                <div key={i}
                  className={`relative p-6 rounded-3xl border border-white/7 bg-white/2 hover:border-orange-500/25 hover:bg-white/4 transition-all duration-300 ${processRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/10 border border-orange-500/25 flex items-center justify-center mb-4 z-10">
                    <Icon name={p.icon} size={20} className="text-orange-400" />
                  </div>
                  <div className="font-montserrat font-black text-5xl text-white/5 absolute top-4 right-4 leading-none select-none">{p.step}</div>
                  <h3 className="font-montserrat font-bold text-sm mb-2 leading-snug">{p.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

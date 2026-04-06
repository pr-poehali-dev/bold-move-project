import Icon from "@/components/ui/icon";

interface Props {
  heroRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function HeroSection({ heroRef }: Props) {
  return (
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
  );
}

import { REVIEWS } from "./data";

interface Props {
  reviewsRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function ReviewsSection({ reviewsRef }: Props) {
  return (
    <section id="reviews" className="py-16 md:py-24">
      <div ref={reviewsRef.ref} className="max-w-7xl mx-auto px-4">
        <div className={`flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10 transition-all duration-700 ${reviewsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div>
            <div className="inline-flex items-center gap-2 text-rose-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-rose-400" />Отзывы клиентов
            </div>
            <h2 className="font-montserrat font-black text-3xl md:text-5xl">
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
  );
}
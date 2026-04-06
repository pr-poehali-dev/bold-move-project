import Icon from "@/components/ui/icon";
import { CATALOG } from "./data";

interface Props {
  catalogRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function CatalogSection({ catalogRef }: Props) {
  return (
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
  );
}

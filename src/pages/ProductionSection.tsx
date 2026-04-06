import Icon from "@/components/ui/icon";
import { PRODUCTION } from "./data";

interface Props {
  productionRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function ProductionSection({ productionRef }: Props) {
  return (
    <section className="py-24 bg-gradient-to-b from-transparent via-orange-950/10 to-transparent">
      <div ref={productionRef.ref} className="max-w-7xl mx-auto px-5">
        <div className={`mb-14 transition-all duration-700 ${productionRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
            <div className="w-8 h-px bg-orange-400" />Собственное производство
          </div>
          <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-3">
            Делаем потолки сами<br /><span className="text-white/30">от полотна до монтажа</span>
          </h2>
          <p className="text-white/50 text-base max-w-2xl">
            Полный цикл производства в Мытищах — раскрой, сварка, приварка гарпуна, контроль качества. Никаких посредников — поэтому цены ниже рыночных на 20–40%.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PRODUCTION.map((item, i) => (
            <div
              key={i}
              className={`group relative rounded-3xl overflow-hidden border border-white/7 hover:border-orange-500/25 transition-all duration-500 ${productionRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="aspect-[16/10] overflow-hidden">
                <img
                  src={item.img}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/25 border border-orange-500/30 flex items-center justify-center">
                    <Icon name="Factory" size={16} className="text-orange-400" />
                  </div>
                  <h3 className="font-montserrat font-black text-lg text-white">{item.title}</h3>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 transition-all duration-700 delay-300 ${productionRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          {[
            { icon: "Zap", label: "Плёнка MSD Premium", sub: "Европейское качество" },
            { icon: "Ruler", label: "Точность до 1 мм", sub: "ЧПУ-раскрой" },
            { icon: "ShieldCheck", label: "Сертификаты ISO", sub: "Безопасные материалы" },
            { icon: "Truck", label: "Доставка за 1 день", sub: "Своя логистика" },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-2xl border border-white/7 bg-white/2 hover:border-orange-500/20 hover:bg-white/4 transition-all text-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-3">
                <Icon name={item.icon} size={18} className="text-orange-400" />
              </div>
              <div className="font-montserrat font-bold text-sm mb-1">{item.label}</div>
              <div className="text-white/40 text-xs">{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

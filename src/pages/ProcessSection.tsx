import Icon from "@/components/ui/icon";
import { PROCESS } from "./data";

interface Props {
  processRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function ProcessSection({ processRef }: Props) {
  return (
    <section className="py-16 md:py-24">
      <div ref={processRef.ref} className="max-w-7xl mx-auto px-4">
        <div className={`mb-10 md:mb-14 transition-all duration-700 ${processRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
            <div className="w-8 h-px bg-violet-400" />Как мы работаем
          </div>
          <h2 className="font-montserrat font-black text-3xl md:text-5xl">
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
  );
}
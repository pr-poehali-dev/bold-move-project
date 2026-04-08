import Icon from "@/components/ui/icon";
import CalculatorWidget from "./CalculatorWidget";
import { STATS } from "./data";
import Header from "./Header";
import HeroSection from "./HeroSection";
import CatalogSection from "./CatalogSection";
import ProcessSection from "./ProcessSection";
import AiAssistant from "./AiAssistant";

type InViewResult = { ref: React.RefObject<HTMLDivElement>; inView: boolean };

interface Props {
  scrollY: number;
  statsRef: InViewResult;
  heroRef: InViewResult;
  catalogRef: InViewResult;
  calcRef: InViewResult;
  processRef: InViewResult;
  assistantRef: InViewResult;
}

export default function SectionsTop({ scrollY, heroRef, statsRef, catalogRef, calcRef, processRef, assistantRef }: Props) {
  return (
    <>
      <Header scrollY={scrollY} />
      <HeroSection heroRef={heroRef} />

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

      <AiAssistant assistantRef={assistantRef} />

      <CatalogSection catalogRef={catalogRef} />

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

      <ProcessSection processRef={processRef} />
    </>
  );
}
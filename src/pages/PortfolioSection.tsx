import { useState } from "react";
import Icon from "@/components/ui/icon";
import { PORTFOLIO_ITEMS, PORTFOLIO_TABS } from "./data";

interface Props {
  portfolioRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function PortfolioSection({ portfolioRef }: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "living" | "bedroom" | "kitchen" | "design">("all");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const filteredPortfolio = activeTab === "all" ? PORTFOLIO_ITEMS : PORTFOLIO_ITEMS.filter(p => p.tab === activeTab);

  return (
    <>
      {/* ─── PORTFOLIO ─── */}
      <section id="portfolio" className="py-16 md:py-24 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div ref={portfolioRef.ref} className="max-w-7xl mx-auto px-4">
          <div className={`flex flex-col gap-5 mb-8 transition-all duration-700 ${portfolioRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div>
              <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
                <div className="w-8 h-px bg-violet-400" />Портфолио
              </div>
              <h2 className="font-montserrat font-black text-3xl md:text-5xl">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
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
    </>
  );
}
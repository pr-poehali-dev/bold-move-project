import { useState, useEffect } from "react";
import { PROJECTS, ALL_SCREENSHOTS } from "../lbData";
import { ProjectCard, Lightbox } from "../lbAtoms";

export function LBPortfolio() {
  return (
    <section id="projects" className="py-8 sm:py-16 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
          Реальные продукты в продакшне
        </div>
        <h2 className="text-2xl sm:text-4xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Портфолио</h2>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
          Живые системы, которыми пользуются реальные компании
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PROJECTS.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
      </div>
    </section>
  );
}

const PREVIEW_COUNT = 6;

export function LBGallery() {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [tick, setTick] = useState(0);
  const allUrls = ALL_SCREENSHOTS.map(s => s.url);

  useEffect(() => {
    if (showAll) return;
    const t = setInterval(() => setTick(n => n + 1), 3000);
    return () => clearInterval(t);
  }, [showAll]);

  const previewIndices = Array.from({ length: PREVIEW_COUNT }, (_, i) =>
    (i + tick) % ALL_SCREENSHOTS.length
  );

  const visibleShots = showAll
    ? ALL_SCREENSHOTS.map((s, i) => ({ ...s, realIdx: i }))
    : previewIndices.map(i => ({ ...ALL_SCREENSHOTS[i], realIdx: i }));

  return (
    <section id="gallery" className="py-8 sm:py-16" style={{ background: "rgba(255,255,255,0.012)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-5 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#22d3ee" }}>
            Скриншоты всех проектов
          </div>
          <h2 className="text-2xl sm:text-4xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Галерея</h2>
          <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Нажмите — откроется на весь экран</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4">
          {visibleShots.map((shot, i) => (
            <button
              key={showAll ? shot.realIdx : `${tick}-${i}`}
              onClick={() => setLightboxIdx(shot.realIdx)}
              className="relative group rounded-xl overflow-hidden active:scale-95"
              style={{
                aspectRatio: "16/10",
                border: "1px solid rgba(255,255,255,0.07)",
                animation: showAll ? "none" : "fadeInGallery 0.5s ease forwards",
              }}
            >
              <img
                src={shot.url}
                alt={shot.caption}
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}>
                <span className="text-white text-lg mb-0.5">🔍</span>
                <span className="text-xs text-center px-1 font-medium hidden sm:block" style={{ color: "rgba(255,255,255,0.9)" }}>{shot.caption}</span>
              </div>
            </button>
          ))}
        </div>

        {!showAll && (
          <div className="text-center">
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95"
              style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#22d3ee" }}
            >
              Посмотреть все {ALL_SCREENSHOTS.length} скриншотов →
            </button>
          </div>
        )}

        {lightboxIdx !== null && (
          <Lightbox images={allUrls} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </div>

      <style>{`
        @keyframes fadeInGallery {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}

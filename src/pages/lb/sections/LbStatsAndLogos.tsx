import { STATS, TECH_LOGOS } from "../lbData";

export function LBStats() {
  return (
    <section className="py-6 sm:py-10 border-y" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl sm:text-4xl font-black mb-0.5" style={{ fontFamily: "Montserrat, sans-serif", background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </div>
              <div className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LBTechLogos() {
  const doubled = [...TECH_LOGOS, ...TECH_LOGOS];
  return (
    <div className="py-5 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
      <div className="flex gap-3 items-center" style={{ animation: "marquee 28s linear infinite", width: "max-content" }}>
        {doubled.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <span className="text-base leading-none">{t.icon}</span>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Montserrat, sans-serif" }}>{t.name}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

// ── Страница личного бренда — точка сборки ───────────────────────────────────
import { useState, useEffect } from "react";
import { StickyBar } from "./lb/lbAtoms";
import { LBHero, LBStats, LBPortfolio, LBStackAbout, LBExperience, LBProcess, LBCta } from "./lb/lbSections";

export default function LBPage() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background: "#080810", minHeight: "100dvh", color: "#fff", fontFamily: "Rubik, sans-serif" }}>
      <StickyBar />
      <LBHero heroVisible={heroVisible} />
      <LBStats />
      <LBPortfolio />
      <LBStackAbout />
      <LBExperience />
      <LBProcess />
      <LBCta />
      <div className="text-center py-8 text-xs" style={{ color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        Красноруцкий Евгений · CPO / AI-разработчик · 2026
      </div>
    </div>
  );
}

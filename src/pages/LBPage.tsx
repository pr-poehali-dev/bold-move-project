// ── Страница личного бренда — точка сборки ───────────────────────────────────
import { useState, useEffect } from "react";
import { NavBar, StickyBar } from "./lb/lbAtoms";
import { LBHero, LBStats, LBTechLogos, LBPortfolio, LBGallery, LBStackAbout, LBAnalytics, LBExperience, LBProcess, LBReviews, LBPricing, LBCta } from "./lb/lbSections";

export default function LBPage() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background: "#080810", minHeight: "100dvh", color: "#fff", fontFamily: "Rubik, sans-serif" }}>
      <NavBar />
      <StickyBar />
      <LBHero heroVisible={heroVisible} />
      <LBStats />
      <LBTechLogos />
      <LBPortfolio />
      <LBGallery />
      <LBAnalytics />
      <LBStackAbout />
      <LBExperience />
      <LBProcess />
      <LBReviews />
      <LBPricing />
      <LBCta />
      <div className="text-center py-8 text-xs" style={{ color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        Красноруцкий Евгений · AI-Архитектор бизнес-процессов · 2026
      </div>
    </div>
  );
}

// ── Верхние секции: Hero, Stats, TechLogos, Portfolio, Gallery ────────────────
import { useState } from "react";
import { PHOTO_URL, PROJECTS, STATS, TECH_LOGOS, ALL_SCREENSHOTS, TG_LINK, MAX_LINK } from "../lbData";
import { TypeWriter, GridBg, ProjectCard, Particles, Lightbox } from "../lbAtoms";

// ── Hero ──────────────────────────────────────────────────────────────────────
export function LBHero({ heroVisible }: { heroVisible: boolean }) {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
      <GridBg />
      <Particles />
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div className="transition-all duration-1000" style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateX(0)" : "translateX(-40px)" }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8b5cf6" }} />
              Open to work · Удалённо / Офис
            </div>

            <h1 className="text-4xl lg:text-6xl font-black leading-tight mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Красноруцкий<br />
              <span style={{ background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Евгений
              </span>
            </h1>

            {/* Акцент: архитектор */}
            <div className="mb-4 text-sm font-semibold tracking-widest uppercase" style={{ color: "#f97316", letterSpacing: "0.12em" }}>
              AI-Архитектор бизнес-решений
            </div>

            <div className="text-xl lg:text-2xl font-semibold mb-6" style={{ color: "rgba(255,255,255,0.7)", minHeight: 60 }}>
              <TypeWriter texts={[
                "Эксперт по автоматизации процессов",
                "API · RAG · NLP · ML · DevOps",
                "Строю продукты с нуля до прода",
                "CPO / AI Creator / Vibe-Coding",
              ]} />
            </div>

            {/* Теги-экспертиза */}
            <div className="flex flex-wrap gap-2 mb-5">
              {["API", "RAG", "NLP", "ML", "DevOps", "UI/UX", "LLM", "MCP"].map((tag, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 520 }}>
              5+ лет — комплексная цифровая трансформация бизнеса с применением AI.
              CRM-системы, голосовые агенты, CAD-инструменты, аналитика данных — от архитектуры до деплоя.
            </p>

            <div className="flex flex-wrap gap-3">
              <a href={TG_LINK} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}>
                💬 Написать в Telegram
              </a>
              <a href={MAX_LINK} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}>
                🚀 Связаться в MAX
              </a>
            </div>

            <div className="flex flex-wrap gap-4 mt-6">
              {["📍 Пушкино, МО", "💻 Удалённо / Офис МСК", "⚡ Полная занятость"].map((t, i) => (
                <span key={i} className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Photo — без пилюль поверх */}
          <div className="flex justify-center lg:justify-end transition-all duration-1000" style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateX(0) scale(1)" : "translateX(40px) scale(0.95)", transitionDelay: "200ms" }}>
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)", transform: "scale(1.2)" }} />
              <div className="absolute -inset-4 rounded-full" style={{ background: "conic-gradient(from 0deg, #8b5cf6, #f97316, #06b6d4, #8b5cf6)", opacity: 0.3, filter: "blur(20px)" }} />
              <img src={PHOTO_URL} alt="Красноруцкий Евгений" className="relative rounded-3xl object-cover" style={{ width: 340, height: 420, objectPosition: "center top", border: "2px solid rgba(139,92,246,0.3)" }} />
              {/* Бейдж СНИЗУ под фото, не перекрывает */}
              <div className="mt-4 flex gap-2 justify-center">
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(249,115,22,0.4)", color: "#fb923c" }}>
                  5+ лет опыта
                </span>
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa" }}>
                  30+ проектов
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce" style={{ zIndex: 10 }}>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>скролл</span>
        <div className="w-px h-8" style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.5), transparent)" }} />
      </div>
    </section>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export function LBStats() {
  return (
    <section className="py-16 border-y" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-black mb-1" style={{ fontFamily: "Montserrat, sans-serif", background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Tech Logos marquee ────────────────────────────────────────────────────────
export function LBTechLogos() {
  const doubled = [...TECH_LOGOS, ...TECH_LOGOS];
  return (
    <div className="py-6 overflow-hidden border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="flex gap-6 items-center" style={{ animation: "marquee 28s linear infinite", width: "max-content" }}>
        {doubled.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#8b5cf6" }} />
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{t.name}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
export function LBPortfolio() {
  return (
    <section id="projects" className="py-24 max-w-6xl mx-auto px-6">
      <div className="mb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
          Реальные продукты в продакшне
        </div>
        <h2 className="text-4xl lg:text-5xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>Портфолио</h2>
        <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
          Не учебные проекты — живые системы, которыми пользуются реальные компании прямо сейчас
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PROJECTS.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
      </div>
    </section>
  );
}

// ── Full Screenshot Gallery ───────────────────────────────────────────────────
export function LBGallery() {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const allUrls = ALL_SCREENSHOTS.map(s => s.url);

  return (
    <section id="gallery" className="py-24" style={{ background: "rgba(255,255,255,0.012)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#22d3ee" }}>
            Скриншоты всех проектов
          </div>
          <h2 className="text-4xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>Галерея</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Нажмите на любой скриншот — откроется на весь экран</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ALL_SCREENSHOTS.map((shot, i) => (
            <button
              key={i}
              onClick={() => setLightboxIdx(i)}
              className="relative group rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:-translate-y-1"
              style={{ aspectRatio: "16/10", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <img src={shot.url} alt={shot.caption} className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}>
                <span className="text-white text-xl mb-1">🔍</span>
                <span className="text-xs text-center px-2 font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>{shot.caption}</span>
              </div>
            </button>
          ))}
        </div>

        {lightboxIdx !== null && (
          <Lightbox images={allUrls} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </div>
    </section>
  );
}

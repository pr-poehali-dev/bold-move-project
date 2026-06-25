import { PHOTO_URL, TG_LINK, MAX_LINK } from "../lbData";
import { TypeWriter, GridBg, Particles } from "../lbAtoms";

export function LBHero({ heroVisible }: { heroVisible: boolean }) {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
      <GridBg />
      <Particles />
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:py-28 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Text */}
          <div className="transition-all duration-1000 order-2 lg:order-1" style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateX(0)" : "translateX(-40px)" }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8b5cf6" }} />
              Open to work · Удалённо / Офис
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black leading-tight mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Красноруцкий<br />
              <span style={{ background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Евгений
              </span>
            </h1>

            <div className="mb-3 text-xs sm:text-sm font-semibold tracking-widest uppercase" style={{ color: "#f97316", letterSpacing: "0.1em" }}>
              AI-Архитектор бизнес-решений
            </div>

            <div className="text-base sm:text-xl lg:text-2xl font-semibold mb-4" style={{ color: "rgba(255,255,255,0.7)", minHeight: 40 }}>
              <TypeWriter texts={[
                "Эксперт по автоматизации процессов",
                "API · RAG · NLP · ML · DevOps",
                "Строю продукты с нуля до прода",
                "CPO / AI Creator / Vibe-Coding",
              ]} />
            </div>

            {/* Теги-экспертиза */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["API", "RAG", "NLP", "ML", "DevOps", "UI/UX", "LLM", "MCP", "Python", "React", "SaaS", "CRM"].map((tag, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              5+ лет — цифровая трансформация бизнеса с AI. CRM, голосовые агенты, CAD, аналитика — от архитектуры до деплоя.
            </p>

            {/* Кнопки — на мобиле во всю ширину */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a href={TG_LINK} target="_blank" rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}>
                💬 Написать в Telegram
              </a>
              <a href={MAX_LINK} target="_blank" rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}>
                🚀 Связаться в MAX
              </a>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              {["📍 Пушкино, МО", "💻 Удалённо / МСК", "⚡ Полная занятость"].map((t, i) => (
                <span key={i} className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Photo — компактная на мобиле, СВЕРХУ */}
          <div className="flex justify-center order-1 lg:order-2 transition-all duration-1000" style={{ opacity: heroVisible ? 1 : 0, transitionDelay: "200ms" }}>
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)", transform: "scale(1.15)" }} />
              <div className="absolute -inset-3 rounded-full" style={{ background: "conic-gradient(from 0deg, #8b5cf6, #f97316, #06b6d4, #8b5cf6)", opacity: 0.25, filter: "blur(16px)" }} />
              <img
                src={PHOTO_URL}
                alt="Красноруцкий Евгений"
                className="relative rounded-2xl sm:rounded-3xl object-cover"
                style={{ width: "min(220px, 55vw)", height: "min(270px, 67vw)", objectPosition: "center top", border: "2px solid rgba(139,92,246,0.3)" }}
              />
              <div className="mt-3 flex gap-2 justify-center">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(249,115,22,0.4)", color: "#fb923c" }}>5+ лет опыта</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa" }}>30+ проектов</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-bounce" style={{ zIndex: 10 }}>
        <div className="w-px h-6" style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.5), transparent)" }} />
      </div>
    </section>
  );
}

// ── Верхние секции: Hero, Stats, TechLogos, Portfolio, Gallery, Mobile ────────
import { useState } from "react";
import { PHOTO_URL, PROJECTS, STATS, TECH_LOGOS, ALL_SCREENSHOTS, TG_LINK, MAX_LINK } from "../lbData";
import { TypeWriter, GridBg, ProjectCard, Particles, Lightbox } from "../lbAtoms";

// ── Hero ──────────────────────────────────────────────────────────────────────
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

            {/* Теги-экспертиза — компактнее на мобиле */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["API", "RAG", "NLP", "ML", "DevOps", "UI/UX", "LLM", "MCP"].map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              5+ лет — цифровая трансформация бизнеса с AI. CRM, голосовые агенты, CAD, аналитика — от архитектуры до деплоя.
            </p>

            {/* Кнопки — на мобиле во всю ширину */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a href={TG_LINK} target="_blank" rel="noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}>
                💬 Написать в Telegram
              </a>
              <a href={MAX_LINK} target="_blank" rel="noreferrer"
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
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>скролл</span>
        <div className="w-px h-6" style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.5), transparent)" }} />
      </div>
    </section>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
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

// ── Tech Logos marquee ────────────────────────────────────────────────────────
export function LBTechLogos() {
  const doubled = [...TECH_LOGOS, ...TECH_LOGOS];
  return (
    <div className="py-4 overflow-hidden border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="flex gap-3 sm:gap-6 items-center" style={{ animation: "marquee 24s linear infinite", width: "max-content" }}>
        {doubled.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#8b5cf6" }} />
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
    <section id="projects" className="py-8 sm:py-16 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
          Реальные продукты в продакшне
        </div>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>Портфолио</h2>
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

// ── Full Screenshot Gallery ───────────────────────────────────────────────────
export function LBGallery() {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const allUrls = ALL_SCREENSHOTS.map(s => s.url);

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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {ALL_SCREENSHOTS.map((shot, i) => (
            <button
              key={i}
              onClick={() => setLightboxIdx(i)}
              className="relative group rounded-xl overflow-hidden transition-all duration-300 active:scale-95"
              style={{ aspectRatio: "16/10", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <img src={shot.url} alt={shot.caption} className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}>
                <span className="text-white text-lg mb-0.5">🔍</span>
                <span className="text-xs text-center px-1 font-medium hidden sm:block" style={{ color: "rgba(255,255,255,0.9)" }}>{shot.caption}</span>
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

// ── Mobile Development ────────────────────────────────────────────────────────
const MOBILE_SCREENS = [
  {
    label: "AI-Агент",
    sub: "Чат с голосовым вводом",
    color: "#f97316",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/507e3a3f-22eb-41d0-b4a9-91c7063e5099.jpg",
  },
  {
    label: "CRM — Воронка",
    sub: "Заявки и финансы",
    color: "#8b5cf6",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/b355fa9e-7615-40f9-8131-9f6dbb3311ae.jpg",
  },
  {
    label: "P&L по заказу",
    sub: "Затраты, доходы, маржа",
    color: "#10b981",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/15478a1b-e4a1-406c-93b7-05f07653da6a.jpg",
  },
  {
    label: "CAD-построитель",
    sub: "Чертёж и материалы",
    color: "#06b6d4",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/9b9146e8-90d5-4a1f-b978-2a4c40af7af9.jpg",
  },
  {
    label: "Мультикомнатный",
    sub: "Несколько комнат, одна смета",
    color: "#f59e0b",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/8444e268-91e3-402f-9a48-88ffb3459a57.jpg",
  },
];

const MOBILE_FEATURES = [
  { icon: "🎨", title: "UI/UX дизайн", desc: "Figma-макеты с нативными паттернами iOS и Android. Анимации и микровзаимодействия." },
  { icon: "⚡", title: "React Native", desc: "Один код — два магазина. Нативная производительность без компромиссов." },
  { icon: "🍎", title: "App Store", desc: "Подготовка, ревью и публикация. TestFlight для бета-тестирования." },
  { icon: "🤖", title: "Google Play", desc: "Публикация APK/AAB с соблюдением всех требований Google." },
  { icon: "🔔", title: "Push & offline", desc: "Уведомления, офлайн-режим, фоновая синхронизация данных." },
  { icon: "🔗", title: "API интеграции", desc: "Подключение к бэкенду, платёжным системам, картам и камере." },
];

export function LBMobile() {
  const [active, setActive] = useState(0);

  return (
    <section id="mobile" className="py-8 sm:py-16 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
            📱 Мобильная разработка
          </div>
          <h2 className="text-3xl sm:text-5xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Приложения для{" "}
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              iOS и Android
            </span>
          </h2>
          <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
            От Figma-макета до публикации в магазинах. Реальные экраны из живых проектов.
          </p>
        </div>

        {/* Скролл-карусель телефонов */}
        <div className="relative mb-4">
          {/* Тени по краям */}
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #080810, transparent)" }} />
          <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #080810, transparent)" }} />

          <div
            className="flex gap-4 overflow-x-auto pb-4"
            style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none", paddingTop: 16 }}
          >
            {MOBILE_SCREENS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className="flex-shrink-0 flex flex-col items-center gap-3 transition-all duration-300"
                style={{ scrollSnapAlign: "center" }}
              >
                {/* Телефон */}
                <div
                  className="relative overflow-hidden transition-all duration-500"
                  style={{
                    width: i === active ? 148 : 110,
                    height: i === active ? 310 : 220,
                    borderRadius: 24,
                    border: `2px solid ${i === active ? s.color : "rgba(255,255,255,0.1)"}`,
                    boxShadow: i === active
                      ? `0 0 0 4px ${s.color}22, 0 20px 50px rgba(0,0,0,0.7), 0 0 40px ${s.color}33`
                      : "0 4px 20px rgba(0,0,0,0.4)",
                    transform: "translateY(0)",
                    background: "#0a0a14",
                  }}
                >
                  {/* Dynamic island */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full" style={{ width: 30, height: 8, background: "#000" }} />
                  {/* Скриншот */}
                  <img
                    src={s.img}
                    alt={s.label}
                    className="w-full h-full object-cover object-center"
                  />
                  {/* Home indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 32, height: 3, background: "rgba(255,255,255,0.25)" }} />
                  {/* Активный glow-border снизу */}
                  {i === active && (
                    <div className="absolute bottom-0 left-0 right-0 h-12" style={{ background: `linear-gradient(to top, ${s.color}22, transparent)` }} />
                  )}
                </div>

                {/* Подпись */}
                <div className="text-center">
                  <div
                    className="text-xs font-bold mb-0.5 transition-all duration-300"
                    style={{ color: i === active ? s.color : "rgba(255,255,255,0.7)" }}
                  >
                    {s.label}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{s.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Точки-индикаторы */}
        <div className="flex justify-center gap-1.5 mb-5">
          {MOBILE_SCREENS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === active ? 20 : 6,
                height: 6,
                background: i === active ? s.color : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        {/* Фичи */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {MOBILE_FEATURES.map((f, i) => (
            <div
              key={i}
              className="p-3 rounded-xl flex flex-col gap-1"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-base">{f.icon}</div>
              <div className="text-xs font-bold leading-tight">{f.title}</div>
              <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Сторы */}
        <div className="flex gap-3 justify-center">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 sm:flex-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "linear-gradient(135deg,#1c1c1e,#2c2c2e)" }}>🍎</div>
            <div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Публикация в</div>
              <div className="font-black text-sm" style={{ fontFamily: "Montserrat, sans-serif" }}>App Store</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>iOS 16+ · TestFlight</div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 sm:flex-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "linear-gradient(135deg,#0f2010,#1a3520)" }}>🤖</div>
            <div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Публикация в</div>
              <div className="font-black text-sm" style={{ fontFamily: "Montserrat, sans-serif" }}>Google Play</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Android 10+ · APK/AAB</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
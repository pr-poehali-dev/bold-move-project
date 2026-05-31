// ── Верхние секции: Hero, Stats, TechLogos, Portfolio, Gallery, Mobile ────────
import { useState, useEffect, useRef, useCallback } from "react";
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
const PREVIEW_COUNT = 6;

export function LBGallery() {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [tick, setTick] = useState(0);
  const allUrls = ALL_SCREENSHOTS.map(s => s.url);

  // Каждые 3 секунды перемешиваем превью-слот (только первые 6)
  useEffect(() => {
    if (showAll) return;
    const t = setInterval(() => setTick(n => n + 1), 3000);
    return () => clearInterval(t);
  }, [showAll]);

  // Динамические 6 индексов — каждый тик сдвигаем на 1
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

        {/* Кнопка */}
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
  {
    label: "Аналитика",
    sub: "Обзор, конверсии, KPI",
    color: "#a78bfa",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/98f77739-d739-4bf0-8fe1-4c43e055b76f.jpg",
  },
  {
    label: "Финансы P&L",
    sub: "Доходы, расходы, прибыль",
    color: "#34d399",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/0882c3c6-0cd9-4d0e-a406-a4e367e7150d.jpg",
  },
  {
    label: "Календарь",
    sub: "Замеры и монтажи на карте",
    color: "#fbbf24",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/82f4b066-784b-4cbd-a290-a14082d16b96.jpg",
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

// ── PhoneDrum: карусель телефонов с инерцией, бесконечным кольцом, снэпом по центру ──
function PhoneDrum({ onOpen }: { onOpen: (idx: number) => void }) {
  const N = MOBILE_SCREENS.length;
  // Тройное дублирование для бесконечного кольца
  const items = [...MOBILE_SCREENS, ...MOBILE_SCREENS, ...MOBILE_SCREENS];

  // Размеры телефонов — активный крупнее
  const PHONE_W_ACTIVE = 148;
  const PHONE_H_ACTIVE = 310;
  const PHONE_W_SMALL  = 110;
  const PHONE_H_SMALL  = 220;
  const GAP  = 16;
  const SLOT = PHONE_W_SMALL + GAP; // шаг сетки = маленький телефон

  // Виртуальный offset: начинаем с середины второго блока чтобы было куда крутить в обе стороны
  const INIT_IDX = N; // индекс первого элемента второго блока
  const [activeRaw, setActiveRaw] = useState(INIT_IDX); // raw-индекс в items[]
  const activeReal = ((activeRaw % N) + N) % N;         // реальный 0..N-1

  const isDragging  = useRef(false);
  const didDrag     = useRef(false);
  const startX      = useRef(0);
  const startY      = useRef(0);
  const dragOffset  = useRef(0); // текущее смещение во время drag (px)
  const lastX       = useRef(0);
  const lastTime    = useRef(0);
  const velocity    = useRef(0);
  const rafId       = useRef<number | null>(null);
  const [dragDelta, setDragDelta] = useState(0); // live-смещение во время drag

  // Снэп к ближайшему индексу с инерцией
  const snapTo = useCallback((rawIdx: number) => {
    // Нормализуем: держимся в диапазоне 1..N*2-1 (второй блок)
    let idx = rawIdx;
    if (idx < 1)       idx += N;
    if (idx > N * 2 - 1) idx -= N;
    setActiveRaw(idx);
    setDragDelta(0);
  }, [N]);

  const startInertia = useCallback((v: number, baseRaw: number, baseDelta: number) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    let vel = v;
    let delta = baseDelta;
    const step = () => {
      vel *= 0.88;
      delta += vel;
      // Снэп когда скорость мала
      if (Math.abs(vel) < 0.8) {
        const shift = Math.round(delta / SLOT);
        snapTo(baseRaw + shift);
        return;
      }
      setDragDelta(delta);
      rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
  }, [SLOT, snapTo]);

  // Touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    isDragging.current = true; didDrag.current = false;
    startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY;
    dragOffset.current = 0;
    lastX.current = e.touches[0].clientX; lastTime.current = performance.now(); velocity.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (!didDrag.current && dy > Math.abs(dx) * 1.2) { isDragging.current = false; return; }
    e.preventDefault(); didDrag.current = true;
    const x = e.touches[0].clientX; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (x - lastX.current) / dt * 14;
    lastX.current = x; lastTime.current = now;
    dragOffset.current = dx;
    setDragDelta(dx);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const v = velocity.current;
    const base = activeRaw;
    const delta = dragOffset.current;
    if (Math.abs(v) < 1 && Math.abs(delta) < SLOT * 0.3) {
      // Маленький сдвиг — снэп на ближайший
      snapTo(base + Math.round(-delta / SLOT));
    } else {
      startInertia(-v, base, -delta);
    }
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [activeRaw, SLOT, snapTo, startInertia]);

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    isDragging.current = true; didDrag.current = false;
    startX.current = e.clientX; dragOffset.current = 0;
    lastX.current = e.clientX; lastTime.current = performance.now(); velocity.current = 0;
    e.preventDefault();
  }, []);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) didDrag.current = true;
    const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (e.clientX - lastX.current) / dt * 14;
    lastX.current = e.clientX; lastTime.current = now;
    dragOffset.current = dx;
    setDragDelta(dx);
  }, []);
  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const v = velocity.current;
    const base = activeRaw;
    const delta = dragOffset.current;
    if (Math.abs(v) < 1 && Math.abs(delta) < SLOT * 0.3) {
      snapTo(base + Math.round(-delta / SLOT));
    } else {
      startInertia(-v, base, -delta);
    }
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [activeRaw, SLOT, snapTo, startInertia]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      style={{ position: "relative", width: "100%", overflow: "hidden", userSelect: "none", paddingTop: 16, cursor: isDragging.current ? "grabbing" : "grab", touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Тени по краям */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 40, zIndex: 10, pointerEvents: "none", background: "linear-gradient(to right,#080810,transparent)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 40, zIndex: 10, pointerEvents: "none", background: "linear-gradient(to left,#080810,transparent)" }} />

      {/* Ряд телефонов — flex, центрируем через отступ */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: GAP, paddingBottom: 16 }}>
        {items.map((s, rawIdx) => {
          // Позиция относительно активного с учётом drag
          const relPos = rawIdx - activeRaw - dragDelta / SLOT;
          // Показываем только ±3 слота от центра
          if (relPos < -3.5 || relPos > 3.5) return null;
          const isCenter = Math.abs(relPos) < 0.5;
          const absDist  = Math.abs(relPos);
          const realIdx  = ((rawIdx % N) + N) % N;

          const phoneW = isCenter ? PHONE_W_ACTIVE : PHONE_W_SMALL;
          const phoneH = isCenter ? PHONE_H_ACTIVE : PHONE_H_SMALL;
          const opacity = Math.max(0.25, 1 - absDist * 0.35);

          return (
            <div
              key={rawIdx}
              onClick={() => {
                if (didDrag.current) return;
                if (isCenter) onOpen(realIdx);
                else snapTo(rawIdx);
              }}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                opacity,
                transition: isDragging.current ? "none" : "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                cursor: isCenter ? "zoom-in" : "pointer",
              }}
            >
              {/* Телефон-мокап */}
              <div style={{
                width: phoneW,
                height: phoneH,
                borderRadius: 24,
                overflow: "hidden",
                border: `2px solid ${isCenter ? s.color : "rgba(255,255,255,0.1)"}`,
                boxShadow: isCenter
                  ? `0 0 0 4px ${s.color}22, 0 20px 50px rgba(0,0,0,0.7), 0 0 40px ${s.color}33`
                  : "0 4px 20px rgba(0,0,0,0.4)",
                background: "#0a0a14",
                position: "relative",
                transition: isDragging.current ? "none" : "width 0.35s cubic-bezier(0.34,1.56,0.64,1), height 0.35s cubic-bezier(0.34,1.56,0.64,1), border-color 0.35s, box-shadow 0.35s",
              }}>
                {/* Dynamic island */}
                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 30, height: 8, borderRadius: 4, background: "#000", zIndex: 2 }} />
                <img src={s.img} alt={s.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {/* Home indicator */}
                <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 32, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.25)" }} />
                {/* Glow снизу у активного */}
                {isCenter && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: `linear-gradient(to top, ${s.color}22, transparent)` }} />}
              </div>

              {/* Подпись — только у активного */}
              <div style={{ textAlign: "center", opacity: isCenter ? 1 : 0, transition: "opacity 0.3s" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Точки-индикаторы */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 4 }}>
        {MOBILE_SCREENS.map((s, i) => (
          <button key={i} onClick={() => snapTo(INIT_IDX + (i - activeReal + N) % N - Math.floor(N / 2))}
            style={{ width: i === activeReal ? 20 : 6, height: 6, borderRadius: 3, background: i === activeReal ? s.color : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
        ))}
      </div>
    </div>
  );
}

// ── Лайтбокс — полноэкранный просмотр ─────────────────────────────────────────
function PhoneLightbox({ idx, onClose }: { idx: number; onClose: () => void }) {
  const s = MOBILE_SCREENS[idx];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* Телефон */}
        <div style={{
          width: 280, height: 590, borderRadius: 36, overflow: "hidden",
          border: `3px solid ${s.color}`,
          boxShadow: `0 0 0 6px ${s.color}25, 0 40px 80px rgba(0,0,0,0.9), 0 0 80px ${s.color}40`,
          background: "#0a0a14", position: "relative",
        }}>
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 52, height: 14, borderRadius: 7, background: "#000", zIndex: 2 }} />
          <img src={s.img} alt={s.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", width: 52, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.35)" }} />
        </div>
        {/* Описание */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{s.sub}</div>
        </div>
        {/* Кнопка закрыть */}
        <button onClick={onClose} style={{ marginTop: 4, padding: "8px 24px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

export function LBMobile() {
  const [lightbox, setLightbox] = useState<number | null>(null);

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
            Крути барабан — смотри реальные экраны живых проектов. Кликни на центральный для полного просмотра.
          </p>
        </div>

        {/* Барабан телефонов */}
        <div className="mb-6">
          <PhoneDrum onOpen={i => setLightbox(i)} />
        </div>

        {/* Фичи */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {MOBILE_FEATURES.map((f, i) => (
            <div key={i} className="p-3 rounded-xl flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
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

      {/* Лайтбокс */}
      {lightbox !== null && <PhoneLightbox idx={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}
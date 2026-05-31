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

// ── PhoneDrum: горизонтальный барабан телефонов с инерцией и бесконечным кольцом ──
function PhoneDrum({ onOpen }: { onOpen: (idx: number) => void }) {
  const N = MOBILE_SCREENS.length;
  // Дублируем список 3 раза для бесконечного кольца
  const items = [...MOBILE_SCREENS, ...MOBILE_SCREENS, ...MOBILE_SCREENS];
  const OFFSET = N; // начальный индекс = второй блок

  const ITEM_W  = 130; // ширина слота
  const GAP     = 16;
  const SLOT    = ITEM_W + GAP;
  const VISIBLE = 5;
  const TOTAL_W = SLOT * VISIBLE;
  const HALF    = TOTAL_W / 2;

  const scrollRef    = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const didDrag      = useRef(false);
  const startX       = useRef(0);
  const startY       = useRef(0);
  const startScroll  = useRef(0);
  const lastX        = useRef(0);
  const lastTime     = useRef(0);
  const velocity     = useRef(0);
  const rafId        = useRef<number | null>(null);
  const isSnapping   = useRef(false);
  const [scrollLeft, setScrollLeft] = useState(OFFSET * SLOT);
  // Для hover-следования мышью
  const [hoverIdx, setHoverIdx]  = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Инициализация — ставим в центр второго блока
  useEffect(() => {
    const el = scrollRef.current;
    if (el) { el.scrollLeft = OFFSET * SLOT; setScrollLeft(OFFSET * SLOT); }
  }, []);

  // Нормализация: если ушли далеко — прыгаем на эквивалентную позицию в центральном блоке
  const normalize = useCallback((sl: number) => {
    const el = scrollRef.current;
    if (!el) return sl;
    const min = SLOT * 1;
    const max = SLOT * (N * 2 - 1);
    if (sl < min) { const jump = sl + N * SLOT; el.scrollLeft = jump; return jump; }
    if (sl > max) { const jump = sl - N * SLOT; el.scrollLeft = jump; return jump; }
    return sl;
  }, [N, SLOT]);

  const snapToIndex = useCallback((rawIdx: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = rawIdx * SLOT;
    if (!smooth) { el.scrollLeft = target; setScrollLeft(target); return; }
    isSnapping.current = true;
    const start = el.scrollLeft;
    const diff  = target - start;
    const dur   = Math.min(350, Math.abs(diff) * 0.8);
    const ts0   = performance.now();
    const step  = (now: number) => {
      const t    = Math.min(1, (now - ts0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      el.scrollLeft = start + diff * ease;
      const sl = normalize(el.scrollLeft);
      setScrollLeft(sl);
      if (t < 1) rafId.current = requestAnimationFrame(step);
      else { isSnapping.current = false; setScrollLeft(normalize(target)); }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [SLOT, normalize]);

  const startInertia = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    let v = velocity.current;
    const step = () => {
      if (isSnapping.current) return;
      v *= 0.91;
      el.scrollLeft += v;
      const sl = normalize(el.scrollLeft);
      setScrollLeft(sl);
      if (Math.abs(v) > 0.6) rafId.current = requestAnimationFrame(step);
      else snapToIndex(Math.round(el.scrollLeft / SLOT));
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [snapToIndex, normalize, SLOT]);

  // Touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false; isDragging.current = true; didDrag.current = false;
    startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY;
    startScroll.current = scrollRef.current?.scrollLeft ?? 0;
    lastX.current = e.touches[0].clientX; lastTime.current = performance.now(); velocity.current = 0;
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dy > Math.abs(dx) * 1.5) return; // вертикальный скролл — не перехватываем
    e.preventDefault(); didDrag.current = true;
    const x = e.touches[0].clientX; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastX.current - x) / dt * 14;
    lastX.current = x; lastTime.current = now;
    scrollRef.current.scrollLeft = startScroll.current + (startX.current - x);
    setScrollLeft(normalize(scrollRef.current.scrollLeft));
  }, [normalize]);
  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    startInertia();
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [startInertia]);

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false; isDragging.current = true; didDrag.current = false;
    startX.current = e.clientX; startScroll.current = scrollRef.current?.scrollLeft ?? 0;
    lastX.current = e.clientX; lastTime.current = performance.now(); velocity.current = 0;
    e.preventDefault();
  }, []);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    if (Math.abs(e.clientX - startX.current) > 4) didDrag.current = true;
    const x = e.clientX; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastX.current - x) / dt * 14;
    lastX.current = x; lastTime.current = now;
    scrollRef.current.scrollLeft = startScroll.current + (startX.current - x);
    setScrollLeft(normalize(scrollRef.current.scrollLeft));
  }, [normalize]);
  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startInertia();
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [startInertia]);
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  // Hover-следование мышью — находим ближайший телефон под курсором
  const onContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - HALF + SLOT / 2;
    const baseIdx = Math.round(scrollLeft / SLOT);
    const hover = Math.round((mx + baseIdx * SLOT) / SLOT);
    setHoverIdx(Math.max(0, Math.min(items.length - 1, hover)));
  }, [scrollLeft, SLOT, HALF, items.length]);
  const onContainerMouseLeave = useCallback(() => setHoverIdx(null), []);

  // Центральный реальный индекс (в терминах исходного массива)
  const centerRawIdx = Math.round(scrollLeft / SLOT);
  const centerIdx    = ((centerRawIdx % N) + N) % N;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", overflow: "hidden", userSelect: "none", cursor: isDragging.current ? "grabbing" : "grab" }}
      onMouseMove={onContainerMouseMove}
      onMouseLeave={onContainerMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Тени-маски по краям */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 60, zIndex: 10, pointerEvents: "none", background: "linear-gradient(to right,#080810,transparent)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 60, zIndex: 10, pointerEvents: "none", background: "linear-gradient(to left,#080810,transparent)" }} />

      {/* Скрытый механический скролл */}
      <div
        ref={scrollRef}
        style={{ position: "absolute", inset: 0, overflowX: "scroll", scrollbarWidth: "none", opacity: 0, pointerEvents: "none" }}
      >
        <div style={{ width: items.length * SLOT, height: 1 }} />
      </div>

      {/* Визуальный ряд телефонов */}
      <div style={{ height: 420, position: "relative" }}>
        {items.map((s, rawIdx) => {
          const realIdx  = ((rawIdx % N) + N) % N;
          const itemCenter = rawIdx * SLOT + SLOT / 2 - scrollLeft;
          const offset   = itemCenter - HALF;
          const norm     = Math.max(-1.2, Math.min(1.2, offset / HALF));
          const isCenter = rawIdx === centerRawIdx;
          const isHovered = hoverIdx === rawIdx;
          const isFocused = isHovered || isCenter;

          // Дуговые параметры — ближе к центру = крупнее
          const scale    = Math.max(0.6, 1 - norm * norm * 0.38);
          const opacity  = Math.max(0.15, 1 - norm * norm * 0.75);
          const translateY = norm * norm * 28; // дуга вниз от центра
          const phoneW   = isFocused ? 160 : Math.round(ITEM_W * scale);
          const phoneH   = isFocused ? 336 : Math.round(ITEM_W * 2.1 * scale);
          const x = HALF + offset - ITEM_W / 2;

          if (x < -ITEM_W || x > TOTAL_W + ITEM_W) return null;

          return (
            <div
              key={rawIdx}
              onClick={() => {
                if (didDrag.current) return;
                if (isCenter) onOpen(realIdx);
                else snapToIndex(rawIdx);
              }}
              style={{
                position: "absolute",
                left: x,
                top: "50%",
                transform: `translateY(calc(-50% + ${translateY}px)) scale(${isFocused ? 1 : scale})`,
                transformOrigin: "bottom center",
                opacity: isFocused ? 1 : opacity,
                transition: isDragging.current ? "none" : "transform 0.25s ease, opacity 0.25s ease, width 0.25s ease, height 0.25s ease",
                cursor: isCenter ? "zoom-in" : "pointer",
                zIndex: isFocused ? 10 : Math.round((1 - Math.abs(norm)) * 5),
              }}
            >
              {/* Телефон-мокап */}
              <div style={{
                width: phoneW, height: phoneH,
                borderRadius: 26,
                overflow: "hidden",
                border: `2px solid ${isFocused ? s.color : "rgba(255,255,255,0.1)"}`,
                boxShadow: isFocused
                  ? `0 0 0 3px ${s.color}30, 0 24px 60px rgba(0,0,0,0.8), 0 0 50px ${s.color}40`
                  : "0 6px 24px rgba(0,0,0,0.5)",
                background: "#0a0a14",
                transition: "width 0.25s ease, height 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
                position: "relative",
              }}>
                <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 10, borderRadius: 5, background: "#000", zIndex: 2 }} />
                <img src={s.img} alt={s.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.3)" }} />
                {isFocused && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to top, ${s.color}33, transparent)` }} />}
                {isCenter && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", opacity: 0, transition: "opacity 0.2s" }} className="hover:!opacity-100">
                  <div style={{ fontSize: 28 }}>🔍</div>
                </div>}
              </div>

              {/* Подпись — только у сфокусированного */}
              <div style={{ textAlign: "center", marginTop: 10, opacity: isFocused ? 1 : 0, transition: "opacity 0.25s" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Индикаторы */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 8 }}>
        {MOBILE_SCREENS.map((s, i) => (
          <button key={i} onClick={() => snapToIndex(OFFSET + i - centerIdx + centerRawIdx)}
            style={{ width: i === centerIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === centerIdx ? s.color : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
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
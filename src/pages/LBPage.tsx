import { useState, useEffect, useRef } from "react";

const PHOTO_URL = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/dc3581be-1604-4c86-b70f-dbd17ca4d283.jpg";

// ── Скриншоты проектов ────────────────────────────────────────────────────────
const PROJECTS = [
  {
    id: "agent",
    title: "AI-Агент для бизнеса",
    subtitle: "Голосовой консультант + умная смета",
    description: "Персональный AI-агент, который знает прайс 50+ поставщиков, ведёт диалог голосом, мгновенно рассчитывает стоимость и формирует смету в PDF. Интегрируется в Telegram и на сайт.",
    tags: ["AI / LLM", "RAG", "Telegram Bot", "Voice", "Python"],
    color: "#f97316",
    glow: "rgba(249,115,22,0.25)",
    link: "/",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/4ecbbf9f-399f-4dfa-9f82-0f510e65acf4.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3416564e-b468-4a79-8b8e-eaade4459b53.png",
    ],
    features: ["Голосовой ввод и ответ", "RAG по базе прайсов", "Мгновенный расчёт сметы", "PDF-выгрузка КП", "Telegram-интеграция"],
  },
  {
    id: "crm",
    title: "CRM-система",
    subtitle: "Воронка · Канбан · Аналитика · Календарь",
    description: "Полноценная CRM для отдела продаж: канбан-доска, воронка заявок, финансовая аналитика P&L, календарь замеров и монтажей, матрица прав для менеджеров.",
    tags: ["React", "PostgreSQL", "Python", "REST API", "Аналитика"],
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.25)",
    link: "/crm",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/b515b10a-e8bf-4688-90d3-5ac68107f14e.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c506c61e-4161-4bae-b929-90e70814ce92.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/326f400c-4845-4d7c-990b-4d4a918273e2.png",
    ],
    features: ["Воронка заявок + Канбан", "Финансы P&L в реальном времени", "Календарь замеров/монтажей", "Матрица прав менеджеров", "Динамика выручки — графики"],
  },
  {
    id: "plan",
    title: "CAD-Построитель",
    subtitle: "Чертёж · Материалы · Смета в браузере",
    description: "Браузерный CAD-редактор для проектирования натяжных потолков: рисование произвольных контуров, автоматический расчёт материалов, диагонали, мультикомнатные проекты, экспорт в PDF.",
    tags: ["Canvas API", "Geometry", "React", "PDF", "CAD"],
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.25)",
    link: "/plan",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/a9e8b3c2-947f-4019-ab92-ba13b0ca8182.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/6ac33c1e-a2a6-4211-abba-7095f4923d5f.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/9c53f861-98e1-49a0-bfe5-2494dca933d5.png",
    ],
    features: ["Произвольные контуры комнат", "Авто-расчёт периметра и площади", "Интерактивные диагонали", "Мультикомнатные проекты", "Экспорт PDF с чертежом"],
  },
  {
    id: "company",
    title: "Панель управления компанией",
    subtitle: "White-label · Агент · Прайсы · Команда",
    description: "Административная панель для компаний: настройка white-label агента под свой бренд, управление прайсами и правилами расчёта, онбординг команды с ролями и правами доступа.",
    tags: ["White-label", "Multi-tenant", "React", "Python", "PostgreSQL"],
    color: "#10b981",
    glow: "rgba(16,185,129,0.25)",
    link: "/company",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3df2c7ac-4cdc-4747-958f-0946f4db2fe3.png",
    ],
    features: ["White-label брендинг агента", "Управление прайсами и правилами", "Роли: компания / менеджер / мастер", "Telegram-бот под своим именем", "Аналитика по всей компании"],
  },
];

const STACK = [
  { name: "React + TypeScript", level: 95, color: "#06b6d4" },
  { name: "Python / FastAPI", level: 88, color: "#f97316" },
  { name: "AI / LLM / RAG", level: 90, color: "#8b5cf6" },
  { name: "PostgreSQL", level: 85, color: "#10b981" },
  { name: "Canvas / CAD", level: 80, color: "#f59e0b" },
  { name: "Telegram Bot API", level: 92, color: "#3b82f6" },
  { name: "MCP / API интеграции", level: 85, color: "#ec4899" },
  { name: "Vite / CI/CD", level: 88, color: "#84cc16" },
];

const STATS = [
  { value: "5+", label: "лет в разработке" },
  { value: "10+", label: "продуктов запущено" },
  { value: "3", label: "собственных платформы" },
  { value: "250K", label: "желаемая зарплата ₽" },
];

// ── Анимированный печатающийся текст ─────────────────────────────────────────
function TypeWriter({ texts, speed = 60 }: { texts: string[]; speed?: number }) {
  const [display, setDisplay] = useState("");
  const [idx, setIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[idx];
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charIdx < current.length) {
          setDisplay(current.slice(0, charIdx + 1));
          setCharIdx(c => c + 1);
        } else {
          setTimeout(() => setDeleting(true), 2000);
        }
      } else {
        if (charIdx > 0) {
          setDisplay(current.slice(0, charIdx - 1));
          setCharIdx(c => c - 1);
        } else {
          setDeleting(false);
          setIdx(i => (i + 1) % texts.length);
        }
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, idx, texts, speed]);

  return (
    <span>
      {display}
      <span className="animate-pulse" style={{ color: "#8b5cf6" }}>|</span>
    </span>
  );
}

// ── Анимированный счётчик ─────────────────────────────────────────────────────
function AnimCounter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = to / 40;
        const t = setInterval(() => {
          start += step;
          if (start >= to) { setVal(to); clearInterval(t); }
          else setVal(Math.floor(start));
        }, 30);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);

  return <span ref={ref}>{val}{suffix}</span>;
}

// ── Карточка проекта ──────────────────────────────────────────────────────────
function ProjectCard({ project, index }: { project: typeof PROJECTS[0]; index: number }) {
  const [activeShot, setActiveShot] = useState(0);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Авто-листание скриншотов
  useEffect(() => {
    if (!hovered) {
      const t = setInterval(() => setActiveShot(s => (s + 1) % project.screenshots.length), 2500);
      return () => clearInterval(t);
    }
  }, [hovered, project.screenshots.length]);

  const isEven = index % 2 === 0;

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : `translateY(${isEven ? 40 : 60}px)`,
        transitionDelay: `${index * 80}ms`,
        background: hovered
          ? `linear-gradient(135deg, rgba(10,10,20,0.98), rgba(10,10,20,0.95))`
          : "rgba(255,255,255,0.025)",
        border: `1.5px solid ${hovered ? project.color : "rgba(255,255,255,0.07)"}`,
        boxShadow: hovered ? `0 0 60px ${project.glow}` : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Скриншот */}
      <div className="relative overflow-hidden" style={{ height: 220 }}>
        {project.screenshots.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top transition-all duration-700"
            style={{ opacity: i === activeShot ? 1 : 0, transform: i === activeShot ? "scale(1.02)" : "scale(1)" }}
          />
        ))}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(8,8,16,0.95) 100%)" }} />
        {/* Dots */}
        {project.screenshots.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {project.screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveShot(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i === activeShot ? 20 : 6, height: 6, background: i === activeShot ? project.color : "rgba(255,255,255,0.3)" }}
              />
            ))}
          </div>
        )}
        {/* Tag */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold" style={{ background: project.color, color: "#0a0a14" }}>
          {project.tags[0]}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{project.title}</h3>
        <p className="text-sm mb-3" style={{ color: project.color }}>{project.subtitle}</p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>{project.description}</p>

        {/* Features */}
        <ul className="space-y-1.5 mb-5">
          {project.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
              {f}
            </li>
          ))}
        </ul>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {project.tags.map((t, i) => (
            <span key={i} className="px-2.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {t}
            </span>
          ))}
        </div>

        <a
          href={project.link}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:gap-3"
          style={{ background: `${project.color}20`, color: project.color, border: `1px solid ${project.color}40` }}
        >
          Посмотреть живой проект →
        </a>
      </div>
    </div>
  );
}

// ── Sticky CTA bar ────────────────────────────────────────────────────────────
function StickyBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-3 px-4 py-3 rounded-2xl transition-all duration-500"
      style={{
        background: "rgba(10,10,20,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        opacity: show ? 1 : 0,
        transform: `translateX(-50%) translateY(${show ? 0 : 20}px)`,
        pointerEvents: show ? "auto" : "none",
      }}
    >
      <a
        href="https://t.me/krasnor"
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
        style={{ background: "#f97316", color: "#0a0a14" }}
      >
        Заказать проект
      </a>
      <a
        href="https://max.ru/u/9LHodD0cOKSEfyoFFiNHDKKda2DJEQla4TlbxlDSi7pGygeSc3tM9PafS5g"
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
        style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.4)" }}
      >
        Пригласить в команду
      </a>
    </div>
  );
}

// ── Анимированный фоновый грид ────────────────────────────────────────────────
function GridBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Gradient orbs */}
      <div className="absolute rounded-full" style={{ width: 600, height: 600, top: -200, left: -200, background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
      <div className="absolute rounded-full" style={{ width: 500, height: 500, top: 100, right: -100, background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)" }} />
    </div>
  );
}

// ── Секция навыков ────────────────────────────────────────────────────────────
function SkillBar({ name, level, color, delay }: { name: string; level: number; color: string; delay: number }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setTimeout(() => setAnimated(true), delay); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Rubik, sans-serif" }}>{name}</span>
        <span className="text-xs font-bold" style={{ color }}>{level}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: animated ? `${level}%` : "0%", background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: animated ? `0 0 8px ${color}60` : "none" }}
        />
      </div>
    </div>
  );
}

// ── Главная страница ──────────────────────────────────────────────────────────
export default function LBPage() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background: "#080810", minHeight: "100dvh", color: "#fff", fontFamily: "Rubik, sans-serif" }}>
      <StickyBar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <GridBg />
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Text */}
            <div
              className="transition-all duration-1000"
              style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateX(0)" : "translateX(-40px)" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8b5cf6" }} />
                Open to work · Удалённо / Офис
              </div>

              <h1 className="text-4xl lg:text-6xl font-black leading-tight mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Красноруцкий<br />
                <span style={{ background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Евгений
                </span>
              </h1>

              <div className="text-xl lg:text-2xl font-semibold mb-6" style={{ color: "rgba(255,255,255,0.7)", minHeight: 60 }}>
                <TypeWriter texts={[
                  "CPO / AI-разработчик агентов",
                  "Строю продукты с нуля до прода",
                  "Vibe-Coding · AI Creator",
                  "Превращаю идеи в работающий код",
                ]} />
              </div>

              <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 520 }}>
                5+ лет занимаюсь комплексной цифровой трансформацией бизнеса с применением AI.
                Создаю CRM-системы, голосовых агентов, CAD-инструменты и AI-калькуляторы —
                от архитектуры до деплоя.
              </p>

              <div className="flex flex-wrap gap-3">
                <a
                  href="https://t.me/krasnor"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}
                >
                  💬 Заказать проект
                </a>
                <a
                  href="https://max.ru/u/9LHodD0cOKSEfyoFFiNHDKKda2DJEQla4TlbxlDSi7pGygeSc3tM9PafS5g"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}
                >
                  🚀 Пригласить в команду
                </a>
              </div>

              {/* Location + format */}
              <div className="flex flex-wrap gap-4 mt-6">
                {["📍 Пушкино, МО", "💻 Удалённо / Офис МСК", "⚡ Полная занятость"].map((t, i) => (
                  <span key={i} className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div
              className="flex justify-center lg:justify-end transition-all duration-1000"
              style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateX(0) scale(1)" : "translateX(40px) scale(0.95)", transitionDelay: "200ms" }}
            >
              <div className="relative">
                {/* Glow rings */}
                <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)", transform: "scale(1.2)" }} />
                <div className="absolute -inset-4 rounded-full" style={{ background: "conic-gradient(from 0deg, #8b5cf6, #f97316, #06b6d4, #8b5cf6)", opacity: 0.3, filter: "blur(20px)" }} />
                <img
                  src={PHOTO_URL}
                  alt="Красноруцкий Евгений"
                  className="relative rounded-3xl object-cover"
                  style={{ width: 340, height: 420, objectPosition: "center top", border: "2px solid rgba(139,92,246,0.3)" }}
                />
                {/* Badge */}
                <div className="absolute -bottom-4 -right-4 px-4 py-2 rounded-2xl text-xs font-bold" style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa", backdropFilter: "blur(10px)" }}>
                  250 000 ₽ / мес
                </div>
                <div className="absolute -top-4 -left-4 px-4 py-2 rounded-2xl text-xs font-bold" style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(249,115,22,0.4)", color: "#fb923c", backdropFilter: "blur(10px)" }}>
                  5+ лет опыта
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>скролл</span>
          <div className="w-px h-8" style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.5), transparent)" }} />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
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

      {/* ── PROJECTS ─────────────────────────────────────────────────────── */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
            Реальные продукты в продакшне
          </div>
          <h2 className="text-4xl lg:text-5xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Портфолио
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
            Не учебные проекты — живые системы, которыми пользуются реальные компании прямо сейчас
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROJECTS.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      </section>

      {/* ── STACK ────────────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#22d3ee" }}>
                Технический стек
              </div>
              <h2 className="text-4xl font-black mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Что умею
              </h2>
              <p className="mb-8" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
                Полный цикл: от постановки задачи до деплоя в продакшн.
                Работаю с AI/LLM-стеком (RAG, MCP, агенты), строю backend на Python,
                фронт на React + TypeScript, интегрирую API и платёжные системы.
              </p>
              <div className="space-y-4">
                {STACK.map((s, i) => (
                  <SkillBar key={i} name={s.name} level={s.level} color={s.color} delay={i * 80} />
                ))}
              </div>
            </div>

            {/* About me */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                О себе
              </div>
              <h2 className="text-4xl font-black mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Кто я
              </h2>
              <div className="space-y-4">
                {[
                  { icon: "⚡", label: "Моя суперсила", text: "Превращаю размытое ТЗ в работающий продукт. Умею одновременно видеть бизнес-задачу и техническое решение." },
                  { icon: "🎯", label: "В работе ценю", text: "Конкретный результат, а не процесс. Запущенный продукт важнее идеального кода." },
                  { icon: "🤝", label: "Ищу", text: "Сильную команду или проект с интересной бизнес-задачей. Готов к офферу — удалённо или офис в МСК." },
                  { icon: "🔧", label: "Технологии", text: "MCP, RAG, Model Context Protocol, VoIP, NLP, машинное обучение, платёжные шлюзы, IP-телефония." },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex gap-3 items-start">
                      <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</div>
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EXPERIENCE ───────────────────────────────────────────────────── */}
      <section className="py-24 max-w-5xl mx-auto px-6">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
            Опыт работы
          </div>
          <h2 className="text-4xl font-black" style={{ fontFamily: "Montserrat, sans-serif" }}>Что реализовал</h2>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, #8b5cf6, #f97316, transparent)" }} />

          <div className="space-y-6 pl-16">
            {[
              { year: "2021–2026", company: "Unistory.app — Технологии для бизнеса", role: "AI-Архитектор бизнес-процессов", items: ["CRM-система с AI-агентами для автоматизации продаж", "Мультиагентные системы для ведения клиентов", "CAD-построитель с автоматическим расчётом смет", "Система голосового управления корпоративными ресурсами", "AI-калькуляторы и сметчики для быстрого расчёта стоимости", "Интеграция платёжных систем (банковские карты, СБП)", "IP-телефония с функциями маршрутизации и записи звонков"] },
            ].map((exp, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-10 w-3 h-3 rounded-full border-2 mt-1.5" style={{ background: "#8b5cf6", borderColor: "#080810", left: -40 }} />
                <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex flex-wrap gap-3 items-start justify-between mb-1">
                    <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>{exp.company}</h3>
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>{exp.year}</span>
                  </div>
                  <p className="text-sm mb-4" style={{ color: "#f97316" }}>{exp.role}</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {exp.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                        <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#f97316" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESS ──────────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black" style={{ fontFamily: "Montserrat, sans-serif" }}>Как работаю</h2>
            <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Прозрачный процесс — без пропаданий и «ещё чуть-чуть»</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { step: "01", icon: "📞", title: "Бриф", desc: "Разбираемся в задаче, определяем цели и метрики успеха" },
              { step: "02", icon: "🏗️", title: "Архитектура", desc: "Проектирую систему, выбираю стек, оцениваю сроки" },
              { step: "03", icon: "⚙️", title: "Разработка", desc: "Код, тесты, итерации. Регулярные демо — без сюрпризов" },
              { step: "04", icon: "🚀", title: "Деплой", desc: "Запуск в продакшн, обучение команды, поддержка" },
            ].map((s, i) => (
              <div key={i} className="p-6 rounded-2xl text-center group hover:-translate-y-1 transition-all duration-300" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-3xl mb-3">{s.icon}</div>
                <div className="text-xs font-bold mb-2" style={{ color: "rgba(139,92,246,0.6)", fontFamily: "Montserrat, sans-serif" }}>{s.step}</div>
                <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)" }} />
          <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Выберите свой путь
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)" }}>Работаю на двух треках одновременно</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Заказ */}
            <div className="p-8 rounded-3xl text-center group" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(249,115,22,0.03))", border: "1.5px solid rgba(249,115,22,0.25)" }}>
              <div className="text-5xl mb-4">💼</div>
              <h3 className="text-2xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Нужен продукт?</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                От идеи до живого продукта. AI-агенты, CRM, калькуляторы, автоматизация — под ключ с гарантией результата.
              </p>
              <a
                href="https://t.me/krasnor"
                target="_blank"
                rel="noreferrer"
                className="inline-block w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 24px rgba(249,115,22,0.3)" }}
              >
                Заказать разработку → Telegram
              </a>
            </div>

            {/* Найм */}
            <div className="p-8 rounded-3xl text-center" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))", border: "1.5px solid rgba(139,92,246,0.25)" }}>
              <div className="text-5xl mb-4">🤝</div>
              <h3 className="text-2xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Ищете в команду?</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Готов к офферу от 250 000 ₽. Удалённо или офис в Москве. Принесу AI-экспертизу и закрою боль с автоматизацией.
              </p>
              <a
                href="https://max.ru/u/9LHodD0cOKSEfyoFFiNHDKKda2DJEQla4TlbxlDSi7pGygeSc3tM9PafS5g"
                target="_blank"
                rel="noreferrer"
                className="inline-block w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}
              >
                Пригласить в команду → Резюме
              </a>
            </div>
          </div>

          {/* Contacts row */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {[
              { label: "Telegram", value: "@krasnor", href: "https://t.me/krasnor", color: "#06b6d4" },
              { label: "Телефон", value: "+7 (977) 606-89-01", href: "tel:+79776068901", color: "#10b981" },
              { label: "Email", value: "19.jeka.94@gmail.com", href: "mailto:19.jeka.94@gmail.com", color: "#f97316" },
            ].map((c, i) => (
              <a
                key={i}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-105"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{c.label}:</span>
                <span>{c.value}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-8 text-xs" style={{ color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        Красноруцкий Евгений · CPO / AI-разработчик · 2026
      </div>
    </div>
  );
}

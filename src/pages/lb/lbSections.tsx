// ── Все секции страницы личного бренда ───────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import { PHOTO_URL, PROJECTS, STACK, STATS, REVIEWS, PRICING, TECH_LOGOS, ALL_SCREENSHOTS, EXPERIENCE, TG_LINK, MAX_LINK } from "./lbData";
import { TypeWriter, GridBg, ProjectCard, SkillBar, Particles, Lightbox } from "./lbAtoms";

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
              {/* Hover overlay */}
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

// ── Stack + About ─────────────────────────────────────────────────────────────
export function LBStackAbout() {
  return (
    <section id="stack" className="py-24" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#22d3ee" }}>
              Технический стек
            </div>
            <h2 className="text-4xl font-black mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>Что умею</h2>
            <p className="mb-8" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
              Полный цикл: от постановки задачи до деплоя в продакшн.
              AI/LLM-стек (RAG, MCP, агенты), backend на Python, фронт на React, интеграции API и платёжные системы.
            </p>
            <div className="space-y-4">
              {STACK.map((s, i) => <SkillBar key={i} name={s.name} level={s.level} color={s.color} delay={i * 80} />)}
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
              О себе
            </div>
            <h2 className="text-4xl font-black mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>Кто я</h2>
            <div className="space-y-4">
              {[
                { icon: "🏗️", label: "Архитектор процессов", text: "Проектирую бизнес-процессы с нуля и оптимизирую существующие. Внедряю AI там, где это даёт реальный результат в деньгах и скорости." },
                { icon: "📊", label: "Аналитика данных", text: "Строю системы сбора, обработки и визуализации данных. P&L, воронки, динамика — реальные дашборды с автоматическим обновлением." },
                { icon: "⚡", label: "Моя суперсила", text: "Превращаю размытое ТЗ в работающий продукт. Вижу одновременно бизнес-задачу и техническое решение." },
                { icon: "🤝", label: "Ищу", text: "Сильную команду или интересный проект. Готов к офферу — удалённо или офис в МСК." },
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
  );
}

// ── Experience ────────────────────────────────────────────────────────────────
export function LBExperience() {
  return (
    <section id="experience" className="py-24 max-w-5xl mx-auto px-6">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
          Опыт работы
        </div>
        <h2 className="text-4xl font-black" style={{ fontFamily: "Montserrat, sans-serif" }}>Что реализовал</h2>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, #8b5cf6, #f97316, transparent)" }} />
        <div className="space-y-5 pl-16">
          {EXPERIENCE.map((exp, i) => (
            <div key={i} className="relative">
              <div className="absolute w-3 h-3 rounded-full border-2 mt-2" style={{ background: i === 0 ? "#8b5cf6" : "rgba(139,92,246,0.4)", borderColor: "#080810", left: -40 }} />
              <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex flex-wrap gap-3 items-start justify-between mb-1">
                  <div>
                    <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>{exp.companyFull}</h3>
                    <p className="text-sm mt-0.5" style={{ color: "#f97316" }}>{exp.role}</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>{exp.year}</span>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-4">
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
  );
}

// ── Process (переработанный) ──────────────────────────────────────────────────
export function LBProcess() {
  const steps = [
    {
      step: "01",
      title: "Погружение в бизнес",
      desc: "Изучаю процессы, выявляю узкие места. Задаю неудобные вопросы — без них не бывает правильных решений.",
      metric: "1–2 дня",
    },
    {
      step: "02",
      title: "Архитектура решения",
      desc: "Проектирую систему с учётом масштабирования. Выбираю стек под задачу, а не под моду. Фиксирую в документе.",
      metric: "3–5 дней",
    },
    {
      step: "03",
      title: "Итеративная разработка",
      desc: "Спринты по 1–2 недели. После каждого — рабочий демо. Вы контролируете прогресс, а не ждёте финала.",
      metric: "4–8 недель",
    },
    {
      step: "04",
      title: "Запуск и передача",
      desc: "Деплой, нагрузочное тестирование, обучение команды, документация. Поддержка первый месяц включена.",
      metric: "1–3 дня",
    },
  ];

  return (
    <section className="py-24" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>Как строю проекты</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Прозрачный процесс без сюрпризов — вы видите результат на каждом этапе</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((s, i) => (
            <div key={i} className="relative p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa", fontFamily: "Montserrat, sans-serif" }}>
                  {s.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>{s.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" }}>{s.metric}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Гарантии */}
        <div className="mt-8 p-6 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(249,115,22,0.05))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { icon: "📋", label: "Фиксированное ТЗ", desc: "Стоимость не растёт без согласования" },
              { icon: "🔄", label: "Регулярные демо", desc: "Прогресс виден каждые 1–2 недели" },
              { icon: "📚", label: "Документация", desc: "Код и процессы задокументированы" },
            ].map((g, i) => (
              <div key={i}>
                <div className="text-2xl mb-1">{g.icon}</div>
                <div className="text-sm font-semibold text-white mb-0.5">{g.label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{g.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Analytics Accent ──────────────────────────────────────────────────────────
export function LBAnalytics() {
  const shots = [
    { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c506c61e-4161-4bae-b929-90e70814ce92.png", label: "Обзор метрик" },
    { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/2d466914-6eae-455d-b18f-8d21a26b7569.png", label: "Финансы P&L" },
    { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/5959ad19-5d27-4d4c-8828-12a95c55513b.png", label: "Динамика продаж" },
  ];
  const [active, setActive] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % shots.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="py-24 max-w-5xl mx-auto px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Screenshot preview */}
        <div className="relative">
          <div className="relative rounded-2xl overflow-hidden cursor-zoom-in" style={{ border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 0 60px rgba(139,92,246,0.15)" }} onClick={() => setLightboxIdx(active)}>
            {shots.map((s, i) => (
              <img key={i} src={s.url} alt={s.label} className="w-full transition-all duration-700 absolute inset-0" style={{ opacity: i === active ? 1 : 0, position: i === 0 ? "relative" : "absolute" }} />
            ))}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {shots.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setActive(i); }} className="rounded-full transition-all duration-300" style={{ width: i === active ? 20 : 6, height: 6, background: i === active ? "#8b5cf6" : "rgba(255,255,255,0.3)" }} />
              ))}
            </div>
            <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>🔍 Увеличить</div>
          </div>
          <div className="mt-3 text-center text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{shots[active].label}</div>
          {lightboxIdx !== null && <Lightbox images={shots.map(s => s.url)} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />}
        </div>

        {/* Text */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
            Аналитика данных
          </div>
          <h2 className="text-3xl lg:text-4xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Данные — это<br />
            <span style={{ background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              управленческий актив
            </span>
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
            Строю системы, где данные собираются автоматически и превращаются в решения. Не просто красивые графики — а реальные инструменты управления бизнесом.
          </p>
          <div className="space-y-3">
            {[
              { icon: "📈", text: "P&L в реальном времени — доходы, затраты, маржа по каждому заказу" },
              { icon: "🔄", text: "Воронка продаж с конверсией на каждом этапе" },
              { icon: "📊", text: "Динамика выручки и прибыли по месяцам — графики и тренды" },
              { icon: "⚠️", text: "Автоматические алерты при просроченных событиях" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export function LBReviews() {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAuto = () => { intervalRef.current = setInterval(() => setCurrent(c => (c + 1) % REVIEWS.length), 4500); };
  const stopAuto = () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  useEffect(() => { startAuto(); return stopAuto; }, []);

  return (
    <section id="reviews" className="py-24 max-w-5xl mx-auto px-6">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
          Говорят заказчики
        </div>
        <h2 className="text-4xl font-black" style={{ fontFamily: "Montserrat, sans-serif" }}>Отзывы</h2>
      </div>

      <div className="hidden md:grid grid-cols-2 gap-4">
        {REVIEWS.map((r, i) => (
          <div key={i} className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${r.color}30` }}>
            <div className="text-2xl mb-4" style={{ color: r.color }}>❝</div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.7)" }}>{r.text}</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${r.color}25`, border: `1px solid ${r.color}40`, color: r.color }}>{r.avatar}</div>
              <div>
                <div className="text-sm font-semibold text-white">{r.author}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="md:hidden" onMouseEnter={stopAuto} onMouseLeave={startAuto}>
        <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${REVIEWS[current].color}30` }}>
          <div className="text-2xl mb-4" style={{ color: REVIEWS[current].color }}>❝</div>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.7)" }}>{REVIEWS[current].text}</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${REVIEWS[current].color}25`, border: `1px solid ${REVIEWS[current].color}40`, color: REVIEWS[current].color }}>{REVIEWS[current].avatar}</div>
            <div>
              <div className="text-sm font-semibold text-white">{REVIEWS[current].author}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{REVIEWS[current].role}</div>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          {REVIEWS.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className="rounded-full transition-all duration-300" style={{ width: i === current ? 20 : 6, height: 6, background: i === current ? "#8b5cf6" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export function LBPricing() {
  return (
    <section id="pricing" className="py-24" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
            Прозрачные условия
          </div>
          <h2 className="text-4xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>Форматы работы</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Выберите подходящий формат сотрудничества</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PRICING.map((plan, i) => (
            <div key={i} className="relative p-6 rounded-3xl flex flex-col transition-all duration-300 hover:-translate-y-2"
              style={{
                background: plan.popular ? `linear-gradient(135deg, ${plan.color}15, ${plan.color}05)` : "rgba(255,255,255,0.025)",
                border: `1.5px solid ${plan.popular ? plan.color : `${plan.color}30`}`,
                boxShadow: plan.popular ? `0 0 40px ${plan.glow}` : "none",
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold" style={{ background: plan.color, color: "#0a0a14" }}>
                  Популярный
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{plan.title}</h3>
                <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>{plan.description}</p>
                <div className="text-3xl font-black mb-1" style={{ color: plan.color, fontFamily: "Montserrat, sans-serif" }}>{plan.price}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>⏱ {plan.duration}</div>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                    <span className="mt-0.5 flex-shrink-0 text-xs" style={{ color: plan.color }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a href={plan.href} target="_blank" rel="noreferrer"
                className="block text-center py-3 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95"
                style={plan.popular
                  ? { background: plan.color, color: "#0a0a14", boxShadow: `0 4px 20px ${plan.glow}` }
                  : { background: `${plan.color}15`, color: plan.color, border: `1px solid ${plan.color}40` }
                }
              >
                {plan.cta} →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA (упрощённый — только контакты) ─────────────────────────────────
export function LBCta() {
  return (
    <section id="cta" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%)" }} />
        <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl lg:text-5xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Давайте обсудим<br />
          <span style={{ background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            вашу задачу
          </span>
        </h2>
        <p className="text-base mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
          Первая консультация — бесплатно. Расскажите задачу, я скажу как её решить.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <a href={TG_LINK} target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 24px rgba(249,115,22,0.35)" }}>
            ✈️ Telegram — @JoniKras
          </a>
          <a href={MAX_LINK} target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}>
            🚀 Написать в MAX
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {[
            { label: "Телефон", value: "+7 (977) 606-89-01", href: "tel:+79776068901", color: "#10b981" },
            { label: "Email", value: "19.jeka.94@gmail.com", href: "mailto:19.jeka.94@gmail.com", color: "#f97316" },
          ].map((c, i) => (
            <a key={i} href={c.href} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{c.label}:</span>
              <span>{c.value}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
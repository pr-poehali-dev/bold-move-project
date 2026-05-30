// ── Все секции страницы личного бренда ───────────────────────────────────────
import { PHOTO_URL, PROJECTS, STACK, STATS } from "./lbData";
import { TypeWriter, GridBg, ProjectCard, SkillBar } from "./lbAtoms";

// ── Hero ──────────────────────────────────────────────────────────────────────
export function LBHero({ heroVisible }: { heroVisible: boolean }) {
  return (
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

// ── Portfolio ─────────────────────────────────────────────────────────────────
export function LBPortfolio() {
  return (
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
  );
}

// ── Stack + About ─────────────────────────────────────────────────────────────
export function LBStackAbout() {
  return (
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
  );
}

// ── Experience ────────────────────────────────────────────────────────────────
export function LBExperience() {
  return (
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
  );
}

// ── Process ───────────────────────────────────────────────────────────────────
export function LBProcess() {
  return (
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
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
export function LBCta() {
  return (
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
  );
}

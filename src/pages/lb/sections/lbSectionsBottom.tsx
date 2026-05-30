// ── Нижние секции: Process, Reviews, Pricing, Cta ────────────────────────────
import { useState, useRef, useEffect } from "react";
import { REVIEWS, PRICING, TG_LINK, MAX_LINK } from "../lbData";

// ── Process ───────────────────────────────────────────────────────────────────
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

// ── Final CTA ─────────────────────────────────────────────────────────────────
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
            💬 Написать в Telegram
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
// ── Нижние секции: Process, Reviews, Pricing, Cta ────────────────────────────
import { useState, useRef, useEffect } from "react";
import { REVIEWS, PRICING, TG_LINK, MAX_LINK } from "../lbData";

// ── Process ───────────────────────────────────────────────────────────────────
export function LBProcess() {
  const steps = [
    { step: "01", title: "Погружение в бизнес", desc: "Изучаю процессы, выявляю узкие места. Задаю неудобные вопросы — без них не бывает правильных решений.", metric: "1–2 дня" },
    { step: "02", title: "Архитектура решения", desc: "Проектирую систему с учётом масштабирования. Выбираю стек под задачу, а не под моду.", metric: "3–5 дней" },
    { step: "03", title: "Итеративная разработка", desc: "Спринты по 1–2 недели. После каждого — рабочий демо. Вы контролируете прогресс.", metric: "4–8 недель" },
    { step: "04", title: "Запуск и передача", desc: "Деплой, обучение команды, документация. Поддержка первый месяц включена.", metric: "1–3 дня" },
  ];

  return (
    <section className="py-14 sm:py-20" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl sm:text-4xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Как строю проекты</h2>
          <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Прозрачный процесс — вы видите результат на каждом этапе</p>
        </div>

        {/* На мобиле — 1 колонка, на sm — 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((s, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa", fontFamily: "Montserrat, sans-serif" }}>
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>{s.title}</h3>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" }}>{s.metric}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Гарантии — компактнее */}
        <div className="mt-4 p-4 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(249,115,22,0.05))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: "📋", label: "Фиксированное ТЗ", desc: "Цена не растёт" },
              { icon: "🔄", label: "Демо каждые 2 нед.", desc: "Видите прогресс" },
              { icon: "📚", label: "Документация", desc: "Код задокументирован" },
            ].map((g, i) => (
              <div key={i}>
                <div className="text-xl mb-0.5">{g.icon}</div>
                <div className="text-xs font-semibold text-white mb-0.5 leading-tight">{g.label}</div>
                <div className="text-xs hidden sm:block" style={{ color: "rgba(255,255,255,0.4)" }}>{g.desc}</div>
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
    <section id="reviews" className="py-14 sm:py-20 max-w-5xl mx-auto px-4 sm:px-6">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
          Говорят заказчики
        </div>
        <h2 className="text-2xl sm:text-4xl font-black" style={{ fontFamily: "Montserrat, sans-serif" }}>Отзывы</h2>
      </div>

      {/* Десктоп — сетка */}
      <div className="hidden md:grid grid-cols-2 gap-4">
        {REVIEWS.map((r, i) => (
          <div key={i} className="p-5 rounded-2xl hover:-translate-y-1 transition-all duration-300" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${r.color}30` }}>
            <div className="text-xl mb-3" style={{ color: r.color }}>❝</div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>{r.text}</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${r.color}25`, border: `1px solid ${r.color}40`, color: r.color }}>{r.avatar}</div>
              <div>
                <div className="text-xs font-semibold text-white">{r.author}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Мобиль — карусель */}
      <div className="md:hidden" onTouchStart={stopAuto} onTouchEnd={startAuto}>
        <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${REVIEWS[current].color}30` }}>
          <div className="text-xl mb-3" style={{ color: REVIEWS[current].color }}>❝</div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>{REVIEWS[current].text}</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${REVIEWS[current].color}25`, border: `1px solid ${REVIEWS[current].color}40`, color: REVIEWS[current].color }}>{REVIEWS[current].avatar}</div>
            <div>
              <div className="text-xs font-semibold text-white">{REVIEWS[current].author}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{REVIEWS[current].role}</div>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {REVIEWS.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className="rounded-full transition-all duration-300" style={{ width: i === current ? 18 : 5, height: 5, background: i === current ? "#8b5cf6" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export function LBPricing() {
  return (
    <section id="pricing" className="py-14 sm:py-20" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
            Прозрачные условия
          </div>
          <h2 className="text-2xl sm:text-4xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Форматы работы</h2>
          <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Выберите подходящий формат сотрудничества</p>
        </div>

        {/* Горизонтальный скролл на мобиле */}
        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible scrollbar-none">
          {PRICING.map((plan, i) => (
            <div
              key={i}
              className="relative flex-shrink-0 w-72 sm:w-80 md:w-auto p-5 rounded-2xl flex flex-col"
              style={{
                background: plan.popular ? `linear-gradient(135deg, ${plan.color}15, ${plan.color}05)` : "rgba(255,255,255,0.025)",
                border: `1.5px solid ${plan.popular ? plan.color : `${plan.color}30`}`,
                boxShadow: plan.popular ? `0 0 30px ${plan.glow}` : "none",
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold" style={{ background: plan.color, color: "#0a0a14" }}>
                  Популярный
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{plan.title}</h3>
                <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>{plan.description}</p>
                <div className="text-2xl font-black mb-0.5" style={{ color: plan.color, fontFamily: "Montserrat, sans-serif" }}>{plan.price}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>⏱ {plan.duration}</div>
              </div>
              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: plan.color }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                target="_blank"
                rel="noreferrer"
                className="block text-center py-2.5 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95"
                style={plan.popular
                  ? { background: plan.color, color: "#0a0a14", boxShadow: `0 4px 16px ${plan.glow}` }
                  : { background: `${plan.color}15`, color: plan.color, border: `1px solid ${plan.color}40` }
                }
              >
                {plan.cta} →
              </a>
            </div>
          ))}
        </div>

        {/* Подсказка скролла — только мобиль */}
        <p className="text-center text-xs mt-2 md:hidden" style={{ color: "rgba(255,255,255,0.25)" }}>← прокрутите →</p>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
export function LBCta() {
  return (
    <section id="cta" className="py-14 sm:py-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 sm:left-1/4 top-1/2 -translate-y-1/2 w-64 sm:w-96 h-64 sm:h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)" }} />
        <div className="absolute right-0 sm:right-1/4 top-1/2 -translate-y-1/2 w-64 sm:w-96 h-64 sm:h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Давайте обсудим<br />
          <span style={{ background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            вашу задачу
          </span>
        </h2>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
          Первая консультация — бесплатно.
        </p>

        {/* Кнопки во всю ширину на мобиле */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <a href={TG_LINK} target="_blank" rel="noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 20px rgba(249,115,22,0.3)" }}>
            💬 Написать в Telegram
          </a>
          <a href={MAX_LINK} target="_blank" rel="noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}>
            🚀 Написать в MAX
          </a>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
          {[
            { label: "Телефон", value: "+7 (977) 606-89-01", href: "tel:+79776068901", color: "#10b981" },
            { label: "Email", value: "19.jeka.94@gmail.com", href: "mailto:19.jeka.94@gmail.com", color: "#f97316" },
          ].map((c, i) => (
            <a key={i} href={c.href} target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
              <span style={{ color: "rgba(255,255,255,0.35)" }}>{c.label}:</span>
              <span>{c.value}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

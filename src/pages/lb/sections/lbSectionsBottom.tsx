// ── Нижние секции: Process, Reviews, Pricing, Cta ────────────────────────────
import { useState, useRef, useEffect } from "react";
import { REVIEWS, PRICING, TG_LINK, MAX_LINK } from "../lbData";

// ── Process ───────────────────────────────────────────────────────────────────
export function LBProcess() {
  const steps = [
    { step: "01", title: "Погружение в бизнес", desc: "Изучаю процессы, выявляю узкие места. Задаю неудобные вопросы — без них не бывает правильных решений.", metric: "1–2 дня" },
    { step: "02", title: "Архитектура решения", desc: "Проектирую систему с учётом масштабирования. Выбираю стек под задачу, а не под моду.", metric: "3–5 дней" },
    { step: "03", title: "Итеративная разработка", desc: "Спринты по 1–2 недели. После каждого — рабочий демо. Вы контролируете прогресс.", metric: "2–4 недели" },
    { step: "04", title: "Запуск и передача", desc: "Деплой, обучение команды, документация. Поддержка первый месяц включена.", metric: "1–3 дня" },
  ];

  return (
    <section className="py-8 sm:py-16" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl sm:text-4xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Как строю проекты</h2>
          <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Прозрачный процесс — вы видите результат на каждом этапе</p>
        </div>
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
        <div className="mt-4 p-4 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(249,115,22,0.05))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: "📋", label: "Фиксированное ТЗ", desc: "Цена не растёт" },
              { icon: "🔄", label: "Демо каждые 3 дня", desc: "Видите прогресс" },
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
  const touchStartX = useRef<number | null>(null);

  const startAuto = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setCurrent(c => (c + 1) % REVIEWS.length), 4500);
  };
  const stopAuto = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  useEffect(() => { startAuto(); return stopAuto; }, []);

  const goTo = (idx: number) => {
    setCurrent(idx);
    startAuto(); // сброс таймера при ручном переключении
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    stopAuto();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      const next = delta < 0
        ? (current + 1) % REVIEWS.length
        : (current - 1 + REVIEWS.length) % REVIEWS.length;
      goTo(next);
    } else {
      startAuto();
    }
    touchStartX.current = null;
  };

  return (
    <section id="reviews" className="py-8 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
      <div className="mb-5 text-center">
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

      {/* Мобиль — свайп-карусель */}
      <div
        className="md:hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="p-4 rounded-xl transition-all duration-300"
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${REVIEWS[current].color}30` }}
        >
          <div className="text-xl mb-3" style={{ color: REVIEWS[current].color }}>❝</div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>{REVIEWS[current].text}</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${REVIEWS[current].color}25`, border: `1px solid ${REVIEWS[current].color}40`, color: REVIEWS[current].color }}>{REVIEWS[current].avatar}</div>
            <div>
              <div className="text-sm font-semibold text-white">{REVIEWS[current].author}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{REVIEWS[current].role}</div>
            </div>
          </div>
        </div>

        {/* Точки + стрелки */}
        <div className="flex justify-center items-center gap-3 mt-4">
          <button
            onClick={() => goTo((current - 1 + REVIEWS.length) % REVIEWS.length)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >←</button>
          <div className="flex gap-2 items-center">
            {REVIEWS.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className="rounded-full transition-all duration-300" style={{ width: i === current ? 20 : 6, height: 6, background: i === current ? "#8b5cf6" : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
          <button
            onClick={() => goTo((current + 1) % REVIEWS.length)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >→</button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>← свайп →</p>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export function LBPricing() {
  return (
    <section id="pricing" className="py-8 sm:py-16" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
            Прозрачные условия
          </div>
          <h2 className="text-2xl sm:text-4xl font-black mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Форматы работы</h2>
          <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Выберите подходящий формат сотрудничества</p>
        </div>

        {/* На мобиле — вертикальный стек, десктоп — 3 колонки */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-3">
          {PRICING.map((plan, i) => (
            <div
              key={i}
              className="relative p-5 rounded-2xl flex flex-col"
              style={{
                background: plan.popular ? `linear-gradient(135deg, ${plan.color}15, ${plan.color}05)` : "rgba(255,255,255,0.025)",
                border: `1.5px solid ${plan.popular ? plan.color : `${plan.color}30`}`,
                boxShadow: plan.popular ? `0 0 30px ${plan.glow}` : "none",
                // Отступ сверху для лейбла — только если есть лейбл
                marginTop: plan.popular ? "16px" : "0",
              }}
            >
              {/* Лейбл — внутри карточки сверху, не absolute */}
              {plan.popular && (
                <div className="flex justify-center mb-3 -mt-8">
                  <span className="px-4 py-1 rounded-full text-xs font-bold" style={{ background: plan.color, color: "#0a0a14" }}>
                    Популярный
                  </span>
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
              <button
                onClick={() => window.open(plan.href, "_blank", "noopener,noreferrer")}
                className="block w-full text-center py-3 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 cursor-pointer"
                style={plan.popular
                  ? { background: plan.color, color: "#0a0a14", boxShadow: `0 4px 16px ${plan.glow}`, border: "none" }
                  : { background: `${plan.color}15`, color: plan.color, border: `1px solid ${plan.color}40` }
                }
              >
                {plan.cta} →
              </button>
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
    <section id="cta" className="py-8 sm:py-16 relative overflow-hidden">
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

        {/* Основные кнопки */}
        <div className="flex flex-col gap-3 mb-4">
          <button onClick={() => window.open(TG_LINK, "_blank", "noopener,noreferrer")}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 cursor-pointer w-full"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", boxShadow: "0 4px 20px rgba(249,115,22,0.3)", border: "none" }}>
            💬 Написать в Telegram
          </button>
          <button onClick={() => window.open(MAX_LINK, "_blank", "noopener,noreferrer")}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 cursor-pointer w-full"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1.5px solid rgba(139,92,246,0.4)" }}>
            🚀 Написать в MAX
          </button>
        </div>

        {/* Телефон и email — тоже кнопки */}
        <div className="flex flex-col sm:flex-row gap-2">
          <a href="tel:+79776068901"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
            📞 +7 (977) 606-89-01
          </a>
          <a href="mailto:19.jeka.94@gmail.com"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
            ✉️ 19.jeka.94@gmail.com
          </a>
        </div>
      </div>
    </section>
  );
}
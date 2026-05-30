// ── Средние секции: StackAbout, Analytics, Experience ────────────────────────
import { useState, useEffect } from "react";
import { STACK, EXPERIENCE } from "../lbData";
import { SkillBar, Lightbox } from "../lbAtoms";

// ── Stack + About ─────────────────────────────────────────────────────────────
const BEFORE_AFTER = [
  {
    before: "Делают «по ТЗ» — задача закрыта, бизнес не вырос",
    after:  "Погружаюсь в процессы, задаю неудобные вопросы и решаю реальную задачу бизнеса",
  },
  {
    before: "Сдали код — дальше разбирайтесь сами",
    after:  "Обучаю команду, веду за руку до полного владения продуктом",
  },
  {
    before: "Смета х2–3 в процессе, без предупреждения",
    after:  "Фиксирую стоимость в ТЗ. Цена не меняется без вашего согласия",
  },
  {
    before: "Широкий консалтинг? — не наш профиль",
    after:  "Помогаю выстроить процессы, внедрить AI и масштабировать результат после запуска",
  },
];

const STATS = [
  { value: "6+", label: "лет опыта" },
  { value: "40+", label: "проектов" },
  { value: "30+", label: "клиентов" },
  { value: "48ч", label: "до первого демо" },
];

export function LBStackAbout() {
  return (
    <>
      {/* ── Кто я — До / После ─────────────────────────────────────────── */}
      <section id="about" className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          {/* Шапка с аватаром */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
            <div className="flex-shrink-0">
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden"
                style={{ border: "2px solid rgba(139,92,246,0.4)", boxShadow: "0 0 32px rgba(139,92,246,0.2)" }}
              >
                <img
                  src="https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/cd4b33c6-bf9c-47e5-b633-fa3b8f456fbf.jpg"
                  alt="Евгений Красноруцкий"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-2" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                О себе
              </div>
              <h2 className="text-2xl sm:text-4xl font-black mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>Кто я</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                Fullstack-разработчик + AI-интегратор. Пришёл в код из бизнеса —<br className="hidden sm:block" /> поэтому говорю на языке задач, а не технологий.
              </p>
            </div>
          </div>

          {/* Цифры */}
          <div className="grid grid-cols-4 gap-3 mb-10">
            {STATS.map((s, i) => (
              <div key={i} className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-xl sm:text-3xl font-black mb-0.5" style={{ fontFamily: "Montserrat, sans-serif", background: "linear-gradient(135deg, #a78bfa, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.value}</div>
                <div className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* До / После */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-2">
            <div className="p-3 sm:p-4 rounded-xl text-center" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(239,68,68,0.7)" }}>😤 Как обычно бывает</div>
              <div className="space-y-2">
                {BEFORE_AFTER.map((item, i) => (
                  <div key={i} className="text-xs sm:text-sm text-left px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                    {item.before}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl text-center" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)", boxShadow: "0 0 24px rgba(139,92,246,0.08)" }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#a78bfa" }}>✅ Как у меня</div>
              <div className="space-y-2">
                {BEFORE_AFTER.map((item, i) => (
                  <div key={i} className="text-xs sm:text-sm text-left px-3 py-2 rounded-lg" style={{ background: "rgba(139,92,246,0.08)", color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                    {item.after}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Стек ──────────────────────────────────────────────────────────── */}
      <section id="stack" className="py-14 sm:py-20" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#22d3ee" }}>
            Технический стек
          </div>
          <h2 className="text-2xl sm:text-4xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>Что умею</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
            Полный цикл: от задачи до деплоя. AI/LLM-стек (RAG, MCP, агенты), Python, React, интеграции API и платёжные системы.
          </p>
          <div className="space-y-3 max-w-xl">
            {STACK.map((s, i) => <SkillBar key={i} name={s.name} level={s.level} color={s.color} delay={i * 80} />)}
          </div>
        </div>
      </section>
    </>
  );
}

// ── Analytics + SaaS/Bots/Agents Accent ──────────────────────────────────────
const ANALYTICS_TABS = [
  {
    id: "analytics",
    label: "📊 Аналитика",
    color: "#8b5cf6",
    title: "Данные — это",
    titleAccent: "управленческий актив",
    desc: "Строю системы, где данные собираются автоматически и превращаются в решения. Не просто красивые графики — реальные инструменты управления.",
    items: [
      { icon: "📈", text: "P&L в реальном времени — доходы, затраты, маржа" },
      { icon: "🔄", text: "Воронка продаж с конверсией на каждом этапе" },
      { icon: "📊", text: "Динамика выручки и прибыли — графики и тренды" },
      { icon: "⚠️", text: "Автоматические алерты при просроченных событиях" },
    ],
    shots: [
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c506c61e-4161-4bae-b929-90e70814ce92.png", label: "Обзор метрик" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/2d466914-6eae-455d-b18f-8d21a26b7569.png", label: "Финансы P&L" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/5959ad19-5d27-4d4c-8828-12a95c55513b.png", label: "Динамика продаж" },
    ],
  },
  {
    id: "saas",
    label: "🚀 SaaS",
    color: "#f97316",
    title: "Продукт под ключ",
    titleAccent: "работает и зарабатывает",
    desc: "Разрабатываю полноценные SaaS-платформы с монетизацией через подписку. От архитектуры до биллинга, личного кабинета и аналитики.",
    items: [
      { icon: "💳", text: "Биллинг и подписки — Stripe, ЮKassa, СБП, автосписание" },
      { icon: "👤", text: "Личный кабинет с ролями, тарифами и лимитами" },
      { icon: "📦", text: "Multi-tenant — каждый клиент в своём пространстве" },
      { icon: "📉", text: "Встроенная аналитика — MRR, Churn, LTV, конверсии" },
    ],
    shots: [
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3df2c7ac-4cdc-4747-958f-0946f4db2fe3.png", label: "SaaS: панель клиента" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/8ad1558a-3630-4de7-bc86-0867d74be5e7.png", label: "SaaS: white-label настройки" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/50afc0df-5ddb-48d4-9569-e1f37b898421.png", label: "SaaS: интеграции и PDF" },
    ],
  },
  {
    id: "agents",
    label: "🤖 Агенты",
    color: "#06b6d4",
    title: "Мультиагентные системы",
    titleAccent: "работают за людей",
    desc: "Строю голосовых агентов, чат-ботов и мультиагентные системы с RAG, MCP и подключением к внешним API.",
    items: [
      { icon: "🎙️", text: "Голосовые агенты — речь в текст, ответ голосом" },
      { icon: "🧠", text: "RAG — агент знает прайсы, правила, FAQ клиента" },
      { icon: "🔗", text: "Мультиагенты — координатор + специалисты" },
      { icon: "📨", text: "Telegram, MAX, WhatsApp, веб-виджет" },
    ],
    shots: [
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/4ecbbf9f-399f-4dfa-9f82-0f510e65acf4.png", label: "Агент: чат" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3416564e-b468-4a79-8b8e-eaade4459b53.png", label: "Агент: голосовой ввод" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/81d9f4de-68ac-481f-9ddd-432a4dd308af.png", label: "Агент: готовая смета" },
    ],
  },
];

export function LBAnalytics() {
  const [tab, setTab] = useState(0);
  const [active, setActive] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const current = ANALYTICS_TABS[tab];

  useEffect(() => {
    setActive(0);
    const t = setInterval(() => setActive(a => (a + 1) % current.shots.length), 3000);
    return () => clearInterval(t);
  }, [tab, current.shots.length]);

  return (
    <section className="py-14 sm:py-20" style={{ background: "rgba(255,255,255,0.01)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Вкладки — горизонтальный скролл на мобиле */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1 scrollbar-none">
          {ANALYTICS_TABS.map((t, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className="flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300"
              style={{
                background: tab === i ? `${t.color}20` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${tab === i ? t.color : "rgba(255,255,255,0.08)"}`,
                color: tab === i ? t.color : "rgba(255,255,255,0.45)",
                boxShadow: tab === i ? `0 0 16px ${t.color}25` : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* На мобиле — стекинг, на десктопе — сетка */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center">

          {/* Screenshot */}
          <div className="relative">
            <div
              className="relative rounded-xl sm:rounded-2xl overflow-hidden cursor-zoom-in transition-all duration-500"
              style={{ border: `1px solid ${current.color}40`, boxShadow: `0 0 40px ${current.color}15` }}
              onClick={() => setLightboxIdx(active)}
            >
              {current.shots.map((s, i) => (
                <img
                  key={i}
                  src={s.url}
                  alt={s.label}
                  className="w-full transition-all duration-700"
                  style={{ opacity: i === active ? 1 : 0, position: i === 0 ? "relative" : "absolute", top: 0, left: 0 }}
                />
              ))}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {current.shots.map((_, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setActive(i); }} className="rounded-full transition-all duration-300" style={{ width: i === active ? 16 : 5, height: 5, background: i === active ? current.color : "rgba(255,255,255,0.3)" }} />
                ))}
              </div>
              <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>🔍</div>
            </div>
            <div className="mt-2 text-center text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{current.shots[active]?.label}</div>
            {lightboxIdx !== null && (
              <Lightbox images={current.shots.map(s => s.url)} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
            )}
          </div>

          {/* Text */}
          <div key={tab}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: `${current.color}15`, border: `1px solid ${current.color}35`, color: current.color }}>
              {current.label}
            </div>
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {current.title}<br />
              <span style={{ background: `linear-gradient(90deg, ${current.color}, #8b5cf6)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {current.titleAccent}
              </span>
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>{current.desc}</p>
            <div className="space-y-2">
              {current.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${current.color}15` }}>
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <span className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{item.text}</span>
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
    <section id="experience" className="py-14 sm:py-20 max-w-5xl mx-auto px-4 sm:px-6">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
          Опыт работы
        </div>
        <h2 className="text-2xl sm:text-4xl font-black" style={{ fontFamily: "Montserrat, sans-serif" }}>Что реализовал</h2>
      </div>

      <div className="relative">
        <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, #8b5cf6, #f97316, transparent)" }} />
        <div className="space-y-4 pl-10 sm:pl-16">
          {EXPERIENCE.map((exp, i) => (
            <div key={i} className="relative">
              <div className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 mt-2" style={{ background: i === 0 ? "#8b5cf6" : "rgba(139,92,246,0.4)", borderColor: "#080810", left: -26 }} />
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex flex-wrap gap-2 items-start justify-between mb-1">
                  <div>
                    <h3 className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>{exp.companyFull}</h3>
                    <p className="text-xs sm:text-sm mt-0.5" style={{ color: "#f97316" }}>{exp.role}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>{exp.year}</span>
                </div>
                {/* На мобиле — 1 колонка, на десктопе — 2 */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-3">
                  {exp.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
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
// ── Средние секции: StackAbout, Analytics, Experience ────────────────────────
import { useState, useEffect } from "react";
import { STACK, EXPERIENCE } from "../lbData";
import { SkillBar, Lightbox } from "../lbAtoms";

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

// ── Analytics + SaaS/Bots/Agents Accent ──────────────────────────────────────
const ANALYTICS_TABS = [
  {
    id: "analytics",
    label: "📊 Аналитика",
    color: "#8b5cf6",
    title: "Данные — это",
    titleAccent: "управленческий актив",
    desc: "Строю системы, где данные собираются автоматически и превращаются в решения. Не просто красивые графики — реальные инструменты управления бизнесом.",
    items: [
      { icon: "📈", text: "P&L в реальном времени — доходы, затраты, маржа по каждому заказу" },
      { icon: "🔄", text: "Воронка продаж с конверсией на каждом этапе" },
      { icon: "📊", text: "Динамика выручки и прибыли по месяцам — графики и тренды" },
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
    label: "🚀 SaaS-продукты",
    color: "#f97316",
    title: "Продукт под ключ",
    titleAccent: "работает и зарабатывает",
    desc: "Разрабатываю полноценные SaaS-платформы с монетизацией через подписку. От архитектуры и лендинга до биллинга, личного кабинета и аналитики.",
    items: [
      { icon: "💳", text: "Биллинг и подписки — Stripe, ЮKassa, СБП, автоматическое списание" },
      { icon: "👤", text: "Личный кабинет с ролями, тарифами и лимитами на функции" },
      { icon: "📦", text: "Multi-tenant архитектура — каждый клиент в своём пространстве" },
      { icon: "📉", text: "Встроенная аналитика — MRR, Churn, LTV, конверсии по тарифам" },
    ],
    shots: [
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3df2c7ac-4cdc-4747-958f-0946f4db2fe3.png", label: "SaaS: панель клиента" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/8ad1558a-3630-4de7-bc86-0867d74be5e7.png", label: "SaaS: white-label настройки" },
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/50afc0df-5ddb-48d4-9569-e1f37b898421.png", label: "SaaS: интеграции и PDF" },
    ],
  },
  {
    id: "agents",
    label: "🤖 Боты и Агенты",
    color: "#06b6d4",
    title: "Мультиагентные системы",
    titleAccent: "работают за людей",
    desc: "Строю голосовых агентов, чат-ботов и мультиагентные системы с RAG, MCP и подключением к внешним API. Агент — это не скрипт, а думающий сотрудник.",
    items: [
      { icon: "🎙️", text: "Голосовые агенты — речь в текст, ответ голосом, распознавание интента" },
      { icon: "🧠", text: "RAG — агент знает ваши прайсы, правила, FAQ и отвечает точно" },
      { icon: "🔗", text: "Мультиагенты — координатор + специалисты: расчёт, бронь, уведомление" },
      { icon: "📨", text: "Telegram, MAX, WhatsApp, веб-виджет — в любом канале за пару часов" },
    ],
    shots: [
      { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/4ecbbf9f-399f-4dfa-9f82-0f510e65acf4.png", label: "Агент: чат-интерфейс" },
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

  // Авто-листание скриншотов
  useEffect(() => {
    setActive(0);
    const t = setInterval(() => setActive(a => (a + 1) % current.shots.length), 3000);
    return () => clearInterval(t);
  }, [tab, current.shots.length]);

  return (
    <section className="py-24" style={{ background: "rgba(255,255,255,0.01)" }}>
      <div className="max-w-5xl mx-auto px-6">

        {/* Вкладки */}
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {ANALYTICS_TABS.map((t, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105"
              style={{
                background: tab === i ? `${t.color}20` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${tab === i ? t.color : "rgba(255,255,255,0.08)"}`,
                color: tab === i ? t.color : "rgba(255,255,255,0.45)",
                boxShadow: tab === i ? `0 0 20px ${t.color}30` : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Screenshot preview */}
          <div className="relative">
            <div
              className="relative rounded-2xl overflow-hidden cursor-zoom-in transition-all duration-500"
              style={{ border: `1px solid ${current.color}40`, boxShadow: `0 0 60px ${current.color}20` }}
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
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {current.shots.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setActive(i); }}
                    className="rounded-full transition-all duration-300"
                    style={{ width: i === active ? 20 : 6, height: 6, background: i === active ? current.color : "rgba(255,255,255,0.3)" }}
                  />
                ))}
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>
                🔍 Увеличить
              </div>
            </div>
            <div className="mt-3 text-center text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
              {current.shots[active]?.label}
            </div>
            {lightboxIdx !== null && (
              <Lightbox images={current.shots.map(s => s.url)} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
            )}
          </div>

          {/* Text */}
          <div key={tab} className="transition-all duration-500">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: `${current.color}15`, border: `1px solid ${current.color}35`, color: current.color }}>
              {current.label}
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>
              {current.title}<br />
              <span style={{ background: `linear-gradient(90deg, ${current.color}, #8b5cf6)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {current.titleAccent}
              </span>
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
              {current.desc}
            </p>
            <div className="space-y-3">
              {current.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl transition-all duration-300 hover:-translate-x-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${current.color}15` }}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{item.text}</span>
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
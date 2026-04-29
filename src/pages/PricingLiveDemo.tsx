import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

/**
 * Анимированный пример работы сервиса прямо на /pricing.
 * Шаги: 0 — загрузка плана → 1 — материалы → 2 — итог → 3 — прибыль → 4 — скидка → 5 — сделка.
 * Запускается при попадании в зону видимости. Можно перезапустить кнопкой.
 */

const ITEMS = [
  { name: "Полотно ПВХ матовое",  qty: "32 м²",  price: 11200 },
  { name: "Багет алюминиевый",      qty: "24 м.п.",  price:  4800 },
  { name: "Светильники LED",        qty: "6 шт",   price:  6900 },
  { name: "Замер и доставка",       qty: "—",      price:  2500 },
  { name: "Монтаж под ключ",        qty: "32 м²",  price: 18400 },
];

const TOTAL    = 84000;
const COSTS    = 51600;
const PROFIT   = 32400;
const MAX_DISC = 18; // %

export default function PricingLiveDemo() {
  const [step,      setStep]      = useState<number>(-1);
  const [profit,    setProfit]    = useState<number>(0);
  const [disc,      setDisc]      = useState<number>(0);
  const [visible,   setVisible]   = useState(false);
  const [cdown,     setCdown]     = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Отслеживаем видимость — старт и перезапуск только когда на экране
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting && step === -1) setStep(0);
    }, { threshold: 0.35 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [step]);

  // Прогон шагов + закольцовка
  useEffect(() => {
    if (step < 0) return;
    const timings: Record<number, number> = {
      0: 1200, // загрузка плана
      1: 2200, // показываем материалы
      2: 1300, // считаем итог
      3: 1800, // считаем прибыль
      4: 1800, // показываем скидку
      5: 3500, // финал — задержка перед обратным отсчётом
      6: 3000, // обратный отсчёт 3 → 1 → рестарт
    };
    const t = setTimeout(() => {
      if (step < 6) {
        setStep(step + 1);
      } else if (visible) {
        // рестарт цикла
        setProfit(0); setDisc(0); setCdown(0);
        setStep(0);
      } else {
        // вне экрана — задерживаемся на финале
        setStep(5);
      }
    }, timings[step]);
    return () => clearTimeout(t);
  }, [step, visible]);

  // Обратный отсчёт 3 → 2 → 1 на шаге 6
  useEffect(() => {
    if (step !== 6) { setCdown(0); return; }
    setCdown(3);
    const i1 = setTimeout(() => setCdown(2), 1000);
    const i2 = setTimeout(() => setCdown(1), 2000);
    return () => { clearTimeout(i1); clearTimeout(i2); };
  }, [step]);

  // Анимация счётчика прибыли
  useEffect(() => {
    if (step < 3) { setProfit(0); return; }
    let raf = 0;
    const start = performance.now();
    const dur   = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setProfit(Math.round(PROFIT * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Анимация скидки
  useEffect(() => {
    if (step < 4) { setDisc(0); return; }
    let raf = 0;
    const start = performance.now();
    const dur   = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setDisc(Math.round(MAX_DISC * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const restart = () => {
    setProfit(0); setDisc(0); setCdown(0); setStep(0);
  };

  return (
    <section className="max-w-5xl mx-auto px-5 pb-14">

      {/* Заголовок */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3"
          style={{ background: "rgba(167,139,250,0.14)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.32)" }}>
          <Icon name="PlayCircle" size={11} />
          Живой пример
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-2">Смотри как это работает</h2>
        <p className="text-sm text-white/45">Реальный сценарий — от плана до подписанного договора</p>
      </div>

      {/* Демо-окно */}
      <div ref={ref} className="relative rounded-[24px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0d0d1a, #06060c)",
          border: "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}>

        {/* Оверлей закольцовки */}
        {step === 6 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm"
            style={{ background: "rgba(8,8,15,0.78)" }}>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center relative"
                style={{ background: "rgba(167,139,250,0.12)", border: "1.5px solid rgba(167,139,250,0.4)" }}>
                <span className="text-3xl font-black" style={{ color: "#a78bfa" }}>{cdown || 1}</span>
                <div className="absolute inset-0 rounded-full"
                  style={{ animation: "pulse 1s ease-in-out infinite", boxShadow: "0 0 30px rgba(167,139,250,0.4)" }} />
              </div>
              <div className="text-sm font-bold text-white mb-1">Запускаем заново</div>
              <div className="text-[11px] text-white/40">Каждая твоя смета — точный расчёт</div>
            </div>
          </div>
        )}

        {/* Тулбар как в браузере */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]"
          style={{ background: "rgba(255,255,255,0.025)" }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#10b981" }} />
          </div>
          <div className="flex-1 text-center text-[10px] text-white/35 font-mono">
            Смета №1284 · Натяжные потолки · Квартира 32 м²
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
                const url = "https://mospotolki.poehali.dev/pricing";
                const text = "Смотри как считают сметы на натяжные потолки за секунды 🚀";
                if (navigator.share) {
                  navigator.share({ title: text, url });
                } else {
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
                }
              }}
              className="text-[10px] flex items-center gap-1 text-white/40 hover:text-white/80 transition">
              <Icon name="Share2" size={11} /> Поделиться
            </button>
            <span className="text-white/15">|</span>
            <button onClick={restart}
              className="text-[10px] flex items-center gap-1 text-white/40 hover:text-white/80 transition">
              <Icon name="RotateCcw" size={11} /> Заново
            </button>
          </div>
        </div>

        {/* Прогресс-бар шагов */}
        <StepBar step={step} />

        <div className="grid md:grid-cols-2 gap-0">

          {/* ─── Левая колонка: план + материалы ─── */}
          <div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-white/[0.05]">

            {/* План */}
            <div className="mb-4">
              <Label icon="FileText">План помещения</Label>
              <div className="rounded-2xl overflow-hidden h-[140px] relative flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.08)" }}>
                {step === 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-7 h-7 border-2 border-white/15 border-t-[#a78bfa] rounded-full animate-spin" />
                    <div className="text-[10px] text-white/35 font-mono">Распознаём план...</div>
                  </div>
                ) : (
                  <FloorPlan />
                )}
              </div>
            </div>

            {/* Список материалов */}
            <Label icon="Package">Состав сметы</Label>
            <div className="space-y-1.5">
              {ITEMS.map((it, i) => (
                <div key={it.name}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-[11px] transition-all"
                  style={{
                    background: step >= 1 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.015)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    opacity: step >= 1 ? 1 : 0,
                    transform: step >= 1 ? "translateY(0)" : "translateY(8px)",
                    transitionDelay: `${i * 120}ms`,
                  }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#a78bfa" }} />
                    <span className="text-white/75 truncate">{it.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-white/30 font-mono text-[10px]">{it.qty}</span>
                    <span className="text-white font-bold tabular-nums">{it.price.toLocaleString("ru-RU")} ₽</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Правая колонка: цифры → прибыль → скидка → сделка ─── */}
          <div className="p-5 md:p-6">

            {/* Итог */}
            <div className={`rounded-2xl p-4 mb-3 transition-all duration-500 ${step >= 2 ? "" : "opacity-30 blur-[1px]"}`}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Сумма заказа</span>
                {step >= 2 && <Icon name="Check" size={12} style={{ color: "#10b981" }} />}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white tabular-nums">{TOTAL.toLocaleString("ru-RU")} ₽</span>
                <span className="text-[10px] text-white/30">с НДС</span>
              </div>
              <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between">
                <span className="text-[11px] text-white/45">Расходы и закупка</span>
                <span className="text-[12px] font-bold text-[#94a3b8] tabular-nums">−{COSTS.toLocaleString("ru-RU")} ₽</span>
              </div>
            </div>

            {/* Прибыль */}
            <div className={`rounded-2xl p-4 mb-3 relative overflow-hidden transition-all duration-500 ${step >= 3 ? "" : "opacity-30 blur-[1px]"}`}
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.04))",
                border: "1.5px solid rgba(16,185,129,0.4)",
                boxShadow: step >= 3 ? "0 0 30px rgba(16,185,129,0.18)" : "none",
              }}>
              {step >= 3 && <Pulse color="#10b981" />}
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="TrendingUp" size={13} style={{ color: "#10b981" }} />
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#10b981" }}>
                  Чистая прибыль
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black tabular-nums" style={{ color: "#10b981" }}>
                  {profit.toLocaleString("ru-RU")}
                </span>
                <span className="text-base font-bold" style={{ color: "#10b981" }}>₽</span>
              </div>
              <div className="text-[11px] text-white/45 mt-1">
                Маржинальность <b style={{ color: "#10b981" }}>38,6%</b>
              </div>
            </div>

            {/* Скидка */}
            <div className={`rounded-2xl p-4 mb-3 transition-all duration-500 ${step >= 4 ? "" : "opacity-30 blur-[1px]"}`}
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(251,191,36,0.03))",
                border: "1.5px solid rgba(251,191,36,0.45)",
                boxShadow: step >= 4 ? "0 0 35px rgba(251,191,36,0.22)" : "none",
              }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Tag" size={13} style={{ color: "#fbbf24" }} />
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#fbbf24" }}>
                  Можно дать скидку до
                </span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-black tabular-nums" style={{ color: "#fbbf24" }}>
                    {disc}
                  </span>
                  <span className="text-2xl font-black" style={{ color: "#fbbf24" }}>%</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/30">и остаться в плюсе</div>
                  <div className="text-[11px] font-bold text-white">+{(PROFIT - Math.round(TOTAL * disc / 100)).toLocaleString("ru-RU")} ₽</div>
                </div>
              </div>
              {/* Шкала */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full transition-all duration-700"
                  style={{
                    width: `${(disc / 30) * 100}%`,
                    background: "linear-gradient(90deg, #10b981, #fbbf24, #f97316)",
                  }} />
              </div>
              <div className="flex justify-between text-[9px] text-white/25 mt-1 font-mono">
                <span>0%</span><span>15%</span><span>безопасный потолок 30%</span>
              </div>
            </div>

            {/* Финал — сделка */}
            <div className={`rounded-2xl p-4 transition-all duration-500 ${step >= 5 ? "" : "opacity-0 translate-y-2"}`}
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))",
                border: "1.5px solid rgba(16,185,129,0.55)",
                boxShadow: "0 0 40px rgba(16,185,129,0.25)",
              }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#10b981" }}>
                  <Icon name="Check" size={20} style={{ color: "#0a0a14" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: "#10b981" }}>
                    Сделка закрыта
                  </div>
                  <div className="text-xs text-white/65 leading-snug">
                    Ты дал скидку 8% — клиент подписал договор. Заработал <b className="text-white">{(PROFIT - Math.round(TOTAL * 8 / 100)).toLocaleString("ru-RU")} ₽</b>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Подпись внизу */}
        <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between flex-wrap gap-2"
          style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="text-[10px] text-white/35">
            🎯 Так выглядит каждая твоя смета — ты <b className="text-white/70">всегда</b> знаешь свой потолок скидки
          </div>
          <button onClick={restart}
            className="text-[10px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition"
            style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
            <Icon name="Play" size={10} /> Посмотреть ещё раз
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function Label({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon name={icon} size={11} style={{ color: "rgba(255,255,255,0.45)" }} />
      <span className="text-[10px] font-bold text-white/45 uppercase tracking-wider">{children}</span>
    </div>
  );
}

function FloorPlan() {
  // Простой стилизованный «план» SVG
  return (
    <svg viewBox="0 0 240 124" className="w-full h-full p-3">
      <rect x="6" y="6" width="228" height="98" rx="6" fill="none"
        stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeDasharray="3 2" />
      <rect x="14" y="14" width="110" height="50" rx="3" fill="rgba(167,139,250,0.07)"
        stroke="rgba(167,139,250,0.35)" strokeWidth="1" />
      <rect x="130" y="14" width="96" height="50" rx="3" fill="rgba(16,185,129,0.06)"
        stroke="rgba(16,185,129,0.35)" strokeWidth="1" />
      <rect x="14" y="70" width="212" height="28" rx="3" fill="rgba(249,115,22,0.06)"
        stroke="rgba(249,115,22,0.35)" strokeWidth="1" />

      <text x="20" y="32" fill="rgba(167,139,250,0.85)" fontSize="8" fontFamily="monospace">КУХНЯ</text>
      <text x="20" y="44" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">12 м²</text>

      <text x="138" y="32" fill="rgba(16,185,129,0.85)" fontSize="8" fontFamily="monospace">СПАЛЬНЯ</text>
      <text x="138" y="44" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">14 м²</text>

      <text x="20" y="86" fill="rgba(249,115,22,0.85)" fontSize="8" fontFamily="monospace">КОРИДОР · 6 м²</text>

      {/* размер */}
      <text x="120" y="120" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
        ИТОГО: 32 м²
      </text>
    </svg>
  );
}

function Pulse({ color }: { color: string }) {
  return (
    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
      style={{ background: `radial-gradient(circle, ${color}40, transparent 60%)`, animation: "pulse 2s ease-in-out infinite" }} />
  );
}

function StepBar({ step }: { step: number }) {
  const labels = ["План",  "Материалы", "Сумма",  "Прибыль",   "Скидка", "Сделка"];
  const colors = ["#a78bfa","#a78bfa",  "#fff",   "#10b981",   "#fbbf24","#10b981"];
  return (
    <div className="px-4 py-2 flex items-center gap-1.5 border-b border-white/[0.05]"
      style={{ background: "rgba(255,255,255,0.015)" }}>
      {labels.map((l, i) => {
        const active = step >= i;
        const color  = active ? colors[i] : "rgba(255,255,255,0.15)";
        return (
          <div key={l} className="flex items-center gap-1.5 flex-1">
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: active ? color : "rgba(255,255,255,0.06)",
                boxShadow: step === i ? `0 0 12px ${color}` : "none",
              }}>
              {active && <Icon name="Check" size={9} style={{ color: "#0a0a14" }} />}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider truncate"
              style={{ color: active ? color : "rgba(255,255,255,0.25)" }}>
              {l}
            </span>
            {i < labels.length - 1 && (
              <div className="flex-1 h-px"
                style={{ background: step > i ? color : "rgba(255,255,255,0.06)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
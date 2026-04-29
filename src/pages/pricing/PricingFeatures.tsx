import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import PricingLiveDemo from "../PricingLiveDemo";
import { ADVANTAGES } from "./pricingData";

const VISIBLE  = 3;
const INTERVAL = 3000; // мс между сменой
const PAGES    = Math.ceil(ADVANTAGES.length / VISIBLE);

export default function PricingFeatures() {
  const [page,   setPage]   = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setFadeIn(false);
      fadeTimer.current = setTimeout(() => {
        setPage(p => (p + 1) % PAGES);
        setFadeIn(true);
      }, 300);
    }, INTERVAL);
  }, []);

  // Запускаем автосмену при монтировании
  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fadeTimer.current)   clearTimeout(fadeTimer.current);
    };
  }, [startInterval]);

  // Ручное переключение — сбрасывает и перезапускает интервал
  const goToPage = useCallback((i: number) => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setFadeIn(false);
    fadeTimer.current = setTimeout(() => {
      setPage(i);
      setFadeIn(true);
    }, 300);
    startInterval(); // сброс таймера
  }, [startInterval]);

  return (
    <>
      {/* ── ГЛАВНОЕ ПРЕИМУЩЕСТВО — не упускай клиента ─────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 pb-6 sm:pb-12">
        <div className="relative rounded-[28px] overflow-hidden p-4 sm:p-7 md:p-10"
          style={{
            background:
              "radial-gradient(120% 120% at 0% 0%, rgba(249,115,22,0.18), rgba(8,8,15,0) 60%), radial-gradient(120% 120% at 100% 100%, rgba(16,185,129,0.18), rgba(8,8,15,0) 55%), #0a0a14",
            border: "1.5px solid rgba(249,115,22,0.32)",
            boxShadow: "0 0 80px rgba(249,115,22,0.18)",
          }}>

          {/* Бейдж */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 sm:mb-5"
            style={{ background: "rgba(249,115,22,0.18)", color: "#fbbf24", border: "1px solid rgba(249,115,22,0.4)" }}>
            <Icon name="Crown" size={12} />
            Главная фишка сервиса
          </div>

          <h2 className="text-xl sm:text-2xl md:text-4xl font-black leading-tight mb-2 sm:mb-3">
            Не упускай <span style={{ color: "#f97316" }}>СВОЕГО</span> клиента
          </h2>
          <p className="text-sm md:text-base text-white/65 max-w-2xl leading-relaxed mb-4 sm:mb-7">
            Сервис показывает <b className="text-white">сколько ты заработаешь</b> на заказе ещё до закупки материала.
            Значит ты <b style={{ color: "#10b981" }}>точно знаешь</b>, какую скидку можешь дать,
            чтобы клиент <b style={{ color: "#10b981" }}>сказал «беру»</b> — и при этом остаться в плюсе.
          </p>

          {/* Сравнение: ДО / ПОСЛЕ */}
          <div className="grid md:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {/* ДО */}
            <div className="rounded-2xl p-3 sm:p-5"
              style={{ background: "rgba(239,68,68,0.06)", border: "1.5px solid rgba(239,68,68,0.22)" }}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.18)" }}>
                  <Icon name="X" size={14} style={{ color: "#ef4444" }} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#ef4444" }}>
                  Раньше — гадание
                </div>
              </div>
              <div className="text-sm font-bold text-white/85 mb-2">
                «Дам 10%? Или 5%? А вдруг уйду в минус? А вдруг клиент сорвётся?»
              </div>
              <div className="text-[11px] text-white/40 leading-relaxed">
                Считал маржу на коленке, боялся продешевить или потерять клиента.
                Половина сделок срывалась на торге.
              </div>
            </div>

            {/* ПОСЛЕ */}
            <div className="rounded-2xl p-3 sm:p-5"
              style={{ background: "rgba(16,185,129,0.06)", border: "1.5px solid rgba(16,185,129,0.32)" }}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(16,185,129,0.2)" }}>
                  <Icon name="Check" size={14} style={{ color: "#10b981" }} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#10b981" }}>
                  Сейчас — точный расчёт
                </div>
              </div>
              <div className="text-sm font-bold text-white/95 mb-2">
                «Прибыль 18 400 ₽. Дам 8% — закрою сделку.»
              </div>
              <div className="text-[11px] text-white/55 leading-relaxed">
                Видишь чистую прибыль и маржу по каждой смете.
                Торгуешься уверенно — и закрываешь договор.
              </div>
            </div>
          </div>

          {/* Пример цифр */}
          <div className="rounded-2xl p-3 sm:p-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">
              Пример расчёта по смете
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Сумма заказа",     value: "84 000 ₽", color: "#fff"    },
                { label: "Расходы",           value: "−51 600 ₽", color: "#94a3b8" },
                { label: "Чистая прибыль",    value: "32 400 ₽", color: "#10b981" },
                { label: "Можно дать скидку до", value: "до 18%",   color: "#fbbf24", highlight: true },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3"
                  style={{ background: s.highlight ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
                           border: s.highlight ? "1px solid rgba(251,191,36,0.32)" : "1px solid transparent" }}>
                  <div className="text-[9px] font-semibold text-white/35 uppercase tracking-wider mb-1">{s.label}</div>
                  <div className="text-base md:text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
              <Icon name="Sparkles" size={12} style={{ color: "#fbbf24" }} />
              Знаешь свой потолок скидки — закрываешь клиента <b className="text-white">сегодня</b>, а не «подумаю».
            </div>
          </div>
        </div>
      </section>

      {/* ── Живая демонстрация работы сервиса ────────────────────────────── */}
      <PricingLiveDemo />

      {/* ── Остальные преимущества (8 шт) ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 pb-14">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl font-black mb-2">И ещё 8 причин выбрать нас</h2>
          <p className="text-sm text-white/40">Всё, что нужно мастеру — в одном сервисе</p>
        </div>

        {/* Десктоп — все карточки сразу */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ADVANTAGES.map(a => (
            <AdvCard key={a.title} a={a} />
          ))}
        </div>

        {/* Мобиле — авто-карусель по 3 карточки */}
        <div className="sm:hidden">
          {/* Карточки с fade */}
          <div
            className="flex flex-col gap-3 transition-opacity duration-300"
            style={{ opacity: fadeIn ? 1 : 0 }}>
            {ADVANTAGES.slice(page * VISIBLE, page * VISIBLE + VISIBLE).map(a => (
              <AdvCard key={a.title} a={a} />
            ))}
          </div>

          {/* Точки-индикаторы */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {Array.from({ length: PAGES }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width:      i === page ? 20 : 6,
                  height:     6,
                  background: i === page ? "#f97316" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function AdvCard({ a }: { a: { icon: string; title: string; text: string } }) {
  return (
    <div className="p-4 rounded-2xl transition hover:-translate-y-0.5"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: "rgba(249,115,22,0.12)" }}>
        <Icon name={a.icon} size={18} style={{ color: "#f97316" }} />
      </div>
      <div className="text-sm font-bold text-white mb-1">{a.title}</div>
      <div className="text-[11px] text-white/45 leading-relaxed">{a.text}</div>
    </div>
  );
}
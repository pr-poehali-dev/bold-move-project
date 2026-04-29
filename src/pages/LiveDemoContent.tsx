import { type RefObject } from "react";
import Icon from "@/components/ui/icon";
import { Label, FloorPlan, Pulse, StepBar } from "./LiveDemoHelpers";
import { ITEMS, TOTAL, COSTS, PROFIT, MAX_DISC } from "./liveDemoData";

interface Props {
  step:       number;
  profit:     number;
  disc:       number;
  cdown:      number;
  scrollRef:  RefObject<HTMLDivElement>;
  refPlan:    RefObject<HTMLDivElement>;
  refMaterials: RefObject<HTMLDivElement>;
  refTotal:   RefObject<HTMLDivElement>;
  refProfit:  RefObject<HTMLDivElement>;
  refDiscount: RefObject<HTMLDivElement>;
  refDeal:    RefObject<HTMLDivElement>;
  onRestart:  () => void;
}

export default function LiveDemoContent({
  step, profit, disc, cdown, scrollRef,
  refPlan, refMaterials, refTotal, refProfit, refDiscount, refDeal,
  onRestart,
}: Props) {
  return (
    <>
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
              const url  = "https://mospotolki.poehali.dev/pricing";
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
          <button onClick={onRestart}
            className="text-[10px] flex items-center gap-1 text-white/40 hover:text-white/80 transition">
            <Icon name="RotateCcw" size={11} /> Заново
          </button>
        </div>
      </div>

      {/* Прогресс-бар шагов */}
      <StepBar step={step} />

      {/* Скроллируемая зона */}
      <div ref={scrollRef} className="overflow-hidden" style={{ maxHeight: "min(70vh, 560px)" }}>
        <div className="grid md:grid-cols-2 gap-0">

          {/* ─── Левая колонка: план + материалы ─── */}
          <div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-white/[0.05]">

            {/* План */}
            <div className="mb-4" ref={refPlan}>
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
            <div ref={refMaterials}>
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
          </div>

          {/* ─── Правая колонка: цифры → прибыль → скидка → сделка ─── */}
          <div className="p-5 md:p-6">

            {/* Итог */}
            <div ref={refTotal} className={`rounded-2xl p-4 mb-3 transition-all duration-500 ${step >= 2 ? "" : "opacity-30 blur-[1px]"}`}
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
            <div ref={refProfit} className={`rounded-2xl p-4 mb-3 relative overflow-hidden transition-all duration-500 ${step >= 3 ? "" : "opacity-30 blur-[1px]"}`}
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
            <div ref={refDiscount} className={`rounded-2xl p-4 mb-3 transition-all duration-500 ${step >= 4 ? "" : "opacity-30 blur-[1px]"}`}
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
                  <span className="text-3xl md:text-4xl font-black tabular-nums" style={{ color: "#fbbf24" }}>{disc}</span>
                  <span className="text-2xl font-black" style={{ color: "#fbbf24" }}>%</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/30">и остаться в плюсе</div>
                  <div className="text-[11px] font-bold text-white">+{(PROFIT - Math.round(TOTAL * disc / 100)).toLocaleString("ru-RU")} ₽</div>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full transition-all duration-700"
                  style={{ width: `${(disc / 30) * 100}%`, background: "linear-gradient(90deg, #10b981, #fbbf24, #f97316)" }} />
              </div>
              <div className="flex justify-between text-[9px] text-white/25 mt-1 font-mono">
                <span>0%</span><span>15%</span><span>безопасный потолок 30%</span>
              </div>
            </div>

            {/* Финал — сделка */}
            <div ref={refDeal} className={`rounded-2xl p-4 transition-all duration-500 ${step >= 5 ? "" : "opacity-0 translate-y-2"}`}
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
      </div>{/* /scrollRef */}

      {/* Подпись внизу */}
      <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between flex-wrap gap-2"
        style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="text-[10px] text-white/35">
          🎯 Так выглядит каждая твоя смета — ты <b className="text-white/70">всегда</b> знаешь свой потолок скидки
        </div>
        <button onClick={onRestart}
          className="text-[10px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition"
          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
          <Icon name="Play" size={10} /> Посмотреть ещё раз
        </button>
      </div>
    </>
  );
}

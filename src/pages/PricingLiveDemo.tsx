import { useEffect, useRef, useState, type RefObject } from "react";
import Icon from "@/components/ui/icon";
import LiveDemoContent from "./LiveDemoContent";
import { PROFIT, MAX_DISC, STEP_TIMINGS, easeOutCubic } from "./liveDemoData";

export default function PricingLiveDemo() {
  const [step,      setStep]      = useState<number>(-1);
  const [profit,    setProfit]    = useState<number>(0);
  const [disc,      setDisc]      = useState<number>(0);
  const [visible,   setVisible]   = useState(false);
  const [cdown,     setCdown]     = useState(0);
  const hasPlayed = useRef(false); // scroll-lock срабатывает только при первом показе

  const ref          = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const refPlan      = useRef<HTMLDivElement>(null);
  const refMaterials = useRef<HTMLDivElement>(null);
  const refTotal     = useRef<HTMLDivElement>(null);
  const refProfit    = useRef<HTMLDivElement>(null);
  const refDiscount  = useRef<HTMLDivElement>(null);
  const refDeal      = useRef<HTMLDivElement>(null);

  // Отслеживаем видимость — старт и перезапуск только когда на экране
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting && step === -1) {
        setStep(0);
        setTimeout(() => {
          ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }, { threshold: 0.35 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [step]);

  // Scroll-lock: только при первом проигрывании (шаги 0-5)
  useEffect(() => {
    if (hasPlayed.current) return; // уже играло — не лочим
    const isAnimating = step >= 0 && step <= 5;
    if (isAnimating) {
      document.body.style.overflow    = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow    = "";
      document.body.style.touchAction = "";
      if (step === 6) hasPlayed.current = true; // первый цикл завершён
    }
    return () => {
      document.body.style.overflow    = "";
      document.body.style.touchAction = "";
    };
  }, [step]);

  // Прогон шагов + закольцовка
  useEffect(() => {
    if (step < 0) return;
    const t = setTimeout(() => {
      if (step < 6) {
        setStep(step + 1);
      } else if (visible) {
        setProfit(0); setDisc(0); setCdown(0);
        setStep(0);
      } else {
        setStep(5);
      }
    }, STEP_TIMINGS[step]);
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
    const tick  = (now: number) => {
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
    const tick  = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setDisc(Math.round(MAX_DISC * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Точный автоскролл к блоку текущего шага
  useEffect(() => {
    if (step < 0 || !scrollRef.current) return;
    const container = scrollRef.current;
    const targetMap: Record<number, RefObject<HTMLDivElement>> = {
      0: refPlan,
      1: refMaterials,
      2: refTotal,
      3: refProfit,
      4: refDiscount,
      5: refDeal,
    };
    const targetRef = targetMap[step];
    if (!targetRef?.current) return;
    const t = setTimeout(() => {
      const target       = targetRef.current!;
      const containerTop = container.getBoundingClientRect().top;
      const targetTop    = target.getBoundingClientRect().top;
      const offset       = targetTop - containerTop + container.scrollTop - 12;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }, 150);
    return () => clearTimeout(t);
  }, [step]);

  const restart = () => {
    setProfit(0); setDisc(0); setCdown(0); setStep(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
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
        <LiveDemoContent
          step={step}
          profit={profit}
          disc={disc}
          cdown={cdown}
          scrollRef={scrollRef}
          refPlan={refPlan}
          refMaterials={refMaterials}
          refTotal={refTotal}
          refProfit={refProfit}
          refDiscount={refDiscount}
          refDeal={refDeal}
          onRestart={restart}
        />
      </div>
    </section>
  );
}
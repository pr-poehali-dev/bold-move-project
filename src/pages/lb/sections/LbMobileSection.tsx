// ── Mobile Development ────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";

const MOBILE_SCREENS = [
  {
    label: "AI-Агент",
    sub: "Чат с голосовым вводом",
    color: "#f97316",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/507e3a3f-22eb-41d0-b4a9-91c7063e5099.jpg",
  },
  {
    label: "CRM — Воронка",
    sub: "Заявки и финансы",
    color: "#8b5cf6",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/b355fa9e-7615-40f9-8131-9f6dbb3311ae.jpg",
  },
  {
    label: "P&L по заказу",
    sub: "Затраты, доходы, маржа",
    color: "#10b981",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/15478a1b-e4a1-406c-93b7-05f07653da6a.jpg",
  },
  {
    label: "CAD-построитель",
    sub: "Чертёж и материалы",
    color: "#06b6d4",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/9b9146e8-90d5-4a1f-b978-2a4c40af7af9.jpg",
  },
  {
    label: "Мультикомнатный",
    sub: "Несколько комнат, одна смета",
    color: "#f59e0b",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/8444e268-91e3-402f-9a48-88ffb3459a57.jpg",
  },
  {
    label: "Аналитика",
    sub: "Обзор, конверсии, KPI",
    color: "#a78bfa",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/98f77739-d739-4bf0-8fe1-4c43e055b76f.jpg",
  },
  {
    label: "Финансы P&L",
    sub: "Доходы, расходы, прибыль",
    color: "#34d399",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/0882c3c6-0cd9-4d0e-a406-a4e367e7150d.jpg",
  },
  {
    label: "Календарь",
    sub: "Замеры и монтажи на карте",
    color: "#fbbf24",
    img: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/82f4b066-784b-4cbd-a290-a14082d16b96.jpg",
  },
];

const MOBILE_FEATURES = [
  { icon: "🎨", title: "UI/UX дизайн", desc: "Figma-макеты с нативными паттернами iOS и Android. Анимации и микровзаимодействия." },
  { icon: "⚡", title: "React Native", desc: "Один код — два магазина. Нативная производительность без компромиссов." },
  { icon: "🍎", title: "App Store", desc: "Подготовка, ревью и публикация. TestFlight для бета-тестирования." },
  { icon: "🤖", title: "Google Play", desc: "Публикация APK/AAB с соблюдением всех требований Google." },
  { icon: "🔔", title: "Push & offline", desc: "Уведомления, офлайн-режим, фоновая синхронизация данных." },
  { icon: "🔗", title: "API интеграции", desc: "Подключение к бэкенду, платёжным системам, картам и камере." },
];

// Точная копия механики ArcDrum но горизонтальная.
// scrollX — единственный источник правды (пиксели).
// Никакого React-state для dragDelta — только rAF + DOM ref.
function PhoneDrum({ onOpen }: { onOpen: (idx: number) => void }) {
  const N     = MOBILE_SCREENS.length;
  const items = [...MOBILE_SCREENS, ...MOBILE_SCREENS, ...MOBILE_SCREENS];
  const SLOT  = 126; // px на один элемент (шаг сетки)
  const PAD   = SLOT * N; // начальный сдвиг = середина второго блока

  // Скрытый div-скролл (как в ArcDrum) — scrollLeft = текущая позиция
  const scrollRef   = useRef<HTMLDivElement>(null);
  const isDragging  = useRef(false);
  const didDrag     = useRef(false);
  const startX      = useRef(0);
  const startY      = useRef(0);
  const startScroll = useRef(0);
  const lastX       = useRef(0);
  const lastTime    = useRef(0);
  const velocity    = useRef(0);
  const rafId       = useRef<number | null>(null);
  const isSnapping  = useRef(false);
  const [scrollX, setScrollX] = useState(PAD);

  // Инициализация
  useEffect(() => {
    const el = scrollRef.current;
    if (el) { el.scrollLeft = PAD; setScrollX(PAD); }
  }, []); // eslint-disable-line

  // Нормализация бесконечного кольца
  const normalize = useCallback((sl: number): number => {
    const el = scrollRef.current;
    if (!el) return sl;
    if (sl < SLOT)           { const j = sl + N * SLOT; el.scrollLeft = j; return j; }
    if (sl > SLOT * (N*2-1)) { const j = sl - N * SLOT; el.scrollLeft = j; return j; }
    return sl;
  }, [N, SLOT]);

  // Плавный снэп к индексу
  const snapToIdx = useCallback((rawIdx: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    // Нормализуем целевой индекс
    let idx = rawIdx;
    while (idx < N)     idx += N;
    while (idx > N*2-1) idx -= N;
    const target = idx * SLOT;
    if (!smooth) { el.scrollLeft = target; setScrollX(target); return; }
    isSnapping.current = true;
    const start = el.scrollLeft;
    const diff  = target - start;
    const dur   = Math.min(400, Math.abs(diff) * 1.4);
    const ts0   = performance.now();
    const step  = (now: number) => {
      const t    = Math.min(1, (now - ts0) / dur);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      el.scrollLeft = start + diff * ease;
      const sl = normalize(el.scrollLeft);
      setScrollX(sl);
      if (t < 1) rafId.current = requestAnimationFrame(step);
      else { el.scrollLeft = target; setScrollX(normalize(target)); isSnapping.current = false; }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [N, SLOT, normalize]);

  // Инерция — точная копия ArcDrum.startInertia
  const startInertia = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    let v = velocity.current;
    const step = () => {
      if (isSnapping.current) return;
      v *= 0.92; // затухание — как в ArcDrum
      el.scrollLeft += v;
      const sl = normalize(el.scrollLeft);
      setScrollX(sl);
      if (Math.abs(v) > 0.5) rafId.current = requestAnimationFrame(step);
      else snapToIdx(Math.round(el.scrollLeft / SLOT));
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [normalize, snapToIdx, SLOT]);

  // Touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false; isDragging.current = true; didDrag.current = false;
    startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY;
    startScroll.current = scrollRef.current?.scrollLeft ?? 0;
    lastX.current = e.touches[0].clientX; lastTime.current = performance.now(); velocity.current = 0;
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    // Если движение вертикальное — отпускаем
    if (!didDrag.current && dy > Math.abs(dx) + 5) { isDragging.current = false; return; }
    e.preventDefault(); didDrag.current = true;
    const x = e.touches[0].clientX; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastX.current - x) / dt * 16;
    lastX.current = x; lastTime.current = now;
    scrollRef.current.scrollLeft = startScroll.current + (startX.current - x);
    setScrollX(normalize(scrollRef.current.scrollLeft));
  }, [normalize]);
  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    startInertia();
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [startInertia]);

  // Mouse
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false; isDragging.current = true; didDrag.current = false;
    startX.current = e.clientX; startScroll.current = scrollRef.current?.scrollLeft ?? 0;
    lastX.current = e.clientX; lastTime.current = performance.now(); velocity.current = 0;
    e.preventDefault();
  }, []);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    if (Math.abs(e.clientX - startX.current) > 3) didDrag.current = true;
    const x = e.clientX; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastX.current - x) / dt * 16;
    lastX.current = x; lastTime.current = now;
    scrollRef.current.scrollLeft = startScroll.current + (startX.current - x);
    setScrollX(normalize(scrollRef.current.scrollLeft));
  }, [normalize]);
  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startInertia();
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [startInertia]);
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  // Центральный индекс
  const centerRaw  = Math.round(scrollX / SLOT);
  const centerReal = ((centerRaw % N) + N) % N;
  const s_center   = MOBILE_SCREENS[centerReal];

  // Высота контейнера — фиксированная, телефоны выравниваются по дну
  const H = 360;

  return (
    <div
      style={{ position: "relative", width: "100%", userSelect: "none", touchAction: "pan-y", cursor: "grab" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Тени по краям */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 56, zIndex: 10, pointerEvents: "none", background: "linear-gradient(to right,#080810 20%,transparent)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 56, zIndex: 10, pointerEvents: "none", background: "linear-gradient(to left,#080810 20%,transparent)" }} />

      {/* Скрытый механический скролл */}
      <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflowX: "scroll", scrollbarWidth: "none", opacity: 0, pointerEvents: "none" }}>
        <div style={{ width: items.length * SLOT + 800, height: 1 }} />
      </div>

      {/* Визуальный ряд */}
      <div style={{ height: H, position: "relative", overflow: "hidden" }}>
        {items.map((s, rawIdx) => {
          // Смещение в пикселях от центра экрана
          const pxFromCenter = rawIdx * SLOT - scrollX;
          // Показываем только ±3 слота
          if (pxFromCenter < -SLOT * 3.5 || pxFromCenter > SLOT * 3.5) return null;

          const norm    = pxFromCenter / (SLOT * 2.5); // −1..1
          const absNorm = Math.abs(norm);
          const isCenter = rawIdx === centerRaw;
          const realIdx  = ((rawIdx % N) + N) % N;

          // Плавная интерполяция размеров по норме — никаких резких переключений
          const wSmall = 100, wBig = 148;
          const hSmall = 210, hBig = 310;
          const t = Math.max(0, 1 - absNorm * 1.4); // 1 = центр, 0 = край
          const phoneW = Math.round(wSmall + (wBig - wSmall) * t);
          const phoneH = Math.round(hSmall + (hBig - hSmall) * t);
          const opacity = Math.max(0.2, 1 - absNorm * 0.75);
          // Позиция x — центр экрана + смещение
          const cx = pxFromCenter; // offset от центра

          return (
            <div
              key={rawIdx}
              onClick={() => {
                if (didDrag.current) return;
                if (isCenter) onOpen(realIdx);
                else snapToIdx(rawIdx);
              }}
              style={{
                position: "absolute",
                left: "50%",
                bottom: 0,
                transform: `translateX(calc(${cx}px - 50%))`,
                width: phoneW,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                opacity,
                cursor: isCenter ? "zoom-in" : "pointer",
                // Нет transition — движение идёт через rAF, плавно
              }}
            >
              <div style={{
                width: phoneW, height: phoneH,
                borderRadius: 22,
                overflow: "hidden",
                border: `2px solid ${isCenter ? s.color : "rgba(255,255,255,0.1)"}`,
                boxShadow: isCenter
                  ? `0 0 0 3px ${s.color}22, 0 16px 48px rgba(0,0,0,0.8), 0 0 36px ${s.color}33`
                  : "0 4px 16px rgba(0,0,0,0.5)",
                background: "#0a0a14",
                position: "relative",
              }}>
                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 28, height: 8, borderRadius: 4, background: "#000", zIndex: 2 }} />
                <img src={s.img} alt={s.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
                <div style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.25)" }} />
                {isCenter && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: `linear-gradient(to top, ${s.color}22, transparent)` }} />}
              </div>
              {/* Подпись под центральным */}
              <div style={{ textAlign: "center", height: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color, opacity: isCenter ? 1 : 0 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2, opacity: isCenter ? 1 : 0 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Точки */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 8, paddingTop: 4 }}>
        {MOBILE_SCREENS.map((s, i) => (
          <button key={i}
            onClick={() => snapToIdx(N + i)}
            style={{ width: i === centerReal ? 20 : 6, height: 6, borderRadius: 3, background: i === centerReal ? s_center.color : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
        ))}
      </div>
    </div>
  );
}

// ── Лайтбокс — полноэкранный просмотр ─────────────────────────────────────────
function PhoneLightbox({ idx, onClose }: { idx: number; onClose: () => void }) {
  const s = MOBILE_SCREENS[idx];
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* Телефон */}
        <div style={{
          width: 280, height: 590, borderRadius: 36, overflow: "hidden",
          border: `3px solid ${s.color}`,
          boxShadow: `0 0 0 6px ${s.color}25, 0 40px 80px rgba(0,0,0,0.9), 0 0 80px ${s.color}40`,
          background: "#0a0a14", position: "relative",
        }}>
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 52, height: 14, borderRadius: 7, background: "#000", zIndex: 2 }} />
          <img src={s.img} alt={s.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", width: 52, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.35)" }} />
        </div>
        {/* Описание */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{s.sub}</div>
        </div>
        {/* Кнопка закрыть */}
        <button onClick={onClose} style={{ marginTop: 4, padding: "8px 24px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

export function LBMobile() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <section id="mobile" className="py-8 sm:py-16 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
            📱 Мобильная разработка
          </div>
          <h2 className="text-3xl sm:text-5xl font-black mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Приложения для{" "}
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              iOS и Android
            </span>
          </h2>
          <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
            Крути барабан — смотри реальные экраны живых проектов. Кликни на центральный для полного просмотра.
          </p>
        </div>

        {/* Барабан телефонов */}
        <div className="mb-6">
          <PhoneDrum onOpen={i => setLightbox(i)} />
        </div>

        {/* Фичи */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {MOBILE_FEATURES.map((f, i) => (
            <div key={i} className="p-3 rounded-xl flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-base">{f.icon}</div>
              <div className="text-xs font-bold leading-tight">{f.title}</div>
              <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Сторы */}
        <div className="flex gap-3 justify-center">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 sm:flex-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "linear-gradient(135deg,#1c1c1e,#2c2c2e)" }}>🍎</div>
            <div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Публикация в</div>
              <div className="font-black text-sm" style={{ fontFamily: "Montserrat, sans-serif" }}>App Store</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>iOS 16+ · TestFlight</div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 sm:flex-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "linear-gradient(135deg,#0f2010,#1a3520)" }}>🤖</div>
            <div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Публикация в</div>
              <div className="font-black text-sm" style={{ fontFamily: "Montserrat, sans-serif" }}>Google Play</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Android 10+ · APK/AAB</div>
            </div>
          </div>
        </div>

      </div>

      {/* Лайтбокс */}
      {lightbox !== null && <PhoneLightbox idx={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}

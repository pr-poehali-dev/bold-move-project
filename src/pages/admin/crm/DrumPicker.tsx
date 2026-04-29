import { useRef, useEffect, useCallback } from "react";

export interface DrumItem {
  value: string;
  label: string;
  color: string;
}

interface Props {
  items: DrumItem[];
  value: string;
  onChange: (value: string) => void;
  itemHeight?: number;
  visibleCount?: number;
}

export default function DrumPicker({
  items,
  value,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  // Инерция
  const isDragging   = useRef(false);
  const startY       = useRef(0);
  const startScroll  = useRef(0);
  const lastY        = useRef(0);
  const lastTime     = useRef(0);
  const velocity     = useRef(0);
  const rafId        = useRef<number | null>(null);
  const isSnapping   = useRef(false);

  const containerHeight = itemHeight * visibleCount;
  const padding         = itemHeight * Math.floor(visibleCount / 2);

  // Индекс выбранного элемента
  const selectedIdx = items.findIndex(i => i.value === value);

  // Плавная прокрутка к индексу
  const snapToIndex = useCallback((idx: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const target  = clamped * itemHeight;
    if (!smooth) {
      el.scrollTop = target;
      return;
    }
    isSnapping.current = true;
    const start    = el.scrollTop;
    const diff     = target - start;
    const duration = Math.min(300, Math.abs(diff) * 1.2);
    const startTs  = performance.now();
    const step = (now: number) => {
      const t  = Math.min(1, (now - startTs) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.scrollTop = start + diff * ease;
      if (t < 1) {
        rafId.current = requestAnimationFrame(step);
      } else {
        el.scrollTop = target;
        isSnapping.current = false;
        onChange(items[clamped].value);
      }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [items, itemHeight, onChange]);

  // При смене value снаружи — прокручиваем
  useEffect(() => {
    if (selectedIdx >= 0) snapToIndex(selectedIdx, false);
  }, []); // eslint-disable-line

  // Инерционная прокрутка
  const startInertia = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    let v = velocity.current;
    const decay = 0.92;
    const step = () => {
      if (isSnapping.current) return;
      v *= decay;
      el.scrollTop += v;
      if (Math.abs(v) > 0.5) {
        rafId.current = requestAnimationFrame(step);
      } else {
        // Привязка к ближайшему элементу
        const idx = Math.round(el.scrollTop / itemHeight);
        snapToIndex(idx);
      }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [itemHeight, snapToIndex]);

  // ── Touch events ──────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false;
    isDragging.current = true;
    startY.current     = e.touches[0].clientY;
    startScroll.current = scrollRef.current?.scrollTop ?? 0;
    lastY.current      = e.touches[0].clientY;
    lastTime.current   = performance.now();
    velocity.current   = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const y    = e.touches[0].clientY;
    const now  = performance.now();
    const dt   = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - y) / dt * 16;
    lastY.current  = y;
    lastTime.current = now;
    scrollRef.current.scrollTop = startScroll.current + (startY.current - y);
  }, []);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    startInertia();
  }, [startInertia]);

  // ── Mouse events (для десктопа) ───────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current  = false;
    isDragging.current  = true;
    startY.current      = e.clientY;
    startScroll.current = scrollRef.current?.scrollTop ?? 0;
    lastY.current       = e.clientY;
    lastTime.current    = performance.now();
    velocity.current    = 0;
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const y   = e.clientY;
    const now = performance.now();
    const dt  = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - y) / dt * 16;
    lastY.current    = y;
    lastTime.current = now;
    scrollRef.current.scrollTop = startScroll.current + (startY.current - y);
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startInertia();
  }, [startInertia]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Клик по элементу → переход
  const handleItemClick = useCallback((idx: number) => {
    if (!isDragging.current) snapToIndex(idx);
  }, [snapToIndex]);

  // Скролл мышкой/трекпадом
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (isSnapping.current || !scrollRef.current) return;
    scrollRef.current.scrollTop += e.deltaY;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    const timeoutId = setTimeout(() => {
      const idx = Math.round((scrollRef.current?.scrollTop ?? 0) / itemHeight);
      snapToIndex(idx);
    }, 120);
    return () => clearTimeout(timeoutId);
  }, [itemHeight, snapToIndex]);

  // Текущий выбранный из позиции скролла
  const onScroll = useCallback(() => {
    if (isSnapping.current || isDragging.current || !scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (items[clamped]?.value !== value) {
      onChange(items[clamped].value);
    }
  }, [items, itemHeight, value, onChange]);

  const currentItem = items[selectedIdx] ?? items[0];

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, position: "relative", userSelect: "none" }}
      className="w-full"
    >
      {/* Маска сверху и снизу */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: padding,
        background: "linear-gradient(to bottom, var(--drum-bg, #1a1a2e) 0%, transparent 100%)",
        zIndex: 2,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: padding,
        background: "linear-gradient(to top, var(--drum-bg, #1a1a2e) 0%, transparent 100%)",
        zIndex: 2,
        pointerEvents: "none",
      }} />

      {/* Рамка выбранного элемента */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0, right: 0,
        height: itemHeight,
        transform: "translateY(-50%)",
        borderTop:    `1.5px solid ${currentItem?.color ?? "#7c3aed"}60`,
        borderBottom: `1.5px solid ${currentItem?.color ?? "#7c3aed"}60`,
        background:   `${currentItem?.color ?? "#7c3aed"}12`,
        borderRadius: 12,
        zIndex: 3,
        pointerEvents: "none",
        transition: "border-color 0.2s, background 0.2s",
      }} />

      {/* Скроллируемый список */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onScroll={onScroll}
        style={{
          height: "100%",
          overflowY: "scroll",
          scrollbarWidth: "none",
          paddingTop:    padding,
          paddingBottom: padding,
          cursor: "grab",
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, idx) => {
          const isSelected = item.value === value;
          const distance   = Math.abs(idx - selectedIdx);
          const opacity    = distance === 0 ? 1 : distance === 1 ? 0.55 : distance === 2 ? 0.28 : 0.12;
          const scale      = distance === 0 ? 1 : distance === 1 ? 0.92 : 0.84;

          return (
            <div
              key={item.value}
              onClick={() => handleItemClick(idx)}
              style={{
                height:        itemHeight,
                display:       "flex",
                alignItems:    "center",
                justifyContent: "center",
                fontSize:      isSelected ? 14 : 13,
                fontWeight:    isSelected ? 700 : 500,
                color:         isSelected ? item.color : "#fff",
                opacity,
                transform:     `scale(${scale})`,
                transition:    "opacity 0.15s, transform 0.15s, color 0.15s",
                letterSpacing: isSelected ? "0.01em" : 0,
                cursor:        "pointer",
              }}
            >
              <span style={{
                display: "inline-block",
                padding: "2px 12px",
                borderRadius: 8,
                background: isSelected ? `${item.color}18` : "transparent",
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

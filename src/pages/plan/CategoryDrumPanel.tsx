import { useState, useEffect, useRef, useCallback } from "react";
import type { SegmentPriceItem } from "./planTypes";

export interface PriceEntry {
  id: number;
  name: string;
  category: string;
  image_url: string | null;
  category_image_url: string | null;
  unit: string; // единица измерения из прайса (шт, м, м², и др.)
}

interface ArcItem {
  value: string;
  label: string;
  imageUrl: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prices: PriceEntry[];
  onDragItem: (item: SegmentPriceItem) => void;
}

// Параметры дуги
const ITEM_H   = 62;   // высота одного слота
const VISIBLE  = 5;    // 1 центральная + 2 сверху + 2 снизу
const ARC_R    = 220;  // радиус дуги
const TOTAL_H  = ITEM_H * VISIBLE;
const PADDING  = ITEM_H * Math.floor(VISIBLE / 2);

// ── Барабан с дугой ───────────────────────────────────────────────────────────

function ArcDrum({ items, value, onChange, onClick, initialIdx, onSwipeRight }: {
  items: ArcItem[];
  value: string;
  onChange: (v: string) => void;
  onClick: (v: string) => void;
  initialIdx?: number;
  onSwipeRight?: () => void;
}) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const isDragging  = useRef(false);
  const didDrag     = useRef(false);
  const startY      = useRef(0);
  const startX      = useRef(0);
  const startScroll = useRef(0);
  const lastY       = useRef(0);
  const lastTime    = useRef(0);
  const velocity    = useRef(0);
  const rafId       = useRef<number | null>(null);
  const isSnapping  = useRef(false);
  // Текущий scroll для рендера дуги
  const [scrollTop, setScrollTop] = useState(0);

  const selectedIdx = items.findIndex(i => i.value === value);

  const snapToIndex = useCallback((idx: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const target  = clamped * ITEM_H;
    if (!smooth) { el.scrollTop = target; setScrollTop(target); return; }
    isSnapping.current = true;
    const start = el.scrollTop;
    const diff  = target - start;
    const dur   = Math.min(300, Math.abs(diff) * 1.2);
    const ts0   = performance.now();
    const step  = (now: number) => {
      const t    = Math.min(1, (now - ts0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      el.scrollTop = start + diff * ease;
      setScrollTop(el.scrollTop);
      if (t < 1) { rafId.current = requestAnimationFrame(step); }
      else {
        el.scrollTop = target;
        setScrollTop(target);
        isSnapping.current = false;
        navigator.vibrate?.(8);
        onChange(items[clamped].value);
      }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [items, onChange]);

  useEffect(() => {
    if (items.length === 0) return;
    const startIdx = (initialIdx !== undefined && initialIdx >= 0 && initialIdx < items.length)
      ? initialIdx
      : Math.floor(items.length / 2);
    const el = scrollRef.current;
    if (el) { el.scrollTop = startIdx * ITEM_H; setScrollTop(startIdx * ITEM_H); isSnapping.current = false; }
    onChange(items[startIdx].value);
  }, [items.length]); // eslint-disable-line

  useEffect(() => {
    if (selectedIdx >= 0) snapToIndex(selectedIdx, false);
  }, []); // eslint-disable-line

  const startInertia = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    let v = velocity.current;
    const step = () => {
      if (isSnapping.current) return;
      v *= 0.92;
      el.scrollTop += v;
      setScrollTop(el.scrollTop);
      if (Math.abs(v) > 0.5) { rafId.current = requestAnimationFrame(step); }
      else snapToIndex(Math.round(el.scrollTop / ITEM_H));
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [snapToIndex]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false; isDragging.current = true; didDrag.current = false;
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    startScroll.current = scrollRef.current?.scrollTop ?? 0;
    lastY.current = e.touches[0].clientY; lastTime.current = performance.now(); velocity.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault(); didDrag.current = true;
    const y = e.touches[0].clientY; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - y) / dt * 16;
    lastY.current = y; lastTime.current = now;
    scrollRef.current.scrollTop = startScroll.current + (startY.current - y);
    setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    isDragging.current = false;
    const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    const dy = Math.abs((e.changedTouches[0]?.clientY ?? startY.current) - startY.current);
    // свайп вправо: горизонтальное смещение > 50px и больше чем вертикальное
    if (dx > 50 && dx > dy * 1.5 && onSwipeRight) {
      onSwipeRight();
      return;
    }
    startInertia();
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [startInertia, onSwipeRight]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false; isDragging.current = true; didDrag.current = false;
    startY.current = e.clientY; startScroll.current = scrollRef.current?.scrollTop ?? 0;
    lastY.current = e.clientY; lastTime.current = performance.now(); velocity.current = 0;
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    if (Math.abs(e.clientY - startY.current) > 3) didDrag.current = true;
    const y = e.clientY; const now = performance.now(); const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - y) / dt * 16;
    lastY.current = y; lastTime.current = now;
    scrollRef.current.scrollTop = startScroll.current + (startY.current - y);
    setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startInertia();
    // сбрасываем didDrag после завершения — следующий клик будет чистым
    setTimeout(() => { didDrag.current = false; }, 50);
  }, [startInertia]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (isSnapping.current || !scrollRef.current) return;
    scrollRef.current.scrollTop += e.deltaY;
    setScrollTop(scrollRef.current.scrollTop);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setTimeout(() => { snapToIndex(Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H)); }, 120);
  }, [snapToIndex]);

  const onScroll = useCallback(() => {
    if (isSnapping.current || isDragging.current || !scrollRef.current) return;
    setScrollTop(scrollRef.current.scrollTop);
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (items[clamped]?.value !== value) onChange(items[clamped].value);
  }, [items, value, onChange]);

  // Визуальная позиция центра элемента idx: PADDING + idx*ITEM_H + ITEM_H/2 - scrollTop
  // Центр экрана: TOTAL_H / 2
  // offset = визуальная позиция - центр экрана
  const centerIdx = Math.round(scrollTop / ITEM_H);
  const clampedCenterIdx = Math.max(0, Math.min(items.length - 1, centerIdx));

  return (
    <div
      style={{ height: TOTAL_H, position: "relative", userSelect: "none", width: "100%", overflow: "hidden", clipPath: `inset(0 -200px 0 0)`, touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
    >
      {/* Скрытый скролл — только для механики, не перехватывает клики */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ position: "absolute", inset: 0, overflowY: "scroll", scrollbarWidth: "none", opacity: 0, pointerEvents: "none" }}
      >
        <div style={{ height: items.length * ITEM_H + PADDING * 2 }} />
      </div>

      {/* Визуальные элементы — рендерим сами по дуге */}
      {items.map((item, idx) => {
        // Визуальная Y-позиция центра элемента относительно контейнера
        const itemVisualCenter = PADDING + idx * ITEM_H + ITEM_H / 2 - scrollTop;
        // Смещение от центра контейнера
        const offset = itemVisualCenter - TOTAL_H / 2;
        const norm = Math.max(-1, Math.min(1, offset / (TOTAL_H / 2)));

        // Дуга: квадратичная парабола
        const arcX    = norm * norm * 90;
        const scale   = Math.max(0.72, 1 - norm * norm * 0.28);
        const opacity = Math.max(0.2, 1 - norm * norm * 0.78);
        // Строго один центральный
        const isCenter = idx === clampedCenterIdx;

        // Вертикальная позиция на экране
        const y = TOTAL_H / 2 + offset - ITEM_H / 2;

        // Скрываем элементы вне видимой зоны
        if (y < -ITEM_H || y > TOTAL_H) return null;

        return (
          <div
            key={item.value}
            onClick={() => {
              if (didDrag.current) return;
              if (isCenter) onClick(item.value);
              else snapToIndex(idx);
            }}
            style={{
              position: "absolute",
              top: y,
              right: 0,
              width: `calc(100% - ${Math.round(arcX)}px)`,
              height: ITEM_H,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 12px 0 8px",
              cursor: "pointer",
              transform: `scale(${scale})`,
              transformOrigin: "right center",
              opacity,
              transition: "none",
              background: isCenter ? "rgba(124,58,237,0.12)" : "transparent",
              borderRadius: 14,
              border: isCenter ? "1px solid rgba(124,58,237,0.45)" : "1px solid transparent",
              boxSizing: "border-box",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9, overflow: "hidden", flexShrink: 0,
              background: "rgba(124,58,237,0.18)",
              border: `1px solid rgba(124,58,237,${isCenter ? 0.5 : 0.2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 18 }}>📦</span>
              }
            </div>
            <span style={{
              fontSize: isCenter ? 13 : 11,
              fontWeight: isCenter ? 700 : 500,
              color: isCenter ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
              flex: 1,
              lineHeight: 1.3,
            }}>
              {item.label}
            </span>
          </div>
        );
      })}

      {/* Маски — только прозрачность, без чёрного */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 1.2, background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * 1.2, background: "linear-gradient(to top, rgba(0,0,0,0.0) 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export default function CategoryDrumPanel({ open, onClose, prices, onDragItem }: Props) {
  const [mode,             setMode]             = useState<"categories" | "items">("categories");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItem,     setSelectedItem]     = useState("");
  const [visible,          setVisible]          = useState(false);

  useEffect(() => {
    if (open)  setTimeout(() => setVisible(true), 10);
    else       setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) setTimeout(() => { setMode("categories"); setSelectedCategory(""); setSelectedItem(""); }, 300);
  }, [open]);

  const categories: ArcItem[] = (() => {
    const seen = new Set<string>();
    const result: ArcItem[] = [];
    for (const p of prices) {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        result.push({ value: p.category, label: p.category, imageUrl: p.category_image_url });
      }
    }
    return result;
  })();

  const catItems: ArcItem[] = prices
    .filter(p => p.category === selectedCategory)
    .map(p => ({ value: String(p.id), label: p.name, imageUrl: p.image_url }));

  // Стартовый индекс категорий — ищем "профил" по подстроке (без учёта регистра)
  const catStartIdx = (() => {
    const profileIdx = categories.findIndex(c =>
      c.label.toLowerCase().includes("профил")
    );
    return profileIdx >= 0 ? profileIdx : Math.floor(categories.length / 2);
  })();

  const handleCategoryClick = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setMode("items");
  }, []);

  const handleItemClick = useCallback((itemValue: string) => {
    const price = prices.find(p => String(p.id) === itemValue);
    if (!price) return;
    onDragItem({ priceId: price.id, name: price.name, category: price.category, imageUrl: price.image_url, categoryImageUrl: price.category_image_url, unit: price.unit ?? "" });
    onClose();
  }, [prices, onDragItem, onClose]);

  if (!open && !visible) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", top: 0, bottom: 0, right: 0, width: 210, zIndex: 40 }} />
      <div style={{
        position: "fixed",
        right: -8,
        top: 0,
        bottom: 0,
        transform: `translateX(${visible ? 0 : 80}px)`,
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease",
        zIndex: 41,
        width: 200,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "stretch",
        pointerEvents: "none",
        background: "transparent",
      }}>


        <div style={{
          pointerEvents: "all",
          position: "relative",
          padding: "12px 0 12px 6px",
          touchAction: "none",
        }}>
          {/* Дымчатый полукруг за барабаном */}
          <div style={{
            position: "absolute",
            top: "50%",
            // сдвигаем вправо за пределы контейнера — половина круга уходит за правый край
            right: -210,
            transform: "translateY(-50%)",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,10,30,0.82) 0%, rgba(14,10,30,0.45) 50%, transparent 75%)",
            pointerEvents: "none",
            zIndex: 0,
          }} />
          {mode === "categories" && (
            <ArcDrum
              key="cats"
              items={categories}
              value={selectedCategory || (categories[catStartIdx]?.value ?? "")}
              onChange={setSelectedCategory}
              onClick={handleCategoryClick}
              initialIdx={catStartIdx}
            />
          )}
          {mode === "items" && (
            <ArcDrum
              key={`items-${selectedCategory}`}
              items={catItems}
              value={selectedItem || (catItems[0]?.value ?? "")}
              onChange={setSelectedItem}
              onClick={handleItemClick}
              onSwipeRight={() => { setMode("categories"); setSelectedCategory(""); }}
            />
          )}
        </div>
      </div>
    </>
  );
}
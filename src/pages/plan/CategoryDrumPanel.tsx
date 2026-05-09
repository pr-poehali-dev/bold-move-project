import { useRef, useEffect, useCallback, useState } from "react";
import type { SegmentPriceItem } from "./planTypes";

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface PriceEntry {
  id: number;
  name: string;
  category: string;
  image_url: string | null;
  category_image_url: string | null;
}

interface DrumItem {
  value: string;      // category name or price id (as string)
  label: string;
  imageUrl: string | null;
}

// ─── Барабан ─────────────────────────────────────────────────────────────────

const ITEM_H = 56;
const VISIBLE = 7;

function PriceDrum({
  items,
  value,
  onChange,
  onHold,
}: {
  items: DrumItem[];
  value: string;
  onChange: (v: string) => void;
  onHold?: (v: string) => void;
}) {
  const scrollRef    = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const startY       = useRef(0);
  const startScroll  = useRef(0);
  const lastY        = useRef(0);
  const lastTime     = useRef(0);
  const velocity     = useRef(0);
  const rafId        = useRef<number | null>(null);
  const isSnapping   = useRef(false);
  const holdTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdValue    = useRef<string>("");

  const containerH = ITEM_H * VISIBLE;
  const padding    = ITEM_H * Math.floor(VISIBLE / 2);

  const selectedIdx = items.findIndex(i => i.value === value);

  const snapToIndex = useCallback((idx: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const target  = clamped * ITEM_H;
    if (!smooth) { el.scrollTop = target; return; }
    isSnapping.current = true;
    const start = el.scrollTop;
    const diff  = target - start;
    const dur   = Math.min(300, Math.abs(diff) * 1.2);
    const ts0   = performance.now();
    const step = (now: number) => {
      const t    = Math.min(1, (now - ts0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      el.scrollTop = start + diff * ease;
      if (t < 1) {
        rafId.current = requestAnimationFrame(step);
      } else {
        el.scrollTop = target;
        isSnapping.current = false;
        navigator.vibrate?.(8);
        onChange(items[clamped].value);
      }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [items, onChange]);

  useEffect(() => {
    if (selectedIdx >= 0) snapToIndex(selectedIdx, false);
  }, []); // eslint-disable-line

  // Когда список меняется (категория выбрана) — сбрасываем в начало
  useEffect(() => {
    const el = scrollRef.current;
    if (el) { el.scrollTop = 0; isSnapping.current = false; }
    if (items.length > 0) onChange(items[0].value);
  }, [items.length]); // eslint-disable-line

  const startInertia = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    let v = velocity.current;
    const step = () => {
      if (isSnapping.current) return;
      v *= 0.92;
      el.scrollTop += v;
      if (Math.abs(v) > 0.5) {
        rafId.current = requestAnimationFrame(step);
      } else {
        snapToIndex(Math.round(el.scrollTop / ITEM_H));
      }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, [snapToIndex]);

  // Hold: задержка 1.5 с → onHold
  const startHold = (v: string) => {
    if (!onHold) return;
    holdValue.current = v;
    holdTimer.current = setTimeout(() => { onHold(holdValue.current); }, 1500);
  };
  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isSnapping.current = false;
    isDragging.current = true;
    startY.current     = e.touches[0].clientY;
    startScroll.current = scrollRef.current?.scrollTop ?? 0;
    lastY.current      = e.touches[0].clientY;
    lastTime.current   = performance.now();
    velocity.current   = 0;
    // hold — берём текущий центральный элемент
    const idx = Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H);
    startHold(items[Math.max(0, Math.min(items.length - 1, idx))]?.value ?? "");
  }, [items]); // eslint-disable-line

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    cancelHold();
    const y   = e.touches[0].clientY;
    const now = performance.now();
    const dt  = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - y) / dt * 16;
    lastY.current    = y;
    lastTime.current = now;
    scrollRef.current.scrollTop = startScroll.current + (startY.current - y);
  }, []);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    startInertia();
    // hold — при остановке смотрим что в центре
    setTimeout(() => {
      const idx = Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H);
      const v = items[Math.max(0, Math.min(items.length - 1, idx))]?.value ?? "";
      startHold(v);
    }, 350);
  }, [startInertia, items]); // eslint-disable-line

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
    const idx = Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H);
    startHold(items[Math.max(0, Math.min(items.length - 1, idx))]?.value ?? "");
  }, [items]); // eslint-disable-line

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    cancelHold();
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
    setTimeout(() => {
      const idx = Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H);
      const v = items[Math.max(0, Math.min(items.length - 1, idx))]?.value ?? "";
      startHold(v);
    }, 350);
  }, [startInertia, items]); // eslint-disable-line

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      cancelHold();
    };
  }, [onMouseMove, onMouseUp]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    cancelHold();
    if (isSnapping.current || !scrollRef.current) return;
    scrollRef.current.scrollTop += e.deltaY;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setTimeout(() => {
      const idx = Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H);
      snapToIndex(idx);
    }, 120);
  }, [snapToIndex]);

  const onScroll = useCallback(() => {
    if (isSnapping.current || isDragging.current || !scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (items[clamped]?.value !== value) onChange(items[clamped].value);
  }, [items, value, onChange]);

  return (
    <div style={{ height: containerH, position: "relative", userSelect: "none" }} className="w-full">
      {/* Маски */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: padding,
        background: "linear-gradient(to bottom, #0f1017 0%, transparent 100%)",
        zIndex: 2, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: padding,
        background: "linear-gradient(to top, #0f1017 0%, transparent 100%)",
        zIndex: 2, pointerEvents: "none",
      }} />
      {/* Рамка выбранного */}
      <div style={{
        position: "absolute", top: "50%", left: 8, right: 8, height: ITEM_H,
        transform: "translateY(-50%)",
        borderTop: "1px solid rgba(124,58,237,0.35)",
        borderBottom: "1px solid rgba(124,58,237,0.35)",
        background: "rgba(124,58,237,0.08)",
        borderRadius: 12, zIndex: 3, pointerEvents: "none",
      }} />
      {/* Список */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onScroll={onScroll}
        style={{ height: "100%", overflowY: "scroll", scrollbarWidth: "none" }}
      >
        <div style={{ paddingTop: padding, paddingBottom: padding }}>
          {items.map((item) => (
            <div
              key={item.value}
              style={{ height: ITEM_H, display: "flex", alignItems: "center", cursor: "pointer", padding: "0 16px", gap: 12 }}
            >
              {/* Картинка */}
              <div style={{
                width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 18 }}>📦</span>
                }
              </div>
              {/* Название */}
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: item.value === value ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                transition: "color 0.15s",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  prices: PriceEntry[];
  /** вызывается когда пользователь начинает тащить товар на холст */
  onDragItem: (item: SegmentPriceItem) => void;
}

export default function CategoryDrumPanel({ open, onClose, prices, onDragItem }: Props) {
  // Уникальные категории
  const categories: DrumItem[] = (() => {
    const seen = new Set<string>();
    const result: DrumItem[] = [];
    for (const p of prices) {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        result.push({
          value: p.category,
          label: p.category,
          imageUrl: p.category_image_url,
        });
      }
    }
    return result;
  })();

  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.value ?? "");
  const [mode, setMode] = useState<"categories" | "items">("categories");
  const [selectedItem, setSelectedItem] = useState("");
  // hint под барабаном
  const [hint, setHint] = useState("Задержитесь 1.5 с чтобы открыть товары");

  // Товары выбранной категории
  const categoryItems: DrumItem[] = prices
    .filter(p => p.category === selectedCategory)
    .map(p => ({
      value: String(p.id),
      label: p.name,
      imageUrl: p.image_url,
    }));

  // При смене категории — сбросить выбранный товар
  useEffect(() => {
    if (categoryItems.length > 0) setSelectedItem(categoryItems[0].value);
  }, [selectedCategory]); // eslint-disable-line

  // Задержка на категории → переключить на товары
  const handleCategoryHold = (catValue: string) => {
    setSelectedCategory(catValue);
    setMode("items");
    setHint("Потяните товар на стену чертежа");
  };

  // Выбор товара — начать drag
  const handleItemHold = (itemValue: string) => {
    const price = prices.find(p => String(p.id) === itemValue);
    if (!price) return;
    const item: SegmentPriceItem = {
      priceId: price.id,
      name: price.name,
      category: price.category,
      imageUrl: price.image_url,
      categoryImageUrl: price.category_image_url,
    };
    onDragItem(item);
    onClose();
  };

  const handleBack = () => {
    setMode("categories");
    setHint("Задержитесь 1.5 с чтобы открыть товары");
  };

  if (!open) return null;

  return (
    <>
      {/* Оверлей */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.4)",
        }}
      />

      {/* Панель справа */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 41,
        width: 220,
        background: "#0f1017",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Шапка: назад / категория */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "16px 12px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          {mode === "items" && (
            <button
              onClick={handleBack}
              style={{
                background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.6)",
                borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              ← Назад
            </button>
          )}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flex: 1 }}>
            {mode === "categories" ? "Категории" : selectedCategory}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.25)",
              cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Барабан */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {mode === "categories" ? (
            <PriceDrum
              key="categories"
              items={categories}
              value={selectedCategory}
              onChange={setSelectedCategory}
              onHold={handleCategoryHold}
            />
          ) : (
            <PriceDrum
              key={`items-${selectedCategory}`}
              items={categoryItems}
              value={selectedItem}
              onChange={setSelectedItem}
              onHold={handleItemHold}
            />
          )}
        </div>

        {/* Подсказка */}
        <div style={{
          padding: "8px 16px 20px",
          textAlign: "center",
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", margin: 0, lineHeight: 1.4 }}>
            {hint}
          </p>
        </div>
      </div>
    </>
  );
}

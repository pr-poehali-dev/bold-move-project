import { useState, useEffect, useRef, useCallback } from "react";
import type { SegmentPriceItem } from "./planTypes";

export interface PriceEntry {
  id: number;
  name: string;
  category: string;
  image_url: string | null;
  category_image_url: string | null;
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

const ITEM_H      = 60;
const VISIBLE     = 5;
const CONTAINER_H = ITEM_H * VISIBLE;
const PADDING     = ITEM_H * Math.floor(VISIBLE / 2);

// ── Барабан ───────────────────────────────────────────────────────────────────

function ArcDrum({ items, value, onChange, onClick }: {
  items: ArcItem[];
  value: string;
  onChange: (v: string) => void;
  onClick: (v: string) => void;
}) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const isDragging  = useRef(false);
  const didDrag     = useRef(false);
  const startY      = useRef(0);
  const startScroll = useRef(0);
  const lastY       = useRef(0);
  const lastTime    = useRef(0);
  const velocity    = useRef(0);
  const rafId       = useRef<number | null>(null);
  const isSnapping  = useRef(false);

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
    const step  = (now: number) => {
      const t    = Math.min(1, (now - ts0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      el.scrollTop = start + diff * ease;
      if (t < 1) { rafId.current = requestAnimationFrame(step); }
      else {
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
    const el = scrollRef.current;
    if (el) { el.scrollTop = 0; isSnapping.current = false; }
    if (items.length > 0) onChange(items[0].value);
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
  }, []);

  const onTouchEnd = useCallback(() => { isDragging.current = false; startInertia(); }, [startInertia]);

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
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false; startInertia();
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
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setTimeout(() => { snapToIndex(Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_H)); }, 120);
  }, [snapToIndex]);

  const onScroll = useCallback(() => {
    if (isSnapping.current || isDragging.current || !scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (items[clamped]?.value !== value) onChange(items[clamped].value);
  }, [items, value, onChange]);

  return (
    <div style={{ height: CONTAINER_H, position: "relative", userSelect: "none", width: "100%" }}>
      {/* Маски — фейд без фона */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: PADDING, background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: PADDING, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)", zIndex: 2, pointerEvents: "none" }} />
      {/* Рамка центра */}
      <div style={{ position: "absolute", top: "50%", left: 6, right: 6, height: ITEM_H, transform: "translateY(-50%)", border: "1px solid rgba(124,58,237,0.5)", background: "rgba(124,58,237,0.07)", borderRadius: 16, zIndex: 3, pointerEvents: "none" }} />
      {/* Список */}
      <div ref={scrollRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onMouseDown={onMouseDown} onWheel={onWheel} onScroll={onScroll} style={{ height: "100%", overflowY: "scroll", scrollbarWidth: "none" }}>
        <div style={{ paddingTop: PADDING, paddingBottom: PADDING }}>
          {items.map((item, idx) => {
            const dist    = Math.abs(idx - selectedIdx);
            const scale   = Math.max(0.7, 1 - dist * 0.1);
            const opacity = Math.max(0.2, 1 - dist * 0.3);
            const isCenter = idx === selectedIdx;
            return (
              <div
                key={item.value}
                onClick={() => { if (!didDrag.current) { if (isCenter) onClick(item.value); else snapToIndex(idx); } }}
                style={{ height: ITEM_H, display: "flex", alignItems: "center", gap: 10, padding: "0 14px 0 8px", cursor: "pointer", transform: `scale(${scale})`, opacity, transition: "transform 0.15s, opacity 0.15s" }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 20 }}>📦</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: isCenter ? 700 : 500, color: isCenter ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {item.label}
                </span>
                {isCenter && (
                  <span style={{ fontSize: 9, color: "rgba(196,181,253,0.6)", flexShrink: 0 }}>▶</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
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

  const handleCategoryClick = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setMode("items");
  }, []);

  const handleItemClick = useCallback((itemValue: string) => {
    const price = prices.find(p => String(p.id) === itemValue);
    if (!price) return;
    onDragItem({ priceId: price.id, name: price.name, category: price.category, imageUrl: price.image_url, categoryImageUrl: price.category_image_url });
    onClose();
  }, [prices, onDragItem, onClose]);

  if (!open && !visible) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div style={{
        position: "fixed", right: 0, top: "50%",
        transform: `translateY(-50%) translateX(${visible ? 0 : 80}px)`,
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.2s ease",
        zIndex: 41, width: 210,
        display: "flex", flexDirection: "column",
      }}>
        {/* Шапка */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 2px" }}>
          {mode === "items" ? (
            <button onClick={e => { e.stopPropagation(); setMode("categories"); setSelectedCategory(""); }}
              style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8, padding: "2px 10px", color: "rgba(196,181,253,0.9)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              ← Назад
            </button>
          ) : (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 700, letterSpacing: 1 }}>КАТАЛОГ</span>
          )}
          <button onClick={e => { e.stopPropagation(); onClose(); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "center", margin: "2px 0 4px", padding: "0 8px" }}>
          {mode === "categories" ? "Нажмите на центральный элемент" : selectedCategory}
        </p>
        {/* Барабан */}
        {mode === "categories" && (
          <ArcDrum key="cats" items={categories} value={selectedCategory || (categories[0]?.value ?? "")} onChange={setSelectedCategory} onClick={handleCategoryClick} />
        )}
        {mode === "items" && (
          <ArcDrum key={`items-${selectedCategory}`} items={catItems} value={selectedItem || (catItems[0]?.value ?? "")} onChange={setSelectedItem} onClick={handleItemClick} />
        )}
      </div>
    </>
  );
}

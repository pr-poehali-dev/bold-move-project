import { useCallback, useEffect, useRef, useState } from "react";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import func2url from "@/../backend/func2url.json";

const PRICES_URL = (func2url as Record<string, string>)["get-prices"];

export interface PlanCatalogState {
  catalogOpen: boolean;
  setCatalogOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  prices: PriceEntry[];
  filteredPrices: PriceEntry[];
  activeItems: SegmentPriceItem[];
  setActiveItems: React.Dispatch<React.SetStateAction<SegmentPriceItem[]>>;
  tapActiveId: number | null;
  setTapActiveId: (id: number | null) => void;
  dragItem: SegmentPriceItem | null;
  setDragItem: (item: SegmentPriceItem | null) => void;
  dragPos: { x: number; y: number } | null;
  setDragPos: (pos: { x: number; y: number } | null) => void;
  dragCardItem: SegmentPriceItem | null;
  dragCardPos: { x: number; y: number } | null;
  hoverSegId: string | null;
  setHoverSegId: (id: string | null) => void;
  filterAttached: boolean;
  setFilterAttached: (v: boolean | ((prev: boolean) => boolean)) => void;
  attachedCount: number;
  findClosestSeg: (clientX: number, clientY: number, useLargeThreshold?: boolean) => string | null;
  assignItemToSeg: (item: SegmentPriceItem, segId: string) => void;
  removeActiveItem: (priceId: number) => void;
}

export function usePlanCatalog(
  stateRef: React.MutableRefObject<PlanState>,
  push: (s: PlanState) => void,
): PlanCatalogState {
  const [catalogOpen,    setCatalogOpen]    = useState(false);
  const [prices,         setPrices]         = useState<PriceEntry[]>([]);
  const [activeItems,    setActiveItems]    = useState<SegmentPriceItem[]>([]);
  const [dragItem,       setDragItem]       = useState<SegmentPriceItem | null>(null);
  const [dragPos,        setDragPos]        = useState<{ x: number; y: number } | null>(null);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverSegId,     setHoverSegId]     = useState<string | null>(null);
  const [tapActiveId,    setTapActiveId]    = useState<number | null>(null);
  const [dragCardItem,   setDragCardItem]   = useState<SegmentPriceItem | null>(null);
  const [dragCardPos,    setDragCardPos]    = useState<{ x: number; y: number } | null>(null);
  const [filterAttached, setFilterAttached] = useState(false);

  // Загружаем прайс один раз
  useEffect(() => {
    if (!PRICES_URL) return;
    fetch(PRICES_URL)
      .then(r => r.json())
      .then((data: { prices: PriceEntry[] }) => { if (data?.prices) setPrices(data.prices); })
      .catch(() => {});
  }, []);

  // Утилита: найти ближайший сегмент к точке экрана
  const findClosestSeg = useCallback((clientX: number, clientY: number, useLargeThreshold = false) => {
    const s = stateRef.current;
    if (!s.isClosed || s.segments.length === 0) return null;
    const zoom = s.settings.zoom;
    const panX = s.settings.panX ?? 0;
    const panY = s.settings.panY ?? 0;
    const canvasEl = document.getElementById("plan-canvas-wrap");
    if (!canvasEl) return null;
    const rect = canvasEl.getBoundingClientRect();
    const cx = (clientX - rect.left) / zoom - panX;
    const cy = (clientY - rect.top) / zoom - panY;
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const seg of s.segments) {
      const a = s.points.find(p => p.id === seg.fromId);
      const b = s.points.find(p => p.id === seg.toId);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / len2)) : 0;
      const px = a.x + t * dx - cx, py = a.y + t * dy - cy;
      const dist = Math.sqrt(px * px + py * py);
      if (dist < bestDist) { bestDist = dist; bestId = seg.id; }
    }
    const threshold = useLargeThreshold ? 200 / zoom : 80 / zoom;
    return bestDist < threshold ? bestId : null;
  }, [stateRef]);

  // Привязать товар к стене (quantity = длина стены в метрах, округлено до 0.01)
  const assignItemToSeg = useCallback((item: SegmentPriceItem, segId: string) => {
    const s = stateRef.current;
    const newSegments = s.segments.map(seg => {
      if (seg.id !== segId) return seg;
      const existing = seg.items ?? [];
      if (existing.some(it => it.priceId === item.priceId)) return seg;
      const meters = seg.lengthCm ? Math.round(seg.lengthCm / 100 * 100) / 100 : 1;
      return { ...seg, items: [...existing, { ...item, quantity: meters }] };
    });
    push({ ...s, segments: newSegments });
  }, [stateRef, push]);

  // Удалить товар со всех стен и убрать карточку
  const removeActiveItem = useCallback((priceId: number) => {
    const s = stateRef.current;
    const newSegments = s.segments.map(seg => ({
      ...seg,
      items: (seg.items ?? []).filter(it => it.priceId !== priceId),
    }));
    push({ ...s, segments: newSegments });
    setActiveItems(prev => prev.filter(it => it.priceId !== priceId));
    setTapActiveId(prev => (prev === priceId ? null : prev));
  }, [stateRef, push]);

  // Drag: товар летит за курсором/пальцем (десктоп)
  useEffect(() => {
    if (!dragItem) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const { clientX, clientY } = "touches" in e ? e.touches[0] : e;
      dragPosRef.current = { x: clientX, y: clientY };
      setDragPos({ x: clientX, y: clientY });
      setHoverSegId(findClosestSeg(clientX, clientY));
    };

    const onEnd = (e: MouseEvent | TouchEvent) => {
      const pt = "changedTouches" in e ? e.changedTouches[0] : e;
      const closestId = findClosestSeg(pt.clientX, pt.clientY);
      if (closestId) assignItemToSeg(dragItem, closestId);
      setDragItem(null);
      setDragPos(null);
      dragPosRef.current = null;
      setHoverSegId(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragItem, findClosestSeg, assignItemToSeg]);

  // Drag карточки активного товара на стену (touch + mouse)
  useEffect(() => {
    if (activeItems.length === 0) return;

    let draggingItem: SegmentPriceItem | null = null;
    let isDragging = false;
    let startX = 0, startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest("[data-active-item]") as HTMLElement | null;
      if (!card) return;
      const priceId = parseInt(card.dataset.activeItem ?? "0");
      const item = activeItems.find(it => it.priceId === priceId);
      if (!item) return;
      draggingItem = item;
      isDragging = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    let directionDecided = false;
    let isHorizontal = false;

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingItem) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);

      if (!directionDecided && (adx > 5 || ady > 5)) {
        directionDecided = true;
        isHorizontal = adx > ady;
      }

      if (isHorizontal) {
        draggingItem = null;
        return;
      }

      if (dy < -10) {
        isDragging = true;
        e.preventDefault();
      }

      if (isDragging) {
        const tx = e.touches[0].clientX;
        const ty = e.touches[0].clientY;
        setDragCardItem(draggingItem);
        setDragCardPos({ x: tx, y: ty });
        setHoverSegId(findClosestSeg(tx, ty));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!draggingItem || !isDragging) {
        draggingItem = null;
        isDragging = false;
        directionDecided = false;
        isHorizontal = false;
        setHoverSegId(null);
        setDragCardItem(null);
        setDragCardPos(null);
        return;
      }
      const pt = e.changedTouches[0];
      const closestId = findClosestSeg(pt.clientX, pt.clientY, false);
      if (closestId) {
        assignItemToSeg(draggingItem, closestId);
        navigator.vibrate?.(30);
      }
      draggingItem = null;
      isDragging = false;
      directionDecided = false;
      isHorizontal = false;
      setHoverSegId(null);
      setDragCardItem(null);
      setDragCardPos(null);
    };

    // Mouse drag (десктоп)
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest("[data-active-item]") as HTMLElement | null;
      if (!card) return;
      const priceId = parseInt(card.dataset.activeItem ?? "0");
      const item = activeItems.find(it => it.priceId === priceId);
      if (!item) return;
      draggingItem = item;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingItem || !isDragging) return;
      setDragCardItem(draggingItem);
      setDragCardPos({ x: e.clientX, y: e.clientY });
      setHoverSegId(findClosestSeg(e.clientX, e.clientY));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!draggingItem || !isDragging) { draggingItem = null; isDragging = false; return; }
      const closestId = findClosestSeg(e.clientX, e.clientY, false);
      if (closestId) assignItemToSeg(draggingItem, closestId);
      draggingItem = null; isDragging = false;
      setHoverSegId(null); setDragCardItem(null); setDragCardPos(null);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeItems, findClosestSeg, assignItemToSeg]);

  // Кол-во уникальных товаров на холсте
  const attachedPriceIds = new Set<number>();
  stateRef.current.segments.forEach(seg => seg.items?.forEach(it => attachedPriceIds.add(it.priceId)));
  const attachedCount = attachedPriceIds.size;

  // Фильтруем прайс если активен фильтр «На холсте»
  const filteredPrices = filterAttached && attachedPriceIds.size > 0
    ? prices.filter(p => attachedPriceIds.has(p.id))
    : prices;

  return {
    catalogOpen, setCatalogOpen,
    prices, filteredPrices,
    activeItems, setActiveItems,
    tapActiveId, setTapActiveId,
    dragItem, setDragItem,
    dragPos, setDragPos,
    dragCardItem, dragCardPos,
    hoverSegId, setHoverSegId,
    filterAttached, setFilterAttached,
    attachedCount,
    findClosestSeg, assignItemToSeg, removeActiveItem,
  };
}
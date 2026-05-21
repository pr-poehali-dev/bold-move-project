import { useCallback, useEffect, useRef, useState } from "react";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { FloorItem, PlanState, SegmentPriceItem } from "./planTypes";
import { genId } from "./planTypes";
import { ALL_SEGS_SENTINEL } from "./useVoiceCatalog";
import func2url from "@/../backend/func2url.json";

// Категории ниш — не заменяются, а добавляются вторым товаром на стену
const NICHE_CATEGORIES = new Set([
  "Ниши для штор",
  "Двухуровневые",
]);

const PRICES_URL = (func2url as Record<string, string>)["get-prices"];

export interface PlanCatalogState {
  catalogOpen: boolean;
  setCatalogOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  replaceCatalogCategory: string | null;
  setReplaceCatalogCategory: (cat: string | null) => void;
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
  assignItemToSegs: (item: SegmentPriceItem, segIds: string[]) => void;
  assignItemToAllSegs: (item: SegmentPriceItem) => void;
  removeItemFromAllSegs: (priceId: number) => void;
  removeActiveItem: (priceId: number) => void;
  isItemOnAllSegs: (priceId: number) => boolean;
  adjustItemQuantity: (priceId: number, delta: number) => void;
  setItemQuantity: (priceId: number, value: number) => void;
  assignManyItems: (wallItems: { item: SegmentPriceItem; segIds: string[] | null }[], floorItems: SegmentPriceItem[]) => void;
  // Модалка для добавления на полотно
  pendingFloorItem: SegmentPriceItem | null;
  setPendingFloorItem: (item: SegmentPriceItem | null) => void;
  confirmFloorItem: (quantity: number) => void;
  // Модалка редактирования существующего floorItem
  editingFloorId: string | null;
  setEditingFloorId: (id: string | null) => void;
  editingFloorItem: (SegmentPriceItem & { quantity: number }) | null;
  confirmEditFloorItem: (quantity: number) => void;
}

export function usePlanCatalog(
  stateRef: React.MutableRefObject<PlanState>,
  push: (s: PlanState) => void,
  state: PlanState,
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
  const [filterAttached,         setFilterAttached]         = useState(false);
  const [pendingFloorItem,       setPendingFloorItem]       = useState<SegmentPriceItem | null>(null);
  const [editingFloorId,         setEditingFloorId]         = useState<string | null>(null);
  const [replaceCatalogCategory, setReplaceCatalogCategory] = useState<string | null>(null);

  // Категории, которые НЕ показываются в нижней панели
  const HIDDEN_CATEGORIES = ["монтаж", "раскрой", "огарпунивание"];
  const isHiddenCategory = (cat: string) =>
    HIDDEN_CATEGORIES.some(h => cat?.toLowerCase().includes(h));

  // Синхронизация activeItems с товарами в сегментах + полотне
  // Собираем уникальные товары из segments[].items и floorItems (кроме скрытых категорий)
  useEffect(() => {
    const seenPriceIds = new Set<number>();
    const derived: SegmentPriceItem[] = [];

    // Сначала — товары со стен
    for (const seg of state.segments) {
      for (const it of seg.items ?? []) {
        if (!seenPriceIds.has(it.priceId) && !isHiddenCategory(it.category)) {
          seenPriceIds.add(it.priceId);
          derived.push(it);
        }
      }
    }

    // Затем — товары с полотна (floorItems), которых ещё нет в списке
    for (const fi of state.floorItems ?? []) {
      if (!seenPriceIds.has(fi.priceId) && !isHiddenCategory(fi.category)) {
        seenPriceIds.add(fi.priceId);
        derived.push({
          priceId: fi.priceId,
          name: fi.name,
          category: fi.category,
          imageUrl: fi.imageUrl,
          categoryImageUrl: null,
          unit: fi.unit,
          isWallItem: false,
        });
      }
    }

    setActiveItems(prev => {
      const prevIds = new Set(prev.map(i => i.priceId));
      const nextIds = new Set(derived.map(i => i.priceId));
      const sameSet = prevIds.size === nextIds.size && [...nextIds].every(id => prevIds.has(id));
      if (sameSet) return prev;
      return derived;
    });
  }, [state.segments, state.floorItems]);

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

  // Найти превалирующий профиль для стен (самый часто встречающийся не-нишевый товар)
  // ВАЖНО: объявлен ДО assignItemToSeg чтобы избежать temporal dead zone
  const findDominantWallProfile = useCallback((segments: typeof stateRef.current.segments): SegmentPriceItem | null => {
    const counts = new Map<number, { item: SegmentPriceItem; count: number }>();
    for (const seg of segments) {
      for (const it of seg.items ?? []) {
        if (NICHE_CATEGORIES.has(it.category)) continue;
        const prev = counts.get(it.priceId);
        if (prev) { prev.count++; } else { counts.set(it.priceId, { item: it, count: 1 }); }
      }
    }
    if (counts.size === 0) return null;
    return [...counts.values()].sort((a, b) => b.count - a.count)[0].item;
  }, []);

  // Привязать товар к стене (quantity = длина стены в метрах, округлено до 0.01)
  const assignItemToSeg = useCallback((item: SegmentPriceItem, segId: string) => {
    const s = stateRef.current;
    const isNiche = NICHE_CATEGORIES.has(item.category);
    const newSegments = s.segments.map(seg => {
      if (seg.id !== segId) return seg;
      const existing = seg.items ?? [];
      if (existing.some(it => it.priceId === item.priceId)) return seg;
      const meters = seg.lengthCm ? Math.round(seg.lengthCm / 100 * 100) / 100 : 1;
      let updatedItems = [...existing, { ...item, quantity: meters }];

      // ПРАВИЛО: при добавлении ниши вручную — автоматически добавить превалирующий профиль
      if (isNiche) {
        const hasWallProfile = existing.some(it => !NICHE_CATEGORIES.has(it.category));
        if (!hasWallProfile) {
          const dominant = findDominantWallProfile(s.segments);
          if (dominant && !existing.some(it => it.priceId === dominant.priceId)) {
            updatedItems = [...updatedItems, { ...dominant, quantity: meters }];
          }
        }
      }
      return { ...seg, items: updatedItems };
    });
    push({ ...s, segments: newSegments });
  }, [stateRef, push, findDominantWallProfile]);

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

  // Привязать товар сразу к нескольким стенам одним push (атомарно)
  const assignItemToSegs = useCallback((item: SegmentPriceItem, segIds: string[]) => {
    const s = stateRef.current;
    const idSet = new Set(segIds);
    const newSegments = s.segments.map(seg => {
      if (!idSet.has(seg.id)) return seg;
      const existing = seg.items ?? [];
      if (existing.some(it => it.priceId === item.priceId)) return seg;
      const meters = seg.lengthCm ? Math.round(seg.lengthCm / 100 * 100) / 100 : 1;
      return { ...seg, items: [...existing, { ...item, quantity: meters }] };
    });
    push({ ...s, segments: newSegments });
    setActiveItems(prev => prev.some(it => it.priceId === item.priceId) ? prev : [...prev, item]);
    setTapActiveId(item.priceId);
  }, [stateRef, push]);

  // Добавить товар на все стены (quantity = длина каждой стены)
  const assignItemToAllSegs = useCallback((item: SegmentPriceItem) => {
    const s = stateRef.current;
    const newSegments = s.segments.map(seg => {
      const existing = seg.items ?? [];
      if (existing.some(it => it.priceId === item.priceId)) return seg;
      const meters = seg.lengthCm ? Math.round(seg.lengthCm / 100 * 100) / 100 : 1;
      return { ...seg, items: [...existing, { ...item, quantity: meters }] };
    });
    push({ ...s, segments: newSegments });
  }, [stateRef, push]);

  // Добавить СРАЗУ НЕСКОЛЬКО товаров за один push (для голосового ввода)
  const assignManyItems = useCallback((
    wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[],
    floorOrActiveItems: SegmentPriceItem[],
  ) => {
    const s = stateRef.current;

    let newSegments = s.segments;
    for (const { item, segIds } of wallItemsWithSegs) {
      if (!segIds || segIds.length === 0) continue; // null = неизвестно, пропускаем
      const isAllSegs = segIds[0] === ALL_SEGS_SENTINEL;
      const targetSet = isAllSegs ? null : new Set(segIds);
      const isNiche = NICHE_CATEGORIES.has(item.category);

      newSegments = newSegments.map(seg => {
        if (targetSet && !targetSet.has(seg.id)) return seg;
        const existing = seg.items ?? [];
        const meters = seg.lengthCm ? Math.round(seg.lengthCm / 100 * 100) / 100 : 1;

        if (isNiche) {
          // Ниши — добавляем вторым, не заменяем существующее
          if (existing.some(it => it.priceId === item.priceId)) return seg;
          let updatedItems = [...existing, { ...item, quantity: meters }];

          // ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: за нишей всегда должен быть профиль для стены.
          // Если на этой стене нет ни одного не-нишевого профиля — добавляем превалирующий.
          const hasWallProfile = existing.some(it => !NICHE_CATEGORIES.has(it.category));
          if (!hasWallProfile) {
            const dominant = findDominantWallProfile(newSegments);
            if (dominant) {
              updatedItems = [...updatedItems, { ...dominant, quantity: meters }];
            }
          }
          return { ...seg, items: updatedItems };
        } else {
          // Обычный профиль — ЗАМЕНЯЕМ существующий той же категории на этой стене
          const sameCategory = existing.filter(it => it.category === item.category);
          if (sameCategory.length > 0) {
            // Убираем старый, ставим новый
            const filtered = existing.filter(it => it.category !== item.category);
            return { ...seg, items: [...filtered, { ...item, quantity: meters }] };
          }
          if (existing.some(it => it.priceId === item.priceId)) return seg;
          return { ...seg, items: [...existing, { ...item, quantity: meters }] };
        }
      });
    }

    // Полотно/штучные — добавляем в state.floorItems (не в activeItems!)
    let newFloorItems = s.floorItems ?? [];
    for (const item of floorOrActiveItems) {
      if (!newFloorItems.some(fi => fi.priceId === item.priceId)) {
        const fi: FloorItem = {
          id: genId("fi"),
          priceId: item.priceId,
          name: item.name,
          category: item.category,
          imageUrl: item.imageUrl,
          unit: item.unit,
          quantity: item.quantity ?? 1,
        };
        newFloorItems = [...newFloorItems, fi];
      }
    }

    push({ ...s, segments: newSegments, floorItems: newFloorItems });
  }, [stateRef, push]);

  // Удалить товар только со всех стен (карточку НЕ убираем)
  const removeItemFromAllSegs = useCallback((priceId: number) => {
    const s = stateRef.current;
    const newSegments = s.segments.map(seg => ({
      ...seg,
      items: (seg.items ?? []).filter(it => it.priceId !== priceId),
    }));
    push({ ...s, segments: newSegments });
  }, [stateRef, push]);

  // Проверить: товар стоит на всех стенах?
  const isItemOnAllSegs = useCallback((priceId: number): boolean => {
    const s = stateRef.current;
    if (!s.segments.length) return false;
    return s.segments.every(seg => (seg.items ?? []).some(it => it.priceId === priceId));
  }, [stateRef]);

  // Изменить суммарное quantity на delta (±1) — делим поровну по стенам
  const adjustItemQuantity = useCallback((priceId: number, delta: number) => {
    const s = stateRef.current;
    const segsWithItem = s.segments.filter(seg => (seg.items ?? []).some(it => it.priceId === priceId));
    const count = segsWithItem.length || 1;
    const currentTotal = segsWithItem.reduce((sum, seg) => {
      const it = (seg.items ?? []).find(i => i.priceId === priceId);
      return sum + (it?.quantity ?? 1);
    }, 0);
    const newTotal = Math.max(0.1, Math.round((currentTotal + delta) * 10) / 10);
    const perSeg = Math.max(0.01, Math.round((newTotal / count) * 100) / 100);
    const newSegments = s.segments.map(seg => ({
      ...seg,
      items: (seg.items ?? []).map(it =>
        it.priceId === priceId ? { ...it, quantity: perSeg } : it
      ),
    }));
    push({ ...s, segments: newSegments });
  }, [stateRef, push]);

  // Установить суммарное количество — итог округляем вверх до чётного целого (шаг 2м)
  // Примеры: 18.5→20, 19→20, 20→20, 21→22, 22→22, 23→24
  const setItemQuantity = useCallback((priceId: number, value: number) => {
    const s = stateRef.current;
    const segsWithItem = s.segments.filter(seg => (seg.items ?? []).some(it => it.priceId === priceId));
    const count = segsWithItem.length || 1;
    // Округляем вверх до чётного целого
    const ceiled = Math.ceil(value);
    const total = ceiled % 2 === 0 ? ceiled : ceiled + 1;
    // Первые (count-1) стен получают floor(total/count), последняя — остаток
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    let segIdx = 0;
    const newSegments = s.segments.map(seg => {
      const hasItem = (seg.items ?? []).some(it => it.priceId === priceId);
      if (!hasItem) return seg;
      const qty = segIdx < (count - remainder) ? base : base + 1;
      segIdx++;
      return {
        ...seg,
        items: (seg.items ?? []).map(it =>
          it.priceId === priceId ? { ...it, quantity: Math.max(1, qty) } : it
        ),
      };
    });
    push({ ...s, segments: newSegments });
  }, [stateRef, push]);

  // Утилита: точка (cx,cy) в canvas-координатах внутри полигона?
  const isInsidePolygon = useCallback((clientX: number, clientY: number): boolean => {
    const s = stateRef.current;
    if (!s.isClosed || s.points.length < 3) return false;
    const zoom = s.settings.zoom;
    const panX = s.settings.panX ?? 0;
    const panY = s.settings.panY ?? 0;
    const canvasEl = document.getElementById("plan-canvas-wrap");
    if (!canvasEl) return false;
    const rect = canvasEl.getBoundingClientRect();
    const cx = (clientX - rect.left) / zoom - panX;
    const cy = (clientY - rect.top) / zoom - panY;
    // Ray casting
    const pts = s.points;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      if (((yi > cy) !== (yj > cy)) && (cx < (xj - xi) * (cy - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, [stateRef]);

  // Подтвердить добавление на полотно с введённым количеством
  const confirmFloorItem = useCallback((quantity: number) => {
    const item = pendingFloorItem;
    if (!item) return;
    const s = stateRef.current;
    const newFloorItem: FloorItem = {
      id: genId("fi"),
      priceId: item.priceId,
      name: item.name,
      category: item.category,
      imageUrl: item.imageUrl,
      unit: item.unit,
      quantity,
    };
    push({ ...s, floorItems: [...(s.floorItems ?? []), newFloorItem] });
    setPendingFloorItem(null);
  }, [pendingFloorItem, stateRef, push]);

  // Подтвердить редактирование существующего floorItem
  const confirmEditFloorItem = useCallback((quantity: number) => {
    if (!editingFloorId) return;
    const s = stateRef.current;
    push({ ...s, floorItems: (s.floorItems ?? []).map(fi =>
      fi.id === editingFloorId ? { ...fi, quantity } : fi
    )});
    setEditingFloorId(null);
  }, [editingFloorId, stateRef, push]);

  // Заменить floorItem: удалить старый, поставить новый с тем же quantity
  const replaceFloorItem = useCallback((newItem: SegmentPriceItem, quantity: number) => {
    if (!editingFloorId) return;
    const s = stateRef.current;
    push({ ...s, floorItems: (s.floorItems ?? []).map(fi =>
      fi.id === editingFloorId
        ? { ...fi, priceId: newItem.priceId, name: newItem.name, category: newItem.category, imageUrl: newItem.imageUrl, unit: newItem.unit, quantity }
        : fi
    )});
    setEditingFloorId(null);
  }, [editingFloorId, stateRef, push]);

  // Данные редактируемого floorItem для модалки
  const editingFloorItem = editingFloorId
    ? (() => {
        const fi = stateRef.current.floorItems?.find(f => f.id === editingFloorId);
        if (!fi) return null;
        return { priceId: fi.priceId, name: fi.name, category: fi.category,
          imageUrl: fi.imageUrl, categoryImageUrl: null, unit: fi.unit, quantity: fi.quantity } as SegmentPriceItem & { quantity: number };
      })()
    : null;

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
      // Полотно имеет приоритет над стеной при малом пороге
      if (isInsidePolygon(pt.clientX, pt.clientY)) {
        const closestId = findClosestSeg(pt.clientX, pt.clientY);
        if (closestId) {
          assignItemToSeg(dragItem, closestId);
        } else {
          setPendingFloorItem(dragItem);
        }
      } else {
        const closestId = findClosestSeg(pt.clientX, pt.clientY, true);
        if (closestId) assignItemToSeg(dragItem, closestId);
      }
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
      if (isInsidePolygon(pt.clientX, pt.clientY)) {
        const closestId = findClosestSeg(pt.clientX, pt.clientY, false);
        if (closestId) { assignItemToSeg(draggingItem, closestId); navigator.vibrate?.(30); }
        else setPendingFloorItem(draggingItem);
      } else {
        const closestId = findClosestSeg(pt.clientX, pt.clientY, true);
        if (closestId) { assignItemToSeg(draggingItem, closestId); navigator.vibrate?.(30); }
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
    let mouseStartX = 0, mouseStartY = 0;
    let mouseDragging = false; // true только после реального движения мыши
    const MOUSE_DRAG_THRESHOLD = 6; // px — минимальное движение чтобы считать drag

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Не перехватываем клики на попапе или кнопках внутри карточки
      if (target.closest("[data-item-popup]")) return;
      const card = target.closest("[data-active-item]") as HTMLElement | null;
      if (!card) return;
      const priceId = parseInt(card.dataset.activeItem ?? "0");
      const item = activeItems.find(it => it.priceId === priceId);
      if (!item) return;
      draggingItem = item;
      isDragging = false;   // ← drag НЕ начат, пока мышь не двинулась
      mouseDragging = false;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingItem) return;
      const dx = Math.abs(e.clientX - mouseStartX);
      const dy = Math.abs(e.clientY - mouseStartY);
      if (!mouseDragging && (dx > MOUSE_DRAG_THRESHOLD || dy > MOUSE_DRAG_THRESHOLD)) {
        mouseDragging = true;
        isDragging = true;
      }
      if (!isDragging) return;
      setDragCardItem(draggingItem);
      setDragCardPos({ x: e.clientX, y: e.clientY });
      setHoverSegId(findClosestSeg(e.clientX, e.clientY));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!draggingItem || !isDragging) {
        // Просто клик — не привязываем к стене
        draggingItem = null; isDragging = false; mouseDragging = false;
        return;
      }
      if (isInsidePolygon(e.clientX, e.clientY)) {
        const closestId = findClosestSeg(e.clientX, e.clientY, false);
        if (closestId) assignItemToSeg(draggingItem, closestId);
        else setPendingFloorItem(draggingItem);
      } else {
        const closestId = findClosestSeg(e.clientX, e.clientY, true);
        if (closestId) assignItemToSeg(draggingItem, closestId);
      }
      draggingItem = null; isDragging = false; mouseDragging = false;
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
  }, [activeItems, findClosestSeg, assignItemToSeg, isInsidePolygon]);

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
    findClosestSeg, assignItemToSeg, assignItemToSegs, assignItemToAllSegs, assignManyItems, removeItemFromAllSegs, removeActiveItem, isItemOnAllSegs, adjustItemQuantity, setItemQuantity,
    pendingFloorItem, setPendingFloorItem, confirmFloorItem,
    editingFloorId, setEditingFloorId, editingFloorItem, confirmEditFloorItem, replaceFloorItem,
    replaceCatalogCategory, setReplaceCatalogCategory,
  };
}
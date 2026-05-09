import React, { useCallback, useEffect, useRef, useState } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanRightInputPanel from "./PlanRightInputPanel";
import PlanModals from "./PlanModals";
import MobileBottomBar from "./MobileBottomBar";
import useVoiceDraw from "./useVoiceDraw";
import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";
import { PANEL_WIDTH } from "./PlanRightInputPanel";
import { useHistory, useIsMobile } from "./usePlanHistory";
import { usePlanHandlers } from "./usePlanHandlers";
import { useAuth } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const PRICES_URL = (func2url as Record<string, string>)["get-prices"];

export default function PlanPage() {
  const { state, push, replace, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);
  const { user, token } = useAuth();
  const isMobile = useIsMobile();

  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [sheetSnap,      setSheetSnap]      = useState<"half" | "full">("full");
  const [sheetHeight,    setSheetHeight]    = useState(0);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [libraryOpen,    setLibraryOpen]    = useState(false);
  const [authOpen,       setAuthOpen]       = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);

  // ── Каталог ──────────────────────────────────────────────────────────────
  const [catalogOpen,     setCatalogOpen]     = useState(false);
  const [prices,          setPrices]          = useState<PriceEntry[]>([]);
  // Активные товары внизу экрана — массив (можно несколько сразу)
  const [activeItems,     setActiveItems]     = useState<SegmentPriceItem[]>([]);
  // Какой товар сейчас тащится пальцем (для drag-ghost на десктопе)
  const [dragItem,        setDragItem]        = useState<SegmentPriceItem | null>(null);
  const [dragPos,         setDragPos]         = useState<{ x: number; y: number } | null>(null);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverSegId,      setHoverSegId]      = useState<string | null>(null);
  // Какой активный товар сейчас в режиме "тап на стену"
  const [tapActiveId,     setTapActiveId]     = useState<number | null>(null);
  const [filterAttached,  setFilterAttached]  = useState(false);
  const stateRef = useRef(state);
  // Флаг: план загружается из библиотеки — не открывать панели автоматически
  const loadingFromLibraryRef = useRef(false);
  stateRef.current = state;

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
  }, []);

  // Привязать товар к стене (не убирает карточку)
  const assignItemToSeg = useCallback((item: SegmentPriceItem, segId: string) => {
    const s = stateRef.current;
    const newSegments = s.segments.map(seg => {
      if (seg.id !== segId) return seg;
      const existing = seg.items ?? [];
      if (existing.some(it => it.priceId === item.priceId)) return seg;
      return { ...seg, items: [...existing, item] };
    });
    push({ ...s, segments: newSegments });
  }, [push]);

  // Удалить товар со всех стен и убрать карточку
  const removeActiveItem = useCallback((priceId: number) => {
    const s = stateRef.current;
    const newSegments = s.segments.map(seg => ({
      ...seg,
      items: (seg.items ?? []).filter(it => it.priceId !== priceId),
    }));
    push({ ...s, segments: newSegments });
    setActiveItems(prev => prev.filter(it => it.priceId !== priceId));
    if (tapActiveId === priceId) setTapActiveId(null);
  }, [push, tapActiveId]);

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

  // Drag карточки активного товара на стену (мобиле)
  // Пользователь должен ФИЗИЧЕСКИ потянуть карточку на стену
  useEffect(() => {
    if (activeItems.length === 0) return;

    let draggingItem: SegmentPriceItem | null = null;
    let isDragging = false;
    let startX = 0, startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      // Проверяем что касание началось на карточке активного товара
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

      // Определяем направление при первом значимом движении
      if (!directionDecided && (adx > 5 || ady > 5)) {
        directionDecided = true;
        isHorizontal = adx > ady;
      }

      // Горизонталь — это скролл слайдера, не drag
      if (isHorizontal) {
        draggingItem = null;
        return;
      }

      // Вертикаль вверх — drag товара на стену
      if (directionDecided && !isHorizontal && ady > 10) {
        isDragging = true;
        e.preventDefault(); // блокируем скролл при вертикальном drag
      }

      if (isDragging) {
        setHoverSegId(findClosestSeg(e.touches[0].clientX, e.touches[0].clientY));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!draggingItem || !isDragging) {
        draggingItem = null;
        isDragging = false;
        directionDecided = false;
        isHorizontal = false;
        setHoverSegId(null);
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
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeItems, findClosestSeg, assignItemToSeg]);

  // Онбординг для незарегистрированных — через 3 сек
  useEffect(() => {
    if (!user) {
      const id = setTimeout(() => setShowOnboarding(true), 3000);
      return () => clearTimeout(id);
    }
  }, [user]);

  const {
    storage,
    handleChange,
    handleReplace,
    handleSettingChange,
    handleUpdateSegment,
    handleUpdateDiagonal,
    handleToolChange,
    zoomIn,
    zoomOut,
    zoomFit,
    handleSave,
    handleSaveAs,
    handleLoad,
    handleDelete,
    handleRename,
    handleNew,
    sidebarW,
    onSidebarDragStart,
  } = usePlanHandlers({
    state, push, replace, undo, redo, reset,
    isMobile,
    token: token ?? null,
    setSheetOpen,
    setExportOpen,
    setLibraryOpen,
    setAuthOpen,
    setRightPanelOpen,
    setFocusSegmentId,
    sheetHeight,
    onBeforeLoad: () => { loadingFromLibraryRef.current = true; },
    onAfterLoad:  () => { loadingFromLibraryRef.current = false; },
  });

  // При замыкании фигуры
  const prevIsClosed = useRef(state.isClosed);
  useEffect(() => {
    if (state.isClosed && !prevIsClosed.current && !loadingFromLibraryRef.current) {
      if (!isMobile) {
        // ПК: открываем сайдбар + zoomFit
        setSidebarOpen(true);
        setTimeout(() => zoomFit(), 100);
      } else {
        // Мобиле: открываем правую панель ввода сторон
        setFocusSegmentId(state.segments[0]?.id ?? null);
        setRightPanelOpen(true);
        setTimeout(() => zoomFit(), 100);
      }
    }
    prevIsClosed.current = state.isClosed;
  }, [state.isClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Мобиле: нажатие на сторону → каталог только если все размеры заполнены
  const prevSelectedSegId = useRef(state.selectedSegmentId);
  useEffect(() => {
    if (!isMobile) return;
    if (state.selectedSegmentId && state.selectedSegmentId !== prevSelectedSegId.current && state.isClosed) {
      const allFilled = state.segments.every(s => s.lengthCm && s.lengthCm > 0);
      if (allFilled) {
        setCatalogOpen(true);
      }
    }
    prevSelectedSegId.current = state.selectedSegmentId;
  }, [state.selectedSegmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Голосовое рисование ───────────────────────────────────────────────────
  const voiceDraw = useVoiceDraw({ state, onChange: handleChange });

  const isLoggedIn = !!user && !!token;
  const currentPlanName = storage.plans.find(p => p.id === storage.currentPlanId)?.name
    ?? (state as PlanState).room.name ?? "Без названия";

  // Кол-во уникальных товаров на холсте
  const attachedPriceIds = new Set<number>();
  state.segments.forEach(seg => seg.items?.forEach(it => attachedPriceIds.add(it.priceId)));
  const attachedCount = attachedPriceIds.size;

  // При hover подсвечиваем стену через selectedSegmentId
  const displayState = hoverSegId
    ? { ...state, selectedSegmentId: hoverSegId }
    : state;

  // Фильтруем прайс если активен фильтр «На холсте»
  const filteredPrices = filterAttached && attachedPriceIds.size > 0
    ? prices.filter(p => attachedPriceIds.has(p.id))
    : prices;

  return (
    <div className="flex flex-col bg-[#111] overflow-hidden" style={{ height: "100dvh" }}>

      {/* Toolbar */}
      <PlanToolbar
        tool={state.tool}
        phase={state.phase}
        isClosed={state.isClosed}
        settings={state.settings}
        canUndo={canUndo}
        canRedo={canRedo}
        isMobile={isMobile}
        saveStatus={storage.saveStatus}
        isDirty={storage.isDirty}
        isLoggedIn={isLoggedIn}
        currentPlanId={storage.currentPlanId}
        onToolChange={handleToolChange}
        onSettingChange={handleSettingChange}
        onUndo={undo}
        onRedo={redo}
        onReset={() => reset()}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        onOpenPanel={() => setSheetOpen(true)}
        onExport={() => setExportOpen(true)}
        onSave={handleSave}
        onOpenLibrary={() => setLibraryOpen(true)}
      />

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden relative">

        <div id="plan-canvas-wrap" className="flex-1 overflow-hidden">
          <PlanCanvas
            state={displayState}
            onChange={handleChange}
            onReplace={handleReplace}
            onOpenCatalog={() => setCatalogOpen(true)}
          />
        </div>

        {!isMobile && sidebarOpen && (<>
          <div
            className="w-1 bg-white/[0.04] hover:bg-violet-500/30 cursor-col-resize transition-colors shrink-0"
            onMouseDown={onSidebarDragStart}
          />
          <div className="shrink-0 overflow-hidden border-l border-white/[0.06]" style={{ width: sidebarW }}>
            <PlanSidebar state={state} onChange={handleChange} onOpenCatalog={() => setCatalogOpen(true)} />
          </div>
        </>)}

        {/* Нижняя панель кнопок */}
        {(
          <MobileBottomBar
            zoom={state.settings.zoom}
            settings={state.settings}
            onSettingChange={handleSettingChange}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomFit={zoomFit}
            onOpenPanel={isMobile
              ? () => { if (sheetOpen) { setSheetOpen(false); } else { setSheetSnap("half"); setSheetOpen(true); } }
              : () => setSidebarOpen(v => !v)
            }
            onOpenCatalog={() => setCatalogOpen(v => !v)}
            onOpenSides={() => {
              if (rightPanelOpen) { setRightPanelOpen(false); } else {
                setFocusSegmentId(state.selectedSegmentId);
                setRightPanelOpen(true);
              }
            }}
            selectedSegmentId={state.selectedSegmentId}
            sheetOpen={isMobile ? sheetOpen : sidebarOpen}
            catalogOpen={catalogOpen}
            rightPanelOpen={rightPanelOpen}
            isMobile={isMobile}
            onToggleVoiceDraw={voiceDraw.hasSpeech ? voiceDraw.toggle : undefined}
            isVoiceDrawing={voiceDraw.isListening}
            isVoiceProcessing={voiceDraw.isProcessing}
            voiceStatus={voiceDraw.status}
            voiceInterim={voiceDraw.interimText}
            attachedCount={attachedCount}
            filterAttached={filterAttached}
            onToggleFilterAttached={() => setFilterAttached(v => !v)}
          />
        )}
      </div>

      {/* Мобиле: правая панель быстрого ввода сторон */}
      {isMobile && rightPanelOpen && (
        <PlanRightInputPanel
          state={state}
          onUpdateSegment={handleUpdateSegment}
          onUpdateDiagonal={handleUpdateDiagonal}
          focusSegmentId={focusSegmentId}
          onClose={() => { setRightPanelOpen(false); setFocusSegmentId(null); }}
        />
      )}

      {/* Мобиле: bottom sheet */}
      {isMobile && (
        <PlanBottomSheet
          state={state}
          onChange={handleChange}
          open={sheetOpen}
          initialSnap={sheetSnap}
          onClose={() => { setSheetOpen(false); setSheetHeight(0); }}
          onSheetHeightChange={setSheetHeight}
        />
      )}

      {/* Модалки, онбординг, статус-бар */}
      <PlanModals
        state={state}
        isMobile={isMobile}
        isLoggedIn={isLoggedIn}
        currentPlanName={currentPlanName}
        exportOpen={exportOpen}
        libraryOpen={libraryOpen}
        authOpen={authOpen}
        showOnboarding={showOnboarding}
        storage={storage}
        onCloseExport={() => setExportOpen(false)}
        onCloseLibrary={() => setLibraryOpen(false)}
        onCloseAuth={() => setAuthOpen(false)}
        onCloseOnboarding={() => setShowOnboarding(false)}
        onLoginRequest={() => { setLibraryOpen(false); setAuthOpen(true); }}
        onLoad={handleLoad}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onDelete={handleDelete}
        onRename={handleRename}
        onNew={handleNew}
      />

      {/* ── Каталог материалов ── */}
      <CategoryDrumPanel
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        prices={filteredPrices}
        onDragItem={item => {
          setCatalogOpen(false);
          const selectedSeg = stateRef.current.selectedSegmentId;
          if (selectedSeg) {
            // Есть выбранная сторона — привязываем сразу
            assignItemToSeg(item, selectedSeg);
          } else {
            // Добавляем в активные карточки внизу (если ещё нет)
            setActiveItems(prev =>
              prev.some(it => it.priceId === item.priceId)
                ? prev
                : [...prev, item]
            );
            setTapActiveId(item.priceId);
          }
        }}
      />

      {/* ── Drag ghost — летит за курсором на десктопе ── */}
      {dragItem && dragPos && (
        <div style={{
          position: "fixed",
          left: dragPos.x - 22, top: dragPos.y - 22,
          zIndex: 9999, pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(15,16,23,0.92)",
          border: `1px solid ${hoverSegId ? "rgba(124,58,237,0.7)" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 12, padding: "6px 10px 6px 6px",
          boxShadow: hoverSegId ? "0 0 20px rgba(124,58,237,0.4)" : "0 4px 20px rgba(0,0,0,0.5)",
          transition: "border-color 0.15s, box-shadow 0.15s", maxWidth: 180,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dragItem.imageUrl
              ? <img src={dragItem.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 16 }}>📦</span>}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: hoverSegId ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.8)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{dragItem.name}</span>
        </div>
      )}

      {/* ── Активные карточки внизу (мобиле) — горизонтальный слайдер ── */}
      {activeItems.length > 0 && (
        <div style={{
          position: "fixed", bottom: 90, left: 0, right: 0,
          zIndex: 9999,
          display: "flex", gap: 8, alignItems: "flex-end",
          overflowX: "auto", overflowY: "visible",
          padding: "4px 16px 4px 16px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          pointerEvents: "all",
        }}>
          {activeItems.map(item => {
            const isActive = tapActiveId === item.priceId;
            return (
              <div
                key={item.priceId}
                data-active-item={String(item.priceId)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(12,10,28,0.96)",
                  border: `1px solid ${hoverSegId && isActive ? "rgba(124,58,237,1)" : isActive ? "rgba(124,58,237,0.8)" : "rgba(124,58,237,0.25)"}`,
                  borderRadius: 16, padding: "10px 10px 10px 10px",
                  boxShadow: hoverSegId && isActive
                    ? "0 0 32px rgba(124,58,237,0.7), 0 8px 24px rgba(0,0,0,0.6)"
                    : isActive
                      ? "0 0 24px rgba(124,58,237,0.45), 0 8px 24px rgba(0,0,0,0.6)"
                      : "0 4px 16px rgba(0,0,0,0.5)",
                  backdropFilter: "blur(14px)",
                  cursor: "grab",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  opacity: isActive ? 1 : 0.7,
                  userSelect: "none",
                  touchAction: "pan-x",
                  flexShrink: 0,
                  scrollSnapAlign: "start",
                  maxWidth: 220,
                }}
                onClick={() => setTapActiveId(item.priceId)}
              >
                {/* Иконка */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                  background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 20 }}>📦</span>}
                </div>
                {/* Название + подсказка */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: isActive ? "rgba(196,181,253,1)" : "rgba(255,255,255,0.75)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 120,
                  }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: hoverSegId && isActive ? "rgba(167,139,250,0.9)" : "rgba(167,139,250,0.55)", marginTop: 1 }}>
                    {hoverSegId && isActive ? "Отпусти на стену" : "Потяни на стену"}
                  </div>
                </div>
                {/* Крестик — удалить везде */}
                <button
                  onClick={e => { e.stopPropagation(); removeActiveItem(item.priceId); }}
                  style={{
                    width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.35)", fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
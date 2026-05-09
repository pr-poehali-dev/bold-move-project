import React, { useEffect, useRef, useState } from "react";
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
  const [exportOpen,     setExportOpen]     = useState(false);
  const [libraryOpen,    setLibraryOpen]    = useState(false);
  const [authOpen,       setAuthOpen]       = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);

  // ── Каталог ──────────────────────────────────────────────────────────────
  const [catalogOpen,     setCatalogOpen]     = useState(false);
  const [prices,          setPrices]          = useState<PriceEntry[]>([]);
  const [dragItem,        setDragItem]        = useState<SegmentPriceItem | null>(null);
  const [dragPos,         setDragPos]         = useState<{ x: number; y: number } | null>(null);
  const [hoverSegId,      setHoverSegId]      = useState<string | null>(null);
  const [filterAttached,  setFilterAttached]  = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Загружаем прайс один раз
  useEffect(() => {
    if (!PRICES_URL) return;
    fetch(PRICES_URL)
      .then(r => r.json())
      .then((data: { prices: PriceEntry[] }) => { if (data?.prices) setPrices(data.prices); })
      .catch(() => {});
  }, []);

  // Drag: товар летит за курсором/пальцем и ищет ближайшую стену
  useEffect(() => {
    if (!dragItem) return;

    const findClosestSeg = (clientX: number, clientY: number) => {
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
      return bestDist < 80 / zoom ? bestId : null;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const { clientX, clientY } = "touches" in e ? e.touches[0] : e;
      setDragPos({ x: clientX, y: clientY });
      setHoverSegId(findClosestSeg(clientX, clientY));
    };

    const onEnd = (e: MouseEvent | TouchEvent) => {
      const pt = "changedTouches" in e ? e.changedTouches[0] : e;
      const closestId = findClosestSeg(pt.clientX, pt.clientY);
      if (closestId && dragItem) {
        const s = stateRef.current;
        const newSegments = s.segments.map(seg => {
          if (seg.id !== closestId) return seg;
          const existing = seg.items ?? [];
          if (existing.some(it => it.priceId === dragItem.priceId)) return seg;
          return { ...seg, items: [...existing, dragItem] };
        });
        push({ ...s, segments: newSegments });
      }
      setDragItem(null);
      setDragPos(null);
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
  }, [dragItem, push]);

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
  });

  // Мобиле: нажатие на сторону → открываем каталог (сторона уже подсвечена через selectedSegmentId)
  const prevSelectedSegId = useRef(state.selectedSegmentId);
  useEffect(() => {
    if (!isMobile) return;
    if (state.selectedSegmentId && state.selectedSegmentId !== prevSelectedSegId.current && state.isClosed) {
      // Открываем каталог — товар прикрепится к выбранной стороне
      setCatalogOpen(true);
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
            onOpenCatalog={() => setCatalogOpen(true)}
          />
        </div>

        {!isMobile && (<>
          <div
            className="w-1 bg-white/[0.04] hover:bg-violet-500/30 cursor-col-resize transition-colors shrink-0"
            onMouseDown={onSidebarDragStart}
          />
          <div className="shrink-0 overflow-hidden border-l border-white/[0.06]" style={{ width: sidebarW }}>
            <PlanSidebar state={state} onChange={handleChange} />
          </div>
        </>)}

        {/* Мобиле: нижняя панель кнопок */}
        {isMobile && (
          <MobileBottomBar
            zoom={state.settings.zoom}
            settings={state.settings}
            onSettingChange={handleSettingChange}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomFit={zoomFit}
            onOpenPanel={() => { setSheetSnap("half"); setSheetOpen(true); }}
            onOpenCatalog={() => setCatalogOpen(true)}
            onOpenSides={() => {
              setFocusSegmentId(state.selectedSegmentId);
              setRightPanelOpen(true);
            }}
            selectedSegmentId={state.selectedSegmentId}
            onToggleVoiceDraw={voiceDraw.hasSpeech ? voiceDraw.toggle : undefined}
            isVoiceDrawing={voiceDraw.isListening}
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
            // Есть выбранная сторона — привязываем сразу без drag
            const s = stateRef.current;
            const newSegments = s.segments.map(seg => {
              if (seg.id !== selectedSeg) return seg;
              const existing = seg.items ?? [];
              if (existing.some(it => it.priceId === item.priceId)) return seg;
              return { ...seg, items: [...existing, item] };
            });
            push({ ...s, segments: newSegments });
          } else {
            // Нет выбранной стороны — стандартный drag
            setDragItem(item);
          }
        }}
      />

      {/* ── Drag ghost — товар летит за курсором ── */}
      {dragItem && dragPos && (
        <div
          style={{
            position: "fixed",
            left: dragPos.x - 22,
            top:  dragPos.y - 22,
            zIndex: 9999,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(15,16,23,0.92)",
            border: `1px solid ${hoverSegId ? "rgba(124,58,237,0.7)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 12,
            padding: "6px 10px 6px 6px",
            boxShadow: hoverSegId ? "0 0 20px rgba(124,58,237,0.4)" : "0 4px 20px rgba(0,0,0,0.5)",
            transition: "border-color 0.15s, box-shadow 0.15s",
            maxWidth: 180,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dragItem.imageUrl
              ? <img src={dragItem.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 16 }}>📦</span>
            }
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: hoverSegId ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.8)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            transition: "color 0.15s",
          }}>
            {dragItem.name}
          </span>
        </div>
      )}
    </div>
  );
}
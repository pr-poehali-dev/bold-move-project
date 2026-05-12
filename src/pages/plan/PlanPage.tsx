import { useEffect, useRef, useState } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanRightInputPanel from "./PlanRightInputPanel";
import PlanModals from "./PlanModals";
import MobileBottomBar from "./MobileBottomBar";
import useVoiceDraw from "./useVoiceDraw";
import PlanCatalogPanel from "./PlanCatalogPanel";
import PlanDragGhosts from "./PlanDragGhosts";
import PlanQuantityModal from "./PlanQuantityModal";
import { usePlanCatalog } from "./usePlanCatalog";
import type { PlanState } from "./planTypes";
import { INITIAL_STATE, polygonArea, polygonPerimeter } from "./planTypes";
import { useHistory, useIsMobile } from "./usePlanHistory";
import { usePlanHandlers } from "./usePlanHandlers";
import { useAuth } from "@/context/AuthContext";
import PlanProjectsScreen from "./PlanProjectsScreen";
import PlanRoomsScreen from "./PlanRoomsScreen";
import type { PlanProject, PlanRoom } from "./usePlanProjects";
import { usePlanProjects } from "./usePlanProjects";
import { useRoomAutoSave } from "./useRoomAutoSave";
import { usePlanVariants } from "./usePlanVariants";
import PlanVariantSaveModal from "./PlanVariantSaveModal";

type PlanScreen = "projects" | "rooms" | "canvas";

export default function PlanPage() {
  const { state, push, replace, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);
  const { user, token } = useAuth();
  const isMobile = useIsMobile();

  // ── Флоу проектов ────────────────────────────────────────────────────────────
  const [screen,         setScreen]         = useState<PlanScreen>("projects");
  const [activeProject,  setActiveProject]  = useState<PlanProject | null>(null);
  const [activeRoom,     setActiveRoom]     = useState<PlanRoom | null>(null);

  // ── Загрузка комнаты ──────────────────────────────────────────────────────
  const { loadRoom } = usePlanProjects(token);
  const [roomLoading, setRoomLoading] = useState(false);

  // ── Автосохранение в комнату ──────────────────────────────────────────────
  const { saveStatus: roomSaveStatus } = useRoomAutoSave(
    activeRoom?.id ?? null,
    state,
    token
  );

  // ── Варианты ─────────────────────────────────────────────────────────────
  const { variants, loading: variantsLoading, saving: variantSaving, loadVariants, saveVariant, deleteVariant, updateVariant } = usePlanVariants(token);
  const [variantModalOpen, setVariantModalOpen] = useState(false);

  const handleSaveVariant = async (name: string) => {
    if (!activeRoom) return;
    await saveVariant(activeRoom.id, name, state);
    setVariantModalOpen(false);
  };

  const handleLoadVariant = (variantData: object) => {
    reset({ ...INITIAL_STATE, ...(variantData as Partial<typeof INITIAL_STATE>) });
  };

  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [sheetSnap,      setSheetSnap]      = useState<"half" | "full">("full");
  const [sheetHeight,    setSheetHeight]    = useState(0);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [libraryOpen,    setLibraryOpen]    = useState(false);
  const [authOpen,       setAuthOpen]       = useState(false);
  const [bottomSettingsOpen, setBottomSettingsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);

  const stateRef = useRef(state);
  const loadingFromLibraryRef = useRef(false);
  stateRef.current = state;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = "";
    };
  }, []);

  const catalog = usePlanCatalog(stateRef, push);

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

  // При замыкании фигуры — отслеживаем по ID последнего сегмента
  // чтобы не пропустить голосовой ввод (там onChange вызывается через ref)
  const lastClosedSegId = useRef<string | null>(null);
  useEffect(() => {
    if (!state.isClosed || loadingFromLibraryRef.current) return;
    const lastSeg = state.segments[state.segments.length - 1];
    if (!lastSeg || lastSeg.id === lastClosedSegId.current) return;
    lastClosedSegId.current = lastSeg.id;
    if (!isMobile) {
      setSidebarOpen(true);
      setTimeout(() => zoomFit(), 100);
    } else {
      setFocusSegmentId(state.segments[0]?.id ?? null);
      setRightPanelOpen(true);
      setTimeout(() => zoomFit(), 100);
    }
  }, [state.isClosed, state.segments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Мобиле: нажатие на сторону → каталог только если все размеры заполнены
  const prevSelectedSegId = useRef(state.selectedSegmentId);
  useEffect(() => {
    if (!isMobile) return;
    if (state.selectedSegmentId && state.selectedSegmentId !== prevSelectedSegId.current && state.isClosed) {
      const allFilled = state.segments.every(s => s.lengthCm && s.lengthCm > 0);
      if (allFilled) {
        catalog.setCatalogOpen(true);
      }
    }
    prevSelectedSegId.current = state.selectedSegmentId;
  }, [state.selectedSegmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Голосовое рисование ───────────────────────────────────────────────────
  const voiceDraw = useVoiceDraw({ state, onChange: handleChange });

  const isLoggedIn = !!user && !!token;
  const currentPlanName = storage.plans.find(p => p.id === storage.currentPlanId)?.name
    ?? (state as PlanState).room.name ?? "Без названия";

  // При hover подсвечиваем стену через selectedSegmentId
  const displayState = catalog.hoverSegId
    ? { ...state, selectedSegmentId: catalog.hoverSegId }
    : state;

  // Дефолтное количество для модалки "добавить на полотно" в зависимости от категории:
  // - Полотна → площадь в м²
  // - Профили (стандартный, теневой, парящий, ниши) → периметр в пог.м
  // - Остальные → 1
  const getFloorDefault = (category?: string): number | undefined => {
    if (!state.isClosed || !state.baseScale || state.points.length < 3) return undefined;
    const cat = (category || "").toLowerCase();
    const isCanvas = cat.includes("полотн");
    const isProfile = cat.includes("профил") || cat.includes("нишa") || cat.includes("ниш") || cat.includes("двухур");
    if (isCanvas) {
      const areaPx2 = polygonArea(state.points);
      const areaCm2 = areaPx2 / (state.baseScale * state.baseScale);
      return Math.round(areaCm2 / 100) / 100; // м²
    }
    if (isProfile) {
      const perimPx = polygonPerimeter(state.points);
      const perimM = perimPx / (state.baseScale * 100);
      return Math.round(perimM * 100) / 100; // пог.м
    }
    return undefined; // остальные → дефолт 1 в модалке
  };

  // ── Экраны проектов и комнат ─────────────────────────────────────────────────
  if (screen === "projects") {
    return (
      <PlanProjectsScreen
        token={token}
        onSelectProject={project => {
          setActiveProject(project);
          setScreen("rooms");
        }}
      />
    );
  }

  if (screen === "rooms" && activeProject) {
    return (
      <PlanRoomsScreen
        token={token}
        project={activeProject}
        onBack={() => setScreen("projects")}
        onOpenRoom={async room => {
          setActiveRoom(room);
          setRoomLoading(true);
          setScreen("canvas");
          // Загружаем данные комнаты и варианты параллельно
          const [loaded] = await Promise.all([
            loadRoom(room.id),
            loadVariants(room.id),
          ]);
          const savedData = loaded?.data as PlanState | undefined;
          const hasData = savedData && Object.keys(savedData).length > 0 && savedData.points;
          reset(hasData ? { ...INITIAL_STATE, ...savedData } : INITIAL_STATE);
          setRoomLoading(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col bg-[#111] overflow-hidden relative" style={{ height: "100dvh" }}>

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
        onBack={activeRoom ? () => setScreen("rooms") : undefined}
        backLabel={activeRoom?.name}
        roomSaveStatus={roomSaveStatus}
        onSaveVariant={activeRoom ? () => setVariantModalOpen(true) : undefined}
        variants={variants}
        variantsLoading={variantsLoading}
        onLoadVariant={handleLoadVariant}
        onDeleteVariant={(id) => activeRoom && deleteVariant(id, activeRoom.id)}
        onRenameVariant={(id, name) => updateVariant(id, { name })}
      />

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">

        <div id="plan-canvas-wrap" className="flex-1 overflow-hidden relative">
          <PlanCanvas
            state={displayState}
            onChange={handleChange}
            onReplace={handleReplace}
            onOpenCatalog={() => catalog.setCatalogOpen(true)}
            onEditFloorItem={catalog.setEditingFloorId}
          />
          {roomLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
              style={{ background: "rgba(7,7,15,0.75)", backdropFilter: "blur(4px)" }}>
              <div className="w-10 h-10 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mb-3" />
              <span className="text-white/50 text-[13px] font-medium">
                Загружаем {activeRoom?.name}…
              </span>
            </div>
          )}
        </div>

        {!isMobile && sidebarOpen && (<>
          <div
            className="w-1 bg-white/[0.04] hover:bg-violet-500/30 cursor-col-resize transition-colors shrink-0"
            onMouseDown={onSidebarDragStart}
          />
          <div className="shrink-0 overflow-hidden border-l border-white/[0.06]" style={{ width: sidebarW }}>
            <PlanSidebar
              state={state}
              onChange={handleChange}
              onOpenCatalog={() => catalog.setCatalogOpen(true)}
              onRemoveItem={(segId, priceId) => {
                const newSegs = state.segments.map(s => {
                  if (s.id !== segId) return s;
                  return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
                });
                handleChange({ segments: newSegs });
              }}
              onUpdateQuantity={(segId, priceId, quantity) => {
                const newSegs = state.segments.map(s => {
                  if (s.id !== segId) return s;
                  return { ...s, items: (s.items ?? []).map(it => it.priceId === priceId ? { ...it, quantity } : it) };
                });
                handleChange({ segments: newSegs });
              }}
              onRemoveFloorItem={(id) => {
                handleChange({ floorItems: (state.floorItems ?? []).filter(fi => fi.id !== id) });
              }}
              onUpdateFloorQuantity={(id, quantity) => {
                handleChange({ floorItems: (state.floorItems ?? []).map(fi => fi.id === id ? { ...fi, quantity } : fi) });
              }}
            />
          </div>
        </>)}

      </div>

      {/* Нижняя панель кнопок — вынесена из overflow-hidden, позиционируется абсолютно в корневом relative div */}
      <MobileBottomBar
        zoom={state.settings.zoom}
        settings={state.settings}
        onSettingChange={handleSettingChange}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        onOpenPanel={isMobile
          ? () => {
              if (sheetOpen) { setSheetOpen(false); } else {
                catalog.setCatalogOpen(false);
                setRightPanelOpen(false);
                setSheetSnap("half"); setSheetOpen(true);
              }
            }
          : () => {
              if (sidebarOpen) { setSidebarOpen(false); } else {
                catalog.setCatalogOpen(false);
                setSidebarOpen(true);
              }
            }
        }
        onOpenCatalog={() => {
          const next = !catalog.catalogOpen;
          catalog.setCatalogOpen(next);
          if (next) {
            setSheetOpen(false);
            setSidebarOpen(false);
            setRightPanelOpen(false);
          }
        }}
        onOpenSides={() => {
          if (rightPanelOpen) { setRightPanelOpen(false); } else {
            catalog.setCatalogOpen(false);
            setSheetOpen(false);
            setFocusSegmentId(state.selectedSegmentId);
            setRightPanelOpen(true);
          }
        }}
        selectedSegmentId={state.selectedSegmentId}
        sheetOpen={isMobile ? sheetOpen : sidebarOpen}
        catalogOpen={catalog.catalogOpen}
        rightPanelOpen={rightPanelOpen}
        isMobile={isMobile}
        onToggleVoiceDraw={voiceDraw.hasSpeech ? voiceDraw.toggle : undefined}
        isVoiceDrawing={voiceDraw.isListening}
        isVoiceProcessing={voiceDraw.isProcessing}
        voiceStatus={voiceDraw.status}
        voiceInterim={voiceDraw.interimText}
        voiceVolume={voiceDraw.volume}
        isClosed={state.isClosed}
        attachedCount={catalog.attachedCount}
        filterAttached={catalog.filterAttached}
        onToggleFilterAttached={() => catalog.setFilterAttached(v => !v)}
        onSettingsOpenChange={setBottomSettingsOpen}
      />

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
      <PlanCatalogPanel
        open={catalog.catalogOpen}
        filteredPrices={catalog.filteredPrices}
        selectedSegmentId={null}
        onClose={() => catalog.setCatalogOpen(false)}
        onAssignToSeg={catalog.assignItemToSeg}
        onAddToActive={item => {
          catalog.setActiveItems(prev =>
            prev.some(it => it.priceId === item.priceId) ? prev : [...prev, item]
          );
          catalog.setTapActiveId(item.priceId);
        }}
      />

      {/* ── Модалка добавления на полотно ── */}
      <PlanQuantityModal
        item={catalog.pendingFloorItem}
        onConfirm={catalog.confirmFloorItem}
        onCancel={() => catalog.setPendingFloorItem(null)}
        defaultQuantity={getFloorDefault(catalog.pendingFloorItem?.category)}
      />
      {/* ── Модалка редактирования quantity floorItem ── */}
      <PlanQuantityModal
        item={catalog.editingFloorItem}
        onConfirm={catalog.confirmEditFloorItem}
        onCancel={() => catalog.setEditingFloorId(null)}
      />

      {/* ── Ghost-оверлеи и слайдер активных карточек ── */}
      <PlanDragGhosts
        dragItem={catalog.dragItem}
        dragPos={catalog.dragPos}
        dragCardItem={catalog.dragCardItem}
        dragCardPos={catalog.dragCardPos}
        activeItems={catalog.activeItems}
        tapActiveId={catalog.tapActiveId}
        hoverSegId={catalog.hoverSegId}
        isMobile={isMobile}
        segments={state.segments}
        floorItems={state.floorItems ?? []}
        anyPanelOpen={sheetOpen || sidebarOpen || rightPanelOpen || catalog.catalogOpen || exportOpen || libraryOpen || authOpen || bottomSettingsOpen}
        onTapActiveId={catalog.setTapActiveId}
        onRemoveActiveItem={catalog.removeActiveItem}
        onAssignToAllSegs={catalog.assignItemToAllSegs}
        onRemoveFromAllSegs={catalog.removeItemFromAllSegs}
        isItemOnAllSegs={catalog.isItemOnAllSegs}
        onAdjustQuantity={catalog.adjustItemQuantity}
        onSetQuantity={catalog.setItemQuantity}
        onAddToFloor={catalog.setPendingFloorItem}
        hasSegments={state.isClosed && state.segments.length > 0}
      />

      {/* Модалка сохранения варианта */}
      <PlanVariantSaveModal
        open={variantModalOpen}
        saving={variantSaving}
        onSave={handleSaveVariant}
        onClose={() => setVariantModalOpen(false)}
      />
    </div>
  );
}
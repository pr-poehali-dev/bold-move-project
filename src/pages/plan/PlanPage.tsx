import { useEffect, useRef, useState } from "react";
import QuickAccessBar from "@/components/QuickAccessBar";
import QuickNavDesktop from "@/components/QuickNavDesktop";
import PlanToolbar from "./PlanToolbar";
import useVoiceDraw from "./useVoiceDraw";
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
import { usePlanVariants, type PlanVariant } from "./usePlanVariants";
import { usePlanVariantHandlers } from "./usePlanVariantHandlers";
import PlanCanvasArea from "./PlanCanvasArea";
import PlanPagePanels from "./PlanPagePanels";
import { PlanExportModal as PdfExportModal } from "./PlanExportMenu";
import { generateExportPdf } from "./PlanExportGenerator";

type PlanScreen = "projects" | "rooms" | "canvas";

export default function PlanPage() {
  const { state, push, replace, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);
  const { user, token } = useAuth();
  const isMobile = useIsMobile();

  // ── Флоу проектов ────────────────────────────────────────────────────────────
  const [screen,        setScreen]        = useState<PlanScreen>("projects");
  const [activeProject, setActiveProject] = useState<PlanProject | null>(null);
  const [activeRoom,    setActiveRoom]    = useState<PlanRoom | null>(null);

  // ── Загрузка комнаты ──────────────────────────────────────────────────────
  const { loadRoom } = usePlanProjects(token);
  const [roomLoading, setRoomLoading] = useState(false);

  // ── Варианты ─────────────────────────────────────────────────────────────
  const variantsHook = usePlanVariants(token);
  const {
    variants, loading: variantsLoading, saving: variantSaving,
    activeVariantId, loadVariants,
  } = variantsHook;

  // ── Автосохранение в комнату ──────────────────────────────────────────────
  const { saveStatus: roomSaveStatus } = useRoomAutoSave(
    activeRoom?.id ?? null,
    state,
    token,
    activeVariantId,
    activeProject?.id ?? null
  );
  const [variantModalOpen,       setVariantModalOpen]       = useState(false);
  const [mobileVariantPickerOpen, setMobileVariantPickerOpen] = useState(false);

  // ── UI-флаги ──────────────────────────────────────────────────────────────
  const [sheetOpen,          setSheetOpen]          = useState(false);
  const [sheetSnap,          setSheetSnap]          = useState<"half" | "full">("full");
  const [sheetHeight,        setSheetHeight]        = useState(0);
  const [rightPanelOpen,     setRightPanelOpen]     = useState(false);
  const [sidebarOpen,        setSidebarOpen]        = useState(false);
  const [exportOpen,         setExportOpen]         = useState(false);
  const [libraryOpen,        setLibraryOpen]        = useState(false);
  const [authOpen,           setAuthOpen]           = useState(false);
  const [bottomSettingsOpen, setBottomSettingsOpen] = useState(false);
  const [showOnboarding,     setShowOnboarding]     = useState(false);
  const [focusSegmentId,     setFocusSegmentId]     = useState<string | null>(null);

  const stateRef = useRef(state);
  const loadingFromLibraryRef = useRef(false);
  const loadingFromRoomRef = useRef(false);
  stateRef.current = state;

  // Блокируем скролл страницы
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = "";
    };
  }, []);

  const catalog = usePlanCatalog(stateRef, push, state);

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

  // При замыкании фигуры открываем боковую/правую панель ТОЛЬКО если размеры не заполнены
  // (т.е. пользователь только что нарисовал руками, а не загрузил готовый план)
  const lastClosedSegId = useRef<string | null>(null);
  useEffect(() => {
    if (!state.isClosed || loadingFromLibraryRef.current || loadingFromRoomRef.current) return;
    const lastSeg = state.segments[state.segments.length - 1];
    if (!lastSeg || lastSeg.id === lastClosedSegId.current) return;
    lastClosedSegId.current = lastSeg.id;
    // Если все размеры уже заполнены — план загружен, не открываем панель
    const allSizesFilled = state.segments.every(s => s.lengthCm && s.lengthCm > 0);
    if (allSizesFilled) return;
    if (!isMobile) {
      setSidebarOpen(true);
      setTimeout(() => zoomFit(), 100);
    } else {
      setFocusSegmentId(state.segments[0]?.id ?? null);
      setRightPanelOpen(true);
      setTimeout(() => zoomFit(), 100);
    }
  }, [state.isClosed, state.segments]); // eslint-disable-line react-hooks/exhaustive-deps



  // На мобиле: при выборе угла закрываем правую панель (она мешает drag)
  const prevSelectedPointId = useRef(state.selectedPointId);
  useEffect(() => {
    if (!isMobile) return;
    if (state.selectedPointId && state.selectedPointId !== prevSelectedPointId.current) {
      setRightPanelOpen(false);
    }
    prevSelectedPointId.current = state.selectedPointId;
  }, [state.selectedPointId, isMobile]);  

  // ── Голосовое рисование ───────────────────────────────────────────────────
  const voiceDraw = useVoiceDraw({ state, onChange: handleChange });

  // ── Обработчики вариантов ────────────────────────────────────────────────
  const variantHandlers = usePlanVariantHandlers({
    activeRoom,
    token,
    reset,
    variants: variantsHook,
    setVariantModalOpen,
  });

  const isLoggedIn = !!user && !!token;
  const currentPlanName = storage.plans.find(p => p.id === storage.currentPlanId)?.name
    ?? (state as PlanState).room.name ?? "Без названия";

  // При hover подсвечиваем стену через selectedSegmentId (только визуально, selectedSegmentIds не меняем)
  const displayState = catalog.hoverSegId
    ? { ...state, selectedSegmentId: catalog.hoverSegId, selectedSegmentIds: state.selectedSegmentIds ?? [] }
    : state;

  // Дефолтное количество для модалки "добавить на полотно"
  const getFloorDefault = (category?: string): number | undefined => {
    if (!state.isClosed || !state.baseScale || state.points.length < 3) return undefined;
    const cat = (category || "").toLowerCase();
    const isCanvas = cat.includes("полотн");
    const isProfile = cat.includes("профил") || cat.includes("нишa") || cat.includes("ниш") || cat.includes("двухур");
    if (isCanvas) {
      const areaPx2 = polygonArea(state.points);
      const areaCm2 = areaPx2 / (state.baseScale * state.baseScale);
      return Math.round(areaCm2 / 100) / 100;
    }
    if (isProfile) {
      const perimPx = polygonPerimeter(state.points);
      const perimM = perimPx / (state.baseScale * 100);
      return Math.round(perimM * 100) / 100;
    }
    return undefined;
  };

  // ── Экраны проектов и комнат ─────────────────────────────────────────────────
  if (screen === "projects") {
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("project_id");
    return (
      <div className="flex flex-col bg-[#111]" style={{ height: "100dvh" }}>
        {/* Быстрая навигация — только десктоп, под шапкой экрана проектов */}
        <div className="hidden sm:flex items-center px-6 py-2 flex-shrink-0 border-b border-white/[0.06]">
          <QuickNavDesktop />
        </div>
        <div className="flex-1 overflow-hidden">
          <PlanProjectsScreen
            token={token}
            initialProjectId={urlProjectId ? Number(urlProjectId) : undefined}
            onSelectProject={project => {
              setActiveProject(project);
              setScreen("rooms");
              // room_id и variant_id оставляем в URL — PlanRoomsScreen их прочитает
              const url = new URL(window.location.href);
              url.searchParams.delete("project_id");
              window.history.replaceState({}, "", url.toString());
            }}
          />
        </div>
        <QuickAccessBar />
      </div>
    );
  }

  if (screen === "rooms" && activeProject) {
    return (
      <div className="flex flex-col bg-[#111]" style={{ height: "100dvh" }}>
        {/* Быстрая навигация — только десктоп, под шапкой экрана комнат */}
        <div className="hidden sm:flex items-center px-6 py-2 flex-shrink-0 border-b border-white/[0.06]">
          <QuickNavDesktop />
        </div>
        <div className="flex-1 overflow-hidden">
          <PlanRoomsScreen
            token={token}
            project={activeProject}
            onBack={() => setScreen("projects")}
            onOpenRoom={async room => {
          setActiveRoom(room);
          setRoomLoading(true);
          setScreen("canvas");
          const [loaded, variantList] = await Promise.all([
            loadRoom(room.id),
            loadVariants(room.id),
          ]);
          // Активный вариант имеет наивысший приоритет.
          // Только если вариантов нет — берём room.data или loaded.data.
          const vlist = variantList as PlanVariant[];
          let activeVariant = vlist.find(v => v.is_active);
          // Если варианты есть, но ни один не активен — авто-активируем первый
          if (!activeVariant && vlist.length > 0) {
            activeVariant = vlist[0];
            variantsHook.updateVariant(activeVariant.id, { is_active: true });
          }
          const hasVariants = vlist.length > 0;
          const roomHasOverrideData = !hasVariants && room.data && Object.keys(room.data as object).length > 0 && (room.data as PlanState).points;
          const dataSource: PlanState | undefined = activeVariant
            ? (activeVariant.data as PlanState)
            : roomHasOverrideData
              ? (room.data as PlanState)
              : (loaded?.data as PlanState | undefined);
          const hasData = dataSource && Object.keys(dataSource).length > 0 && dataSource.points;
          loadingFromRoomRef.current = true;
          lastClosedSegId.current = null;
          catalog.setTapActiveId(null);
          reset(hasData ? { ...INITIAL_STATE, ...dataSource, selectedSegmentId: null, selectedSegmentIds: [], selectedPointId: null } : INITIAL_STATE);
          // Сбрасываем флаг и подгоняем вид под чертёж
          setTimeout(() => {
            loadingFromRoomRef.current = false;
            if (hasData) zoomFit();
          }, 200);
          setRoomLoading(false);
        }}
          />
        </div>
        <QuickAccessBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#111] overflow-hidden relative" style={{ height: "100dvh" }}>

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
        onOverwriteVariant={activeRoom && activeVariantId ? () => variantHandlers.handleOverwriteVariant(state) : undefined}
        variants={variants}
        variantsLoading={variantsLoading}
        activeVariantId={activeVariantId}
        onLoadVariant={(id, data) => {
          loadingFromRoomRef.current = true;
          lastClosedSegId.current = null;
          setRightPanelOpen(false);
          setSheetOpen(false);
          setSidebarOpen(false);
          catalog.setCatalogOpen(false);
          catalog.setTapActiveId(null);
          setTimeout(() => { loadingFromRoomRef.current = false; }, 150);
          variantHandlers.handleLoadVariant(id, data);
        }}
        onDeleteVariant={variantHandlers.handleDeleteVariant}
        onRenameVariant={variantHandlers.handleRenameVariant}
        onSelectVariant={activeRoom ? (id) => variantsHook.updateVariant(id, { is_active: true }) : undefined}
        onVariantPickerOpenChange={setMobileVariantPickerOpen}
      />

      <PlanCanvasArea
        displayState={displayState}
        state={state}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        sidebarW={sidebarW}
        roomLoading={roomLoading}
        activeRoomName={activeRoom?.name}
        catalog={catalog}
        onSidebarDragStart={onSidebarDragStart}
        handleChange={handleChange}
        handleReplace={handleReplace}
        onBeforeAutoOpenCatalog={isMobile ? () => { setSheetOpen(false); setRightPanelOpen(false); } : undefined}
      />

      <PlanPagePanels
        state={state}
        isMobile={isMobile}
        isLoggedIn={isLoggedIn}
        currentPlanName={currentPlanName}
        sheetOpen={sheetOpen}                   setSheetOpen={setSheetOpen}
        sheetSnap={sheetSnap}                   setSheetSnap={setSheetSnap}
        sheetHeight={sheetHeight}               setSheetHeight={setSheetHeight}
        rightPanelOpen={rightPanelOpen}         setRightPanelOpen={setRightPanelOpen}
        sidebarOpen={sidebarOpen}               setSidebarOpen={setSidebarOpen}
        exportOpen={exportOpen}                 setExportOpen={setExportOpen}
        libraryOpen={libraryOpen}               setLibraryOpen={setLibraryOpen}
        authOpen={authOpen}                     setAuthOpen={setAuthOpen}
        bottomSettingsOpen={bottomSettingsOpen} setBottomSettingsOpen={setBottomSettingsOpen}
        showOnboarding={showOnboarding}         setShowOnboarding={setShowOnboarding}
        focusSegmentId={focusSegmentId}         setFocusSegmentId={setFocusSegmentId}
        handleChange={handleChange}
        handleUpdateSegment={handleUpdateSegment}
        handleUpdateDiagonal={handleUpdateDiagonal}
        handleSave={handleSave}
        handleSaveAs={handleSaveAs}
        handleLoad={handleLoad}
        handleDelete={handleDelete}
        handleRename={handleRename}
        handleNew={handleNew}
        handleSettingChange={handleSettingChange}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        zoomFit={zoomFit}
        storage={storage}
        catalog={catalog}
        getFloorDefault={getFloorDefault}
        voiceDraw={voiceDraw}
        variantModalOpen={variantModalOpen}
        variantSaving={variantSaving}
        onSaveVariant={(name) => variantHandlers.handleSaveVariantWithState(name, state)}
        onCloseVariantModal={() => setVariantModalOpen(false)}
        mobileVariantPickerOpen={mobileVariantPickerOpen}
      />

      {/* Модалка выгрузки PDF сметы */}
      <PdfExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        showScope={false}
        onExport={async cfg => {
          // Строим room из текущей комнаты + актуального state как данных
          const roomForExport: PlanRoom = activeRoom
            ? { ...activeRoom, active_variant_data: state }
            : { id: 0, name: currentPlanName, project_id: 0, data: state, thumbnail: null, created_at: "", updated_at: "", include_in_estimate: true, include_drawing: true, active_variant_data: state };
          await generateExportPdf({
            type: cfg.type,
            scope: cfg.scope,
            project: {
              name: activeProject?.name ?? currentPlanName,
              client_name: activeProject?.client_name ?? null,
              phone: activeProject?.phone ?? null,
              address: activeProject?.address ?? null,
            },
            rooms: [roomForExport],
          });
          setExportOpen(false);
        }}
      />

    </div>
  );
}
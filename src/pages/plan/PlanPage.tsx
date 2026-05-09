import React, { useEffect, useRef } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanRightInputPanel from "./PlanRightInputPanel";
import PlanModals from "./PlanModals";
import Icon from "@/components/ui/icon";
import type { PlanState } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";
import { PANEL_WIDTH } from "./PlanRightInputPanel";
import { useHistory, useIsMobile } from "./usePlanHistory";
import { usePlanHandlers } from "./usePlanHandlers";
import { useAuth } from "@/context/AuthContext";

export default function PlanPage() {
  const { state, push, replace, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);
  const { user, token } = useAuth();
  const isMobile = useIsMobile();

  const [sheetOpen,      setSheetOpen]      = React.useState(false);
  const [sheetSnap,      setSheetSnap]      = React.useState<"half" | "full">("full");
  const [sheetHeight,    setSheetHeight]    = React.useState(0);
  const [rightPanelOpen, setRightPanelOpen] = React.useState(false);
  const [exportOpen,     setExportOpen]     = React.useState(false);
  const [libraryOpen,    setLibraryOpen]    = React.useState(false);
  const [authOpen,       setAuthOpen]       = React.useState(false);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [focusSegmentId, setFocusSegmentId] = React.useState<string | null>(null);

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

  // Мобиле: кнопка открытия правой панели при нажатии на сторону
  const prevSelectedSegId = useRef(state.selectedSegmentId);
  useEffect(() => {
    if (!isMobile) return;
    if (state.selectedSegmentId && state.selectedSegmentId !== prevSelectedSegId.current && state.isClosed) {
      setFocusSegmentId(state.selectedSegmentId);
      setRightPanelOpen(true);
      if (!rightPanelOpen) setTimeout(() => zoomFit(0, PANEL_WIDTH), 80);
    }
    prevSelectedSegId.current = state.selectedSegmentId;
  }, [state.selectedSegmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoggedIn = !!user && !!token;
  const currentPlanName = storage.plans.find(p => p.id === storage.currentPlanId)?.name
    ?? (state as PlanState).room.name ?? "Без названия";

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
          <PlanCanvas state={state} onChange={handleChange} />
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

        {/* Мобиле: кнопка открытия панели */}
        {isMobile && !sheetOpen && (
          <button
            onClick={() => { setSheetSnap("half"); setSheetOpen(true); }}
            className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-violet-600 shadow-lg shadow-violet-500/30 flex items-center justify-center text-white z-20 active:scale-95 transition-transform"
          >
            <Icon name="PanelBottom" size={20} />
          </button>
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
    </div>
  );
}
import MobileBottomBar from "./MobileBottomBar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanRightInputPanel from "./PlanRightInputPanel";
import PlanModals from "./PlanModals";
import PlanCatalogPanel from "./PlanCatalogPanel";
import PlanDragGhosts from "./PlanDragGhosts";
import PlanQuantityModal from "./PlanQuantityModal";
import PlanVariantSaveModal from "./PlanVariantSaveModal";
import type { PlanState } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";
import type { usePlanHandlers } from "./usePlanHandlers";
import useVoiceDraw from "./useVoiceDraw";

type VoiceDraw = ReturnType<typeof useVoiceDraw>;
type Catalog   = ReturnType<typeof usePlanCatalog>;
type Handlers  = ReturnType<typeof usePlanHandlers>;

interface Props {
  state: PlanState;
  isMobile: boolean;
  isLoggedIn: boolean;
  currentPlanName: string;
  // UI flags
  sheetOpen: boolean;       setSheetOpen: (v: boolean) => void;
  sheetSnap: "half" | "full"; setSheetSnap: (v: "half" | "full") => void;
  sheetHeight: number;      setSheetHeight: (v: number) => void;
  rightPanelOpen: boolean;  setRightPanelOpen: (v: boolean) => void;
  sidebarOpen: boolean;     setSidebarOpen: (v: boolean) => void;
  exportOpen: boolean;      setExportOpen: (v: boolean) => void;
  libraryOpen: boolean;     setLibraryOpen: (v: boolean) => void;
  authOpen: boolean;        setAuthOpen: (v: boolean) => void;
  bottomSettingsOpen: boolean; setBottomSettingsOpen: (v: boolean) => void;
  showOnboarding: boolean;  setShowOnboarding: (v: boolean) => void;
  focusSegmentId: string | null; setFocusSegmentId: (v: string | null) => void;
  // handlers
  handleChange: (patch: Partial<PlanState>) => void;
  handleUpdateSegment: Handlers["handleUpdateSegment"];
  handleUpdateDiagonal: Handlers["handleUpdateDiagonal"];
  handleSave: () => Promise<void>;
  handleSaveAs: (name: string) => Promise<void>;
  handleLoad: (planId: number) => Promise<void>;
  handleDelete: (planId: number) => Promise<void>;
  handleRename: (planId: number, name: string) => Promise<void>;
  handleNew: () => void;
  handleSettingChange: (patch: Partial<PlanState["settings"]>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  storage: Handlers["storage"];
  // catalog
  catalog: Catalog;
  getFloorDefault: (category?: string) => number | undefined;
  // voice
  voiceDraw: VoiceDraw;
  // variants
  variantModalOpen: boolean;
  variantSaving: boolean;
  onSaveVariant: (name: string) => Promise<void>;
  onCloseVariantModal: () => void;
}

export default function PlanPagePanels({
  state, isMobile, isLoggedIn, currentPlanName,
  sheetOpen, setSheetOpen,
  sheetSnap, setSheetSnap,
  sheetHeight, setSheetHeight,
  rightPanelOpen, setRightPanelOpen,
  sidebarOpen, setSidebarOpen,
  exportOpen, setExportOpen,
  libraryOpen, setLibraryOpen,
  authOpen, setAuthOpen,
  bottomSettingsOpen, setBottomSettingsOpen,
  showOnboarding, setShowOnboarding,
  focusSegmentId, setFocusSegmentId,
  handleChange, handleUpdateSegment, handleUpdateDiagonal,
  handleSave, handleSaveAs, handleLoad, handleDelete, handleRename, handleNew,
  handleSettingChange, zoomIn, zoomOut, zoomFit,
  storage, catalog, getFloorDefault, voiceDraw,
  variantModalOpen, variantSaving, onSaveVariant, onCloseVariantModal,
}: Props) {
  return (
    <>
      {/* Нижняя панель */}
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

      {/* Модалки, онбординг */}
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

      {/* Каталог материалов */}
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

      {/* Модалка добавления на полотно */}
      <PlanQuantityModal
        item={catalog.pendingFloorItem}
        onConfirm={catalog.confirmFloorItem}
        onCancel={() => catalog.setPendingFloorItem(null)}
        defaultQuantity={getFloorDefault(catalog.pendingFloorItem?.category)}
      />
      {/* Модалка редактирования quantity floorItem */}
      <PlanQuantityModal
        item={catalog.editingFloorItem}
        onConfirm={catalog.confirmEditFloorItem}
        onCancel={() => catalog.setEditingFloorId(null)}
      />

      {/* Ghost-оверлеи и слайдер активных карточек */}
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
        onSave={onSaveVariant}
        onClose={onCloseVariantModal}
      />
    </>
  );
}
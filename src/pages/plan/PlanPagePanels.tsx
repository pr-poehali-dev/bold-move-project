import MobileBottomBar from "./MobileBottomBar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanRightInputPanel from "./PlanRightInputPanel";
import PlanModals from "./PlanModals";
import PlanCatalogPanel from "./PlanCatalogPanel";
import PlanDragGhosts from "./PlanDragGhosts";
import PlanQuantityModal from "./PlanQuantityModal";
import PlanVariantSaveModal from "./PlanVariantSaveModal";
import ReplaceItemModal from "./ReplaceItemModal";
import { useState, useEffect, useRef } from "react";
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
  mobileVariantPickerOpen?: boolean;
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
  mobileVariantPickerOpen = false,
}: Props) {
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);

  // Голосовое наполнение из нижней кнопки — вызывает handleVoiceItems через PlanCatalogPanel
  // Хранится как ref чтобы MobileBottomBar мог вызвать напрямую
  const voiceItemsHandlerRef = useRef<((items: import("./useVoiceCatalog").VoiceCatalogItem[], transcript: string) => void) | null>(null);
  const onVoiceItemsFromBottom = (items: import("./useVoiceCatalog").VoiceCatalogItem[], transcript: string) => {
    voiceItemsHandlerRef.current?.(items, transcript);
  };
  // Замена из нижней панели активных карточек
  const [replaceActiveItem, setReplaceActiveItem] = useState<import("./planTypes").SegmentPriceItem | null>(null);

  // Сохраняем segRef пока барабан открыт (для мобильной замены)
  const [mobileReplaceSegRef, setMobileReplaceSegRef] = useState<{ segId: string; priceId: number } | null>(null);

  // Мобиле: при клике на товар на стене — открываем барабан на нужной категории
  useEffect(() => {
    if (!isMobile || !catalog.editingSegRef) return;
    const cat = catalog.editingSegItem?.category ?? null;
    setMobileReplaceSegRef(catalog.editingSegRef);
    catalog.setReplaceCatalogCategory(cat);
    catalog.setCatalogOpen(true);
    catalog.setEditingSegRef(null);
  }, [isMobile, catalog.editingSegRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const [replaceModalItem, setReplaceModalItem] = useState<(import("./planTypes").SegmentPriceItem & { quantity: number }) | null>(null);
  const [replaceFloorId, setReplaceFloorId] = useState<string | null>(null);

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
        onOpenMaterials={() => {
          if (isMobile) {
            handleChange({ sidebarTab: "calc" });
            catalog.setCatalogOpen(false);
            setRightPanelOpen(false);
            setSheetSnap("half");
            setSheetOpen(true);
          } else {
            handleChange({ sidebarTab: "calc" });
            catalog.setCatalogOpen(false);
            setSidebarOpen(true);
          }
        }}
        materialsOpen={
          isMobile
            ? sheetOpen && state.sidebarTab === "calc"
            : sidebarOpen && state.sidebarTab === "calc"
        }
        onToggleVoiceDraw={voiceDraw.hasSpeech ? voiceDraw.toggle : undefined}
        isVoiceDrawing={voiceDraw.isListening}
        isVoiceProcessing={voiceDraw.isProcessing}
        voiceStatus={voiceDraw.status}
        voiceInterim={voiceDraw.interimText}
        voiceVolume={voiceDraw.volume}
        isClosed={state.isClosed}
        planState={state}
        onVoiceCatalogItems={onVoiceItemsFromBottom}
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
        allPrices={catalog.prices}
        selectedSegmentId={state.selectedSegmentId}
        selectedSegmentIds={state.selectedSegmentIds}
        state={state}
        onClose={() => {
          catalog.setCatalogOpen(false);
          catalog.setReplaceCatalogCategory(null);
          setMobileReplaceSegRef(null);
        }}
        onAssignToSegs={catalog.assignItemToSegs}
        onReplaceItem={(mobileReplaceSegRef || replaceActiveItem) ? (item) => {
          if (mobileReplaceSegRef) {
            catalog.replaceSegItem(item, mobileReplaceSegRef);
            setMobileReplaceSegRef(null);
          } else if (replaceActiveItem) {
            catalog.replaceActiveItemEverywhere(replaceActiveItem.priceId, item);
            setReplaceActiveItem(null);
          }
          catalog.setCatalogOpen(false);
          catalog.setReplaceCatalogCategory(null);
        } : undefined}
        onAssignToAllSegs={catalog.assignItemToAllSegs}
        onAssignMany={catalog.assignManyItems}
        onAddToActive={item => {
          const hidden = ["монтаж", "раскрой", "огарпунивание"];
          if (hidden.some(h => item.category?.toLowerCase().includes(h))) return;
          catalog.setActiveItems(prev =>
            prev.some(it => it.priceId === item.priceId) ? prev : [...prev, item]
          );
          catalog.setTapActiveId(item.priceId);
        }}
        initialCategory={catalog.replaceCatalogCategory ?? undefined}
        isMobile={isMobile}
        onRegisterVoiceHandler={fn => { voiceItemsHandlerRef.current = fn; }}
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
        isEditing
        onReplace={() => {
          if (isMobile) {
            const cat = catalog.editingFloorItem?.category ?? null;
            catalog.setEditingFloorId(null);
            catalog.setReplaceCatalogCategory(cat);
            catalog.setCatalogOpen(true);
          } else {
            setReplaceModalItem(catalog.editingFloorItem);
            setReplaceFloorId(catalog.editingFloorId);
            catalog.setEditingFloorId(null);
            setReplaceModalOpen(true);
          }
        }}
      />

      {/* Модалка замены товара на полотне (только ПК) */}
      {!isMobile && (
        <ReplaceItemModal
          open={replaceModalOpen}
          item={replaceModalItem}
          prices={catalog.prices}
          onReplace={(newItem, quantity) => {
            catalog.replaceFloorItem(newItem, quantity, replaceFloorId ?? undefined);
            setReplaceModalOpen(false);
            setReplaceModalItem(null);
            setReplaceFloorId(null);
          }}
          onCancel={() => {
            setReplaceModalOpen(false);
            setReplaceModalItem(null);
            setReplaceFloorId(null);
          }}
        />
      )}

      {/* Замена товара на стене: ПК — модалка, мобиле — через useEffect (барабан) */}
      {!isMobile && (
        <ReplaceItemModal
          open={!!catalog.editingSegRef}
          item={catalog.editingSegItem}
          prices={catalog.prices}
          onReplace={(newItem) => {
            catalog.replaceSegItem(newItem);
          }}
          onCancel={() => catalog.setEditingSegRef(null)}
        />
      )}

      {/* Замена из нижней панели активных карточек (ПК) */}
      {!isMobile && (
        <ReplaceItemModal
          open={!!replaceActiveItem}
          item={replaceActiveItem ? { ...replaceActiveItem, quantity: 1 } : null}
          prices={catalog.prices}
          onReplace={(newItem) => {
            if (replaceActiveItem) catalog.replaceActiveItemEverywhere(replaceActiveItem.priceId, newItem);
            setReplaceActiveItem(null);
          }}
          onCancel={() => setReplaceActiveItem(null)}
        />
      )}

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
        anyPanelOpen={sheetOpen || sidebarOpen || rightPanelOpen || catalog.catalogOpen || exportOpen || libraryOpen || authOpen || bottomSettingsOpen || mobileVariantPickerOpen}
        onTapActiveId={catalog.setTapActiveId}
        onRemoveActiveItem={catalog.removeActiveItem}
        onAssignToAllSegs={catalog.assignItemToAllSegs}
        onRemoveFromAllSegs={catalog.removeItemFromAllSegs}
        isItemOnAllSegs={catalog.isItemOnAllSegs}
        onAdjustQuantity={catalog.adjustItemQuantity}
        onSetQuantity={catalog.setItemQuantity}
        onAddToFloor={catalog.setPendingFloorItem}
        onReplaceItem={item => {
          if (isMobile) {
            // Мобиле: открываем барабан
            catalog.setReplaceCatalogCategory(item.category ?? null);
            setMobileReplaceSegRef(null);
            setReplaceActiveItem(item);
            catalog.setCatalogOpen(true);
          } else {
            // ПК: открываем модалку
            setReplaceActiveItem(item);
          }
        }}
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
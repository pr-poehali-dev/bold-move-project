import { useState, useEffect, useRef } from "react";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";
import type { usePlanHandlers } from "./usePlanHandlers";
import useVoiceDraw from "./useVoiceDraw";
import PlanBottomBarSection, { type ReplaceTarget } from "./PlanBottomBarSection";
import PlanMobileSidePanels from "./PlanMobileSidePanels";
import PlanCatalogAndModals from "./PlanCatalogAndModals";
import PlanReplaceAndGhosts from "./PlanReplaceAndGhosts";

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
  photosOpen?: boolean;
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
  photosOpen = false,
}: Props) {
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);

  // Голосовое наполнение из нижней кнопки — вызывает handleVoiceItems через PlanCatalogPanel
  // Хранится как ref чтобы MobileBottomBar мог вызвать напрямую
  const voiceItemsHandlerRef = useRef<((items: import("./useVoiceCatalog").VoiceCatalogItem[], transcript: string) => void) | null>(null);
  const onVoiceItemsFromBottom = (items: import("./useVoiceCatalog").VoiceCatalogItem[], transcript: string) => {
    voiceItemsHandlerRef.current?.(items, transcript);
  };
  // ── Замена товара (мобиле) ────────────────────────────────────────────────
  // replaceTarget хранит что именно заменяем:
  //   { type: "seg", segId, priceId }  — конкретный товар на конкретной стене
  //   { type: "active", priceId }      — активный товар из нижней панели (везде)
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget>(null);

  // Обработчик выбора нового товара в барабане замены
  const handleReplaceSelect = (newItem: SegmentPriceItem) => {
    if (!replaceTarget) return;
    if (replaceTarget.type === "seg") {
      catalog.replaceSegItem(newItem, { segId: replaceTarget.segId, priceId: replaceTarget.priceId });
    } else {
      catalog.replaceActiveItemEverywhere(replaceTarget.priceId, newItem);
    }
    setReplaceTarget(null);
  };

  // Когда catalog.editingSegRef устанавливается (кнопка "Заменить" на стене):
  // на мобиле — открываем барабан замены; на ПК — НЕ трогаем editingSegRef,
  // его напрямую использует ReplaceItemModal ниже (open={!!catalog.editingSegRef}).
  useEffect(() => {
    if (!isMobile) return; // на ПК модалка сама следит за editingSegRef
    if (!catalog.editingSegRef) return;
    const segId = catalog.editingSegRef.segId;
    const priceId = catalog.editingSegRef.priceId;
    const seg = state.segments.find(s => s.id === segId);
    const item = seg?.items?.find(it => it.priceId === priceId);
    catalog.setEditingSegRef(null);
    // Задержка 120мс — чтобы тач-событие от кнопки "Заменить" не прошло сквозь
    // барабан и не закрыло его сразу после открытия
    setTimeout(() => {
      setReplaceTarget({
        type: "seg",
        segId,
        priceId,
        category: item?.category ?? null,
      });
    }, 120);
  }, [catalog.editingSegRef, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const [replaceModalItem, setReplaceModalItem] = useState<(SegmentPriceItem & { quantity: number }) | null>(null);
  const [replaceFloorId, setReplaceFloorId] = useState<string | null>(null);

  return (
    <>
      {/* Нижняя панель */}
      <PlanBottomBarSection
        state={state}
        isMobile={isMobile}
        sheetOpen={sheetOpen} setSheetOpen={setSheetOpen}
        sheetSnap={sheetSnap} setSheetSnap={setSheetSnap}
        rightPanelOpen={rightPanelOpen} setRightPanelOpen={setRightPanelOpen}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        setFocusSegmentId={setFocusSegmentId}
        handleChange={handleChange}
        handleSettingChange={handleSettingChange}
        zoomIn={zoomIn} zoomOut={zoomOut} zoomFit={zoomFit}
        catalog={catalog}
        replaceTarget={replaceTarget}
        setReplaceTarget={setReplaceTarget}
        voiceDraw={voiceDraw}
        onVoiceItemsFromBottom={onVoiceItemsFromBottom}
        setBottomSettingsOpen={setBottomSettingsOpen}
      />

      {/* Мобиле: правая панель ввода сторон + bottom sheet */}
      <PlanMobileSidePanels
        state={state}
        isMobile={isMobile}
        rightPanelOpen={rightPanelOpen} setRightPanelOpen={setRightPanelOpen}
        focusSegmentId={focusSegmentId} setFocusSegmentId={setFocusSegmentId}
        sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} sheetSnap={sheetSnap}
        setSheetHeight={setSheetHeight}
        handleChange={handleChange}
        handleUpdateSegment={handleUpdateSegment}
        handleUpdateDiagonal={handleUpdateDiagonal}
        handleSettingChange={handleSettingChange}
        catalog={catalog}
      />

      {/* Модалки общего назначения + оба каталога (обычный режим и барабан замены) */}
      <PlanCatalogAndModals
        state={state}
        isMobile={isMobile}
        isLoggedIn={isLoggedIn}
        currentPlanName={currentPlanName}
        exportOpen={exportOpen} setExportOpen={setExportOpen}
        libraryOpen={libraryOpen} setLibraryOpen={setLibraryOpen}
        authOpen={authOpen} setAuthOpen={setAuthOpen}
        showOnboarding={showOnboarding} setShowOnboarding={setShowOnboarding}
        handleChange={handleChange}
        handleSave={handleSave}
        handleSaveAs={handleSaveAs}
        handleLoad={handleLoad}
        handleDelete={handleDelete}
        handleRename={handleRename}
        handleNew={handleNew}
        storage={storage}
        catalog={catalog}
        getFloorDefault={getFloorDefault}
        replaceTarget={replaceTarget}
        setReplaceTarget={setReplaceTarget}
        handleReplaceSelect={handleReplaceSelect}
        voiceItemsHandlerRef={voiceItemsHandlerRef}
        setReplaceModalOpen={setReplaceModalOpen}
        setReplaceModalItem={setReplaceModalItem}
        setReplaceFloorId={setReplaceFloorId}
      />

      {/* Модалки замены (ПК) + ghost-оверлеи/слайдер активных карточек + сохранение варианта */}
      <PlanReplaceAndGhosts
        state={state}
        isMobile={isMobile}
        catalog={catalog}
        replaceModalOpen={replaceModalOpen} setReplaceModalOpen={setReplaceModalOpen}
        replaceModalItem={replaceModalItem} setReplaceModalItem={setReplaceModalItem}
        replaceFloorId={replaceFloorId} setReplaceFloorId={setReplaceFloorId}
        replaceTarget={replaceTarget} setReplaceTarget={setReplaceTarget}
        sheetOpen={sheetOpen}
        sidebarOpen={sidebarOpen}
        rightPanelOpen={rightPanelOpen}
        exportOpen={exportOpen}
        libraryOpen={libraryOpen}
        authOpen={authOpen}
        bottomSettingsOpen={bottomSettingsOpen}
        mobileVariantPickerOpen={mobileVariantPickerOpen}
        photosOpen={photosOpen}
        variantModalOpen={variantModalOpen}
        variantSaving={variantSaving}
        onSaveVariant={onSaveVariant}
        onCloseVariantModal={onCloseVariantModal}
      />
    </>
  );
}

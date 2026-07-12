import type { MutableRefObject } from "react";
import PlanModals from "./PlanModals";
import PlanCatalogPanel from "./PlanCatalogPanel";
import PlanQuantityModal from "./PlanQuantityModal";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";
import type { usePlanHandlers } from "./usePlanHandlers";
import type { ReplaceTarget } from "./PlanBottomBarSection";

type Catalog  = ReturnType<typeof usePlanCatalog>;
type Handlers = ReturnType<typeof usePlanHandlers>;

interface Props {
  state: PlanState;
  isMobile: boolean;
  isLoggedIn: boolean;
  currentPlanName: string;
  exportOpen: boolean;      setExportOpen: (v: boolean) => void;
  libraryOpen: boolean;     setLibraryOpen: (v: boolean) => void;
  authOpen: boolean;        setAuthOpen: (v: boolean) => void;
  showOnboarding: boolean;  setShowOnboarding: (v: boolean) => void;
  handleChange: (patch: Partial<PlanState>) => void;
  handleSave: () => Promise<void>;
  handleSaveAs: (name: string) => Promise<void>;
  handleLoad: (planId: number) => Promise<void>;
  handleDelete: (planId: number) => Promise<void>;
  handleRename: (planId: number, name: string) => Promise<void>;
  handleNew: () => void;
  storage: Handlers["storage"];
  catalog: Catalog;
  getFloorDefault: (category?: string) => number | undefined;
  replaceTarget: ReplaceTarget;
  setReplaceTarget: (v: ReplaceTarget) => void;
  handleReplaceSelect: (newItem: SegmentPriceItem) => void;
  voiceItemsHandlerRef: MutableRefObject<((items: import("./useVoiceCatalog").VoiceCatalogItem[], transcript: string) => void) | null>;
  setReplaceModalOpen: (v: boolean) => void;
  setReplaceModalItem: (v: (SegmentPriceItem & { quantity: number }) | null) => void;
  setReplaceFloorId: (v: string | null) => void;
}

// ── Модалки общего назначения + оба каталога (обычный режим и барабан замены) ──
export default function PlanCatalogAndModals({
  state, isMobile, isLoggedIn, currentPlanName,
  exportOpen, setExportOpen, libraryOpen, setLibraryOpen, authOpen, setAuthOpen,
  showOnboarding, setShowOnboarding,
  handleChange, handleSave, handleSaveAs, handleLoad, handleDelete, handleRename, handleNew,
  storage, catalog, getFloorDefault,
  replaceTarget, setReplaceTarget, handleReplaceSelect,
  voiceItemsHandlerRef,
  setReplaceModalOpen, setReplaceModalItem, setReplaceFloorId,
}: Props) {
  return (
    <>
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

      {/* Каталог материалов — обычный режим (только когда НЕ идёт замена) */}
      <PlanCatalogPanel
        open={catalog.catalogOpen && !replaceTarget}
        filteredPrices={catalog.filteredPrices}
        allPrices={catalog.prices}
        selectedSegmentId={state.selectedSegmentId}
        selectedSegmentIds={state.selectedSegmentIds}
        state={state}
        onClose={() => {
          catalog.setCatalogOpen(false);
          catalog.setReplaceCatalogCategory(null);
        }}
        onAssignToSegs={catalog.assignItemToSegs}
        onAssignToAllSegs={catalog.assignItemToAllSegs}
        onAssignMany={catalog.assignManyItems}
        onRemoveFromSegs={catalog.removeItemFromSegs}
        onRemoveFromAllSegs={catalog.removeItemFromAllSegs}
        onAddToActive={item => {
          const hidden = ["монтаж", "раскрой", "огарпунивание"];
          if (hidden.some(h => item.category?.toLowerCase().includes(h))) return;
          catalog.setActiveItems(prev =>
            prev.some(it => it.priceId === item.priceId) ? prev : [...prev, item]
          );
          catalog.setTapActiveId(item.priceId);
          catalog.setReplaceCatalogCategory(null);
        }}
        initialCategory={catalog.replaceCatalogCategory ?? undefined}
        isMobile={isMobile}
        onRegisterVoiceHandler={fn => { voiceItemsHandlerRef.current = fn; }}
        onStartClickPlace={catalog.startClickPlace}
        onOpenFloorQuantity={catalog.setPendingFloorItem}
      />

      {/* Барабан замены — отдельный, только когда идёт замена */}
      <PlanCatalogPanel
        open={!!replaceTarget}
        filteredPrices={catalog.filteredPrices}
        allPrices={catalog.prices}
        selectedSegmentId={null}
        state={state}
        onClose={() => {
          setReplaceTarget(null);
          catalog.setReplaceCatalogCategory(null);
        }}
        onAssignToSegs={() => {}}
        onAssignToAllSegs={() => {}}
        onAssignMany={() => {}}
        onRemoveFromSegs={() => {}}
        onRemoveFromAllSegs={() => {}}
        onAddToActive={() => {}}
        onReplaceItem={handleReplaceSelect}
        initialCategory={replaceTarget?.category ?? undefined}
        isMobile={isMobile}
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
        onDelete={() => {
          const id = catalog.editingFloorId;
          catalog.setEditingFloorId(null);
          if (id) handleChange({ floorItems: (state.floorItems ?? []).filter(fi => fi.id !== id) });
        }}
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
    </>
  );
}
import ReplaceItemModal from "./ReplaceItemModal";
import PlanDragGhosts from "./PlanDragGhosts";
import PlanVariantSaveModal from "./PlanVariantSaveModal";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";
import type { ReplaceTarget } from "./PlanBottomBarSection";

type Catalog = ReturnType<typeof usePlanCatalog>;

interface Props {
  state: PlanState;
  isMobile: boolean;
  catalog: Catalog;
  replaceModalOpen: boolean; setReplaceModalOpen: (v: boolean) => void;
  replaceModalItem: (SegmentPriceItem & { quantity: number }) | null;
  setReplaceModalItem: (v: (SegmentPriceItem & { quantity: number }) | null) => void;
  replaceFloorId: string | null; setReplaceFloorId: (v: string | null) => void;
  replaceTarget: ReplaceTarget;
  setReplaceTarget: (v: ReplaceTarget) => void;
  // UI flags для anyPanelOpen
  sheetOpen: boolean;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  exportOpen: boolean;
  libraryOpen: boolean;
  authOpen: boolean;
  bottomSettingsOpen: boolean;
  mobileVariantPickerOpen: boolean;
  // Варианты
  variantModalOpen: boolean;
  variantSaving: boolean;
  onSaveVariant: (name: string) => Promise<void>;
  onCloseVariantModal: () => void;
}

// ── Модалки замены товара (ПК) + ghost-оверлеи/слайдер активных карточек + сохранение варианта ──
export default function PlanReplaceAndGhosts({
  state, isMobile, catalog,
  replaceModalOpen, setReplaceModalOpen, replaceModalItem, setReplaceModalItem,
  replaceFloorId, setReplaceFloorId,
  replaceTarget, setReplaceTarget,
  sheetOpen, sidebarOpen, rightPanelOpen, exportOpen, libraryOpen, authOpen,
  bottomSettingsOpen, mobileVariantPickerOpen,
  variantModalOpen, variantSaving, onSaveVariant, onCloseVariantModal,
}: Props) {
  return (
    <>
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
      {!isMobile && replaceTarget?.type === "active" && (
        <ReplaceItemModal
          open={true}
          item={{ priceId: replaceTarget.priceId, name: "", category: replaceTarget.category ?? "", imageUrl: null, categoryImageUrl: null, unit: "", isWallItem: true, quantity: 1 }}
          prices={catalog.prices}
          onReplace={(newItem) => {
            catalog.replaceActiveItemEverywhere(replaceTarget.priceId, newItem);
            setReplaceTarget(null);
          }}
          onCancel={() => setReplaceTarget(null)}
        />
      )}

      {/* Ghost-оверлеи и слайдер активных карточек */}
      <PlanDragGhosts
        dragItem={catalog.dragItem}
        dragPos={catalog.dragPos}
        dragCardItem={catalog.dragCardItem}
        dragCardPos={catalog.dragCardPos}
        clickPlaceItem={catalog.clickPlaceItem}
        clickPlacePos={catalog.clickPlacePos}
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
        selectedSegmentIds={state.selectedSegmentIds}
        onAssignToSelectedSegs={catalog.assignItemToSegs}
        onHoverItem={catalog.setHoveredPriceId}
        onReplaceItem={item => {
          if (isMobile) {
            // Мобиле: открываем барабан замены
            setReplaceTarget({
              type: "active",
              priceId: item.priceId,
              category: item.category ?? null,
            });
            catalog.setReplaceCatalogCategory(item.category ?? null);
          } else {
            // ПК: открываем модалку через replaceTarget
            setReplaceTarget({ type: "active", priceId: item.priceId, category: item.category ?? null });
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

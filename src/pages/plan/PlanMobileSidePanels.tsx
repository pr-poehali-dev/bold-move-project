import PlanRightInputPanel from "./PlanRightInputPanel";
import PlanBottomSheet from "./PlanBottomSheet";
import type { PlanState } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";
import type { usePlanHandlers } from "./usePlanHandlers";

type Catalog  = ReturnType<typeof usePlanCatalog>;
type Handlers = ReturnType<typeof usePlanHandlers>;

interface Props {
  state: PlanState;
  isMobile: boolean;
  rightPanelOpen: boolean;  setRightPanelOpen: (v: boolean) => void;
  focusSegmentId: string | null; setFocusSegmentId: (v: string | null) => void;
  sheetOpen: boolean;       setSheetOpen: (v: boolean) => void;
  sheetSnap: "half" | "full";
  setSheetHeight: (v: number) => void;
  handleChange: (patch: Partial<PlanState>) => void;
  handleUpdateSegment: Handlers["handleUpdateSegment"];
  handleUpdateDiagonal: Handlers["handleUpdateDiagonal"];
  handleSettingChange: (patch: Partial<PlanState["settings"]>) => void;
  catalog: Catalog;
}

// ── Мобиле: правая панель быстрого ввода сторон + bottom sheet ──────────────
export default function PlanMobileSidePanels({
  state, isMobile,
  rightPanelOpen, setRightPanelOpen,
  focusSegmentId, setFocusSegmentId,
  sheetOpen, setSheetOpen, sheetSnap, setSheetHeight,
  handleChange, handleUpdateSegment, handleUpdateDiagonal, handleSettingChange,
  catalog,
}: Props) {
  if (!isMobile) return null;

  return (
    <>
      {/* Мобиле: правая панель быстрого ввода сторон */}
      {rightPanelOpen && (
        <PlanRightInputPanel
          state={state}
          onUpdateSegment={handleUpdateSegment}
          onUpdateDiagonal={handleUpdateDiagonal}
          focusSegmentId={focusSegmentId}
          onChange={handleChange}
          onClose={() => { setRightPanelOpen(false); setFocusSegmentId(null); }}
        />
      )}

      {/* Мобиле: bottom sheet */}
      <PlanBottomSheet
        state={state}
        onChange={handleChange}
        open={sheetOpen}
        initialSnap={sheetSnap}
        onClose={() => { setSheetOpen(false); setSheetHeight(0); }}
        onSheetHeightChange={setSheetHeight}
        onHideMaterialsButton={!state.settings.hideMaterialsButton ? () => {
          handleSettingChange({ hideMaterialsButton: true });
          setSheetOpen(false);
        } : undefined}
        onShowMaterialsButton={state.settings.hideMaterialsButton ? () => {
          handleSettingChange({ hideMaterialsButton: false });
        } : undefined}
        // Быстрые функции для позиций в "Материалах" — те же, что на ПК в PlanSidebar,
        // без них попап действий на мобиле не открывается.
        onRemoveActiveItem={catalog.removeActiveItem}
        onAssignToAllSegs={catalog.assignItemToAllSegs}
        onRemoveFromAllSegs={catalog.removeItemFromAllSegs}
        isItemOnAllSegs={catalog.isItemOnAllSegs}
        onAdjustQuantity={catalog.adjustItemQuantity}
        onSetQuantity={catalog.setItemQuantity}
        onAddToFloor={catalog.setPendingFloorItem}
        onReplaceItem={(item) => {
          // Полотняный товар → редактирование floor-позиции
          if (item.isWallItem === false) {
            const fi = (state.floorItems ?? []).find(f => f.priceId === item.priceId);
            if (fi) catalog.setEditingFloorId(fi.id);
            return;
          }
          // Стеновой → замена в сегменте (берём первый сегмент с этим товаром);
          // это установит catalog.editingSegRef, который уже отслеживается эффектом
          // выше и откроет барабан замены на мобиле.
          const seg = state.segments.find(s => (s.items ?? []).some(it => it.priceId === item.priceId));
          if (seg) catalog.setEditingSegRef({ segId: seg.id, priceId: item.priceId });
        }}
        onHoverItem={catalog.setHoveredPriceId}
      />
    </>
  );
}

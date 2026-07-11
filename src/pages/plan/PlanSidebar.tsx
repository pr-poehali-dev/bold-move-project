import type { PlanState, SegmentPriceItem } from "./planTypes";
import DrawingTab from "./PlanSidebarDrawingTab";
import CalcTab    from "./PlanSidebarCalcTab";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onSectionOpen?: () => void;
  noAutoOpen?: boolean;
  onOpenCatalog?: () => void;
  onRemoveItem?: (segId: string, priceId: number) => void;
  onUpdateQuantity?: (segId: string, priceId: number, quantity: number) => void;
  onRemoveFloorItem?: (id: string) => void;
  onUpdateFloorQuantity?: (id: string, quantity: number) => void;
  onHideMaterialsButton?: () => void;
  onShowMaterialsButton?: () => void;
  // Быстрые функции для позиций в "Материалах" (как в нижнем баре)
  onRemoveActiveItem?: (priceId: number) => void;
  onAssignToAllSegs?: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs?: (priceId: number) => void;
  isItemOnAllSegs?: (priceId: number) => boolean;
  onAdjustQuantity?: (priceId: number, delta: number) => void;
  onSetQuantity?: (priceId: number, value: number) => void;
  onAddToFloor?: (item: SegmentPriceItem) => void;
  onReplaceItem?: (item: SegmentPriceItem) => void;
  onDragItemStart?: (item: SegmentPriceItem, clientX: number, clientY: number) => void;
  onAddToCategory?: (category: string) => void;
}

export default function PlanSidebar({ state, onChange, onSectionOpen, noAutoOpen, onRemoveItem, onUpdateQuantity, onRemoveFloorItem, onUpdateFloorQuantity, onHideMaterialsButton, onShowMaterialsButton, onRemoveActiveItem, onAssignToAllSegs, onRemoveFromAllSegs, isItemOnAllSegs, onAdjustQuantity, onSetQuantity, onAddToFloor, onReplaceItem, onDragItemStart, onAddToCategory }: Props) {
  const { sidebarTab } = state;
  const isDrawing = sidebarTab !== "calc";

  return (
    <div className="h-full flex flex-col bg-[#161616] text-white">
      {/* Переключатель */}
      <div className="px-3 py-2.5 shrink-0 border-b border-white/[0.07]">
        <div className="flex bg-white/[0.06] rounded-xl p-0.5">
          <button
            onClick={() => onChange({ sidebarTab: "drawing" })}
            className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition ${
              isDrawing
                ? "bg-white text-[#111] shadow-sm"
                : "text-white/40 hover:text-white/70"
            }`}>
            Чертёж
          </button>
          <button
            onClick={() => onChange({ sidebarTab: "calc" })}
            className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition ${
              !isDrawing
                ? "bg-white text-[#111] shadow-sm"
                : "text-white/40 hover:text-white/70"
            }`}>
            Материалы
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {isDrawing  && <DrawingTab state={state} onChange={onChange} onSectionOpen={onSectionOpen} noAutoOpen={noAutoOpen} />}
        {!isDrawing && <CalcTab
          state={state}
          onRemoveItem={onRemoveItem}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveFloorItem={onRemoveFloorItem}
          onUpdateFloorQuantity={onUpdateFloorQuantity}
          onHideMaterialsButton={onHideMaterialsButton}
          onShowMaterialsButton={onShowMaterialsButton}
          onRemoveActiveItem={onRemoveActiveItem}
          onAssignToAllSegs={onAssignToAllSegs}
          onRemoveFromAllSegs={onRemoveFromAllSegs}
          isItemOnAllSegs={isItemOnAllSegs}
          onAdjustQuantity={onAdjustQuantity}
          onSetQuantity={onSetQuantity}
          onAddToFloor={onAddToFloor}
          onReplaceItem={onReplaceItem}
          onDragItemStart={onDragItemStart}
          onAddToCategory={onAddToCategory}
        />}
      </div>
    </div>
  );
}
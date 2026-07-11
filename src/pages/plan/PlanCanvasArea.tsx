import PlanCanvas from "./PlanCanvas";
import PlanSidebar from "./PlanSidebar";
import type { PlanState } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";

interface Props {
  displayState: PlanState;
  state: PlanState;
  isMobile: boolean;
  sidebarOpen: boolean;
  sidebarW: number;
  roomLoading: boolean;
  activeRoomName?: string;
  catalog: ReturnType<typeof usePlanCatalog>;
  onSidebarDragStart: (e: React.MouseEvent) => void;
  handleChange: (patch: Partial<PlanState>) => void;
  handleReplace: (patch: Partial<PlanState>) => void;
  onEditSegItem?: (segId: string, priceId: number) => void;
}

export default function PlanCanvasArea({
  displayState,
  state,
  isMobile,
  sidebarOpen,
  sidebarW,
  roomLoading,
  activeRoomName,
  catalog,
  onSidebarDragStart,
  handleChange,
  handleReplace,
  onEditSegItem,
}: Props) {
  // Идёт перетаскивание стенового товара (из барабана или карточки снизу/сбоку) — подсвечиваем все стены
  const draggedItem = catalog.dragItem ?? catalog.dragCardItem;
  const isDraggingWallItem = !!draggedItem && draggedItem.isWallItem !== false;

  return (
    <div className="flex flex-1 overflow-hidden relative min-h-0">

      <div id="plan-canvas-wrap" className="flex-1 overflow-hidden relative">
        <PlanCanvas
          state={displayState}
          eventState={state}
          onChange={handleChange}
          onReplace={handleReplace}
          onOpenCatalog={() => catalog.setCatalogOpen(true)}
          onEditFloorItem={catalog.setEditingFloorId}
          onEditSegItem={onEditSegItem ?? ((segId, priceId) => catalog.setEditingSegRef({ segId, priceId }))}
          isDraggingWallItem={isDraggingWallItem}
        />
        {roomLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
            style={{ background: "rgba(7,7,15,0.75)", backdropFilter: "blur(4px)" }}>
            <div className="w-10 h-10 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mb-3" />
            <span className="text-white/50 text-[13px] font-medium">
              Загружаем {activeRoomName}…
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
            // Быстрые функции для позиций (те же, что в нижнем баре)
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
              // Стеновой → замена в сегменте (берём первый сегмент с этим товаром)
              const seg = state.segments.find(s => (s.items ?? []).some(it => it.priceId === item.priceId));
              if (seg) catalog.setEditingSegRef({ segId: seg.id, priceId: item.priceId });
            }}
            onDragItemStart={catalog.startSidebarDrag}
            onAddToCategory={(category) => {
              catalog.setReplaceCatalogCategory(category);
              catalog.setCatalogOpen(true);
            }}
          />
        </div>
      </>)}

    </div>
  );
}
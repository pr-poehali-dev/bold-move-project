import type { PlanState } from "./planTypes";
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
}

export default function PlanSidebar({ state, onChange, onSectionOpen, noAutoOpen, onOpenCatalog, onRemoveItem, onUpdateQuantity, onRemoveFloorItem, onUpdateFloorQuantity }: Props) {
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
        {!isDrawing && <CalcTab state={state} onRemoveItem={onRemoveItem} onUpdateQuantity={onUpdateQuantity} onRemoveFloorItem={onRemoveFloorItem} onUpdateFloorQuantity={onUpdateFloorQuantity} />}
      </div>
    </div>
  );
}
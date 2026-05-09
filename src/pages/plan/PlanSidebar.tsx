import type { PlanState } from "./planTypes";
import DrawingTab from "./PlanSidebarDrawingTab";
import CalcTab    from "./PlanSidebarCalcTab";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onSectionOpen?: () => void;
  noAutoOpen?: boolean;
  onOpenCatalog?: () => void;
}

export default function PlanSidebar({ state, onChange, onSectionOpen, noAutoOpen, onOpenCatalog }: Props) {
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
            onClick={() => onOpenCatalog?.()}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition text-white/40 hover:text-white/70">
            Номенклатура
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {isDrawing  && <DrawingTab state={state} onChange={onChange} onSectionOpen={onSectionOpen} noAutoOpen={noAutoOpen} />}
        {!isDrawing && <CalcTab    state={state} />}
      </div>
    </div>
  );
}
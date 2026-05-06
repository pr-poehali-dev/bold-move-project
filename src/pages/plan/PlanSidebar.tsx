import Icon from "@/components/ui/icon";
import type { PlanState, SidebarTab } from "./planTypes";
import DrawingTab from "./PlanSidebarDrawingTab";
import CalcTab    from "./PlanSidebarCalcTab";
import LegendTab  from "./PlanSidebarLegendTab";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

// ─── Главный сайдбар ──────────────────────────────────────────────────────────
export default function PlanSidebar({ state, onChange }: Props) {
  const { sidebarTab } = state;

  const tabs: { id: SidebarTab; label: string; icon: string }[] = [
    { id: "drawing", label: "Чертёж",  icon: "PenTool" },
    { id: "calc",    label: "Расчёт",  icon: "Calculator" },
    { id: "legend",  label: "Легенда", icon: "BookOpen" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0d0d0d] text-white">
      {/* Вкладки */}
      <div className="flex border-b border-white/[0.07] shrink-0">
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => onChange({ sidebarTab: t.id })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition border-b-2 ${
              sidebarTab === t.id
                ? "border-white text-white bg-white/[0.04]"
                : "border-transparent text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
            }`}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === "drawing" && <DrawingTab state={state} onChange={onChange} />}
        {sidebarTab === "calc"    && <CalcTab state={state} />}
        {sidebarTab === "legend"  && <LegendTab />}
      </div>
    </div>
  );
}
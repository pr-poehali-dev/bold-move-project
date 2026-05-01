import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";

interface Props {
  c: DemoPipelineCompany;
  onMove: (status: DemoStatus) => void;
}

export function WLPipelineActionButtons({ c, onMove }: Props) {
  const btn = "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition";
  return (
    <div className="flex gap-1.5 pt-2.5 mt-2.5 border-t border-white/[0.06]"
      onClick={e => e.stopPropagation()}>
      {DEMO_STATUSES.filter(s => s.id !== "presented").map(s => {
        const active = c.status === s.id;
        return (
          <button key={s.id} onClick={() => !active && onMove(s.id)}
            disabled={active}
            className={btn}
            style={{
              background: active ? s.bg : "rgba(255,255,255,0.04)",
              color:      active ? s.color : "rgba(255,255,255,0.3)",
              border:     `1px solid ${active ? s.color + "50" : "transparent"}`,
              cursor:     active ? "default" : "pointer",
            }}>
            {active && <Icon name="Check" size={9} />}
            {s.label}
          </button>
        );
      })}
      {c.status === "presented" && (() => {
        const s = DEMO_STATUSES.find(st => st.id === "presented")!;
        return (
          <div className={btn} style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}50` }}>
            <Icon name="Check" size={9} /> {s.label}
          </div>
        );
      })()}
    </div>
  );
}

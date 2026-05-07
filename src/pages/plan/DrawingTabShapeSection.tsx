import React from "react";
import type { PlanState, RoomParams } from "./planTypes";
import { calcScale } from "./planTypes";
import { Section } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  displayPerimM: number | null;
  areaM2: number | null;
  updateRoom: (patch: Partial<RoomParams>) => void;
}

const lbl10 = "block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1";

export default function DrawingTabShapeSection({ state, displayPerimM, areaM2, updateRoom }: Props) {
  const { points, room } = state;

  return (
    <Section title="Фигура" icon="Pentagon" iconColor="#a78bfa" defaultOpen={false}>
      <div className="mb-3">
        <label className={lbl10}>Активная фигура</label>
        <input value={room.name}
          onChange={e => updateRoom({ name: e.target.value })}
          className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {([
          ["Периметр", displayPerimM ? `${displayPerimM} м` : "—", "#60a5fa"],
          ["Площадь",  areaM2 ? `${areaM2} м²` : "—", "#34d399"],
          ["Углов",    points.length.toString(), "#a78bfa"],
        ] as const).map(([l, v, c]) => (
          <div key={l} className="bg-white/[0.04] rounded-xl p-2 text-center border border-white/[0.06]">
            <div className="text-[9px] text-white/30 mb-0.5 uppercase tracking-wide">{l}</div>
            <div className="text-[13px] font-bold" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

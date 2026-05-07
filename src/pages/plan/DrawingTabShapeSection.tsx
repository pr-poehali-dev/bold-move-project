import React from "react";
import type { PlanState, RoomParams } from "./planTypes";

import { Section } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  displayPerimM: number | null;
  areaM2: number | null;
  updateRoom: (patch: Partial<RoomParams>) => void;
  onSectionOpen?: () => void;
}

const lbl10 = "block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1";

export default function DrawingTabShapeSection({ state, displayPerimM, areaM2, updateRoom }: Props) {
  const { points, room } = state;

  return (
    <Section title="Фигура" icon="Pentagon" iconColor="#a78bfa" defaultOpen={false} onOpen={onSectionOpen}>
      <div className="mb-3">
        <label className={lbl10}>Активная фигура</label>
        <input value={room.name}
          onChange={e => updateRoom({ name: e.target.value })}
          className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3">
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

      {/* Параметры помещения */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className={lbl10}>Высота до потолка, см</label>
          <input type="number" min={100} max={500} step={1}
            value={room.floorToCeilCm ?? ""}
            placeholder="—"
            onChange={e => updateRoom({ floorToCeilCm: e.target.value ? Number(e.target.value) : null })}
            className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
          />
        </div>
        <div>
          <label className={lbl10}>Мансардный потолок</label>
          <button
            onClick={() => updateRoom({ mansardCeiling: !room.mansardCeiling })}
            className={`w-full py-2 px-3 rounded-xl text-[12px] font-semibold border transition mt-0 ${
              room.mansardCeiling
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-white/[0.05] border-white/[0.1] text-white/40"
            }`}
          >
            {room.mansardCeiling ? "Да" : "Нет"}
          </button>
        </div>
      </div>
      <div>
        <label className={lbl10}>Опуск от бетона, мм</label>
        <input type="number" min={0} max={500} step={1}
          value={room.concreteDipMm ?? ""}
          placeholder="—"
          onChange={e => updateRoom({ concreteDipMm: e.target.value ? Number(e.target.value) : null })}
          className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
        />
      </div>
    </Section>
  );
}
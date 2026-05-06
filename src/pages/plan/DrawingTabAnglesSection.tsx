import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, PlanSettings } from "./planTypes";
import { pointLabel, angleDeg, polygonOrientation } from "./planTypes";
import { Section } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  updateSettings: (patch: Partial<PlanSettings>) => void;
}

export default function DrawingTabAnglesSection({ state, onChange, updateSettings }: Props) {
  const { points, isClosed, settings } = state;
  const isCW = polygonOrientation(points) > 0;

  const getAngle = (idx: number) => {
    if (!isClosed || points.length < 3) return null;
    const n = points.length;
    return angleDeg(points[(idx - 1 + n) % n], points[idx], points[(idx + 1) % n], isCW);
  };

  return (
    <Section title="Углы" icon="Angle" iconColor="#fbbf24"
      visible={settings.showAngleLabels}
      onVisibilityToggle={() => updateSettings({ showAngleLabels: !settings.showAngleLabels })}
      badge={points.length > 0 ? String(points.length) : undefined}
      defaultOpen={false}>

      {points.length === 0
        ? <p className="text-[11px] text-white/20 text-center py-3">Нет точек</p>
        : (<>
          {/* Быстрые действия */}
          <div className="flex gap-1.5 mb-2">
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold border bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition"
              onClick={() => onChange({ phase: "angles", activeInputIndex: 0 })} title="Режим ввода углов">
              <Icon name="Target" size={11} />
              Ввод углов
            </button>
            <button
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08] transition"
              title="Все углы прямые">
              Все прямые
            </button>
          </div>

          {/* Пресеты */}
          <div className="flex gap-1.5 mb-2">
            {[90, 180, 270].map(deg => (
              <button key={deg}
                className="flex-1 py-1 rounded-lg text-[11px] font-bold border bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition"
                title={`${deg}° → следующий`}
                onClick={() => onChange({ activeInputIndex: (state.activeInputIndex + 1) % Math.max(1, points.length) })}>
                {deg}°
              </button>
            ))}
          </div>

          {/* Список углов */}
          <div className="space-y-0.5">
            {points.map((pt, idx) => {
              const deg = getAngle(idx);
              const isOdd = deg !== null && Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
              return (
                <div key={pt.id}
                  className="flex items-center gap-1.5 py-1 px-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-default">
                  <Icon name="Angle" size={11} className="text-amber-500/60 shrink-0" />
                  <span className="w-7 text-[11px] font-mono font-bold text-amber-300 shrink-0">{pointLabel(idx)}</span>
                  <div className={`flex-1 bg-white/[0.05] border rounded-lg px-2 py-1 text-[11px] font-mono text-center
                    ${isOdd ? "text-rose-300 border-rose-500/30 bg-rose-500/5" : "text-white/60 border-white/[0.08]"}`}>
                    {deg !== null ? `${deg}°` : "—"}
                  </div>
                  <button onClick={e => { e.stopPropagation(); onChange({ selectedPointId: pt.id }); }}
                    className="p-1 rounded hover:bg-white/10 transition shrink-0">
                    <Icon name="Eye" size={11} className="text-white/25" />
                  </button>
                </div>
              );
            })}
          </div>
        </>)
      }
    </Section>
  );
}

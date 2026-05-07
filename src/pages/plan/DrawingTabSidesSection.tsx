import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, Segment, PlanSettings } from "./planTypes";
import { segmentLabel, pointLabel, checkClosureError } from "./planTypes";
import { Section, LengthRow } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  inputRefs: React.MutableRefObject<React.RefObject<HTMLInputElement>[]>;
  updateSegment: (id: string, patch: Partial<Segment>) => void;
  updateSettings: (patch: Partial<PlanSettings>) => void;
  focusNext: (idx: number) => void;
  onFocusDiagonal?: () => void;
}

export default function DrawingTabSidesSection({
  state, onChange, inputRefs, updateSegment, updateSettings, focusNext, onFocusDiagonal,
}: Props) {
  const { points, segments, isClosed, settings } = state;
  const closureErr = isClosed ? checkClosureError(points, segments, state.baseScale ?? null) : null;

  return (
    <>
      {/* ── Стороны ── */}
      <Section title="Стороны, см" icon="Ruler" iconColor="#60a5fa"
        visible={settings.showSegmentLabels}
        onVisibilityToggle={() => updateSettings({ showSegmentLabels: !settings.showSegmentLabels })}
        badge={segments.length > 0 ? String(segments.length) : undefined}
        defaultOpen={false}
        forceOpen={isClosed}>

        {closureErr !== null && closureErr > 2 && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2">
              <Icon name="AlertTriangle" size={13} className="text-yellow-400 shrink-0" />
              <span className="text-[11px] font-semibold text-yellow-300">
                Погрешность {closureErr}%
              </span>
            </div>
            {onFocusDiagonal && (
              <button
                onClick={onFocusDiagonal}
                className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/25 transition">
                <Icon name="ArrowUpRight" size={11} />
                Ввести диагональ
              </button>
            )}
          </div>
        )}

        {segments.length === 0
          ? <p className="text-[11px] text-white/20 text-center py-3">Нет отрезков</p>
          : (
            <div className="space-y-0.5">
              {segments.map((seg, idx) => (
                <LengthRow key={seg.id}
                  label={segmentLabel(points, seg)}
                  valueCm={seg.lengthCm}
                  placeholder="—"
                  visible={seg.showLength}
                  inputRef={inputRefs.current[idx]}
                  autoFocus={idx === 0 && isClosed}
                  highlighted={state.changedSegmentIds?.includes(seg.id)}
                  autoRecalc={state.changedSegmentIds?.includes(seg.id)}
                  onValueChange={v => updateSegment(seg.id, { lengthCm: v })}
                  onVisibilityToggle={() => updateSegment(seg.id, { showLength: !seg.showLength })}
                  onFocus={() => {
                    onChange({
                      activeInputIndex: idx,
                      changedSegmentIds: (state.changedSegmentIds ?? []).filter(id => id !== seg.id),
                    });
                  }}
                  onEnterNext={idx < segments.length - 1 ? () => focusNext(idx) : undefined}
                />
              ))}
            </div>
          )
        }

        <button onClick={() => updateSettings({ showDimLines: !settings.showDimLines })}
          className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
            settings.showDimLines
              ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
              : "bg-white/[0.03] border-white/[0.07] text-white/30"
          }`}>
          <Icon name="ArrowLeftRight" size={11} />
          {settings.showDimLines ? "Размерные линии вкл" : "Размерные линии выкл"}
        </button>
      </Section>

      {/* ── Скругления углов ── */}
      {segments.length > 0 && isClosed && (
        <Section title="Скругления углов" icon="Spline" iconColor="#10b981" defaultOpen={false}>
          <p className="text-[10px] text-white/30 mb-2 leading-relaxed">
            Скругление применяется к углу входящего конца каждого отрезка. Значение в пикселях холста.
          </p>
          <div className="space-y-1.5">
            {segments.map(seg => {
              const toIdx = points.findIndex(p => p.id === seg.toId);
              if (toIdx < 0) return null;
              return (
                <div key={`arc-${seg.id}`} className="flex items-center gap-2">
                  <span className="w-8 text-[11px] font-mono font-bold text-white/50 shrink-0">{pointLabel(toIdx)}</span>
                  <div className="flex-1 flex items-center gap-2 bg-white/[0.04] rounded-xl px-2 py-1.5 border border-white/[0.06]">
                    <input type="range" min={0} max={120} step={5}
                      value={seg.arcRadius}
                      onChange={e => updateSegment(seg.id, { arcRadius: Number(e.target.value) })}
                      className="flex-1 accent-emerald-500 h-1.5"
                    />
                    <input type="number" min={0} max={120} step={1}
                      value={seg.arcRadius || ""}
                      placeholder="0"
                      onChange={e => updateSegment(seg.id, { arcRadius: Number(e.target.value) || 0 })}
                      className="w-12 bg-transparent text-[11px] text-white/70 font-mono text-right focus:outline-none"
                    />
                    <span className="text-[9px] text-white/25 shrink-0">px</span>
                  </div>
                  {seg.arcRadius > 0 && (
                    <button onClick={() => updateSegment(seg.id, { arcRadius: 0 })}
                      className="p-1 rounded hover:bg-white/10 transition shrink-0" title="Сбросить">
                      <Icon name="X" size={10} className="text-white/30" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => segments.forEach(seg => updateSegment(seg.id, { arcRadius: 20 }))}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition">
              Все: 20px
            </button>
            <button onClick={() => segments.forEach(seg => updateSegment(seg.id, { arcRadius: 0 }))}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold border bg-white/[0.04] border-white/[0.08] text-white/35 hover:bg-white/[0.08] transition">
              Сбросить все
            </button>
          </div>
        </Section>
      )}
    </>
  );
}
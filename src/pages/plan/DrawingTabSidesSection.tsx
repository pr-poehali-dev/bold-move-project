import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, Segment, PlanSettings } from "./planTypes";
import { segmentLabel, checkClosureError } from "./planTypes";
import { Section, LengthRow } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  inputRefs: React.MutableRefObject<React.RefObject<HTMLInputElement>[]>;
  updateSegment: (id: string, patch: Partial<Segment>) => void;
  updateSettings: (patch: Partial<PlanSettings>) => void;
  focusNext: (idx: number) => void;
  onFocusDiagonal?: () => void;
  lastChangedSegId: string | null;
  onFlipSegment: (id: string) => void;
}

export default function DrawingTabSidesSection({
  state, onChange, inputRefs, updateSegment, updateSettings, focusNext, onFocusDiagonal,
  lastChangedSegId, onFlipSegment,
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
                  highlighted={!!state.isBuilt && (state.changedSegmentIds?.includes(seg.id) ?? false)}
                  autoRecalc={!!state.isBuilt && (state.changedSegmentIds?.includes(seg.id) ?? false)}
                  onValueChange={v => updateSegment(seg.id, { lengthCm: v })}
                  onVisibilityToggle={() => updateSegment(seg.id, { showLength: !seg.showLength })}
                  onFlipDirection={seg.id === lastChangedSegId ? () => onFlipSegment(seg.id) : undefined}
                  onFocus={() => {
                    onChange({
                      activeInputIndex: idx,
                      // В режиме построения — всегда чисто. В режиме редактирования — убираем только этот сегмент.
                      changedSegmentIds: state.isBuilt
                        ? (state.changedSegmentIds ?? []).filter(id => id !== seg.id)
                        : [],
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


    </>
  );
}
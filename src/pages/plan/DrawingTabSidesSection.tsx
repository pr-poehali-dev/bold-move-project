import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, Segment, PlanSettings } from "./planTypes";
import { segmentLabel, checkClosureError } from "./planTypes";
import { Section, LengthRow } from "./PlanSidebarShared";
import usePlanVoiceInput from "./usePlanVoiceInput";

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
  onSectionOpen?: () => void;
  noAutoOpen?: boolean;
}

export default function DrawingTabSidesSection({
  state, onChange, inputRefs, updateSegment, updateSettings, focusNext, onFocusDiagonal,
  lastChangedSegId, onFlipSegment, onSectionOpen, noAutoOpen,
}: Props) {
  const { points, segments, isClosed, settings } = state;
  const closureErr = isClosed ? checkClosureError(points, segments, state.baseScale ?? null) : null;

  const voice = usePlanVoiceInput({
    segments,
    onUpdateSegment: updateSegment,
  });

  return (
    <>
      {/* ── Стороны ── */}
      <Section title="Стороны" icon="Ruler" iconColor="#60a5fa"
        visible={settings.showSegmentLabels}
        onVisibilityToggle={() => updateSettings({ showSegmentLabels: !settings.showSegmentLabels })}
        badge={segments.length > 0 ? String(segments.length) : undefined}
        defaultOpen={false}
        forceOpen={noAutoOpen ? false : isClosed}
        onOpen={onSectionOpen}>

        {closureErr !== null && closureErr > 0.5 && (
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

        {/* Кнопка голосового ввода — только если форма замкнута и браузер поддерживает */}
        {isClosed && segments.length > 0 && voice.hasSpeech && (
          <div className="mb-2">
            {/* Мобиле — яркая кнопка */}
            <button
              onClick={voice.toggle}
              className={`sm:hidden w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-bold transition-all shadow-lg ${
                voice.isListening
                  ? "bg-red-500/20 border-red-400/50 text-red-300 animate-pulse shadow-red-500/20"
                  : "border-violet-500/50 text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
              }`}
              style={voice.isListening ? {} : {
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.45)",
              }}
            >
              <div className={`flex items-center justify-center w-6 h-6 rounded-full ${voice.isListening ? "bg-red-400/20" : "bg-white/20"}`}>
                <Icon name={voice.isListening ? "MicOff" : "Mic"} size={14} />
              </div>
              {voice.isListening
                ? `Слушаю... сторона ${segmentLabel(points, segments[voice.activeIdx]) ?? voice.activeIdx + 1}`
                : "Диктовать размеры"}
            </button>
            {/* Десктоп — заметная, но не кричащая */}
            <button
              onClick={voice.toggle}
              className={`hidden sm:flex w-full items-center justify-center gap-1.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
                voice.isListening
                  ? "bg-red-500/15 border-red-400/30 text-red-400 animate-pulse"
                  : "border-violet-500/30 text-violet-300 hover:border-violet-400/60 hover:text-violet-200 hover:bg-violet-500/10"
              }`}
            >
              <Icon name={voice.isListening ? "MicOff" : "Mic"} size={13} />
              {voice.isListening
                ? `Слушаю... сторона ${segmentLabel(points, segments[voice.activeIdx]) ?? voice.activeIdx + 1}`
                : "Диктовать размеры"}
            </button>
            {voice.isListening && voice.interimText && (
              <div className="mt-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                <span className="text-[11px] text-white/40 italic">{voice.interimText}</span>
              </div>
            )}
            {voice.isListening && (
              <p className="mt-1 text-[10px] text-white/25 text-center">
                Скажите число → пауза или «следующая» → следующая сторона
              </p>
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
                  firstInput={idx === 0}
                  highlighted={
                    (voice.isListening && voice.activeIdx === idx) ||
                    (!!state.isBuilt && (state.changedSegmentIds?.includes(seg.id) ?? false))
                  }
                  autoRecalc={!!state.isBuilt && (state.changedSegmentIds?.includes(seg.id) ?? false)}
                  onValueChange={v => updateSegment(seg.id, { lengthCm: v })}
                  onVisibilityToggle={() => updateSegment(seg.id, { showLength: !seg.showLength })}
                  onFlipDirection={seg.id === lastChangedSegId ? () => onFlipSegment(seg.id) : undefined}
                  onFocus={() => {
                    onChange({
                      activeInputIndex: idx,
                      // Подсвечиваем сегмент на холсте
                      selectedSegmentId: seg.id,
                      selectedSegmentIds: [seg.id],
                      selectedPointId: null,
                      selectedDiagonalId: null,
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
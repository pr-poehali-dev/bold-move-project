import React, { useEffect, useRef } from "react";
import type { PlanState, Segment } from "./planTypes";
import { segmentLabel } from "./planTypes";

interface Props {
  state: PlanState;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
  onClose: () => void;
}

export default function PlanRightInputPanel({ state, onUpdateSegment, onClose }: Props) {
  const { segments, points } = state;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [values, setValues] = React.useState<string[]>(() =>
    segments.map(s => (s.lengthCm != null ? String(s.lengthCm) : ""))
  );

  // Синхронизируем значения при смене сегментов
  useEffect(() => {
    setValues(segments.map(s => (s.lengthCm != null ? String(s.lengthCm) : "")));
    inputRefs.current = inputRefs.current.slice(0, segments.length);
  }, [segments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Фокус на первый пустой инпут при открытии
  useEffect(() => {
    const firstEmpty = segments.findIndex(s => s.lengthCm == null || s.lengthCm <= 0);
    const idx = firstEmpty >= 0 ? firstEmpty : 0;
    setTimeout(() => {
      inputRefs.current[idx]?.focus();
      inputRefs.current[idx]?.select();
    }, 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (idx: number, raw: string) => {
    const v = parseFloat(raw.replace(",", "."));
    if (!isNaN(v) && v > 0) {
      onUpdateSegment(segments[idx].id, { lengthCm: v });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(idx, values[idx]);
      if (idx < segments.length - 1) {
        setTimeout(() => {
          inputRefs.current[idx + 1]?.focus();
          inputRefs.current[idx + 1]?.select();
        }, 30);
      } else {
        // Последний отрезок — закрываем панель
        onClose();
      }
    }
  };

  const handleChange = (idx: number, val: string) => {
    const next = [...values];
    next[idx] = val;
    setValues(next);
  };

  const handleBlur = (idx: number) => {
    commit(idx, values[idx]);
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-30 flex flex-col bg-[#12131e] border-l border-white/[0.08] shadow-2xl"
      style={{ width: 160 }}
    >
      {/* Заголовок */}
      <div className="flex items-center justify-between px-3 pt-4 pb-2 shrink-0">
        <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Стороны</span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 transition"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Список сторон */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1.5">
        {segments.map((seg, idx) => {
          const label = segmentLabel(points, seg);
          const filled = seg.lengthCm != null && seg.lengthCm > 0;
          return (
            <div key={seg.id} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-white/35 px-1">{label}</span>
              <div className="relative flex items-center">
                <input
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="decimal"
                  value={values[idx]}
                  placeholder="—"
                  onChange={e => handleChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                  onBlur={() => handleBlur(idx)}
                  onFocus={e => e.target.select()}
                  className={`w-full rounded-lg border px-2.5 py-2 text-[13px] font-semibold text-right pr-8 outline-none transition bg-transparent
                    ${filled
                      ? "border-white/[0.12] text-white"
                      : "border-white/[0.07] text-white/50 focus:border-violet-500/60 focus:text-white"
                    }
                    focus:border-violet-500/60 focus:bg-violet-500/5
                  `}
                />
                <span className="absolute right-2.5 text-[10px] text-white/25 pointer-events-none">см</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Подсказка */}
      <div className="px-3 pb-4 shrink-0">
        <p className="text-[10px] text-white/20 text-center leading-snug">
          Enter — следующая<br/>сторона
        </p>
      </div>
    </div>
  );
}

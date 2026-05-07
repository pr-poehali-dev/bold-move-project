import React, { useEffect, useRef } from "react";
import type { PlanState, Segment, DiagonalDef } from "./planTypes";
import { segmentLabel, pointLabel, angleDeg, polygonOrientation, distPx, calcScale, pxToCm } from "./planTypes";

export const PANEL_WIDTH = 128;

type Tab = "sides" | "diagonals" | "angles";

interface Props {
  state: PlanState;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
  onUpdateDiagonal: (id: string, patch: Partial<DiagonalDef>) => void;
  onClose: () => void;
}

export default function PlanRightInputPanel({ state, onUpdateSegment, onUpdateDiagonal, onClose }: Props) {
  const { segments, points, diagonals } = state;
  const [tab, setTab] = React.useState<Tab>("sides");

  // ── Стороны ──
  const segInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [segValues, setSegValues] = React.useState<string[]>(() =>
    segments.map(s => (s.lengthCm != null ? String(s.lengthCm) : ""))
  );

  useEffect(() => {
    setSegValues(segments.map(s => (s.lengthCm != null ? String(s.lengthCm) : "")));
  }, [segments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Фокус на первый пустой при открытии
  useEffect(() => {
    const firstEmpty = segments.findIndex(s => s.lengthCm == null || s.lengthCm <= 0);
    const idx = firstEmpty >= 0 ? firstEmpty : 0;
    setTimeout(() => {
      segInputRefs.current[idx]?.focus();
      segInputRefs.current[idx]?.select();
    }, 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commitSeg = (idx: number, raw: string) => {
    const v = parseFloat(raw.replace(",", "."));
    if (!isNaN(v) && v > 0) onUpdateSegment(segments[idx].id, { lengthCm: v });
  };

  const handleSegKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitSeg(idx, segValues[idx]);
      if (idx < segments.length - 1) {
        setTimeout(() => { segInputRefs.current[idx + 1]?.focus(); segInputRefs.current[idx + 1]?.select(); }, 30);
      } else {
        onClose();
      }
    }
  };

  // ── Диагонали ──
  const diagInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [diagValues, setDiagValues] = React.useState<string[]>(() =>
    diagonals.map(d => (d.lengthCm != null ? String(d.lengthCm) : ""))
  );

  useEffect(() => {
    setDiagValues(diagonals.map(d => (d.lengthCm != null ? String(d.lengthCm) : "")));
  }, [diagonals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitDiag = (idx: number, raw: string) => {
    const v = parseFloat(raw.replace(",", "."));
    if (!isNaN(v) && v > 0) onUpdateDiagonal(diagonals[idx].id, { lengthCm: v });
  };

  const handleDiagKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDiag(idx, diagValues[idx]);
      if (idx < diagonals.length - 1) {
        setTimeout(() => { diagInputRefs.current[idx + 1]?.focus(); diagInputRefs.current[idx + 1]?.select(); }, 30);
      }
    }
  };

  // ── Углы (только отображение) ──
  const isCW = polygonOrientation(points) > 0;
  const getAngle = (idx: number) => {
    if (!state.isClosed || points.length < 3) return null;
    const n = points.length;
    return angleDeg(points[(idx - 1 + n) % n], points[idx], points[(idx + 1) % n], isCW);
  };

  // ── Авто-подсчёт длины диагонали из координат ──
  const scale = calcScale(points, segments);
  const diagAutoLen = (d: DiagonalDef) => {
    const a = points.find(p => p.id === d.fromId);
    const b = points.find(p => p.id === d.toId);
    if (!a || !b) return null;
    return pxToCm(distPx(a, b), scale);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "sides",     label: "Ст" },
    { id: "diagonals", label: "Дг" },
    { id: "angles",    label: "Ур" },
  ];

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-30 flex flex-col bg-[#12131e] border-l border-white/[0.08] shadow-2xl"
      style={{ width: PANEL_WIDTH }}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-2.5 pt-3 pb-2 shrink-0">
        <div className="flex gap-0.5 bg-white/[0.05] rounded-lg p-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                tab === t.id
                  ? "bg-white text-[#111]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-white/25 hover:text-white/60 transition"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">

        {/* Стороны */}
        {tab === "sides" && segments.map((seg, idx) => {
          const label = segmentLabel(points, seg);
          const filled = seg.lengthCm != null && seg.lengthCm > 0;
          return (
            <div key={seg.id} className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold text-white/30 px-0.5 uppercase tracking-wide">{label}</span>
              <div className="relative flex items-center">
                <input
                  ref={el => { segInputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="decimal"
                  value={segValues[idx]}
                  placeholder="—"
                  onChange={e => { const next = [...segValues]; next[idx] = e.target.value; setSegValues(next); }}
                  onKeyDown={e => handleSegKey(e, idx)}
                  onBlur={() => commitSeg(idx, segValues[idx])}
                  onFocus={e => e.target.select()}
                  className={`w-full rounded-lg border px-2 py-1.5 text-[12px] font-semibold text-right pr-6 outline-none transition bg-transparent
                    ${filled ? "border-white/[0.12] text-white" : "border-white/[0.07] text-white/50"}
                    focus:border-violet-500/60 focus:bg-violet-500/5 focus:text-white`}
                />
                <span className="absolute right-1.5 text-[9px] text-white/25 pointer-events-none">см</span>
              </div>
            </div>
          );
        })}

        {/* Диагонали */}
        {tab === "diagonals" && (
          diagonals.length === 0
            ? <p className="text-[10px] text-white/25 text-center pt-4">Нет диагоналей</p>
            : diagonals.map((diag, idx) => {
                const idxA = points.findIndex(p => p.id === diag.fromId);
                const idxB = points.findIndex(p => p.id === diag.toId);
                const label = `${pointLabel(idxA)}-${pointLabel(idxB)}`;
                const auto = diagAutoLen(diag);
                const filled = diag.lengthCm != null && diag.lengthCm > 0;
                return (
                  <div key={diag.id} className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-white/30 px-0.5 uppercase tracking-wide">{label}</span>
                    <div className="relative flex items-center">
                      <input
                        ref={el => { diagInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="decimal"
                        value={diagValues[idx]}
                        placeholder={auto !== null ? String(auto) : "—"}
                        onChange={e => { const next = [...diagValues]; next[idx] = e.target.value; setDiagValues(next); }}
                        onKeyDown={e => handleDiagKey(e, idx)}
                        onBlur={() => commitDiag(idx, diagValues[idx])}
                        onFocus={e => e.target.select()}
                        className={`w-full rounded-lg border px-2 py-1.5 text-[12px] font-semibold text-right pr-6 outline-none transition bg-transparent
                          ${filled ? "border-white/[0.12] text-white" : "border-white/[0.07] text-white/50"}
                          focus:border-violet-500/60 focus:bg-violet-500/5 focus:text-white`}
                      />
                      <span className="absolute right-1.5 text-[9px] text-white/25 pointer-events-none">см</span>
                    </div>
                  </div>
                );
              })
        )}

        {/* Углы */}
        {tab === "angles" && points.map((pt, idx) => {
          const deg = getAngle(idx);
          const isOdd = deg !== null && Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
          return (
            <div key={pt.id} className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold text-white/30 px-0.5 uppercase tracking-wide">{pointLabel(idx)}</span>
              <div className={`rounded-lg border px-2 py-1.5 text-[12px] font-mono font-semibold text-right transition
                ${isOdd ? "border-rose-500/30 bg-rose-500/5 text-rose-300" : "border-white/[0.07] text-white/60"}`}>
                {deg !== null ? `${deg}°` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Подсказка */}
      <div className="px-2 pb-3 shrink-0">
        <p className="text-[9px] text-white/15 text-center leading-snug">
          {tab === "sides" ? "Enter → след. сторона" : tab === "diagonals" ? "Enter → след. диагональ" : "Только просмотр"}
        </p>
      </div>
    </div>
  );
}

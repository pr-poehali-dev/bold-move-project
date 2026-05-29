import React, { useEffect, useRef, useState, useCallback } from "react";
import type { PlanState, Segment, DiagonalDef } from "./planTypes";
import { segmentLabel, pointLabel, angleDeg, polygonOrientation, distPx, calcScale, pxToCm } from "./planTypes";
import Icon from "@/components/ui/icon";
import usePlanVoiceInput from "./usePlanVoiceInput";

export const PANEL_WIDTH = 80;

type Tab = "sides" | "diagonals" | "angles";

interface Props {
  state: PlanState;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
  onUpdateDiagonal: (id: string, patch: Partial<DiagonalDef>) => void;
  onChange?: (patch: Partial<PlanState>) => void;
  onClose: () => void;
  focusSegmentId?: string | null;
}

export default function PlanRightInputPanel({ state, onUpdateSegment, onUpdateDiagonal, onChange, onClose, focusSegmentId }: Props) {
  const { segments, points, diagonals } = state;
  const [tab, setTab] = React.useState<Tab>("sides");
  const [dropOpen, setDropOpen] = useState(false);

  // Свайп вправо — закрыть панель
  const swipeRef = useRef<{ startX: number; startY: number } | null>(null);
  const [swipeDx, setSwipeDx] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
    setSwipeDx(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current) return;
    const dx = e.touches[0].clientX - swipeRef.current.startX;
    const dy = Math.abs(e.touches[0].clientY - swipeRef.current.startY);
    if (dy > 20) { swipeRef.current = null; return; } // вертикальный скролл — игнорируем
    if (dx > 0) setSwipeDx(dx);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (swipeDx > PANEL_WIDTH * 0.5) onClose();
    else setSwipeDx(0);
    swipeRef.current = null;
  }, [swipeDx, onClose]);

  // ── Стороны ──
  const segInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [segValues, setSegValues] = React.useState<string[]>(() =>
    segments.map(s => (s.lengthCm != null ? String(s.lengthCm) : ""))
  );

  useEffect(() => {
    setSegValues(prev => segments.map((s, i) => {
      const fromState = s.lengthCm != null ? String(s.lengthCm) : "";
      const current = prev[i] ?? "";
      // Если в state есть значение — берём его (источник правды)
      if (fromState !== "") return fromState;
      // Если в state пусто, но в prev уже что-то записано голосом — сохраняем
      if (current !== "") return current;
      return "";
    }));
  }, [segments]);  

  // Фокус: на конкретный сегмент (если передан) или первый пустой
  useEffect(() => {
    let idx = 0;
    if (focusSegmentId) {
      const found = segments.findIndex(s => s.id === focusSegmentId);
      if (found >= 0) { idx = found; setTab("sides"); }
    } else {
      const firstEmpty = segments.findIndex(s => s.lengthCm == null || s.lengthCm <= 0);
      idx = firstEmpty >= 0 ? firstEmpty : 0;
    }
    setTimeout(() => {
      segInputRefs.current[idx]?.focus();
      segInputRefs.current[idx]?.select();
    }, 80);
  }, [focusSegmentId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Голосовой ввод ──
  const voice = usePlanVoiceInput({
    segments,
    onUpdateSegment,
  });

  // ── Авто-подсчёт длины диагонали из координат ──
  const scale = calcScale(points, segments);
  const diagAutoLen = (d: DiagonalDef) => {
    const a = points.find(p => p.id === d.fromId);
    const b = points.find(p => p.id === d.toId);
    if (!a || !b) return null;
    return pxToCm(distPx(a, b), scale);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "sides",     label: "Стороны" },
    { id: "diagonals", label: "Диагонали" },
    { id: "angles",    label: "Углы" },
  ];
  const currentLabel = TABS.find(t => t.id === tab)?.label ?? "Стороны";

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-30 flex flex-col bg-[#12131e] border-l border-white/[0.08] shadow-2xl"
      style={{
        width: PANEL_WIDTH,
        transform: swipeDx > 0 ? `translateX(${swipeDx}px)` : undefined,
        transition: swipeDx === 0 ? "transform 0.2s ease" : "none",
        opacity: swipeDx > 0 ? Math.max(0.3, 1 - swipeDx / PANEL_WIDTH) : 1,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Шапка */}
      <div className="flex items-center justify-between px-2 pt-3 pb-2 shrink-0 relative">
        {/* Дропдаун-кнопка */}
        <div className="relative">
          <button
            onClick={() => setDropOpen(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/[0.1] transition"
          >
            {currentLabel}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${dropOpen ? "rotate-180" : ""}`}>
              <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {dropOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#1e1f2e] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden min-w-[110px]">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setDropOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition ${
                    tab === t.id
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Кнопка микрофона — только на вкладке Стороны */}
          {/* Иконка микрофона в шапке убрана — кнопка есть в контенте */}
          <button
            onClick={onClose}
            className="w-5 h-5 rounded flex items-center justify-center text-white/25 hover:text-white/60 transition"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">

        {/* Голосовой индикатор */}
        {tab === "sides" && voice.isListening && (
          <div className="mb-1 px-1">
            <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Icon name="Mic" size={10} className="text-red-400 shrink-0 animate-pulse" />
              <span className="text-[10px] text-red-300 font-semibold truncate">
                {segmentLabel(points, segments[voice.activeIdx]) ?? `сторона ${voice.activeIdx + 1}`}
              </span>
            </div>
            {voice.interimText && (
              <p className="mt-0.5 text-[9px] text-white/30 italic px-1 truncate">{voice.interimText}</p>
            )}
          </div>
        )}

        {/* Кнопка голосового ввода — стороны */}
        {tab === "sides" && voice.hasSpeech && segments.length > 0 && (
          <div className="flex justify-center mb-2">
            <button
              onClick={voice.toggle}
              title={voice.isListening ? "Остановить" : "Диктовать размеры"}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-[0.93] ${
                voice.isListening
                  ? "bg-red-500/20 border border-red-400/50 text-red-300 animate-pulse"
                  : "text-white hover:brightness-110"
              }`}
              style={voice.isListening ? {} : {
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 3px 14px rgba(124,58,237,0.45)",
              }}
            >
              <Icon name={voice.isListening ? "MicOff" : "Mic"} size={18} />
            </button>
          </div>
        )}

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
                  onFocus={e => {
                    e.target.select();
                    onChange?.({
                      selectedSegmentId: seg.id,
                      selectedSegmentIds: [seg.id],
                      selectedPointId: null,
                      selectedDiagonalId: null,
                    });
                  }}
                  className={`w-full rounded-lg border px-2 py-1.5 text-[12px] font-semibold text-right pr-6 outline-none transition bg-transparent
                    ${voice.isListening && voice.activeIdx === idx
                      ? "border-red-500/50 bg-red-500/5 text-white"
                      : filled
                        ? "border-white/[0.12] text-white"
                        : "border-white/[0.07] text-white/50"
                    }
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

      {/* Кнопка закрыть */}
      <div className="px-2 pb-4 pt-1 shrink-0 flex flex-col gap-1">
        <p className="text-[9px] text-white/15 text-center">
          {tab === "sides" ? "Enter → след." : tab === "diagonals" ? "Enter → след." : "Просмотр"}
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-[11px] font-semibold active:bg-red-500/25 transition"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
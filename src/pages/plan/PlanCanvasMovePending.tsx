import React, { useCallback, useRef } from "react";
import type { PlanState, Segment } from "./planTypes";
import { findNearestSegment } from "./PlanCanvasUtils";

interface Props {
  svgRef: React.RefObject<SVGSVGElement>;
  movePending: { fromSegId: string; priceId: number } | null;
  movePendingRef: React.MutableRefObject<{ fromSegId: string; priceId: number } | null>;
  segments: Segment[];
  zoom: number;
  onChange: (patch: Partial<PlanState>) => void;
  onCancelMove: () => void;
  didMoveRef?: React.MutableRefObject<boolean>;
  longPressRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  longPressPos?: React.MutableRefObject<{ clientX: number; clientY: number; type: string; id: string } | null>;
  setCtxMenu?: (v: null) => void;
  settings: PlanState["settings"];
}

export function useMovePendingHandlers({
  svgRef, movePendingRef, segments, onChange, didMoveRef, longPressRef, longPressPos, setCtxMenu, settings,
}: Omit<Props, "movePending" | "zoom" | "onCancelMove">) {
  const clientToSvgMove = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const { zoom: z, panX: px, panY: py } = settings;
    const rx = (clientX - rect.left) / z - px;
    const ry = (clientY - rect.top) / z - py;
    return { x: rx, y: ry };
  }, [svgRef, settings]);

  const executeMoveToSeg = useCallback((toSegId: string, setMovePending: (v: null) => void) => {
    const mp = movePendingRef.current;
    if (!mp || toSegId === mp.fromSegId) { setMovePending(null); return; }
    const { fromSegId, priceId } = mp;
    setMovePending(null);
    const fromSeg = segments.find(s => s.id === fromSegId);
    const item = fromSeg?.items?.find(it => it.priceId === priceId);
    if (!item) return;
    const toSeg = segments.find(s => s.id === toSegId);
    const meters = toSeg?.lengthCm ? Math.round(toSeg.lengthCm / 100 * 100) / 100 : item.quantity ?? 1;
    const newSegs = segments.map(s => {
      if (s.id === fromSegId) return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
      if (s.id === toSegId) {
        const existing = s.items ?? [];
        if (existing.some(it => it.priceId === priceId)) {
          return { ...s, items: existing.map(it => it.priceId === priceId ? { ...it, quantity: (it.quantity ?? 1) + meters } : it) };
        }
        return { ...s, items: [...existing, { ...item, quantity: meters }] };
      }
      return s;
    });
    onChange({ segments: newSegs });
  }, [segments, onChange, movePendingRef]);

  return { clientToSvgMove, executeMoveToSeg };
}

export function useMovePendingEffects({
  svgRef, movePendingRef, segments, onChange, didMoveRef, longPressRef, longPressPos, setCtxMenu, settings,
  setMovePending,
}: Omit<Props, "movePending" | "zoom" | "onCancelMove"> & { setMovePending: (v: null) => void }) {
  const clientToSvgMove = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const { zoom: z, panX: px, panY: py } = settings;
    return { x: (clientX - rect.left) / z - px, y: (clientY - rect.top) / z - py };
  }, [svgRef, settings]);

  const executeMoveToSeg = useCallback((toSegId: string) => {
    const mp = movePendingRef.current;
    if (!mp || toSegId === mp.fromSegId) { setMovePending(null); return; }
    const { fromSegId, priceId } = mp;
    setMovePending(null);
    const fromSeg = segments.find(s => s.id === fromSegId);
    const item = fromSeg?.items?.find(it => it.priceId === priceId);
    if (!item) return;
    const toSeg = segments.find(s => s.id === toSegId);
    const meters = toSeg?.lengthCm ? Math.round(toSeg.lengthCm / 100 * 100) / 100 : item.quantity ?? 1;
    const newSegs = segments.map(s => {
      if (s.id === fromSegId) return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
      if (s.id === toSegId) {
        const existing = s.items ?? [];
        if (existing.some(it => it.priceId === priceId)) {
          return { ...s, items: existing.map(it => it.priceId === priceId ? { ...it, quantity: (it.quantity ?? 1) + meters } : it) };
        }
        return { ...s, items: [...existing, { ...item, quantity: meters }] };
      }
      return s;
    });
    onChange({ segments: newSegs });
  }, [segments, onChange, movePendingRef, setMovePending]);

  // Нативный перехват touchstart — гасим long-press в режиме movePending
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = () => {
      if (!movePendingRef.current) return;
      if (longPressRef?.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
      if (longPressPos) longPressPos.current = null;
    };
    svg.addEventListener("touchstart", handler, { capture: true, passive: true });
    return () => svg.removeEventListener("touchstart", handler, true);
  }, [svgRef, longPressRef, longPressPos, movePendingRef]);

  // Нативный перехват touchend — выполняем перемещение
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: TouchEvent) => {
      if (!movePendingRef.current || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const svgPt = clientToSvgMove(t.clientX, t.clientY);
      const hit = findNearestSegment(svgPt.x, svgPt.y, segments, segments, Math.max(40, 60 / settings.zoom));
      if (hit) {
        e.stopPropagation();
        e.preventDefault();
        if (longPressRef?.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
        if (longPressPos) longPressPos.current = null;
        if (setCtxMenu) setCtxMenu(null);
        if (didMoveRef) didMoveRef.current = true;
        executeMoveToSeg(hit.id);
      }
    };
    svg.addEventListener("touchend", handler, { capture: true });
    return () => svg.removeEventListener("touchend", handler, true);
  }, [svgRef, clientToSvgMove, segments, settings.zoom, executeMoveToSeg, movePendingRef]);

  return { executeMoveToSeg };
}

export function MovePendingBanner({ onCancel, mode = "move" }: { onCancel: () => void; mode?: "move" | "duplicate" }) {
  return (
    <div style={{
      position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.5)",
      borderRadius: 12, padding: "8px 10px 8px 16px",
      zIndex: 60, whiteSpace: "nowrap",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    }}>
      <span style={{ color: "#67e8f9", fontSize: 13, fontWeight: 600 }}>
        {mode === "duplicate" ? "Выберите стену для дублирования" : "Выберите стену для перемещения"}
      </span>
      <button
        onPointerDown={onCancel}
        style={{
          background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.5)",
          color: "#c4b5fd", fontSize: 12, fontWeight: 600,
          padding: "4px 10px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
        }}
      >
        Отмена
      </button>
    </div>
  );
}
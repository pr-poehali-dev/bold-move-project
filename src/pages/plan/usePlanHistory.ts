import React, { useCallback, useEffect } from "react";
import type { PlanState } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";

// ── Undo/Redo ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 80;

interface HistoryStore { stack: PlanState[]; cursor: number; }
type HistoryAction =
  | { type: "push";    next: PlanState }
  | { type: "replace"; next: PlanState }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; next?: PlanState };

const NON_GEOMETRY_KEYS: (keyof PlanState)[] = [
  "settings", "tool", "phase", "sidebarTab",
  "selectedPointId", "selectedSegmentId", "selectedDiagonalId",
  "selectedArcId", "selectedDimLineId", "activeInputIndex",
  "changedSegmentIds",
];

export function isGeometryPatch(patch: Partial<PlanState>): boolean {
  return Object.keys(patch).some(k => !NON_GEOMETRY_KEYS.includes(k as keyof PlanState));
}

function historyReducer(s: HistoryStore, a: HistoryAction): HistoryStore {
  switch (a.type) {
    case "push": {
      const trimmed = s.stack.slice(0, s.cursor + 1);
      trimmed.push(a.next);
      if (trimmed.length > MAX_HISTORY) trimmed.shift();
      return { stack: trimmed, cursor: trimmed.length - 1 };
    }
    case "replace": {
      const stack = [...s.stack];
      stack[s.cursor] = a.next;
      return { ...s, stack };
    }
    case "undo":
      return { ...s, cursor: Math.max(0, s.cursor - 1) };
    case "redo":
      return { ...s, cursor: Math.min(s.stack.length - 1, s.cursor + 1) };
    case "reset":
      return { stack: [a.next ?? INITIAL_STATE], cursor: 0 };
    default:
      return s;
  }
}

export function useHistory(initial: PlanState) {
  const [{ stack, cursor }, dispatch] = React.useReducer(
    historyReducer,
    { stack: [initial], cursor: 0 }
  );

  const safeCursor = Math.min(cursor, stack.length - 1);
  const state = stack[safeCursor] ?? initial;

  const push    = useCallback((next: PlanState) => dispatch({ type: "push",    next }), []);
  const replace = useCallback((next: PlanState) => dispatch({ type: "replace", next }), []);
  const undo    = useCallback(() => dispatch({ type: "undo" }), []);
  const redo    = useCallback(() => dispatch({ type: "redo" }), []);
  const reset   = useCallback((next?: PlanState) => dispatch({ type: "reset", next }), []);

  return {
    state,
    push, replace, undo, redo, reset,
    canUndo: safeCursor > 0,
    canRedo: safeCursor < stack.length - 1,
  };
}

// ── useIsMobile ──────────────────────────────────────────────────────────────

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

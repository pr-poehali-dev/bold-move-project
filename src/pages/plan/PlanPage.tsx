import React, { useCallback, useEffect, useRef } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import type { PlanState, ToolMode, PlanSettings } from "./planTypes";
import { INITIAL_STATE, buildAutoDiagonals } from "./planTypes";

// ── Undo/Redo стек ────────────────────────────────────────────────────────────
const MAX_HISTORY = 60;

function useHistory(initial: PlanState) {
  const [history, setHistory] = React.useState<PlanState[]>([initial]);
  const [cursor, setCursor] = React.useState(0);

  const state = history[cursor];

  const push = useCallback((next: PlanState) => {
    setHistory(h => {
      const newH = h.slice(0, cursor + 1);
      newH.push(next);
      if (newH.length > MAX_HISTORY) newH.shift();
      return newH;
    });
    setCursor(c => Math.min(c + 1, MAX_HISTORY - 1));
  }, [cursor]);

  const undo = useCallback(() => {
    setCursor(c => Math.max(0, c - 1));
  }, []);

  const redo = useCallback(() => {
    setCursor(c => Math.min(history.length - 1, c + 1));
  }, [history.length]);

  const reset = useCallback(() => {
    setHistory([INITIAL_STATE]);
    setCursor(0);
  }, []);

  return {
    state,
    push,
    undo,
    redo,
    reset,
    canUndo: cursor > 0,
    canRedo: cursor < history.length - 1,
  };
}

// ── Главная страница ──────────────────────────────────────────────────────────
export default function PlanPage() {
  const { state, push, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);

  // изменение состояния с push в историю
  const handleChange = useCallback((patch: Partial<PlanState>) => {
    push({ ...state, ...patch });
  }, [state, push]);

  // изменение настроек (без push в историю — чтобы не засорять undo стек)
  const historylessRef = useRef(false);
  const handleSettingChange = useCallback((patch: Partial<PlanSettings>) => {
    historylessRef.current = true;
    push({ ...state, settings: { ...state.settings, ...patch } });
  }, [state, push]);

  // инструмент
  const handleToolChange = useCallback((t: ToolMode) => {
    push({ ...state, tool: t });
  }, [state, push]);

  // zoom
  const handleZoomIn  = () => handleSettingChange({ zoom: Math.min(3, Math.round((state.settings.zoom + 0.2) * 10) / 10) });
  const handleZoomOut = () => handleSettingChange({ zoom: Math.max(0.3, Math.round((state.settings.zoom - 0.2) * 10) / 10) });
  const handleZoomFit = () => {
    // авто-масштаб по точкам
    if (state.points.length < 2) { handleSettingChange({ zoom: 1 }); return; }
    const xs = state.points.map(p => p.x);
    const ys = state.points.map(p => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const canvasEl = document.getElementById("plan-canvas-wrap");
    if (!canvasEl) return;
    const cw = canvasEl.clientWidth - 80;
    const ch = canvasEl.clientHeight - 80;
    const z = Math.min(cw / (w || 1), ch / (h || 1), 3);
    handleSettingChange({ zoom: Math.max(0.3, Math.round(z * 10) / 10) });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); return; }
      if (e.key === "d" || e.key === "D") handleToolChange("draw");
      if (e.key === "v" || e.key === "V") handleToolChange("move");
      if (e.key === "s" || e.key === "S") handleToolChange("segment");
      if (e.key === "g" || e.key === "G") handleToolChange("diagonal");
      if (e.key === "a" || e.key === "A") handleToolChange("arc");
      if (e.key === "x" || e.key === "X") handleToolChange("delete");
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") handleZoomFit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, handleToolChange, handleZoomIn, handleZoomOut, handleZoomFit]);

  // Боковая панель с resize
  const [sidebarW, setSidebarW] = React.useState(280);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onSidebarDragStart = (e: React.MouseEvent) => {
    sidebarDragRef.current = { startX: e.clientX, startW: sidebarW };
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return;
      const delta = sidebarDragRef.current.startX - ev.clientX;
      setSidebarW(Math.max(220, Math.min(420, sidebarDragRef.current.startW + delta)));
    };
    const onUp = () => {
      sidebarDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] overflow-hidden">

      {/* ── Верхняя панель инструментов ── */}
      <PlanToolbar
        tool={state.tool}
        phase={state.phase}
        isClosed={state.isClosed}
        settings={state.settings}
        canUndo={canUndo}
        canRedo={canRedo}
        onToolChange={handleToolChange}
        onSettingChange={handleSettingChange}
        onUndo={undo}
        onRedo={redo}
        onReset={reset}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
      />

      {/* ── Основная область ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Холст ── */}
        <div id="plan-canvas-wrap" className="flex-1 overflow-hidden">
          <PlanCanvas state={state} onChange={handleChange} />
        </div>

        {/* ── Drag-разделитель ── */}
        <div
          className="w-1 bg-white/[0.05] hover:bg-violet-500/40 cursor-col-resize transition-colors shrink-0 relative group"
          onMouseDown={onSidebarDragStart}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* ── Правая панель ── */}
        <div
          className="shrink-0 overflow-hidden border-l border-white/[0.07]"
          style={{ width: sidebarW }}
        >
          <PlanSidebar state={state} onChange={handleChange} />
        </div>
      </div>

      {/* ── Строка состояния (статус-бар) ── */}
      <div className="h-7 bg-[#0d0e17] border-t border-white/[0.05] flex items-center px-4 gap-6 shrink-0">
        <span className="text-[10px] text-white/25 font-mono">
          Точек: {state.points.length}
        </span>
        <span className="text-[10px] text-white/25 font-mono">
          Отрезков: {state.segments.length}
        </span>
        {state.isClosed && (
          <span className="text-[10px] text-emerald-500/60 font-mono">
            ● Замкнуто
          </span>
        )}
        <span className="text-[10px] text-white/20 font-mono ml-auto">
          Инструмент: {state.tool} · Zoom {Math.round(state.settings.zoom * 100)}%
          {state.settings.ortho ? " · Орто" : ""}
          {state.settings.snapToPoints ? " · Магнит" : ""}
        </span>
      </div>
    </div>
  );
}

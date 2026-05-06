import React, { useCallback, useEffect, useRef } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanExportModal from "./PlanExportModal";
import type { PlanState, ToolMode, PlanSettings } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";

// ── Undo/Redo ─────────────────────────────────────────────────────────────────
const MAX_HISTORY = 80;

function useHistory(initial: PlanState) {
  const [history, setHistory] = React.useState<PlanState[]>([initial]);
  const [cursor, setCursor]   = React.useState(0);
  const state = history[cursor];

  const push = useCallback((next: PlanState) => {
    setHistory(h => {
      const trimmed = h.slice(0, cursor + 1);
      trimmed.push(next);
      if (trimmed.length > MAX_HISTORY) trimmed.shift();
      return trimmed;
    });
    setCursor(c => Math.min(c + 1, MAX_HISTORY - 1));
  }, [cursor]);

  const undo  = useCallback(() => setCursor(c => Math.max(0, c - 1)), []);
  const redo  = useCallback(() => setCursor(c => Math.min(history.length - 1, c + 1)), [history.length]);
  const reset = useCallback(() => { setHistory([INITIAL_STATE]); setCursor(0); }, []);

  return { state, push, undo, redo, reset, canUndo: cursor > 0, canRedo: cursor < history.length - 1 };
}

// ── Хук определения мобильного устройства ─────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ── Главная страница ──────────────────────────────────────────────────────────
export default function PlanPage() {
  const { state, push, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);
  const isMobile = useIsMobile();
  const [sheetOpen,  setSheetOpen]  = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  const handleChange = useCallback((patch: Partial<PlanState>) => {
    push({ ...state, ...patch });
  }, [state, push]);

  const handleSettingChange = useCallback((patch: Partial<PlanSettings>) => {
    push({ ...state, settings: { ...state.settings, ...patch } });
  }, [state, push]);

  const handleToolChange = useCallback((t: ToolMode) => {
    push({ ...state, tool: t });
  }, [state, push]);

  // Zoom
  const zoomIn = useCallback(() =>
    handleSettingChange({ zoom: Math.min(4, Math.round((state.settings.zoom + 0.2) * 10) / 10) }),
    [state, handleSettingChange]);

  const zoomOut = useCallback(() =>
    handleSettingChange({ zoom: Math.max(0.3, Math.round((state.settings.zoom - 0.2) * 10) / 10) }),
    [state, handleSettingChange]);

  const zoomFit = useCallback(() => {
    if (state.points.length < 2) { handleSettingChange({ zoom: 1, panX: 0, panY: 0 }); return; }
    const xs = state.points.map(p => p.x);
    const ys = state.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX || 100, h = maxY - minY || 100;
    const el = document.getElementById("plan-canvas-wrap");
    if (!el) return;
    const cw = el.clientWidth - 80, ch = el.clientHeight - 80;
    const z  = Math.max(0.3, Math.min(3, Math.min(cw / w, ch / h)));
    const newZoom = Math.round(z * 10) / 10;
    const panX = (cw / 2 / newZoom) - (minX + w / 2);
    const panY = (ch / 2 / newZoom) - (minY + h / 2);
    handleSettingChange({ zoom: newZoom, panX: Math.round(panX), panY: Math.round(panY) });
  }, [state.points, handleSettingChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); return; }

      const keys: Record<string, ToolMode> = { d: "draw", v: "move", s: "segment", g: "diagonal", a: "arc", r: "dimline", x: "delete" };
      const k = e.key.toLowerCase();
      if (keys[k]) { handleToolChange(keys[k]); return; }
      if (k === "o") handleSettingChange({ ortho: !state.settings.ortho });
      if (k === "m") handleSettingChange({ snapToPoints: !state.settings.snapToPoints });
      if (k === "+" || k === "=") zoomIn();
      if (k === "-") zoomOut();
      if (k === "0") zoomFit();
      if (k === "p") setSheetOpen(v => !v);
      if (k === "e") setExportOpen(true); // E = экспорт
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, handleToolChange, handleSettingChange, state.settings, zoomIn, zoomOut, zoomFit]);

  // Resize боковой панели (только десктоп)
  const [sidebarW, setSidebarW] = React.useState(300);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onSidebarDragStart = (e: React.MouseEvent) => {
    sidebarDragRef.current = { startX: e.clientX, startW: sidebarW };
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return;
      const delta = sidebarDragRef.current.startX - ev.clientX;
      setSidebarW(Math.max(240, Math.min(480, sidebarDragRef.current.startW + delta)));
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
    <div className="flex flex-col bg-[#0f1117] overflow-hidden" style={{ height: "100dvh" }}>

      {/* Toolbar */}
      <PlanToolbar
        tool={state.tool}
        phase={state.phase}
        isClosed={state.isClosed}
        settings={state.settings}
        canUndo={canUndo}
        canRedo={canRedo}
        isMobile={isMobile}
        onToolChange={handleToolChange}
        onSettingChange={handleSettingChange}
        onUndo={undo}
        onRedo={redo}
        onReset={reset}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        onOpenPanel={() => setSheetOpen(true)}
        onExport={() => setExportOpen(true)}
      />

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Холст — всегда на всю ширину на мобиле */}
        <div id="plan-canvas-wrap" className="flex-1 overflow-hidden">
          <PlanCanvas state={state} onChange={handleChange} />
        </div>

        {/* Десктоп: боковая панель справа */}
        {!isMobile && (<>
          <div
            className="w-1 bg-white/[0.04] hover:bg-violet-500/30 cursor-col-resize transition-colors shrink-0"
            onMouseDown={onSidebarDragStart}
          />
          <div className="shrink-0 overflow-hidden border-l border-white/[0.06]" style={{ width: sidebarW }}>
            <PlanSidebar state={state} onChange={handleChange} />
          </div>
        </>)}

        {/* Мобиле: кнопка-таб открыть панель (если закрыта) */}
        {isMobile && !sheetOpen && (
          <button
            onClick={() => setSheetOpen(true)}
            className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-violet-600 shadow-lg shadow-violet-500/30 flex items-center justify-center text-white z-20"
          >
            <Icon name="PanelBottom" size={20} />
          </button>
        )}
      </div>

      {/* Мобиле: bottom sheet */}
      {isMobile && (
        <PlanBottomSheet
          state={state}
          onChange={handleChange}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Модалка экспорта */}
      {exportOpen && (
        <PlanExportModal state={state} onClose={() => setExportOpen(false)} />
      )}

      {/* Статус-бар — только на десктопе */}
      {!isMobile && (
        <div className="h-6 bg-[#0c0d16] border-t border-white/[0.04] flex items-center px-4 gap-5 shrink-0">
          <span className="text-[10px] text-white/20 font-mono">Точек: {state.points.length}</span>
          <span className="text-[10px] text-white/20 font-mono">Отрезков: {state.segments.length}</span>
          <span className="text-[10px] text-white/20 font-mono">Диаг: {state.diagonals.length}</span>
          {state.isClosed && <span className="text-[10px] text-emerald-500/50 font-mono">● Замкнуто</span>}
          <span className="text-[10px] text-white/15 font-mono ml-auto">
            {state.tool} · {Math.round(state.settings.zoom * 100)}%
            {state.settings.ortho ? " · Орто" : ""}
            {state.settings.snapToPoints ? " · Магнит" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
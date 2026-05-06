import React, { useCallback, useEffect, useRef } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanExportModal from "./PlanExportModal";
import PlanLibraryModal from "./PlanLibraryModal";
import Icon from "@/components/ui/icon";
import type { PlanState, ToolMode, PlanSettings } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";
import { usePlanStorage } from "./usePlanStorage";
import { useAuth } from "@/context/AuthContext";

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

  // reset с возможностью передать новое начальное состояние
  const reset = useCallback((next?: PlanState) => {
    setHistory([next ?? INITIAL_STATE]);
    setCursor(0);
  }, []);

  return { state, push, undo, redo, reset, canUndo: cursor > 0, canRedo: cursor < history.length - 1 };
}

// ── Хук мобильного ─────────────────────────────────────────────────────────────
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
  const { user, token } = useAuth();
  const isMobile = useIsMobile();

  const [sheetOpen,   setSheetOpen]   = React.useState(false);
  const [exportOpen,  setExportOpen]  = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);

  // ── Облачное хранилище ────────────────────────────────────────────────────
  const storage = usePlanStorage();

  // Загружаем список планов при логине
  useEffect(() => {
    if (token) storage.loadPlans(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Помечаем "грязным" при каждом изменении состояния
  const prevStateRef = useRef(state);
  useEffect(() => {
    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      // Не помечаем грязным при первом рендере
      if (state.points.length > 0 || state.segments.length > 0) {
        storage.markDirty();
      }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Автосохранение каждые 60 секунд если есть изменения
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!token || !storage.currentPlanId) return;
    autoSaveRef.current = setInterval(() => {
      if (storage.isDirty) {
        storage.save(state, token);
      }
    }, 60_000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [token, storage.currentPlanId, storage.isDirty, state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Обработчики изменений ─────────────────────────────────────────────────
  const handleChange = useCallback((patch: Partial<PlanState>) => {
    push({ ...state, ...patch });
  }, [state, push]);

  const handleSettingChange = useCallback((patch: Partial<PlanSettings>) => {
    push({ ...state, settings: { ...state.settings, ...patch } });
  }, [state, push]);

  const handleToolChange = useCallback((t: ToolMode) => {
    push({ ...state, tool: t });
  }, [state, push]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
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

  // ── Сохранение ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!token) { setLibraryOpen(true); return; }
    await storage.save(state, token);
    storage.loadPlans(token);
  }, [token, state, storage]);

  const handleSaveAs = useCallback(async (name: string) => {
    if (!token) return;
    const id = await storage.saveAs(state, token, name);
    if (id) storage.loadPlans(token);
  }, [token, state, storage]);

  const handleLoad = useCallback(async (planId: number) => {
    if (!token) return;
    const loaded = await storage.load(planId, token);
    if (loaded) reset(loaded);
  }, [token, storage, reset]);

  const handleDelete = useCallback(async (planId: number) => {
    if (!token) return;
    await storage.deletePlan(planId, token);
  }, [token, storage]);

  const handleRename = useCallback(async (planId: number, name: string) => {
    if (!token) return;
    await storage.rename(planId, name, token);
  }, [token, storage]);

  const handleNew = useCallback(() => {
    storage.newPlan();
    reset(INITIAL_STATE);
  }, [storage, reset]);

  // ── Клавиатура ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      // Ctrl+S — сохранить
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); return; }

      const keys: Record<string, ToolMode> = { d: "draw", v: "move", s: "segment", g: "diagonal", a: "arc", r: "dimline", x: "delete" };
      const k = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && keys[k]) { handleToolChange(keys[k]); return; }
      if (k === "o") handleSettingChange({ ortho: !state.settings.ortho });
      if (k === "m") handleSettingChange({ snapToPoints: !state.settings.snapToPoints });
      if (k === "+" || k === "=") zoomIn();
      if (k === "-") zoomOut();
      if (k === "0") zoomFit();
      if (k === "p") setSheetOpen(v => !v);
      if (k === "e") setExportOpen(true);
      if (k === "l") setLibraryOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, handleSave, handleToolChange, handleSettingChange, state.settings, zoomIn, zoomOut, zoomFit]);

  // ── Resize сайдбара ───────────────────────────────────────────────────────
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

  const isLoggedIn = !!user && !!token;
  const currentPlanName = storage.plans.find(p => p.id === storage.currentPlanId)?.name ?? state.room.name ?? "Без названия";

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
        saveStatus={storage.saveStatus}
        isDirty={storage.isDirty}
        isLoggedIn={isLoggedIn}
        currentPlanId={storage.currentPlanId}
        onToolChange={handleToolChange}
        onSettingChange={handleSettingChange}
        onUndo={undo}
        onRedo={redo}
        onReset={() => reset()}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        onOpenPanel={() => setSheetOpen(true)}
        onExport={() => setExportOpen(true)}
        onSave={handleSave}
        onOpenLibrary={() => setLibraryOpen(true)}
      />

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden relative">

        <div id="plan-canvas-wrap" className="flex-1 overflow-hidden">
          <PlanCanvas state={state} onChange={handleChange} />
        </div>

        {!isMobile && (<>
          <div
            className="w-1 bg-white/[0.04] hover:bg-violet-500/30 cursor-col-resize transition-colors shrink-0"
            onMouseDown={onSidebarDragStart}
          />
          <div className="shrink-0 overflow-hidden border-l border-white/[0.06]" style={{ width: sidebarW }}>
            <PlanSidebar state={state} onChange={handleChange} />
          </div>
        </>)}

        {isMobile && !sheetOpen && (
          <button
            onClick={() => setSheetOpen(true)}
            className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-violet-600 shadow-lg shadow-violet-500/30 flex items-center justify-center text-white z-20">
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

      {/* Модалки */}
      {exportOpen && (
        <PlanExportModal state={state} onClose={() => setExportOpen(false)} />
      )}

      {libraryOpen && (
        <PlanLibraryModal
          plans={storage.plans}
          loading={storage.plansLoading}
          saveStatus={storage.saveStatus}
          lastSavedAt={storage.lastSavedAt}
          isDirty={storage.isDirty}
          currentPlanId={storage.currentPlanId}
          currentPlanName={currentPlanName}
          isLoggedIn={isLoggedIn}
          onClose={() => setLibraryOpen(false)}
          onLoad={handleLoad}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onDelete={handleDelete}
          onRename={handleRename}
          onNew={handleNew}
          onLoginRequest={() => { setLibraryOpen(false); /* редиректим на /login если нужно */ }}
        />
      )}

      {/* Статус-бар — только на десктопе */}
      {!isMobile && (
        <div className="h-6 bg-[#0c0d16] border-t border-white/[0.04] flex items-center px-4 gap-5 shrink-0">
          <span className="text-[10px] text-white/20 font-mono">Точек: {state.points.length}</span>
          <span className="text-[10px] text-white/20 font-mono">Отрезков: {state.segments.length}</span>
          <span className="text-[10px] text-white/20 font-mono">Диаг: {state.diagonals.length}</span>
          {state.isClosed && <span className="text-[10px] text-emerald-500/50 font-mono">● Замкнуто</span>}
          {/* Статус сохранения */}
          {isLoggedIn && (
            <span className={`text-[10px] font-mono ml-auto mr-0 ${
              storage.saveStatus === "saving" ? "text-blue-400/70" :
              storage.saveStatus === "saved"  ? "text-emerald-500/50" :
              storage.saveStatus === "error"  ? "text-rose-400/70" :
              storage.isDirty ? "text-amber-400/60" : "text-white/15"
            }`}>
              {storage.saveStatus === "saving" ? "⟳ Сохранение…" :
               storage.saveStatus === "saved"  ? "✓ Сохранён" :
               storage.saveStatus === "error"  ? "✗ Ошибка" :
               storage.isDirty ? "● Не сохранён" : "○ Актуален"}
            </span>
          )}
          <span className="text-[10px] text-white/15 font-mono">
            {state.tool} · {Math.round(state.settings.zoom * 100)}%
            {state.settings.ortho ? " · Орто" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

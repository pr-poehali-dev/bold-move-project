import React, { useCallback, useEffect, useRef } from "react";
import PlanCanvas from "./PlanCanvas";
import PlanToolbar from "./PlanToolbar";
import PlanSidebar from "./PlanSidebar";
import PlanBottomSheet from "./PlanBottomSheet";
import PlanExportModal from "./PlanExportModal";
import PlanLibraryModal from "./PlanLibraryModal";
import AuthModal from "@/components/AuthModal";
import Icon from "@/components/ui/icon";
import type { PlanState, ToolMode, PlanSettings } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";
import { usePlanStorage } from "./usePlanStorage";
import { useAuth } from "@/context/AuthContext";

// ── Undo/Redo — атомарный useReducer ────────────────────────────────────────
const MAX_HISTORY = 80;

interface HistoryStore { stack: PlanState[]; cursor: number; }
type HistoryAction =
  | { type: "push";    next: PlanState }
  | { type: "replace"; next: PlanState }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; next?: PlanState };

// Поля которые НЕ являются геометрией — изменения по ним не пишутся в историю
const NON_GEOMETRY_KEYS: (keyof import("./planTypes").PlanState)[] = [
  "settings", "tool", "phase", "sidebarTab",
  "selectedPointId", "selectedSegmentId", "selectedDiagonalId",
  "selectedArcId", "selectedDimLineId", "activeInputIndex",
  "changedSegmentIds",
];

function isGeometryPatch(patch: Partial<import("./planTypes").PlanState>): boolean {
  return Object.keys(patch).some(k => !NON_GEOMETRY_KEYS.includes(k as keyof import("./planTypes").PlanState));
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

function useHistory(initial: PlanState) {
  const [{ stack, cursor }, dispatch] = React.useReducer(
    historyReducer,
    { stack: [initial], cursor: 0 }
  );

  // Защита от рассинхронизации cursor/stack
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
  const { state, push, replace, undo, redo, reset, canUndo, canRedo } = useHistory(INITIAL_STATE);
  const { user, token } = useAuth();
  const isMobile = useIsMobile();

  const [sheetOpen,   setSheetOpen]   = React.useState(false);
  const [exportOpen,  setExportOpen]  = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [authOpen,    setAuthOpen]    = React.useState(false);
  // Онбординг: показываем подсказку для незарегистрированных через 3 сек
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  // ── Облачное хранилище ────────────────────────────────────────────────────
  const storage = usePlanStorage();

  // Загружаем список планов при логине
  useEffect(() => {
    if (token) storage.loadPlans(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Онбординг для незарегистрированных — через 3 сек после входа
  useEffect(() => {
    if (!user) {
      const id = setTimeout(() => setShowOnboarding(true), 3000);
      return () => clearTimeout(id);
    }
  }, [user]);

  // На мобиле: автоматически открываем сайдбар при замыкании фигуры
  const prevIsClosed = useRef(state.isClosed);
  useEffect(() => {
    if (state.isClosed && !prevIsClosed.current && isMobile) {
      setSheetOpen(true);
    }
    prevIsClosed.current = state.isClosed;
  }, [state.isClosed, isMobile]);  

  // Ref для актуального state (избегаем stale closure в callbacks)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Помечаем "грязным" при каждом изменении
  const prevPointsLen = useRef(0);
  useEffect(() => {
    const len = state?.points?.length ?? 0;
    if (len > 0 && len !== prevPointsLen.current) {
      storage.markDirty();
    }
    prevPointsLen.current = len;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Автосохранение каждые 60 секунд
  useEffect(() => {
    if (!token || !storage.currentPlanId) return;
    const id = setInterval(() => {
      if (storage.isDirty) storage.save(stateRef.current, token);
    }, 60_000);
    return () => clearInterval(id);
  }, [token, storage.currentPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Обработчики изменений — используем ref чтобы не пересоздавать ─────────
  const handleChange = useCallback((patch: Partial<PlanState>) => {
    const next = { ...stateRef.current, ...patch };
    if (isGeometryPatch(patch)) {
      push(next);
    } else {
      replace(next);
    }
  }, [push, replace]);

  const handleSettingChange = useCallback((patch: Partial<PlanSettings>) => {
    const s = stateRef.current;
    push({ ...s, settings: { ...s.settings, ...patch } });
  }, [push]);

  const handleToolChange = useCallback((t: ToolMode) => {
    push({ ...stateRef.current, tool: t });
  }, [push]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const z = stateRef.current.settings.zoom;
    handleSettingChange({ zoom: Math.min(4, Math.round((z + 0.2) * 10) / 10) });
  }, [handleSettingChange]);

  const zoomOut = useCallback(() => {
    const z = stateRef.current.settings.zoom;
    handleSettingChange({ zoom: Math.max(0.3, Math.round((z - 0.2) * 10) / 10) });
  }, [handleSettingChange]);

  const zoomFit = useCallback(() => {
    const pts = stateRef.current.points;
    if (!pts || pts.length < 2) { handleSettingChange({ zoom: 1, panX: 0, panY: 0 }); return; }
    const xs = pts.map((p: { x: number }) => p.x);
    const ys = pts.map((p: { y: number }) => p.y);
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
  }, [handleSettingChange]);

  // ── Сохранение ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!token) { setLibraryOpen(true); return; }
    await storage.save(stateRef.current, token);
    storage.loadPlans(token);
  }, [token, storage]);

  const handleSaveAs = useCallback(async (name: string) => {
    if (!token) return;
    const id = await storage.saveAs(stateRef.current, token, name);
    if (id) storage.loadPlans(token);
  }, [token, storage]);

  const handleLoad = useCallback(async (planId: number) => {
    if (!token) return;
    const loaded = await storage.load(planId, token);
    if (loaded) {
      const allSet = loaded.segments?.length > 0 && loaded.segments.every((s: import("./planTypes").Segment) => s.lengthCm !== null && s.lengthCm > 0);
      reset({ ...loaded, changedSegmentIds: [], isBuilt: loaded.isBuilt ?? (!!loaded.baseScale && allSet) });
    }
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
      if (k === "o") handleSettingChange({ ortho: !stateRef.current.settings.ortho });
      if (k === "m") handleSettingChange({ snapToPoints: !stateRef.current.settings.snapToPoints });
      if (k === "+" || k === "=") zoomIn();
      if (k === "-") zoomOut();
      if (k === "0") zoomFit();
      if (k === "p") setSheetOpen(v => !v);
      if (k === "e") setExportOpen(true);
      if (k === "l") setLibraryOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, handleSave, handleToolChange, handleSettingChange, zoomIn, zoomOut, zoomFit]);

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
    <div className="flex flex-col bg-[#111] overflow-hidden" style={{ height: "100dvh" }}>

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
          onLoginRequest={() => { setLibraryOpen(false); setAuthOpen(true); }}
        />
      )}

      {/* ── Онбординг для незарегистрированных ── */}
      {showOnboarding && !isLoggedIn && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
          <div className="bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Cloud" size={16} className="text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white/90 mb-0.5">Сохраняй планы в облако</p>
              <p className="text-[11px] text-white/45 leading-relaxed">Войди чтобы твои чертежи сохранялись и были доступны с любого устройства</p>
              <button
                onClick={() => { setShowOnboarding(false); setAuthOpen(true); }}
                className="mt-2.5 w-full py-2 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-200 text-[12px] font-bold hover:bg-violet-500/35 transition">
                Войти и сохранить
              </button>
            </div>
            <button onClick={() => setShowOnboarding(false)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition shrink-0">
              <Icon name="X" size={13} className="text-white/30" />
            </button>
          </div>
        </div>
      )}

      {/* Статус-бар — только на десктопе */}
      {!isMobile && (
        <div className="h-6 bg-[#111] border-t border-white/[0.07] flex items-center px-4 gap-5 shrink-0">
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

      {/* ── Модал авторизации ── */}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          defaultTab="login"
          onSuccess={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
}
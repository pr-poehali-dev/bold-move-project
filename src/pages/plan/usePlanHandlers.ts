import React, { useCallback, useEffect, useRef } from "react";
import type { PlanState, PlanSettings, Segment, DiagonalDef, ToolMode } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";
import { updateSegmentWithRebuild } from "./planSegmentUpdate";
import { usePlanStorage } from "./usePlanStorage";
import { isGeometryPatch } from "./usePlanHistory";
import { PANEL_WIDTH } from "./PlanRightInputPanel";

interface UseHandlersOpts {
  state: PlanState;
  push: (next: PlanState) => void;
  replace: (next: PlanState) => void;
  undo: () => void;
  redo: () => void;
  reset: (next?: PlanState) => void;
  isMobile: boolean;
  token: string | null;
  setSheetOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setExportOpen: (v: boolean) => void;
  setLibraryOpen: (v: boolean) => void;
  setAuthOpen: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setFocusSegmentId: (v: string | null) => void;
  sheetHeight: number;
  onBeforeLoad?: () => void;
  onAfterLoad?: () => void;
}

export function usePlanHandlers({
  state, push, replace, undo, redo, reset,
  isMobile, token,
  setSheetOpen, setExportOpen, setLibraryOpen, setAuthOpen,
  setRightPanelOpen, setFocusSegmentId, sheetHeight,
  onBeforeLoad, onAfterLoad,
}: UseHandlersOpts) {
  const storage = usePlanStorage();
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Загружаем список планов при логине ───────────────────────────────────
  useEffect(() => {
    if (token) storage.loadPlans(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Помечаем "грязным" при каждом изменении ──────────────────────────────
  const prevPointsLen = useRef(0);
  useEffect(() => {
    const len = state?.points?.length ?? 0;
    if (len > 0 && len !== prevPointsLen.current) storage.markDirty();
    prevPointsLen.current = len;
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Автосохранение каждые 60 секунд ─────────────────────────────────────
  useEffect(() => {
    if (!token || !storage.currentPlanId) return;
    const id = setInterval(() => {
      if (storage.isDirty) storage.save(stateRef.current, token);
    }, 60_000);
    return () => clearInterval(id);
  }, [token, storage.currentPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Обработчики изменений ────────────────────────────────────────────────
  const handleChange = useCallback((patch: Partial<PlanState>) => {
    const next = { ...stateRef.current, ...patch };
    if (isGeometryPatch(patch)) push(next); else replace(next);
  }, [push, replace]);

  // replace без добавления в историю — используется во время drag
  const handleReplace = useCallback((patch: Partial<PlanState>) => {
    replace({ ...stateRef.current, ...patch });
  }, [replace]);

  const handleSettingChange = useCallback((patch: Partial<PlanSettings>) => {
    const s = stateRef.current;
    push({ ...s, settings: { ...s.settings, ...patch } });
  }, [push]);

  const handleUpdateSegment = useCallback((id: string, patch: Partial<Segment>) => {
    const s = stateRef.current;
    push({ ...s, ...updateSegmentWithRebuild(s, id, patch) });
  }, [push]);

  const handleUpdateDiagonal = useCallback((id: string, patch: Partial<DiagonalDef>) => {
    const s = stateRef.current;
    push({ ...s, diagonals: s.diagonals.map(d => d.id === id ? { ...d, ...patch } : d) });
  }, [push]);

  const handleToolChange = useCallback((t: ToolMode) => {
    const s = stateRef.current;
    // При переключении на draw — сбрасываем phase в "draw" если фигура не замкнута
    const phase = t === "draw" && !s.isClosed ? "draw" : s.phase;
    push({ ...s, tool: t, phase });
  }, [push]);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const z = stateRef.current.settings.zoom;
    handleSettingChange({ zoom: Math.min(10, Math.round((z + 0.2) * 10) / 10) });
  }, [handleSettingChange]);

  const zoomOut = useCallback(() => {
    const z = stateRef.current.settings.zoom;
    handleSettingChange({ zoom: Math.max(0.3, Math.round((z - 0.2) * 10) / 10) });
  }, [handleSettingChange]);

  const zoomFit = useCallback((reservedBottomPx = 0, reservedRightPx = 0) => {
    const pts = stateRef.current.points;
    if (!pts || pts.length < 2) { handleSettingChange({ zoom: 1, panX: 0, panY: 0 }); return; }
    const xs = pts.map((p: { x: number }) => p.x);
    const ys = pts.map((p: { y: number }) => p.y);
    // Расширяем bbox на 30 SVG-единиц — место под метки A,B,C,D (18px offset + шрифт)
    const LABEL_MARGIN = 30;
    const minX = Math.min(...xs) - LABEL_MARGIN, maxX = Math.max(...xs) + LABEL_MARGIN;
    const minY = Math.min(...ys) - LABEL_MARGIN, maxY = Math.max(...ys) + LABEL_MARGIN;
    const w = maxX - minX || 100, h = maxY - minY || 100;
    const el = document.getElementById("plan-canvas-wrap");
    if (!el) return;
    const PAD_LEFT = 40, PAD_RIGHT = 40, PAD_TOP = 40, PAD_BOT = 40;
    const cw = el.clientWidth  - PAD_LEFT - PAD_RIGHT - reservedRightPx;
    const ch = el.clientHeight - reservedBottomPx - PAD_TOP - PAD_BOT;
    if (cw <= 0 || ch <= 0) return;
    const z = Math.max(0.2, Math.min(8, Math.min(cw / w, ch / h)));
    const newZoom = Math.round(z * 10) / 10;
    const panX = (cw / 2 / newZoom) - (minX + w / 2) + (PAD_LEFT - PAD_RIGHT) / 2 / newZoom;
    const panY = (ch / 2 / newZoom) - (minY + h / 2) + (PAD_TOP - PAD_BOT) / 2 / newZoom;
    handleSettingChange({ zoom: newZoom, panX: Math.round(panX), panY: Math.round(panY) });
  }, [handleSettingChange]);

  // ── Сохранение ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!token) { setLibraryOpen(true); return; }
    await storage.save(stateRef.current, token);
    storage.loadPlans(token);
  }, [token, storage, setLibraryOpen]);

  const handleSaveAs = useCallback(async (name: string) => {
    if (!token) return;
    const id = await storage.saveAs(stateRef.current, token, name);
    if (id) storage.loadPlans(token);
  }, [token, storage]);

  const handleLoad = useCallback(async (planId: number) => {
    if (!token) return;
    onBeforeLoad?.();
    const loaded = await storage.load(planId, token);
    if (loaded) {
      const allSet = loaded.segments?.length > 0 && loaded.segments.every((s: Segment) => s.lengthCm !== null && s.lengthCm > 0);
      reset({ ...loaded, changedSegmentIds: [], isBuilt: loaded.isBuilt ?? (!!loaded.baseScale && allSet) });
      setTimeout(() => { zoomFit(); onAfterLoad?.(); }, 150);
    } else {
      onAfterLoad?.();
    }
  }, [token, storage, reset, zoomFit, onBeforeLoad, onAfterLoad]);

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

  // ── Клавиатура ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
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
  }, [undo, redo, handleSave, handleToolChange, handleSettingChange, zoomIn, zoomOut, zoomFit, setSheetOpen, setExportOpen, setLibraryOpen]);

  // ── Мобиле: при размыкании — закрываем правую панель ────────────────────
  const prevIsClosed = useRef(state.isClosed);
  useEffect(() => {
    if (!state.isClosed && prevIsClosed.current && isMobile) {
      setRightPanelOpen(false);
      setTimeout(() => zoomFit(0, 0), 80);
    }
    prevIsClosed.current = state.isClosed;
  }, [state.isClosed, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild завершён → zoomFit на всех устройствах ──────────────────────
  const prevIsBuilt = useRef(state.isBuilt);
  useEffect(() => {
    if (state.isBuilt && !prevIsBuilt.current) {
      if (isMobile) setRightPanelOpen(false);
      setTimeout(() => zoomFit(0, 0), 120);
    }
    prevIsBuilt.current = state.isBuilt;
  }, [state.isBuilt, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Мобиле: изменение высоты нижнего бара → пересчёт зума ───────────────
  const prevSheetHeight = useRef(0);
  useEffect(() => {
    if (!isMobile) return;
    if (sheetHeight === prevSheetHeight.current) return;
    prevSheetHeight.current = sheetHeight;
    setTimeout(() => zoomFit(sheetHeight), 50);
  }, [sheetHeight, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize сайдбара ──────────────────────────────────────────────────────
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

  return {
    storage,
    stateRef,
    handleChange,
    handleReplace,
    handleSettingChange,
    handleUpdateSegment,
    handleUpdateDiagonal,
    handleToolChange,
    zoomIn,
    zoomOut,
    zoomFit,
    handleSave,
    handleSaveAs,
    handleLoad,
    handleDelete,
    handleRename,
    handleNew,
    sidebarW,
    onSidebarDragStart,
  };
}
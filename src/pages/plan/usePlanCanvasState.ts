import React, { useRef, useEffect } from "react";

export interface CtxMenuState {
  x: number;
  y: number;
  type: "point" | "segment" | "diagonal";
  id: string;
}

export interface GhostState {
  x: number;
  y: number;
  willClose: boolean;
}

/** Все локальные стейты и refs холста */
export function usePlanCanvasState(tool: string) {
  // ── Refs для управления жестами ──────────────────────────────────────────
  const svgRef      = useRef<SVGSVGElement>(null);
  const dragRef     = useRef<{ pointId: string } | null>(null);
  // Ближайшая точка при touchStart — для lazy grab при движении { id, dist }
  const nearbyPtRef = useRef<{ id: string; dist: number } | null>(null);
  // Время начала касания — для dead zone 100мс перед началом drag
  const touchStartTimeRef = useRef<number>(0);
  const panRef      = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const pinchRef    = useRef<{ dist: number; zoom: number; midX?: number; midY?: number } | null>(null);
  const isPanning   = useRef(false);
  const didMoveRef  = useRef(false);

  // ── Long press ───────────────────────────────────────────────────────────
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPos = useRef<{ clientX: number; clientY: number; type: "point" | "segment" | "diagonal"; id: string } | null>(null);

  // ── Принудительный ре-рендер после вибрации ──────────────────────────────
  const [, setVibrated] = React.useState(false);

  // ── Ghost предпросмотр ───────────────────────────────────────────────────
  const [ghost, setGhost] = React.useState<GhostState | null>(null);

  // ── dimline: первая выбранная точка ──────────────────────────────────────
  const [dimLineFrom, setDimLineFrom] = React.useState<string | null>(null);

  // ── Контекстное меню ─────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenuState | null>(null);

  // ── Hover-цель для инструмента delete (SVG координаты) ──────────────────
  const [deleteHover, setDeleteHover] = React.useState<{ x: number; y: number; type: "point" | "segment" } | null>(null);

  // ── Long-press индикатор (координаты экрана) ─────────────────────────────
  const [lpIndicator, setLpIndicator] = React.useState<{ x: number; y: number } | null>(null);

  // Сбрасываем dimLineFrom при смене инструмента
  useEffect(() => {
    if (tool !== "dimline") setDimLineFrom(null);
  }, [tool]);

  // Polling позиции long-press индикатора
  useEffect(() => {
    const id = setInterval(() => {
      if (longPressPos.current) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        setLpIndicator({
          x: longPressPos.current.clientX - rect.left,
          y: longPressPos.current.clientY - rect.top,
        });
      } else {
        setLpIndicator(null);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  return {
    svgRef,
    dragRef,
    nearbyPtRef,
    touchStartTimeRef,
    panRef,
    pinchRef,
    isPanning,
    didMoveRef,
    longPressRef,
    longPressPos,
    setVibrated,
    ghost, setGhost,
    dimLineFrom, setDimLineFrom,
    ctxMenu, setCtxMenu,
    lpIndicator,
    deleteHover, setDeleteHover,
  };
}

export type PlanCanvasState = ReturnType<typeof usePlanCanvasState>;
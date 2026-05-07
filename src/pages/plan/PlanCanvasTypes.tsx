import React from "react";
import type { Point, Segment, DiagonalDef, DimLine } from "./planTypes";
import Icon from "@/components/ui/icon";

// ── Типы для render-пропсов ───────────────────────────────────────────────────

export interface RenderContext {
  points: Point[];
  segments: Segment[];
  diagonals: DiagonalDef[];
  dimLines: DimLine[];
  scale: number | null;
  isClosed: boolean;
  tool: string;
  showDimLines: boolean;
  showSegmentLabels: boolean;
  showAngleLabels: boolean;
  showDiagonals: boolean;
  showPoints: boolean;
  showPointLabels: boolean;
  selectedPointId: string | null;
  selectedSegmentId: string | null;
  selectedDiagonalId: string | null;
  selectedArcId: string | null;
  selectedDimLineId: string | null;
  intersectingSegIds: string[];
  changedSegmentIds: string[];
  ghost: { x: number; y: number; willClose: boolean } | null;
  dimLineFrom: string | null;
  zoom: number;
  phase: string;
  activeInputIndex?: number;
}

export interface SegmentHandlers {
  onSegmentClick: (e: React.MouseEvent, segId: string) => void;
  onSegmentCtxMenu: (e: React.MouseEvent, segId: string) => void;
  onDimLineClick: (e: React.MouseEvent, dlId: string) => void;
  onDiagonalClick: (e: React.MouseEvent, diagId: string) => void;
  onPointClick: (e: React.MouseEvent, pointId: string) => void;
  onPointMouseDown: (e: React.MouseEvent, pointId: string) => void;
  onPointCtxMenu: (e: React.MouseEvent, pointId: string) => void;
}

// ── CtxItem ───────────────────────────────────────────────────────────────────

export function CtxItem({
  icon, label, onClick, danger = false,
}: {
  icon: string; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition hover:bg-white/[0.06] ${danger ? "text-rose-400" : "text-white/70"}`}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
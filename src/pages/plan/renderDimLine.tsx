import React from "react";
import type { Segment } from "./planTypes";
import { segmentLabel, midPoint, segmentNormal } from "./planTypes";
import type { RenderContext } from "./PlanCanvasTypes";
import { DIM_OFF } from "./PlanCanvasUtils";

// ── renderDimLine ─────────────────────────────────────────────────────────────

export function renderDimLine(seg: Segment, ctx: Pick<RenderContext, "points" | "scale" | "showDimLines" | "zoom">) {
  const { points, showDimLines, zoom } = ctx;
  if (!showDimLines || !seg.showDimLine) return null;
  const a = points.find(p => p.id === seg.fromId);
  const b = points.find(p => p.id === seg.toId);
  if (!a || !b) return null;
  const z = zoom ?? 1;
  const { nx, ny } = segmentNormal(a, b);
  const off  = DIM_OFF / z;
  const tick = 7 / z;
  const sw   = 1 / z;
  const fs   = 10 / z;
  const dy   = -5 / z;
  const x1 = a.x + nx * off, y1 = a.y + ny * off;
  const x2 = b.x + nx * off, y2 = b.y + ny * off;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const lenCm = seg.lengthCm ?? null;
  const label = lenCm !== null ? `${lenCm}` : "";
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const na = angle > 90 || angle < -90 ? angle + 180 : angle;
  return (
    <g key={`dim-${seg.id}`} className="pointer-events-none">
      <line x1={a.x + nx * (off - tick)} y1={a.y + ny * (off - tick)} x2={a.x + nx * (off + tick)} y2={a.y + ny * (off + tick)} stroke="#60a5fa" strokeWidth={sw} />
      <line x1={b.x + nx * (off - tick)} y1={b.y + ny * (off - tick)} x2={b.x + nx * (off + tick)} y2={b.y + ny * (off + tick)} stroke="#60a5fa" strokeWidth={sw} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60a5fa" strokeWidth={sw} strokeDasharray={`${4/z} ${2/z}`} />
      {label && <text x={mx} y={my} transform={`rotate(${na},${mx},${my})`} textAnchor="middle" dominantBaseline="auto" dy={dy} fontSize={fs} fill="#93c5fd" fontFamily="monospace">{label}</text>}
    </g>
  );
}

// ── renderSegmentLabel ────────────────────────────────────────────────────────

export function renderSegmentLabel(seg: Segment, ctx: Pick<RenderContext, "points" | "scale" | "showSegmentLabels" | "zoom">) {
  const { points, showSegmentLabels, zoom } = ctx;
  if (!showSegmentLabels || !seg.showLength) return null;
  const a = points.find(p => p.id === seg.fromId);
  const b = points.find(p => p.id === seg.toId);
  if (!a || !b) return null;
  const z = zoom ?? 1;
  const mid = midPoint(a, b);
  const { nx, ny } = segmentNormal(a, b);
  const lbl = segmentLabel(points, seg);
  const lenCm = seg.lengthCm ?? null;
  const text = lenCm !== null ? `${lbl}: ${lenCm}` : lbl;
  return (
    <text key={`lbl-${seg.id}`} x={mid.x + nx * (13 / z)} y={mid.y + ny * (13 / z)}
      textAnchor="middle" dominantBaseline="middle" fontSize={11 / z} fill="#e2e8f0" fontFamily="monospace"
      className="pointer-events-none select-none">{text}</text>
  );
}

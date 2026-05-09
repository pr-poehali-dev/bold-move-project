import type { Point, Segment, DiagonalDef } from "./planTypes";

// ── Константы ─────────────────────────────────────────────────────────────────
export const PT_R      = 7;   // радиус точки (чуть больше для тача)
export const PT_HIT    = 44;  // зона клика/захвата точки на тач
export const SNAP_THR  = 30;  // увеличен для надёжного снаппинга на тач
export const CLOSE_THR = 30;  // порог замыкания (больше для пальца)
export const DIM_OFF   = 28;

// ── Утилиты поиска ближайшего элемента ───────────────────────────────────────

export function ptToSegDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

export function findNearestSegment(
  x: number, y: number,
  points: Point[],
  segments: Segment[],
  threshold: number,
): Segment | null {
  let best: Segment | null = null;
  let bestD = threshold;
  for (const seg of segments) {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) continue;
    const d = ptToSegDist(x, y, a.x, a.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = seg; }
  }
  return best;
}

export function findNearestDiagonal(
  x: number, y: number,
  points: Point[],
  diagonals: DiagonalDef[],
  threshold: number,
): DiagonalDef | null {
  let best: DiagonalDef | null = null;
  let bestD = threshold;
  for (const diag of diagonals) {
    if (!diag.visible) continue;
    const a = points.find(p => p.id === diag.fromId);
    const b = points.find(p => p.id === diag.toId);
    if (!a || !b) continue;
    const d = ptToSegDist(x, y, a.x, a.y, b.x, b.y);
    if (d < bestD) { bestD = d; best = diag; }
  }
  return best;
}
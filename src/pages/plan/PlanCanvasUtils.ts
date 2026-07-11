import type { Point, Segment, DiagonalDef } from "./planTypes";

// ── Константы ─────────────────────────────────────────────────────────────────
export const PT_R      = 7;   // радиус точки (чуть больше для тача)
export const PT_HIT    = 28;  // зона точного попадания по точке на тач
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

/** Минимальное расстояние между двумя отрезками (px→qy = путь курсора, ax→bx = стена).
 *  Используется чтобы не пропускать тонкие стены при быстром движении мыши —
 *  проверяем весь путь курсора между кадрами, а не только точку под курсором. */
export function segSegDist(
  p1x: number, p1y: number, p2x: number, p2y: number,
  q1x: number, q1y: number, q2x: number, q2y: number,
): number {
  // Если отрезки пересекаются геометрически — расстояние 0
  const d1 = ((p2y - p1y) * (q2x - q1x) - (p2x - p1x) * (q2y - q1y));
  if (Math.abs(d1) > 1e-10) {
    const t = ((q1x - p1x) * (q2y - q1y) - (q1y - p1y) * (q2x - q1x)) / d1;
    const u = ((q1x - p1x) * (p2y - p1y) - (q1y - p1y) * (p2x - p1x)) / d1;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  // Иначе — минимум из расстояний "точка до отрезка" по всем 4 комбинациям
  return Math.min(
    ptToSegDist(p1x, p1y, q1x, q1y, q2x, q2y),
    ptToSegDist(p2x, p2y, q1x, q1y, q2x, q2y),
    ptToSegDist(q1x, q1y, p1x, p1y, p2x, p2y),
    ptToSegDist(q2x, q2y, p1x, p1y, p2x, p2y),
  );
}

/** Находит ID всех стен, задетых путём курсора от (fromX,fromY) до (toX,toY)
 *  в пределах threshold px — гарантирует что стена отметится, даже если между
 *  двумя кадрами mousemove курсор её "перепрыгнул" при быстром движении. */
export function findSegmentsAlongPath(
  fromX: number, fromY: number, toX: number, toY: number,
  points: Point[],
  segments: Segment[],
  threshold: number,
): Segment[] {
  const hit: Segment[] = [];
  for (const seg of segments) {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) continue;
    const d = segSegDist(fromX, fromY, toX, toY, a.x, a.y, b.x, b.y);
    if (d < threshold) hit.push(seg);
  }
  return hit;
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
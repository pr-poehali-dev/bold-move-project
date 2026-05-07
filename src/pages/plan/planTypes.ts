// ─── Базовые типы ────────────────────────────────────────────────────────────

export interface Point {
  id: string;
  x: number;
  y: number;
}

export interface Segment {
  id: string;
  fromId: string;
  toId: string;
  lengthCm: number | null;
  showLength: boolean;
  showDimLine: boolean;
  // радиус скругления угла в точке "to" (0 = нет дуги)
  arcRadius: number;
}

export interface DiagonalDef {
  id: string;
  fromId: string;
  toId: string;
  lengthCm: number | null;
  showLength: boolean;
  visible: boolean;
}

export interface ArcDef {
  id: string;
  segmentId: string;
  bulge: number;
  radiusCm: number;
  visible: boolean;
}

export interface DimLine {
  id: string;
  fromId: string;
  toId: string;
  offsetPx: number;     // смещение линии от отрезка
  visible: boolean;
  labelCm: number | null;
}

// ─── Параметры помещения (как в Estiroom) ────────────────────────────────────

export interface RoomParams {
  name: string;
  floorToCeilCm: number | null;    // высота от пола до чернового потолка
  mansardCeiling: boolean;          // мансардный потолок
  concreteDipMm: number | null;     // опуск от бетона, мм
}

// ─── Режимы инструментов ─────────────────────────────────────────────────────

export type ToolMode =
  | "draw"
  | "move"
  | "segment"
  | "diagonal"
  | "arc"
  | "dimline"
  | "delete";

export type InputPhase = "draw" | "lengths" | "angles";

export type SidebarTab = "drawing" | "markup" | "calc" | "legend";

// ─── Настройки холста ────────────────────────────────────────────────────────

export interface PlanSettings {
  ortho: boolean;
  snapToPoints: boolean;
  showGrid: boolean;
  gridSize: number;
  zoom: number;
  panX: number;
  panY: number;
  showSegmentLabels: boolean;
  showAngleLabels: boolean;
  showDiagonals: boolean;
  showDimLines: boolean;
  showPoints: boolean;
  showPointLabels: boolean;
}

// ─── Полное состояние плана ──────────────────────────────────────────────────

export interface PlanState {
  points: Point[];
  segments: Segment[];
  diagonals: DiagonalDef[];
  arcs: ArcDef[];
  dimLines: DimLine[];
  isClosed: boolean;
  settings: PlanSettings;
  tool: ToolMode;
  phase: InputPhase;
  sidebarTab: SidebarTab;
  room: RoomParams;
  selectedPointId: string | null;
  selectedSegmentId: string | null;
  selectedDiagonalId: string | null;
  selectedArcId: string | null;
  selectedDimLineId: string | null;
  activeInputIndex: number;
  /** Базовый масштаб px/cm, устанавливается при первом вводе длины стороны и больше не меняется */
  baseScale: number | null;
  /** Фигура перестроена (все стороны введены и выполнен rebuild). Включает режим редактирования. */
  isBuilt: boolean;
  /** ID сторон которые были автоматически пересчитаны при последней перестройке (для подсветки) */
  changedSegmentIds: string[];
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
export function genId(prefix = "p"): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

export function pointLabel(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < 26) return letters[index];
  return letters[Math.floor(index / 26) - 1] + letters[index % 26];
}

export function segmentLabel(points: Point[], seg: Segment): string {
  const a = points.findIndex(p => p.id === seg.fromId);
  const b = points.findIndex(p => p.id === seg.toId);
  if (a < 0 || b < 0) return "?-?";
  return `${pointLabel(a)}-${pointLabel(b)}`;
}

export function distPx(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Сдвинуть только конечную точку отрезка segId на новую длину newLenCm.
 * Все остальные точки остаются на месте.
 * Соседние отрезки пересчитываются автоматически через новые координаты точки.
 *
 * baseScale устанавливается при первом вводе (когда baseScaleIn === null).
 */
export function moveEndPoint(
  points: Point[],
  segments: Segment[],
  segId: string,
  newLenCm: number,
  baseScaleIn: number | null,
): { points: Point[]; baseScale: number } | null {
  if (newLenCm <= 0) return null;
  if (points.length < 2 || segments.length < 2) return null;

  const seg = segments.find(s => s.id === segId);
  if (!seg) return null;

  const fromPt = points.find(p => p.id === seg.fromId);
  const toPt   = points.find(p => p.id === seg.toId);
  if (!fromPt || !toPt) return null;

  const origPx = distPx(fromPt, toPt);
  if (origPx === 0) return null;

  // Масштаб: устанавливается один раз при первом вводе
  const scale = baseScaleIn ?? (origPx / newLenCm);

  const targetPx = newLenCm * scale;

  // Единичный вектор направления отрезка
  const ux = (toPt.x - fromPt.x) / origPx;
  const uy = (toPt.y - fromPt.y) / origPx;

  // Новая позиция конечной точки
  const newTo = {
    x: fromPt.x + ux * targetPx,
    y: fromPt.y + uy * targetPx,
  };

  const newPoints = points.map(p =>
    p.id === seg.toId ? { ...p, ...newTo } : p
  );

  return { points: newPoints, baseScale: scale };
}

/**
 * Перестроить 4-угольник как правильный прямоугольник (все углы 90°).
 * Фиксируем точку A (points[0]), строим B, C, D по осям X/Y.
 * Размеры берём из lengthCm отрезков (если введены), иначе из пикселей/масштаба.
 */
export function buildOrthoRect(
  points: Point[],
  segments: Segment[],
  baseScaleIn: number | null,
): { points: Point[]; baseScale: number } | null {
  if (points.length !== 4 || segments.length !== 4) return null;

  // Строим цепочку A→B→C→D
  const chain: string[] = [points[0].id];
  let cur = points[0].id;
  for (let i = 0; i < 4; i++) {
    const s = segments.find(sg => sg.fromId === cur);
    if (!s) return null;
    if (chain.includes(s.toId)) break;
    chain.push(s.toId);
    cur = s.toId;
  }
  if (chain.length !== 4) return null;

  const orderedSegs: Segment[] = [];
  for (let i = 0; i < 4; i++) {
    const s = segments.find(sg => sg.fromId === chain[i] && sg.toId === chain[(i + 1) % 4]);
    if (!s) return null;
    orderedSegs.push(s);
  }

  // Масштаб
  let scale = baseScaleIn;
  if (!scale) {
    for (const s of orderedSegs) {
      if (!s.lengthCm || s.lengthCm <= 0) continue;
      const pa = points.find(p => p.id === s.fromId);
      const pb = points.find(p => p.id === s.toId);
      if (!pa || !pb) continue;
      const px = distPx(pa, pb);
      if (px > 0) { scale = px / s.lengthCm; break; }
    }
  }
  if (!scale) return null;

  // Длины в пикселях для каждого отрезка
  const getLenPx = (s: Segment, idx: number): number => {
    if (s.lengthCm && s.lengthCm > 0) return s.lengthCm * scale!;
    const pa = points.find(p => p.id === s.fromId);
    const pb = points.find(p => p.id === s.toId);
    return pa && pb ? distPx(pa, pb) : 100;
  };

  const wPx = getLenPx(orderedSegs[0], 0); // A-B (горизонталь)
  const hPx = getLenPx(orderedSegs[1], 1); // B-C (вертикаль)

  // Определяем ориентацию по оригинальным точкам A, B, C
  const ptA = points.find(p => p.id === chain[0])!;
  const ptB = points.find(p => p.id === chain[1])!;
  const ptC = points.find(p => p.id === chain[2])!;
  const dx = ptB.x - ptA.x;
  const dy = ptB.y - ptA.y;
  // Основная ось A-B
  const abLen = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / abLen, uy = dy / abLen;
  // Два варианта перпендикуляра — выбираем тот что ближе к оригинальной точке C
  const vx1 = -uy, vy1 = ux;
  const vx2 = uy, vy2 = -ux;
  const d1 = (ptB.x + vx1 - ptC.x) ** 2 + (ptB.y + vy1 - ptC.y) ** 2;
  const d2 = (ptB.x + vx2 - ptC.x) ** 2 + (ptB.y + vy2 - ptC.y) ** 2;
  const vx = d1 < d2 ? vx1 : vx2;
  const vy = d1 < d2 ? vy1 : vy2;

  const ax = ptA.x, ay = ptA.y;
  const bx = ax + ux * wPx, by = ay + uy * wPx;
  const cx = bx + vx * hPx, cy = by + vy * hPx;
  const dx2 = ax + vx * hPx, dy2 = ay + vy * hPx;

  const coords: Record<string, { x: number; y: number }> = {
    [chain[0]]: { x: ax, y: ay },
    [chain[1]]: { x: bx, y: by },
    [chain[2]]: { x: cx, y: cy },
    [chain[3]]: { x: dx2, y: dy2 },
  };

  const newPoints = points.map(p => coords[p.id] ? { ...p, ...coords[p.id] } : p);
  return { points: newPoints, baseScale: scale };
}

/**
 * Пересчитать позиции ВСЕХ точек фигуры по заданным длинам отрезков.
 *
 * baseScale (px/cm) устанавливается при первом вводе и НИКОГДА не меняется.
 * Это гарантирует что все 400 = 400px×scale — одинаковое расстояние на холсте.
 */
export function resizeSegmentInPlace(
  points: Point[],
  segments: Segment[],
  segId: string,
  newLenCm: number,
  baseScaleIn: number | null,
): { points: Point[]; baseScale: number } | null {
  if (newLenCm <= 0) return null;
  if (points.length < 2 || segments.length < 2) return null;

  // Строим упорядоченную цепочку pointId[] начиная с points[0]
  const chain: string[] = [points[0].id];
  let cur = points[0].id;
  for (let i = 0; i < segments.length; i++) {
    const s = segments.find(sg => sg.fromId === cur);
    if (!s) break;
    if (chain.includes(s.toId)) break;
    chain.push(s.toId);
    cur = s.toId;
  }
  if (chain.length < 2) return null;

  // Собираем отрезки в порядке цепочки
  const orderedSegs: Segment[] = [];
  for (let i = 0; i < chain.length; i++) {
    const fromId = chain[i];
    const toId = chain[(i + 1) % chain.length];
    const s = segments.find(sg => sg.fromId === fromId && sg.toId === toId);
    if (!s) return null;
    orderedSegs.push(s);
  }

  // baseScale устанавливается ОДИН РАЗ при первом вводе и никогда не меняется.
  // Это гарантирует что 400см = одинаковое расстояние на холсте для всех отрезков.
  let scale = baseScaleIn;
  if (!scale) {
    // Первый ввод — вычисляем из текущего отрезка до его изменения
    const editedSeg = orderedSegs.find(s => s.id === segId);
    if (!editedSeg) return null;
    const eFrom = points.find(p => p.id === editedSeg.fromId);
    const eTo   = points.find(p => p.id === editedSeg.toId);
    if (!eFrom || !eTo) return null;
    const ePx = distPx(eFrom, eTo);
    if (ePx === 0) return null;
    scale = ePx / newLenCm; // px / cm
  }

  // Целевая пиксельная длина: lengthCm × scale (одинаковый scale для всех)
  const targetPx = new Map<string, number>();
  for (const s of orderedSegs) {
    const pa = points.find(p => p.id === s.fromId);
    const pb = points.find(p => p.id === s.toId);
    if (!pa || !pb) return null;
    const origPx = distPx(pa, pb);
    const lenCm = s.id === segId ? newLenCm : s.lengthCm;
    targetPx.set(s.id, (lenCm !== null && lenCm > 0) ? lenCm * scale : origPx);
  }

  // Строим новые координаты кинематически (p[0] — якорь, не двигается)
  const p0 = points.find(p => p.id === chain[0]);
  if (!p0) return null;
  const newCoords = new Map<string, { x: number; y: number }>();
  newCoords.set(chain[0], { x: p0.x, y: p0.y });

  for (let i = 0; i < chain.length; i++) {
    const fromId = chain[i];
    const toId   = chain[(i + 1) % chain.length];
    if (toId === chain[0]) break;

    const s = orderedSegs[i];
    const curFrom = newCoords.get(fromId)!;

    // Единичный вектор направления из ОРИГИНАЛЬНЫХ точек
    const origFrom = points.find(p => p.id === s.fromId)!;
    const origTo   = points.find(p => p.id === s.toId)!;
    const origLen  = distPx(origFrom, origTo);
    const ux = origLen > 0 ? (origTo.x - origFrom.x) / origLen : 0;
    const uy = origLen > 0 ? (origTo.y - origFrom.y) / origLen : 0;

    const px = targetPx.get(s.id) ?? origLen;
    newCoords.set(toId, { x: curFrom.x + ux * px, y: curFrom.y + uy * px });
  }

  const newPoints = points.map(p => {
    const nc = newCoords.get(p.id);
    return nc ? { ...p, x: nc.x, y: nc.y } : p;
  });

  return { points: newPoints, baseScale: scale };
}

/**
 * Перестроить фигуру когда ВСЕ длины введены.
 * Фиксируем точку p[0] и первый отрезок как эталон масштаба.
 * Остальные точки строятся кинематически вдоль оригинальных направлений.
 */
export function rebuildFromLengths(
  points: Point[],
  segments: Segment[], // все lengthCm уже заполнены
  baseScaleIn: number | null,
): { points: Point[]; baseScale: number } | null {
  if (points.length < 2 || segments.length < 2) return null;

  // Упорядоченная цепочка от points[0]
  const chain: string[] = [points[0].id];
  let cur = points[0].id;
  for (let i = 0; i < segments.length; i++) {
    const s = segments.find(sg => sg.fromId === cur);
    if (!s) break;
    if (chain.includes(s.toId)) break;
    chain.push(s.toId);
    cur = s.toId;
  }
  if (chain.length < 2) return null;

  const orderedSegs: Segment[] = [];
  for (let i = 0; i < chain.length; i++) {
    const s = segments.find(sg => sg.fromId === chain[i] && sg.toId === chain[(i + 1) % chain.length]);
    if (!s) return null;
    orderedSegs.push(s);
  }

  // Масштаб: если передан baseScale — используем его, иначе вычисляем из первого отрезка с lengthCm
  let scale = baseScaleIn;
  if (!scale) {
    for (const s of orderedSegs) {
      if (!s.lengthCm || s.lengthCm <= 0) continue;
      const pa = points.find(p => p.id === s.fromId);
      const pb = points.find(p => p.id === s.toId);
      if (!pa || !pb) continue;
      const px = distPx(pa, pb);
      if (px > 0) { scale = px / s.lengthCm; break; }
    }
  }
  if (!scale) return null;

  // Строим точки: p[0] фиксирован, каждая следующая = предыдущая + direction * targetPx
  const p0 = points.find(p => p.id === chain[0]);
  if (!p0) return null;
  const newCoords = new Map<string, { x: number; y: number }>();
  newCoords.set(chain[0], { x: p0.x, y: p0.y });

  for (let i = 0; i < chain.length; i++) {
    const toId = chain[(i + 1) % chain.length];
    if (toId === chain[0]) break;
    const s = orderedSegs[i];
    const curFrom = newCoords.get(chain[i])!;

    // Оригинальное направление отрезка из исходных точек
    const oFrom = points.find(p => p.id === s.fromId)!;
    const oTo   = points.find(p => p.id === s.toId)!;
    const oLen  = distPx(oFrom, oTo);
    const ux = oLen > 0 ? (oTo.x - oFrom.x) / oLen : 0;
    const uy = oLen > 0 ? (oTo.y - oFrom.y) / oLen : 0;

    // Целевая пиксельная длина:
    // — если lengthCm задана вручную → lengthCm * scale (единый масштаб)
    // — если нет → оставляем оригинальную пиксельную длину
    const hasManual = s.lengthCm !== null && s.lengthCm > 0;
    const targetPx = hasManual ? s.lengthCm! * scale : oLen;
    newCoords.set(toId, { x: curFrom.x + ux * targetPx, y: curFrom.y + uy * targetPx });
  }

  return {
    points: points.map(p => { const nc = newCoords.get(p.id); return nc ? { ...p, ...nc } : p; }),
    baseScale: scale,
  };
}

export function calcScale(points: Point[], segments: Segment[]): number | null {
  for (const seg of segments) {
    if (seg.lengthCm === null || seg.lengthCm <= 0) continue;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) continue;
    const px = distPx(a, b);
    if (px === 0) continue;
    return px / seg.lengthCm;
  }
  return null;
}

export function pxToCm(px: number, scale: number | null): number | null {
  if (!scale) return null;
  return Math.round((px / scale) * 10) / 10;
}

export function cmToPx(cm: number, scale: number): number {
  return cm * scale;
}

/** Знак ориентации полигона в SVG (Y↓).
 *  > 0 = по часовой стрелке, < 0 = против часовой. */
export function polygonOrientation(points: Point[]): number {
  const n = points.length;
  if (n < 3) return 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += (points[j].x - points[i].x) * (points[j].y + points[i].y);
  }
  return sum;
}

/** Внутренний угол в точке B между отрезками A-B и B-C (в градусах, 0–360).
 *  isCW — полигон обходится по часовой стрелке (в SVG где Y↓). */
export function angleDeg(a: Point, b: Point, c: Point, isCW = true): number {
  const ax = a.x - b.x, ay = a.y - b.y;
  const cx = c.x - b.x, cy = c.y - b.y;
  const dot = ax * cx + ay * cy;
  const cross = ax * cy - ay * cx;
  const between = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);
  // В SVG Y↓: cross > 0 = поворот по часовой
  // Для полигона по часовой — внутренний угол когда cross > 0
  // Для полигона против часовой — внутренний угол когда cross < 0
  const isInner = isCW ? cross > 0 : cross < 0;
  const angle = isInner ? between : 360 - between;
  return Math.round(angle * 10) / 10;
}

export function snapVal(v: number, grid: number, enabled: boolean): number {
  if (!enabled) return v;
  return Math.round(v / grid) * grid;
}

export function snapToPoint(
  x: number, y: number,
  points: Point[],
  excludeId: string | null,
  threshold: number,
  enabled: boolean
): { x: number; y: number; snapped: boolean; snapId: string | null } {
  if (!enabled) return { x, y, snapped: false, snapId: null };
  let best: Point | null = null;
  let bestDist = threshold;
  for (const p of points) {
    if (p.id === excludeId) continue;
    const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  if (best) return { x: best.x, y: best.y, snapped: true, snapId: best.id };
  return { x, y, snapped: false, snapId: null };
}

export function orthoPoint(prev: Point, x: number, y: number): { x: number; y: number } {
  const dx = Math.abs(x - prev.x);
  const dy = Math.abs(y - prev.y);
  if (dx >= dy) return { x, y: prev.y };
  return { x: prev.x, y };
}

export function polygonArea(points: Point[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function polygonPerimeter(points: Point[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let perim = 0;
  for (let i = 0; i < n; i++) {
    perim += distPx(points[i], points[(i + 1) % n]);
  }
  return perim;
}

/** Проверяет пересечение двух отрезков (строго, без крайних точек) */
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const denom = (by - ay) * (dx - cx) - (bx - ax) * (dy - cy);
  if (Math.abs(denom) < 1e-10) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  // Строго внутри (не на концах)
  return t > 1e-8 && t < 1 - 1e-8 && u > 1e-8 && u < 1 - 1e-8;
}

/** Проверяет, проходит ли диагональ (from→to) сквозь стены фигуры */
export function diagonalCrossesWall(
  from: Point, to: Point,
  points: Point[],
  segments: { fromId: string; toId: string }[],
): boolean {
  for (const seg of segments) {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) continue;
    // Не проверяем отрезки, которые смежны с from или to
    if (a.id === from.id || a.id === to.id || b.id === from.id || b.id === to.id) continue;
    if (segmentsIntersect(from.x, from.y, to.x, to.y, a.x, a.y, b.x, b.y)) return true;
  }
  return false;
}

/** Возвращает id отрезков которые пересекаются с другими отрезками фигуры */
export function findSelfIntersections(points: Point[], segments: Segment[]): string[] {
  const result = new Set<string>();
  for (let i = 0; i < segments.length; i++) {
    const si = segments[i];
    const ai = points.find(p => p.id === si.fromId);
    const bi = points.find(p => p.id === si.toId);
    if (!ai || !bi) continue;
    for (let j = i + 2; j < segments.length; j++) {
      // Пропускаем смежные отрезки (замыкающий со стартовым)
      if (i === 0 && j === segments.length - 1) continue;
      const sj = segments[j];
      const aj = points.find(p => p.id === sj.fromId);
      const bj = points.find(p => p.id === sj.toId);
      if (!aj || !bj) continue;
      if (segmentsIntersect(ai.x, ai.y, bi.x, bi.y, aj.x, aj.y, bj.x, bj.y)) {
        result.add(si.id);
        result.add(sj.id);
      }
    }
  }
  return Array.from(result);
}

export function buildAutoDiagonals(
  points: Point[],
  existingDiagonals: DiagonalDef[],
  baseScale: number | null = null,
): DiagonalDef[] {
  const n = points.length;
  if (n < 4) return [];
  const result: DiagonalDef[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const from = points[i];
      const to   = points[j];
      if (diagonalCrossesWall(from, to, points, points.map((_, k) => ({
        fromId: points[k].id,
        toId:   points[(k + 1) % n].id,
      })))) continue;
      const fromId = from.id;
      const toId   = to.id;
      const existing = existingDiagonals.find(
        d => (d.fromId === fromId && d.toId === toId) ||
             (d.fromId === toId && d.toId === fromId)
      );
      // Автоматически вычисляем lengthCm если есть масштаб
      const autoCm = baseScale && baseScale > 0
        ? Math.round((distPx(from, to) / baseScale) * 10) / 10
        : null;
      if (existing) {
        // Обновляем lengthCm только если клиент не вводил вручную
        const lenCm = existing.lengthCm !== null ? existing.lengthCm : autoCm;
        result.push({ ...existing, lengthCm: lenCm });
      } else {
        result.push({ id: genId("d"), fromId, toId, lengthCm: autoCm, showLength: true, visible: true });
      }
    }
  }
  return result;
}

/**
 * Перестраивает фигуру по введённым длинам, сохраняя углы из оригинала.
 * Точка A (points[0]) фиксирована.
 * Срабатывает только когда введены ВСЕ стороны.
 * Возвращает новые точки и обновлённый baseScale, или null если не все стороны введены.
 */
export function rebuildFromAnglesAndLengths(
  points: Point[],
  segments: Segment[],
  baseScaleIn: number | null,
  changedSegId?: string,
): { points: Point[]; baseScale: number } | null {
  if (points.length < 3 || segments.length < 3) return null;

  // Строим полную упорядоченную цепочку начиная с points[0]
  const buildChainFrom = (startId: string): string[] | null => {
    const chain: string[] = [startId];
    let cur = startId;
    for (let i = 0; i < segments.length; i++) {
      const s = segments.find(sg => sg.fromId === cur);
      if (!s) break;
      if (chain.includes(s.toId)) break;
      chain.push(s.toId);
      cur = s.toId;
    }
    return chain.length === points.length ? chain : null;
  };

  // Базовая цепочка с points[0]
  let chain = buildChainFrom(points[0].id);
  if (!chain) return null;

  // Если указан изменённый сегмент — строим цепочку от его toId.
  // Логика: toId фиксируется (не двигается), fromId вычисляется через замыкание.
  // Изменённый сегмент будет замыкающим — но его длина применяется через scale,
  // который мы вычисляем отдельно из изменённого сегмента в PlanSidebarDrawingTab.
  // Таким образом все остальные точки перестраиваются с учётом нового масштаба,
  // а toId изменённого сегмента остаётся на месте.
  if (changedSegId) {
    const changedSeg = segments.find(s => s.id === changedSegId);
    if (changedSeg) {
      const newChain = buildChainFrom(changedSeg.toId);
      if (newChain) chain = newChain;
    }
  }

  const orderedSegs: Segment[] = [];
  for (let i = 0; i < chain.length; i++) {
    const s = segments.find(sg => sg.fromId === chain[i] && sg.toId === chain[(i + 1) % chain.length]);
    if (!s) return null;
    orderedSegs.push(s);
  }

  // Все стороны должны быть введены
  if (!orderedSegs.every(s => s.lengthCm !== null && s.lengthCm > 0)) return null;

  // Масштаб из первого введённого отрезка (или сохраняем существующий)
  let scale = baseScaleIn;
  if (!scale) {
    const s = orderedSegs[0];
    const pa = points.find(p => p.id === s.fromId);
    const pb = points.find(p => p.id === s.toId);
    if (pa && pb) {
      const px = distPx(pa, pb);
      if (px > 0 && s.lengthCm) scale = px / s.lengthCm;
    }
  }
  if (!scale) return null;

  // Строим новые координаты: A фиксирована, идём по направлениям оригинала × введённые длины
  const p0 = points.find(p => p.id === chain[0])!;
  const newCoords = new Map<string, { x: number; y: number }>();
  newCoords.set(chain[0], { x: p0.x, y: p0.y });

  // Строим точки вперёд по цепочке (все N-1 сегментов, кроме замыкающего)
  for (let i = 0; i < chain.length - 1; i++) {
    const toId = chain[i + 1];
    const s = orderedSegs[i];
    const curFrom = newCoords.get(chain[i])!;
    const oFrom = points.find(p => p.id === s.fromId)!;
    const oTo   = points.find(p => p.id === s.toId)!;
    const oLen  = distPx(oFrom, oTo);
    const ux = oLen > 0 ? (oTo.x - oFrom.x) / oLen : 0;
    const uy = oLen > 0 ? (oTo.y - oFrom.y) / oLen : 0;
    const targetPx = s.lengthCm! * scale;
    newCoords.set(toId, { x: curFrom.x + ux * targetPx, y: curFrom.y + uy * targetPx });
  }

  const newPoints = points.map(p => {
    const nc = newCoords.get(p.id);
    return nc ? { ...p, ...nc } : p;
  });

  return { points: newPoints, baseScale: scale };
}

/**
 * Перестраивает фигуру с точными 90° для «прямых» углов.
 * Углы ≈90° или ≈270° (±SNAP_TOL) заменяются на ровно 90°/270°.
 * Скосы (остальные углы) — сохраняют оригинальное направление.
 * Требует: все lengthCm заполнены, baseScale задан.
 *
 * Алгоритм:
 * 1. Упорядочиваем цепочку точек через сегменты.
 * 2. Первый сегмент — «базовое» направление (определяем ближайшее горизонт/вертик или скос).
 * 3. Для каждого следующего угла: если ≈90° — поворот на 90°, если ≈270° — поворот на -90°,
 *    иначе — поворот на оригинальный вектор следующего сегмента.
 * 4. Длины — из lengthCm * baseScale.
 */
export function rebuildWithRightAngles(
  points: Point[],
  segments: Segment[],
  baseScale: number,
): { points: Point[]; hasSkews: boolean; segments?: Segment[] } | null {
  if (points.length < 3 || segments.length < 3) return null;
  if (!segments.every(s => s.lengthCm !== null && s.lengthCm > 0)) return null;

  const SNAP_TOL = 15; // ±15° считаем "прямым углом"

  // Строим упорядоченную цепочку
  const chain: string[] = [points[0].id];
  let cur = points[0].id;
  for (let i = 0; i < segments.length; i++) {
    const s = segments.find(sg => sg.fromId === cur);
    if (!s) break;
    if (chain.includes(s.toId)) break;
    chain.push(s.toId);
    cur = s.toId;
  }
  if (chain.length !== points.length) return null;

  const orderedSegs: Segment[] = [];
  for (let i = 0; i < chain.length; i++) {
    const s = segments.find(sg => sg.fromId === chain[i] && sg.toId === chain[(i + 1) % chain.length]);
    if (!s) return null;
    orderedSegs.push(s);
  }

  const isCW = polygonOrientation(points) > 0;

  // Вычисляем нарисованные углы в каждой точке цепочки
  const drawnAngles: number[] = chain.map((ptId, i) => {
    const pt   = points.find(p => p.id === ptId)!;
    const prev = points.find(p => p.id === chain[(i - 1 + chain.length) % chain.length])!;
    const next = points.find(p => p.id === chain[(i + 1) % chain.length])!;
    return angleDeg(prev, pt, next, isCW);
  });

  // Снапим каждый угол к 90° или 270° если близко
  const snapAngle = (deg: number): number | null => {
    if (Math.abs(deg - 90) <= SNAP_TOL) return 90;
    if (Math.abs(deg - 270) <= SNAP_TOL) return 270;
    return null; // скос — оставляем как есть
  };

  const snappedAngles = drawnAngles.map(snapAngle);
  const hasSkews = snappedAngles.some(a => a === null);

  // Определяем начальное направление первого сегмента
  // Снапим к ближайшей оси (0°, 90°, 180°, 270°) если угол к оси < SNAP_TOL
  const oFrom0 = points.find(p => p.id === orderedSegs[0].fromId)!;
  const oTo0   = points.find(p => p.id === orderedSegs[0].toId)!;
  const rawAngle0 = Math.atan2(oTo0.y - oFrom0.y, oTo0.x - oFrom0.x) * 180 / Math.PI;
  const axisAngles = [0, 90, 180, -90, -180];
  let initAngleDeg = rawAngle0;
  let minDiff = Infinity;
  for (const ax of axisAngles) {
    const diff = Math.abs(rawAngle0 - ax);
    if (diff < minDiff && diff <= SNAP_TOL) {
      minDiff = diff;
      initAngleDeg = ax;
    }
  }

  // Строим координаты цепочки
  const anchor = points.find(p => p.id === chain[0])!;
  const newCoords = new Map<string, { x: number; y: number }>();
  newCoords.set(chain[0], { x: anchor.x, y: anchor.y });

  let dirRad = initAngleDeg * Math.PI / 180;

  for (let i = 0; i < chain.length - 1; i++) {
    const seg = orderedSegs[i];
    const lenPx = seg.lengthCm! * baseScale;
    const fromCoord = newCoords.get(chain[i])!;
    const toId = chain[i + 1];

    // Следующая точка в направлении dirRad на lenPx
    // Снапим cos/sin к точным 0/±1 для осевых направлений
    const cosD = Math.abs(Math.cos(dirRad)) < 1e-10 ? 0 : Math.cos(dirRad);
    const sinD = Math.abs(Math.sin(dirRad)) < 1e-10 ? 0 : Math.sin(dirRad);
    newCoords.set(toId, {
      x: fromCoord.x + cosD * lenPx,
      y: fromCoord.y + sinD * lenPx,
    });

    // Поворачиваем направление для следующего сегмента
    // Угол в точке toId (chain[i+1]) определяет поворот
    const nextAngleIdx = i + 1; // угол в точке chain[i+1]
    const snapped = snappedAngles[nextAngleIdx];

    if (snapped === 90 || snapped === 270) {
      // Прямой угол: поворачиваем на ±90°
      // Внутренний угол 90° (CW полигон) = поворот влево (против часовой) = -90°
      // Внутренний угол 270° (CW полигон) = поворот вправо (по часовой) = +90°
      const turnRad = (snapped === 90)
        ? (isCW ? -Math.PI / 2 : Math.PI / 2)
        : (isCW ? Math.PI / 2 : -Math.PI / 2);
      dirRad += turnRad;
      // Снапим к ближайшей оси (0°, ±90°, ±180°) чтобы не накапливать float-погрешность
      const axisDeg = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI];
      let snapDiff = Infinity;
      let snapVal = dirRad;
      for (const ax of axisDeg) {
        const diff = Math.abs(dirRad - ax);
        if (diff < snapDiff) { snapDiff = diff; snapVal = ax; }
      }
      dirRad = snapVal;
    } else if (snapped === null && i < chain.length - 2) {
      // Скос: берём оригинальный вектор следующего сегмента
      const nextSeg = orderedSegs[i + 1];
      const nFrom = points.find(p => p.id === nextSeg.fromId)!;
      const nTo   = points.find(p => p.id === nextSeg.toId)!;
      dirRad = Math.atan2(nTo.y - nFrom.y, nTo.x - nFrom.x);
    }
    // Для последнего перехода (замыкание) — направление уже не нужно
  }

  const newPoints = points.map(p => {
    const nc = newCoords.get(p.id);
    return nc ? { ...p, ...nc } : p;
  });

  // Проверяем замыкание: если последний сегмент H-A не совпадает с введённой длиной
  // — это значит алгоритм накопил ошибку. Исправляем lengthCm последнего сегмента.
  const lastSeg = orderedSegs[orderedSegs.length - 1];
  const lastFrom = newPoints.find(p => p.id === lastSeg.fromId);
  const lastTo   = newPoints.find(p => p.id === lastSeg.toId);
  let correctedSegments = segments;
  if (lastFrom && lastTo) {
    const realPx = distPx(lastFrom, lastTo);
    const realCm = Math.round((realPx / baseScale) * 10) / 10;
    if (Math.abs(realCm - (lastSeg.lengthCm ?? 0)) > 0.5) {
      correctedSegments = segments.map(s =>
        s.id === lastSeg.id ? { ...s, lengthCm: realCm } : s
      );
    }
  }

  return { points: newPoints, hasSkews, segments: correctedSegments };
}

/**
 * Проверяет замкнутость фигуры по введённым длинам и направлениям отрезков.
 * Возвращает погрешность в процентах (0 = идеально замкнута).
 * Если не все стороны введены — возвращает null.
 */
export function checkClosureError(
  points: Point[],
  segments: Segment[],
  baseScale: number | null,
): number | null {
  if (!baseScale || points.length < 3 || segments.length < 3) return null;

  // Строим упорядоченную цепочку
  const chain: string[] = [points[0].id];
  let cur = points[0].id;
  for (let i = 0; i < segments.length; i++) {
    const s = segments.find(sg => sg.fromId === cur);
    if (!s) break;
    if (chain.includes(s.toId)) break;
    chain.push(s.toId);
    cur = s.toId;
  }
  if (chain.length !== points.length) return null;

  const orderedSegs: Segment[] = [];
  for (let i = 0; i < chain.length; i++) {
    const s = segments.find(sg => sg.fromId === chain[i] && sg.toId === chain[(i + 1) % chain.length]);
    if (!s) return null;
    orderedSegs.push(s);
  }

  // Все стороны должны быть введены
  if (!orderedSegs.every(s => s.lengthCm !== null && s.lengthCm > 0)) return null;

  // Строим цепочку по направлениям из оригинальных точек + введённым длинам
  let x = 0, y = 0;
  let totalCm = 0;
  for (const s of orderedSegs) {
    const fromPt = points.find(p => p.id === s.fromId)!;
    const toPt   = points.find(p => p.id === s.toId)!;
    const origPx = distPx(fromPt, toPt);
    if (origPx === 0) continue;
    const ux = (toPt.x - fromPt.x) / origPx;
    const uy = (toPt.y - fromPt.y) / origPx;
    const lenCm = s.lengthCm!;
    x += ux * lenCm;
    y += uy * lenCm;
    totalCm += lenCm;
  }

  if (totalCm === 0) return null;

  // Расстояние от конечной точки до начала (должно быть 0)
  const errorCm = Math.sqrt(x * x + y * y);
  return Math.round((errorCm / totalCm) * 1000) / 10; // % с одним знаком
}

export function midPoint(a: Point, b: Point): Point {
  return { id: "", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function segmentNormal(a: Point, b: Point): { nx: number; ny: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { nx: -dy / len, ny: dx / len };
}

/** SVG arc path для скругления угла в точке pt между prev и next */
export function cornerArcPath(
  prev: Point, pt: Point, next: Point, radiusPx: number
): string {
  const d1 = distPx(prev, pt);
  const d2 = distPx(pt, next);
  const r = Math.min(radiusPx, d1 * 0.45, d2 * 0.45);
  if (r < 1) return "";

  const ux = (prev.x - pt.x) / d1, uy = (prev.y - pt.y) / d1;
  const vx = (next.x - pt.x) / d2, vy = (next.y - pt.y) / d2;

  const p1x = pt.x + ux * r, p1y = pt.y + uy * r;
  const p2x = pt.x + vx * r, p2y = pt.y + vy * r;

  // определяем sweep direction
  const cross = ux * vy - uy * vx;
  const sweep = cross > 0 ? 0 : 1;

  return `L ${p1x} ${p1y} A ${r} ${r} 0 0 ${sweep} ${p2x} ${p2y}`;
}

/** Построить полный SVG path фигуры с дугами скруглений */
export function buildShapePath(points: Point[], segments: Segment[], isClosed: boolean): string {
  if (points.length < 2) return "";

  // Собираем радиус для каждой точки-угла
  const radii = new Map<string, number>();
  for (const seg of segments) {
    if (seg.arcRadius > 0) {
      // arcRadius применяется к точке toId
      radii.set(seg.toId, seg.arcRadius);
    }
  }

  let d = "";
  const n = points.length;

  if (isClosed) {
    // Идём по замкнутому контуру
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const cur  = points[i];
      const next = points[(i + 1) % n];
      const r = radii.get(cur.id) ?? 0;

      if (i === 0) {
        if (r > 0) {
          const d1 = distPx(prev, cur);
          const ux = (prev.x - cur.x) / d1, uy = (prev.y - cur.y) / d1;
          d += `M ${cur.x + ux * Math.min(r, d1 * 0.45)} ${cur.y + uy * Math.min(r, d1 * 0.45)} `;
        } else {
          d += `M ${cur.x} ${cur.y} `;
        }
      }

      if (r > 0) {
        d += cornerArcPath(prev, cur, next, r) + " ";
      } else {
        if (i > 0) d += `L ${cur.x} ${cur.y} `;
      }
    }
    d += "Z";
  } else {
    d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < n; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  return d;
}

export const DEFAULT_SETTINGS: PlanSettings = {
  ortho: true,
  snapToPoints: true,
  showGrid: true,
  gridSize: 20,
  zoom: 1,
  panX: 0,
  panY: 0,
  showSegmentLabels: false,  // по дефолту скрыты подписи A-B
  showAngleLabels: false,
  showDiagonals: false,
  showDimLines: false,
  showPoints: true,
  showPointLabels: true,
};

export const DEFAULT_ROOM: RoomParams = {
  name: "Главная фигура",
  floorToCeilCm: null,
  mansardCeiling: false,
  concreteDipMm: null,
};

export const INITIAL_STATE: PlanState = {
  points: [],
  segments: [],
  diagonals: [],
  arcs: [],
  dimLines: [],
  isClosed: false,
  settings: DEFAULT_SETTINGS,
  tool: "draw",
  phase: "draw",
  sidebarTab: "drawing",
  room: DEFAULT_ROOM,
  selectedPointId: null,
  selectedSegmentId: null,
  selectedDiagonalId: null,
  selectedArcId: null,
  selectedDimLineId: null,
  activeInputIndex: 0,
  baseScale: null,
  isBuilt: false,
  changedSegmentIds: [],
};
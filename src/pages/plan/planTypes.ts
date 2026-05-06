// ─── Базовые типы ────────────────────────────────────────────────────────────

export interface Point {
  id: string;
  x: number;   // пиксели на холсте
  y: number;
}

export interface Segment {
  id: string;
  fromId: string;
  toId: string;
  // реальный размер в сантиметрах (null = не введён)
  lengthCm: number | null;
  // видимость метки длины
  showLength: boolean;
  // видимость размерной линии
  showDimLine: boolean;
}

export interface DiagonalDef {
  id: string;
  fromId: string;
  toId: string;
  // пользовательский размер в см (null = авто-расчёт)
  lengthCm: number | null;
  showLength: boolean;
  visible: boolean;
}

export interface ArcDef {
  id: string;
  segmentId: string;   // к какому отрезку привязана дуга
  bulge: number;       // >0 = выпуклость вправо, <0 = влево (как в DXF)
  visible: boolean;
}

// ─── Режимы инструментов ─────────────────────────────────────────────────────

export type ToolMode =
  | "draw"       // рисование точек
  | "move"       // перемещение точек
  | "segment"    // редактирование отрезков
  | "diagonal"   // управление диагоналями
  | "arc"        // добавление дуг / скруглений
  | "delete";    // удаление элементов

// ─── Фаза ввода размеров ─────────────────────────────────────────────────────

export type InputPhase =
  | "draw"       // рисуем контур
  | "lengths"    // вводим длины отрезков
  | "angles";    // вводим / уточняем углы

// ─── Настройки холста ────────────────────────────────────────────────────────

export interface PlanSettings {
  ortho: boolean;          // ортогональное черчение
  snapToPoints: boolean;   // магнитные точки
  showGrid: boolean;       // показать сетку
  gridSize: number;        // px — шаг сетки
  zoom: number;            // масштаб холста (0.5 – 3)
  // видимость слоёв
  showSegmentLabels: boolean;
  showAngleLabels: boolean;
  showDiagonals: boolean;
  showDimLines: boolean;
}

// ─── Полное состояние плана ──────────────────────────────────────────────────

export interface PlanState {
  points: Point[];
  segments: Segment[];
  diagonals: DiagonalDef[];
  arcs: ArcDef[];
  isClosed: boolean;         // фигура замкнута?
  settings: PlanSettings;
  tool: ToolMode;
  phase: InputPhase;
  selectedPointId: string | null;
  selectedSegmentId: string | null;
  selectedDiagonalId: string | null;
  // активный индекс при вводе длин/углов
  activeInputIndex: number;
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
export function genId(prefix = "p"): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

/** Имя точки: 0→A, 1→B, … 25→Z, 26→AA … */
export function pointLabel(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < 26) return letters[index];
  return letters[Math.floor(index / 26) - 1] + letters[index % 26];
}

/** Имя отрезка: A-B, B-C … */
export function segmentLabel(points: Point[], seg: Segment): string {
  const a = points.findIndex(p => p.id === seg.fromId);
  const b = points.findIndex(p => p.id === seg.toId);
  return `${pointLabel(a)}-${pointLabel(b)}`;
}

/** Евклидово расстояние между двумя точками в пикселях */
export function distPx(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Масштаб: сколько пикселей в 1 сантиметре.
 *  Вычисляется из первого отрезка у которого есть lengthCm. */
export function calcScale(points: Point[], segments: Segment[]): number | null {
  for (const seg of segments) {
    if (seg.lengthCm === null || seg.lengthCm <= 0) continue;
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) continue;
    const px = distPx(a, b);
    if (px === 0) continue;
    return px / seg.lengthCm; // px/cm
  }
  return null;
}

/** Конвертировать пиксели в сантиметры используя масштаб */
export function pxToCm(px: number, scale: number | null): number | null {
  if (!scale) return null;
  return Math.round((px / scale) * 10) / 10;
}

/** Угол в градусах в точке B (между отрезками A-B и B-C) */
export function angleDeg(a: Point, b: Point, c: Point): number {
  const ax = a.x - b.x, ay = a.y - b.y;
  const cx = c.x - b.x, cy = c.y - b.y;
  const dot = ax * cx + ay * cy;
  const cross = ax * cy - ay * cx;
  let angle = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);
  // interior angle (всегда положительный)
  if (cross < 0) angle = 360 - angle;
  return Math.round(angle * 10) / 10;
}

/** Snap значения к сетке */
export function snapVal(v: number, grid: number, enabled: boolean): number {
  if (!enabled) return v;
  return Math.round(v / grid) * grid;
}

/** Snap с магнитом к ближайшей существующей точке */
export function snapToPoint(
  x: number,
  y: number,
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

/** Ортогональное черчение: от предыдущей точки — только по горизонту или вертикали */
export function orthoPoint(prev: Point, x: number, y: number): { x: number; y: number } {
  const dx = Math.abs(x - prev.x);
  const dy = Math.abs(y - prev.y);
  if (dx >= dy) return { x, y: prev.y };
  return { x: prev.x, y };
}

/** Площадь полигона по формуле Гаусса (в px²) */
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

/** Периметр полигона в пикселях */
export function polygonPerimeter(points: Point[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let perim = 0;
  for (let i = 0; i < n; i++) {
    perim += distPx(points[i], points[(i + 1) % n]);
  }
  return perim;
}

/** Построить все диагонали для замкнутой фигуры (не соседние стороны) */
export function buildAutoDiagonals(points: Point[], existingDiagonals: DiagonalDef[]): DiagonalDef[] {
  const n = points.length;
  if (n < 4) return [];
  const result: DiagonalDef[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      // исключаем замыкающий отрезок n-1 → 0
      if (i === 0 && j === n - 1) continue;
      const fromId = points[i].id;
      const toId = points[j].id;
      // ищем существующую
      const existing = existingDiagonals.find(
        d => (d.fromId === fromId && d.toId === toId) ||
             (d.fromId === toId && d.toId === fromId)
      );
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          id: genId("d"),
          fromId,
          toId,
          lengthCm: null,
          showLength: true,
          visible: true,
        });
      }
    }
  }
  return result;
}

/** Середина отрезка — для подписи */
export function midPoint(a: Point, b: Point): Point {
  return { id: "", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Нормаль к отрезку (единичный вектор, повёрнутый на 90°) */
export function segmentNormal(a: Point, b: Point): { nx: number; ny: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { nx: -dy / len, ny: dx / len };
}

export const DEFAULT_SETTINGS: PlanSettings = {
  ortho: true,
  snapToPoints: true,
  showGrid: true,
  gridSize: 20,
  zoom: 1,
  showSegmentLabels: true,
  showAngleLabels: true,
  showDiagonals: true,
  showDimLines: true,
};

export const INITIAL_STATE: PlanState = {
  points: [],
  segments: [],
  diagonals: [],
  arcs: [],
  isClosed: false,
  settings: DEFAULT_SETTINGS,
  tool: "draw",
  phase: "draw",
  selectedPointId: null,
  selectedSegmentId: null,
  selectedDiagonalId: null,
  activeInputIndex: 0,
};

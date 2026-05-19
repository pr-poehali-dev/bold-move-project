import type { PlanState, Point, Segment, DiagonalDef, DimLine } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, midPoint, segmentNormal,
  pxToCm, calcScale, angleDeg, buildShapePath,
} from "./planTypes";
import func2url from "@/../backend/func2url.json";

const IMAGE_PROXY_URL = (func2url as Record<string, string>)["image-proxy"];

const PAD = 60; // отступ вокруг фигуры в px экспортного SVG

// ── Загрузка картинки → base64 через прокси-бэкенд (обход CORS) ──────────────
const imageCache = new Map<string, string>();

async function fetchImageAsBase64(url: string): Promise<string> {
  if (imageCache.has(url)) return imageCache.get(url)!;
  try {
    const proxyUrl = `${IMAGE_PROXY_URL}?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return "";
    const data = await res.json();
    const dataUrl = data.dataUrl as string;
    if (dataUrl) {
      imageCache.set(url, dataUrl);
      return dataUrl;
    }
  } catch { /* ignore */ }
  return "";
}

// ── Собрать все imageUrl из сегментов ────────────────────────────────────────
export async function preloadWallImages(state: PlanState): Promise<Map<string, string>> {
  const urls = new Set<string>();
  for (const seg of state.segments ?? []) {
    for (const item of seg.items ?? []) {
      if (item.imageUrl) urls.add(item.imageUrl);
    }
  }
  const map = new Map<string, string>();
  await Promise.all(Array.from(urls).map(async url => {
    const b64 = await fetchImageAsBase64(url);
    if (b64) map.set(url, b64);
  }));
  return map;
}

// ── Вычислить bounding box фигуры ─────────────────────────────────────────────
function bbox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 400, maxY: 400, w: 400, h: 400 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ── Генерация чистого SVG-документа ──────────────────────────────────────────
export function generateSvgString(state: PlanState, exportScale = 1, forThumbnail = false, darkBg = false, showImages = false, imageMap: Map<string, string> = new Map()): string {
  const { points, segments, diagonals, dimLines, isClosed, settings } = state;
  // Для превью (thumbnail) всегда показываем размеры, независимо от настроек
  const showSegmentLabels = forThumbnail ? false : settings.showSegmentLabels;
  const showAngleLabels   = forThumbnail ? false : settings.showAngleLabels;
  const showDiagonals     = forThumbnail ? false : settings.showDiagonals;
  const showDimLines      = forThumbnail ? true  : settings.showDimLines;
  const showPoints        = forThumbnail ? true  : settings.showPoints;
  const showPointLabels   = forThumbnail ? false : settings.showPointLabels;

  if (points.length < 2) return "";

  const scale = calcScale(points, segments);
  const box   = bbox(points);
  const DIM_OFF = 28;

  // Размеры холста экспорта
  const svgW = (box.w + PAD * 2) * exportScale;
  const svgH = (box.h + PAD * 2) * exportScale;
  // Смещение чтобы фигура начиналась от PAD
  const ox = -box.minX + PAD;
  const oy = -box.minY + PAD;

  // Перевести точку из координат чертежа в координаты экспорта
  const tx = (x: number) => (x + ox) * exportScale;
  const ty = (y: number) => (y + oy) * exportScale;
  const ts = (v: number) => v * exportScale; // масштаб числа

  // Точки со смещением
  const pts: Point[] = points.map(p => ({ ...p, x: p.x + ox, y: p.y + oy }));

  // Строим контур
  const rawPath = buildShapePath(points, segments, isClosed);
  // Перестраиваем path с учётом смещения и scale через трансформ на группе

  // ── Размерная линия для отрезка ──────────────────────────────────────────
  const dimLineEl = (seg: Segment): string => {
    if (!showDimLines || !seg.showDimLine) return "";
    const a = pts.find(p => p.id === seg.fromId);
    const b = pts.find(p => p.id === seg.toId);
    if (!a || !b) return "";
    const { nx, ny } = segmentNormal(a, b);
    const off = ts(DIM_OFF);
    const x1 = tx(a.x - ox) + nx * off, y1 = ty(a.y - oy) + ny * off;
    const x2 = tx(b.x - ox) + nx * off, y2 = ty(b.y - oy) + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), scale);
    const label = lenCm !== null ? `${lenCm} см` : "";
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const na = angle > 90 || angle < -90 ? angle + 180 : angle;
    const tick = (px: number, py: number) =>
      `<line x1="${px + nx * (off - ts(7))}" y1="${py + ny * (off - ts(7))}" x2="${px + nx * (off + ts(7))}" y2="${py + ny * (off + ts(7))}" stroke="#60a5fa" stroke-width="1"/>`;
    return `
      ${tick(tx(a.x - ox), ty(a.y - oy))}
      ${tick(tx(b.x - ox), ty(b.y - oy))}
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#60a5fa" stroke-width="1" stroke-dasharray="4 2"/>
      ${label ? `<text x="${mx}" y="${my}" transform="rotate(${na},${mx},${my})" text-anchor="middle" dominant-baseline="auto" dy="-4" font-size="${ts(10)}" fill="#93c5fd" font-family="monospace">${label}</text>` : ""}
    `;
  };

  // ── Подпись отрезка ──────────────────────────────────────────────────────
  const segLabelEl = (seg: Segment): string => {
    if (!showSegmentLabels || !seg.showLength) return "";
    const a = pts.find(p => p.id === seg.fromId);
    const b = pts.find(p => p.id === seg.toId);
    if (!a || !b) return "";
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const lbl = segmentLabel(points, seg);
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), scale);
    const text = lenCm !== null ? `${lbl}: ${lenCm} см` : lbl;
    return `<text x="${tx(mid.x - ox) + nx * ts(13)}" y="${ty(mid.y - oy) + ny * ts(13)}" text-anchor="middle" dominant-baseline="middle" font-size="${ts(11)}" fill="#e2e8f0" font-family="monospace">${escXml(text)}</text>`;
  };

  // ── Угол в точке ─────────────────────────────────────────────────────────
  const angleLabelEl = (pt: Point, idx: number): string => {
    if (!showAngleLabels || !isClosed) return "";
    const n = pts.length;
    const prev = pts[(idx - 1 + n) % n];
    const cur  = pts[idx];
    const next = pts[(idx + 1) % n];
    const deg  = angleDeg(
      { ...prev, x: prev.x - ox, y: prev.y - oy },
      { ...cur,  x: cur.x  - ox, y: cur.y  - oy },
      { ...next, x: next.x - ox, y: next.y - oy }
    );
    const ax = ((prev.x - cur.x) + (next.x - cur.x)) / 2;
    const ay = ((prev.y - cur.y) + (next.y - cur.y)) / 2;
    const alen = Math.sqrt(ax * ax + ay * ay) || 1;
    const isOdd = Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
    return `<text x="${tx(cur.x - ox) + (ax / alen) * ts(26)}" y="${ty(cur.y - oy) + (ay / alen) * ts(26)}" text-anchor="middle" dominant-baseline="middle" font-size="${ts(10)}" fill="${isOdd ? "#fb923c" : "#fbbf24"}" font-family="monospace">${deg}°</text>`;
  };

  // ── Диагональ ────────────────────────────────────────────────────────────
  const diagEl = (diag: DiagonalDef): string => {
    if (!showDiagonals || !diag.visible) return "";
    const a = pts.find(p => p.id === diag.fromId);
    const b = pts.find(p => p.id === diag.toId);
    if (!a || !b) return "";
    const mid = midPoint(a, b);
    const lenCm = diag.lengthCm ?? pxToCm(distPx(a, b), scale);
    const idxA = points.findIndex(p => p.id === diag.fromId);
    const idxB = points.findIndex(p => p.id === diag.toId);
    const lbl = `${pointLabel(idxA)}-${pointLabel(idxB)}`;
    return `
      <line x1="${tx(a.x - ox)}" y1="${ty(a.y - oy)}" x2="${tx(b.x - ox)}" y2="${ty(b.y - oy)}" stroke="#92400e" stroke-width="${ts(1.2)}" stroke-dasharray="${ts(7)} ${ts(4)}"/>
      ${diag.showLength && lenCm !== null ? `<text x="${tx(mid.x - ox) + ts(4)}" y="${ty(mid.y - oy) - ts(5)}" font-size="${ts(9.5)}" fill="#f59e0b" font-family="monospace">${escXml(lbl)}: ${lenCm} см</text>` : ""}
    `;
  };

  // ── Пользовательская размерная линия ─────────────────────────────────────
  const customDimEl = (dl: DimLine): string => {
    if (!dl.visible) return "";
    const a = pts.find(p => p.id === dl.fromId);
    const b = pts.find(p => p.id === dl.toId);
    if (!a || !b) return "";
    const { nx, ny } = segmentNormal(a, b);
    const off = ts(dl.offsetPx);
    const x1 = tx(a.x - ox) + nx * off, y1 = ty(a.y - oy) + ny * off;
    const x2 = tx(b.x - ox) + nx * off, y2 = ty(b.y - oy) + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenCm = dl.labelCm ?? pxToCm(distPx(a, b), scale);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const na = angle > 90 || angle < -90 ? angle + 180 : angle;
    return `
      <line x1="${tx(a.x - ox) + nx * (off - ts(7))}" y1="${ty(a.y - oy) + ny * (off - ts(7))}" x2="${tx(a.x - ox) + nx * (off + ts(7))}" y2="${ty(a.y - oy) + ny * (off + ts(7))}" stroke="#a78bfa" stroke-width="1.5"/>
      <line x1="${tx(b.x - ox) + nx * (off - ts(7))}" y1="${ty(b.y - oy) + ny * (off - ts(7))}" x2="${tx(b.x - ox) + nx * (off + ts(7))}" y2="${ty(b.y - oy) + ny * (off + ts(7))}" stroke="#a78bfa" stroke-width="1.5"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a78bfa" stroke-width="1.5"/>
      ${lenCm !== null ? `<text x="${mx}" y="${my}" transform="rotate(${na},${mx},${my})" text-anchor="middle" dominant-baseline="auto" dy="-5" font-size="${ts(10)}" fill="#c4b5fd" font-family="monospace">${lenCm} см</text>` : ""}
    `;
  };

  // ── Цвета зависят от режима ───────────────────────────────────────────────
  // darkBg = тёмный фон (как в построителе), иначе светлый (белый)
  const useDark      = darkBg || !forThumbnail;
  const bgColor      = useDark ? "#0f1117" : "#ffffff";
  const fillColor    = useDark ? "rgba(139,92,246,0.12)" : "rgba(99,102,241,0.08)";
  const strokeColor  = isClosed ? (useDark ? "#a78bfa" : "#6366f1") : "#6366f1";
  const dimColor     = useDark ? "#60a5fa" : "#3b82f6";
  const dimTextColor = useDark ? "#93c5fd" : "#1e40af";
  const ptColor      = useDark ? "#7c3aed" : "#6366f1";
  const ptStroke     = useDark ? "#4c1d95" : "#4338ca";
  const nameColor    = useDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";

  // Перегенерируем dimLineEl с правильными цветами для thumbnail
  const dimLineElColored = (seg: Segment): string => {
    if (!showDimLines || !seg.showDimLine) return "";
    const a = pts.find(p => p.id === seg.fromId);
    const b = pts.find(p => p.id === seg.toId);
    if (!a || !b) return "";
    const { nx, ny } = segmentNormal(a, b);
    const off = ts(DIM_OFF);
    const x1 = tx(a.x - ox) + nx * off, y1 = ty(a.y - oy) + ny * off;
    const x2 = tx(b.x - ox) + nx * off, y2 = ty(b.y - oy) + ny * off;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lenCm = seg.lengthCm ?? pxToCm(distPx(a, b), scale);
    const label = lenCm !== null ? `${lenCm} см` : "";
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const na = angle > 90 || angle < -90 ? angle + 180 : angle;
    const tick = (px: number, py: number) =>
      `<line x1="${px + nx * (off - ts(7))}" y1="${py + ny * (off - ts(7))}" x2="${px + nx * (off + ts(7))}" y2="${py + ny * (off + ts(7))}" stroke="${dimColor}" stroke-width="1"/>`;
    return `
      ${tick(tx(a.x - ox), ty(a.y - oy))}
      ${tick(tx(b.x - ox), ty(b.y - oy))}
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${dimColor}" stroke-width="1" stroke-dasharray="4 2"/>
      ${label ? `<text x="${mx}" y="${my}" transform="rotate(${na},${mx},${my})" text-anchor="middle" dominant-baseline="auto" dy="-4" font-size="${ts(10)}" fill="${dimTextColor}" font-family="monospace">${label}</text>` : ""}
    `;
  };

  // ── Товары на стенах ───────────────────────────────────────────────────────
  const wallItemsEl = (seg: Segment): string => {
    if (!forThumbnail || !seg.items?.length) return "";
    const a = pts.find(p => p.id === seg.fromId);
    const b = pts.find(p => p.id === seg.toId);
    if (!a || !b) return "";
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const inset = ts(18); // внутрь контура
    const cx = tx(mid.x - ox) - nx * inset;
    const cy = ty(mid.y - oy) - ny * inset;
    const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const na = angle > 90 || angle < -90 ? angle + 180 : angle;
    if (showImages) {
      // Режим картинок: рисуем миниатюры товаров вдоль стены
      const imgSize = ts(48); // крупнее чтобы было видно
      const insetPx = nx * ts(28) + ny * ts(28);
      const segLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) * exportScale;
      const maxImgs = Math.max(1, Math.floor(segLen / (imgSize * 1.3)));
      const items = seg.items.slice(0, maxImgs);
      const dx = (tx(b.x - ox) - tx(a.x - ox)) / (items.length + 1);
      const dy = (ty(b.y - oy) - ty(a.y - oy)) / (items.length + 1);
      return items.map((it, idx) => {
        const b64 = it.imageUrl ? imageMap.get(it.imageUrl) : null;
        if (!b64) return "";
        const ix = tx(a.x - ox) + dx * (idx + 1) - nx * ts(28);
        const iy = ty(a.y - oy) + dy * (idx + 1) - ny * ts(28);
        const half = imgSize / 2;
        const r = ts(6);
        return `<clipPath id="clip-img-${idx}-${seg.id}"><rect x="${ix - half}" y="${iy - half}" width="${imgSize}" height="${imgSize}" rx="${r}"/></clipPath><image href="${b64}" x="${ix - half}" y="${iy - half}" width="${imgSize}" height="${imgSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-img-${idx}-${seg.id})"/>`; void insetPx;
      }).join("");
    } else {
      // Режим текста: название товара
      const names = seg.items.map(it => `${it.name}${it.quantity ? ` ${it.quantity}${it.unit}` : ""}`).join(", ");
      const short = names.length > 40 ? names.slice(0, 38) + "…" : names;
      return `<text x="${cx}" y="${cy}" transform="rotate(${na},${cx},${cy})" text-anchor="middle" dominant-baseline="middle" font-size="${ts(8)}" fill="${useDark ? "#a78bfa" : "#7c3aed"}" font-family="sans-serif" font-weight="600">${escXml(short)}</text>`;
    }
  };

  // ── Сборка SVG ────────────────────────────────────────────────────────────
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <!-- Фон -->
  <rect width="${svgW}" height="${svgH}" fill="${bgColor}"/>

  <!-- Заливка фигуры -->
  ${points.length >= 3 && isClosed
    ? `<g transform="translate(${ox * exportScale},${oy * exportScale}) scale(${exportScale})">
        <path d="${rawPath}" fill="${fillColor}" stroke="none"/>
       </g>`
    : ""}

  <!-- Контур -->
  <g transform="translate(${ox * exportScale},${oy * exportScale}) scale(${exportScale})">
    <path d="${rawPath}" fill="none" stroke="${strokeColor}" stroke-width="${ts(2)}" stroke-linejoin="round"/>
  </g>

  <!-- Размерные линии отрезков -->
  ${segments.map(seg => forThumbnail ? dimLineElColored(seg) : dimLineEl(seg)).join("")}

  <!-- Подписи отрезков -->
  ${segments.map(seg => segLabelEl(seg)).join("")}

  <!-- Товары на стенах -->
  ${segments.map(seg => wallItemsEl(seg)).join("")}

  <!-- Пользовательские размерные линии -->
  ${dimLines.map(dl => customDimEl(dl)).join("")}

  <!-- Диагонали -->
  ${diagonals.map(d => diagEl(d)).join("")}

  <!-- Метки углов -->
  ${isClosed ? pts.map((_, idx) => angleLabelEl(pts[idx], idx)).join("") : ""}

  <!-- Точки -->
  ${showPoints ? pts.map((pt, idx) => {
    const isFirst = idx === 0;
    return `
      <circle cx="${tx(pt.x - ox)}" cy="${ty(pt.y - oy)}" r="${ts(PT_R_EXPORT)}" fill="${isFirst && !isClosed ? "#34d399" : ptColor}" stroke="${ptStroke}" stroke-width="${ts(2)}"/>
      ${showPointLabels ? `<text x="${tx(pt.x - ox) + ts(11)}" y="${ty(pt.y - oy) - ts(11)}" font-size="${ts(11)}" font-weight="700" fill="${forThumbnail ? "#111827" : "#e2e8f0"}" font-family="monospace">${pointLabel(idx)}</text>` : ""}
    `;
  }).join("") : ""}

  <!-- Название -->
  <text x="${ts(12)}" y="${svgH - ts(10)}" font-size="${ts(10)}" fill="${nameColor}" font-family="sans-serif">${escXml(state.room.name)}</text>
</svg>`;

  return svg;
}

const PT_R_EXPORT = 6;

// ── Скачать SVG ───────────────────────────────────────────────────────────────
export function downloadSvg(state: PlanState, filename = "plan.svg", exportScale = 1): void {
  const svg = generateSvgString(state, exportScale);
  if (!svg) return;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), filename);
}

// ── Скачать PNG ───────────────────────────────────────────────────────────────
export async function downloadPng(
  state: PlanState,
  filename = "plan.png",
  exportScale = 2,   // 2× = retina-качество
  bgColor = "#0f1117"
): Promise<void> {
  const svgStr = generateSvgString(state, exportScale);
  if (!svgStr) return;

  const box = bbox(state.points);
  const w   = (box.w + 60 * 2) * exportScale;
  const h   = (box.h + 60 * 2) * exportScale;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url  = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(pngBlob => {
        if (!pngBlob) { reject(new Error("Canvas toBlob failed")); return; }
        triggerDownload(URL.createObjectURL(pngBlob), filename);
        resolve();
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG load failed")); };
    img.src = url;
  });
}

// ── Получить data URL для превью ──────────────────────────────────────────────
export function getSvgDataUrl(state: PlanState, exportScale = 1, forThumbnail = true, darkBg = false, showImages = false, imageMap: Map<string, string> = new Map()): string {
  const svg = generateSvgString(state, exportScale, forThumbnail, darkBg, showImages, imageMap);
  if (!svg) return "";
  const b64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}

// ── Асинхронная версия с загрузкой картинок ───────────────────────────────────
export async function getSvgDataUrlAsync(state: PlanState, exportScale = 1, forThumbnail = true, darkBg = false, showImages = false): Promise<string> {
  const imageMap = showImages ? await preloadWallImages(state) : new Map<string, string>();
  return getSvgDataUrl(state, exportScale, forThumbnail, darkBg, showImages, imageMap);
}

// ── Триггер скачивания файла ──────────────────────────────────────────────────
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Экранирование XML ─────────────────────────────────────────────────────────
function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
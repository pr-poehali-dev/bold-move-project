// Генератор PDF/HTML для 7 типов выгрузки сметы
import type { PlanRoom } from "./usePlanProjects";
import type { PlanState } from "./planTypes";
import type { ExportType, ExportScope } from "./PlanExportMenu";
import { getSvgDataUrlAsync } from "./planExport";
import func2url from "@/../backend/func2url.json";
import { sortCategories } from "./categoryOrder";

const PRICES_URL = (func2url as Record<string, string>)["get-prices"];
const PARSE_XLSX_URL = (func2url as Record<string, string>)["parse-xlsx"];

interface PriceFull {
  id: number;
  name: string;
  price: number;
  purchase_price: number;
  installation_price: number;
  measure_price: number;
  management_price: number;
  unit: string;
  category: string;
  is_material?: boolean;
}

interface AggregatedItem {
  priceId: number;
  name: string;
  unit: string;
  quantity: number;
  category: string;
  price?: number;
  purchase_price?: number;
  installation_price?: number;
  measure_price?: number;
  management_price?: number;
  is_material?: boolean;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

// ── Загрузка полного прайса (с purchase/installation/measure) ────────────────
async function loadFullPrices(): Promise<Map<number, PriceFull>> {
  const map = new Map<number, PriceFull>();
  try {
    // parse-xlsx?r=prices возвращает все нужные поля включая installation_price и measure_price
    const res = await fetch(`${PARSE_XLSX_URL}?r=prices`);
    const data = await res.json();
    const items: PriceFull[] = data.items ?? [];
    for (const p of items) map.set(p.id, p);
  } catch {
    // Fallback на get-prices (без некоторых полей)
    try {
      const res = await fetch(PRICES_URL);
      const data = await res.json();
      const items: PriceFull[] = data.prices ?? [];
      for (const p of items) map.set(p.id, p);
    } catch { /* ignore */ }
  }
  return map;
}

// ── Извлечение позиций из комнаты (сегменты + полотно) ─────────────────────
function extractRoomItems(room: PlanRoom, prices: Map<number, PriceFull>): AggregatedItem[] {
  const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
  if (!planData) return [];

  const agg = new Map<number, AggregatedItem>();

  const addItem = (priceId: number, name: string, unit: string, qty: number) => {
    const p = prices.get(priceId);
    const ex = agg.get(priceId);
    if (ex) {
      ex.quantity += qty;
    } else {
      agg.set(priceId, {
        priceId,
        name,
        unit,
        quantity: qty,
        category: p?.category ?? "",
        price: p?.price,
        purchase_price: p?.purchase_price,
        installation_price: p?.installation_price,
        measure_price: p?.measure_price,
        management_price: p?.management_price,
        is_material: p?.is_material,
      });
    }
  };

  for (const seg of planData.segments ?? []) {
    for (const it of (seg.items ?? []) as { priceId: number; name: string; unit: string; quantity?: number }[]) {
      const qty = it.quantity ?? (seg.lengthCm ? seg.lengthCm / 100 : 1);
      addItem(it.priceId, it.name, it.unit, qty);
    }
  }
  for (const it of (planData.floorItems ?? []) as { priceId: number; name: string; unit: string; quantity: number }[]) {
    addItem(it.priceId, it.name, it.unit, it.quantity ?? 1);
  }

  // Сортируем по категории согласно единому порядку
  const items = Array.from(agg.values());
  const catOrder = sortCategories([...new Set(items.map(i => i.category || "Прочее"))]);
  return items.sort((a, b) => {
    const ia = catOrder.indexOf(a.category || "Прочее");
    const ib = catOrder.indexOf(b.category || "Прочее");
    return ia - ib;
  });
}

// ── Превью чертежа комнаты (опционально без подписей стен) ─────────────────
async function renderRoomThumb(room: PlanRoom, opts: { withLabels: boolean }): Promise<string> {
  const planData = (room.active_variant_data ?? room.data) as PlanState | undefined;
  if (!planData?.points || planData.points.length < 2) return "";
  // Клонируем state и убираем подписи если нужно
  const state: PlanState = opts.withLabels
    ? planData
    : { ...planData, segments: (planData.segments ?? []).map(s => ({ ...s, items: [] })) } as PlanState;
  try {
    return await getSvgDataUrlAsync(state, 0.6, true, false, opts.withLabels);
  } catch { return ""; }
}

// ── Базовая HTML обёртка ───────────────────────────────────────────────────
function htmlWrapper(title: string, clientName: string | null, clientPhone: string | null, address: string | null, body: string): string {
  const dateStr = new Date().toLocaleDateString("ru-RU");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:sans-serif;padding:32px;color:#111;max-width:900px;margin:0 auto;background:#fff}
    h1{font-size:22px;margin:0 0 6px}
    h2{font-size:16px;color:#7c3aed;margin:24px 0 8px}
    .meta{color:#666;font-size:13px;margin:0 0 20px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}
    th{background:#f5f3ff;color:#7c3aed;text-align:left;padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase}
    td{padding:6px 10px;border-bottom:1px solid #f0f0f0}
    .num{text-align:center}
    .right{text-align:right;font-weight:600}
    .total-row td{padding:10px;font-size:14px;font-weight:700;background:#faf5ff;border-top:2px solid #7c3aed}
    .room-section{margin-bottom:28px;page-break-inside:avoid}
    .drawing{text-align:center;margin:10px 0}
    .drawing img{max-width:100%;max-height:380px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px}
    .summary{margin-top:24px;padding:16px;border-radius:10px;background:#faf5ff;border:1px solid #e9d5ff}
    .summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}
    .summary-row.profit{font-size:18px;font-weight:800;color:#16a34a;border-top:2px solid #c084fc;margin-top:8px;padding-top:10px}
    @media print{.room-section{page-break-inside:avoid}}
  </style></head>
  <body>
  <h1>${title}</h1>
  <p class="meta">${clientName ? `Клиент: <b>${clientName}</b>` : ""}${clientPhone ? ` · ${clientPhone}` : ""}${address ? ` · ${address}` : ""}${(clientName||clientPhone||address)?" · ":""}Дата: ${dateStr}</p>
  ${body}
  </body></html>`;
}

// ── Группировка/суммирование по проекту ─────────────────────────────────────
function groupAllRooms(rooms: PlanRoom[], prices: Map<number, PriceFull>): AggregatedItem[] {
  const total = new Map<number, AggregatedItem>();
  for (const room of rooms) {
    for (const item of extractRoomItems(room, prices)) {
      const ex = total.get(item.priceId);
      if (ex) ex.quantity += item.quantity;
      else total.set(item.priceId, { ...item });
    }
  }
  return Array.from(total.values());
}

// ── Открыть HTML в новой вкладке и распечатать ─────────────────────────────
function openPrint(html: string): void {
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
}

// ── Параметры выгрузки ─────────────────────────────────────────────────────
export interface GenerateOpts {
  type: ExportType;
  scope: ExportScope;
  project: { name: string; client_name?: string | null; phone?: string | null; address?: string | null };
  rooms: PlanRoom[];
}

// ── Основная функция ───────────────────────────────────────────────────────
export async function generateExportPdf(opts: GenerateOpts): Promise<void> {
  const { type, scope, project, rooms } = opts;
  const prices = await loadFullPrices();
  const clientName = project.client_name ?? null;
  const clientPhone = project.phone ?? null;
  const address = project.address ?? null;
  const projectName = project.name || "Проект";

  // Готовим превью чертежей при необходимости
  const needDrawings = type === "kp_detail" || type === "zp_install";
  const withLabels = type === "kp_detail";
  const thumbs = new Map<number, string>();
  if (needDrawings) {
    for (const room of rooms) {
      const thumb = await renderRoomThumb(room, { withLabels });
      if (thumb) thumbs.set(room.id, thumb);
    }
  }

  // Роутинг по типам
  switch (type) {
    case "kp_light":      return openPrint(buildKpLight(rooms, prices, scope, projectName, clientName, clientPhone, address));
    case "kp_detail":     return openPrint(buildKpDetail(rooms, prices, scope, projectName, clientName, clientPhone, address, thumbs));
    case "kp_materials":  return openPrint(buildKpMaterials(rooms, prices, scope, projectName, clientName, clientPhone, address));
    case "kp_works":      return openPrint(buildKpWorks(rooms, prices, scope, projectName, clientName, clientPhone, address));
    case "zp_install":    return openPrint(buildZpInstall(rooms, prices, projectName, clientName, clientPhone, address, thumbs));
    case "zp_measure":    return openPrint(buildZpMeasure(rooms, prices, projectName, clientName, clientPhone, address));
    case "zp_management": return openPrint(buildZpManagement(rooms, prices, projectName, clientName, clientPhone, address));
    case "analytics":     return openPrint(buildAnalytics(rooms, prices, projectName, clientName, clientPhone, address));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) КП: ЛАЙТ — без чертежей и без подписей стен, продажные цены
// ─────────────────────────────────────────────────────────────────────────────
function buildKpLight(rooms: PlanRoom[], prices: Map<number, PriceFull>, scope: ExportScope, projectName: string, name: string | null, phone: string | null, address: string | null): string {
  const renderItems = (items: AggregatedItem[]): { html: string; total: number } => {
    let total = 0;
    const rows = items.map(it => {
      const sum = (it.price ?? 0) * it.quantity;
      total += sum;
      return `<tr>
        <td>${it.name}</td>
        <td class="num">${fmt(it.quantity)}</td>
        <td class="num">${it.unit}</td>
        <td class="right">${fmt(sum)} ₽</td>
      </tr>`;
    }).join("");
    return {
      html: `<table>
        <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Ед.</th><th class="right">Сумма</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`,
      total,
    };
  };

  let body = "";
  let grandTotal = 0;
  if (scope === "room") {
    for (const room of rooms) {
      const items = extractRoomItems(room, prices);
      if (items.length === 0) continue;
      const { html, total } = renderItems(items);
      grandTotal += total;
      body += `<div class="room-section"><h2>${room.name}</h2>${html}
        <p class="right" style="font-size:14px">Итого по комнате: <b>${fmt(total)} ₽</b></p></div>`;
    }
  } else {
    const items = groupAllRooms(rooms, prices);
    const { html, total } = renderItems(items);
    grandTotal = total;
    body += html;
  }
  body += `<div class="summary"><div class="summary-row profit"><span>Итого:</span><span>${fmt(grandTotal)} ₽</span></div></div>`;
  return htmlWrapper(`КП: ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) КП: ДЕТАЛИЗАЦИЯ — с чертежами и подписями стен
// ─────────────────────────────────────────────────────────────────────────────
function buildKpDetail(rooms: PlanRoom[], prices: Map<number, PriceFull>, scope: ExportScope, projectName: string, name: string | null, phone: string | null, address: string | null, thumbs: Map<number, string>): string {
  const renderItems = (items: AggregatedItem[]): { html: string; total: number } => {
    let total = 0;
    const rows = items.map(it => {
      const sum = (it.price ?? 0) * it.quantity;
      total += sum;
      return `<tr>
        <td>${it.name}</td>
        <td class="num">${fmt(it.quantity)}</td>
        <td class="num">${it.unit}</td>
        <td class="num">${fmt(it.price ?? 0)} ₽</td>
        <td class="right">${fmt(sum)} ₽</td>
      </tr>`;
    }).join("");
    return {
      html: `<table>
        <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Ед.</th><th class="num">Цена</th><th class="right">Сумма</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`,
      total,
    };
  };

  let body = "";
  let grandTotal = 0;
  if (scope === "room") {
    for (const room of rooms) {
      const items = extractRoomItems(room, prices);
      if (items.length === 0) continue;
      const { html, total } = renderItems(items);
      const thumb = thumbs.get(room.id);
      grandTotal += total;
      body += `<div class="room-section"><h2>${room.name}</h2>
        ${thumb ? `<div class="drawing"><img src="${thumb}" alt="${room.name}"/></div>` : ""}
        ${html}
        <p class="right" style="font-size:14px">Итого по комнате: <b>${fmt(total)} ₽</b></p></div>`;
    }
  } else {
    for (const room of rooms) {
      const thumb = thumbs.get(room.id);
      if (thumb) body += `<div class="room-section"><h2>${room.name}</h2><div class="drawing"><img src="${thumb}" alt="${room.name}"/></div></div>`;
    }
    const items = groupAllRooms(rooms, prices);
    const { html, total } = renderItems(items);
    grandTotal = total;
    body += html;
  }
  body += `<div class="summary"><div class="summary-row profit"><span>Итого:</span><span>${fmt(grandTotal)} ₽</span></div></div>`;
  return htmlWrapper(`КП с детализацией: ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) КП: МАТЕРИАЛЫ — только материалы и количество, без цен
// ─────────────────────────────────────────────────────────────────────────────
function buildKpMaterials(rooms: PlanRoom[], prices: Map<number, PriceFull>, scope: ExportScope, projectName: string, name: string | null, phone: string | null, address: string | null): string {
  const renderItems = (items: AggregatedItem[]): string => {
    const materials = items.filter(it => it.is_material !== false);
    if (materials.length === 0) return "<p>Материалы не найдены.</p>";
    const rows = materials.map(it => `<tr>
      <td>${it.name}</td>
      <td class="num">${fmt(it.quantity)}</td>
      <td class="num">${it.unit}</td>
    </tr>`).join("");
    return `<table>
      <thead><tr><th>Материал</th><th class="num">Кол-во</th><th class="num">Ед.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  };

  let body = "";
  if (scope === "room") {
    for (const room of rooms) {
      const items = extractRoomItems(room, prices);
      const materials = items.filter(it => it.is_material !== false);
      if (materials.length === 0) continue;
      body += `<div class="room-section"><h2>${room.name}</h2>${renderItems(items)}</div>`;
    }
  } else {
    body += renderItems(groupAllRooms(rooms, prices));
  }
  return htmlWrapper(`КП: Материалы — ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) КП: РАБОТЫ — только цены из колонки «Монтаж ₽» прайса
// ─────────────────────────────────────────────────────────────────────────────
function buildKpWorks(rooms: PlanRoom[], prices: Map<number, PriceFull>, scope: ExportScope, projectName: string, name: string | null, phone: string | null, address: string | null): string {
  const renderItems = (items: AggregatedItem[]): { html: string; total: number } => {
    let total = 0;
    const rows = items
      .filter(it => (it.installation_price ?? 0) > 0)
      .map(it => {
        const sum = (it.installation_price ?? 0) * it.quantity;
        total += sum;
        return `<tr>
          <td>${it.name}</td>
          <td class="num">${fmt(it.quantity)}</td>
          <td class="num">${it.unit}</td>
          <td class="num">${fmt(it.installation_price ?? 0)} ₽</td>
          <td class="right">${fmt(sum)} ₽</td>
        </tr>`;
      }).join("");
    return {
      html: `<table>
        <thead><tr><th>Работа</th><th class="num">Кол-во</th><th class="num">Ед.</th><th class="num">Цена</th><th class="right">Сумма</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="num" style="color:#999">Работы не найдены</td></tr>`}</tbody>
      </table>`,
      total,
    };
  };

  let body = "";
  let grandTotal = 0;
  if (scope === "room") {
    for (const room of rooms) {
      const items = extractRoomItems(room, prices);
      const { html, total } = renderItems(items);
      if (total === 0) continue;
      grandTotal += total;
      body += `<div class="room-section"><h2>${room.name}</h2>${html}
        <p class="right" style="font-size:14px">Итого по комнате: <b>${fmt(total)} ₽</b></p></div>`;
    }
  } else {
    const items = groupAllRooms(rooms, prices);
    const { html, total } = renderItems(items);
    grandTotal = total;
    body += html;
  }
  body += `<div class="summary"><div class="summary-row profit"><span>Итого за работы:</span><span>${fmt(grandTotal)} ₽</span></div></div>`;
  return htmlWrapper(`КП: Работы — ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) ЗП МОНТАЖНИКИ — только чертежи, работы и цены из колонки Монтаж
// ─────────────────────────────────────────────────────────────────────────────
function buildZpInstall(rooms: PlanRoom[], prices: Map<number, PriceFull>, projectName: string, name: string | null, phone: string | null, address: string | null, thumbs: Map<number, string>): string {
  let body = "";
  let grandTotal = 0;
  for (const room of rooms) {
    const items = extractRoomItems(room, prices).filter(it => (it.installation_price ?? 0) > 0);
    if (items.length === 0 && !thumbs.get(room.id)) continue;
    let total = 0;
    const rows = items.map(it => {
      const sum = (it.installation_price ?? 0) * it.quantity;
      total += sum;
      return `<tr>
        <td>${it.name}</td>
        <td class="num">${fmt(it.quantity)}</td>
        <td class="num">${it.unit}</td>
        <td class="num">${fmt(it.installation_price ?? 0)} ₽</td>
        <td class="right">${fmt(sum)} ₽</td>
      </tr>`;
    }).join("");
    grandTotal += total;
    const thumb = thumbs.get(room.id);
    body += `<div class="room-section"><h2>${room.name}</h2>
      ${thumb ? `<div class="drawing"><img src="${thumb}" alt="${room.name}"/></div>` : ""}
      <table>
        <thead><tr><th>Работа</th><th class="num">Кол-во</th><th class="num">Ед.</th><th class="num">ЗП</th><th class="right">Сумма</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="num" style="color:#999">Нет работ</td></tr>`}</tbody>
      </table>
      <p class="right" style="font-size:14px">Итого по комнате: <b>${fmt(total)} ₽</b></p></div>`;
  }
  body += `<div class="summary"><div class="summary-row profit"><span>Итого к выплате монтажникам:</span><span>${fmt(grandTotal)} ₽</span></div></div>`;
  return htmlWrapper(`ЗП монтажникам — ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) ЗП ЗАМЕРЩИКА — без чертежей, цены из колонки Замер
// ─────────────────────────────────────────────────────────────────────────────
function buildZpMeasure(rooms: PlanRoom[], prices: Map<number, PriceFull>, projectName: string, name: string | null, phone: string | null, address: string | null): string {
  const items = groupAllRooms(rooms, prices).filter(it => (it.measure_price ?? 0) > 0);
  let total = 0;
  const rows = items.map(it => {
    const sum = (it.measure_price ?? 0) * it.quantity;
    total += sum;
    return `<tr>
      <td>${it.name}</td>
      <td class="num">${fmt(it.quantity)}</td>
      <td class="num">${it.unit}</td>
      <td class="num">${fmt(it.measure_price ?? 0)} ₽</td>
      <td class="right">${fmt(sum)} ₽</td>
    </tr>`;
  }).join("");
  const body = `<table>
    <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Ед.</th><th class="num">Замер</th><th class="right">Сумма</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="num" style="color:#999">Нет позиций для замера</td></tr>`}</tbody>
  </table>
  <div class="summary"><div class="summary-row profit"><span>Итого к выплате замерщику:</span><span>${fmt(total)} ₽</span></div></div>`;
  return htmlWrapper(`ЗП замерщика — ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) ЗП МЕНЕДЖМЕНТ — без чертежей, цены из колонки Менеджмент
// ─────────────────────────────────────────────────────────────────────────────
function buildZpManagement(rooms: PlanRoom[], prices: Map<number, PriceFull>, projectName: string, name: string | null, phone: string | null, address: string | null): string {
  const items = groupAllRooms(rooms, prices).filter(it => (it.management_price ?? 0) > 0);
  let total = 0;
  const rows = items.map(it => {
    const sum = (it.management_price ?? 0) * it.quantity;
    total += sum;
    return `<tr>
      <td>${it.name}</td>
      <td class="num">${fmt(it.quantity)}</td>
      <td class="num">${it.unit}</td>
      <td class="num">${fmt(it.management_price ?? 0)} ₽</td>
      <td class="right">${fmt(sum)} ₽</td>
    </tr>`;
  }).join("");
  const body = `<table>
    <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Ед.</th><th class="num">Менеджмент</th><th class="right">Сумма</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="num" style="color:#999">Нет позиций для менеджмента</td></tr>`}</tbody>
  </table>
  <div class="summary"><div class="summary-row profit"><span>Итого к выплате менеджменту:</span><span>${fmt(total)} ₽</span></div></div>`;
  return htmlWrapper(`ЗП менеджмент — ${projectName}`, name, phone, address, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) АНАЛИТИКА ПО ОБЪЕКТУ — всё: себестоимость, ЗП, продажа, прибыль
// ─────────────────────────────────────────────────────────────────────────────
function buildAnalytics(rooms: PlanRoom[], prices: Map<number, PriceFull>, projectName: string, name: string | null, phone: string | null, address: string | null): string {
  const items = groupAllRooms(rooms, prices);

  let materialCost = 0;     // Себестоимость материалов
  let installCost = 0;      // ЗП монтажников
  let measureCost = 0;      // ЗП замерщика
  let managementCost = 0;   // ЗП менеджмент
  let salesTotal = 0;       // Продажная сумма

  // Группируем по категориям для детального отчёта
  const byCategory = new Map<string, { sales: number; material: number; install: number; measure: number; management: number; count: number }>();

  for (const it of items) {
    const sales = (it.price ?? 0) * it.quantity;
    const mat = it.is_material !== false ? (it.purchase_price ?? 0) * it.quantity : 0;
    const inst = (it.installation_price ?? 0) * it.quantity;
    const meas = (it.measure_price ?? 0) * it.quantity;
    const mgmt = (it.management_price ?? 0) * it.quantity;
    salesTotal += sales;
    materialCost += mat;
    installCost += inst;
    measureCost += meas;
    managementCost += mgmt;

    const cat = it.category || "Прочее";
    const ex = byCategory.get(cat) ?? { sales: 0, material: 0, install: 0, measure: 0, management: 0, count: 0 };
    ex.sales += sales; ex.material += mat; ex.install += inst; ex.measure += meas; ex.management += mgmt; ex.count++;
    byCategory.set(cat, ex);
  }

  const totalCost = materialCost + installCost + measureCost + managementCost;
  const profit = salesTotal - totalCost;
  const margin = salesTotal > 0 ? Math.round((profit / salesTotal) * 100) : 0;

  const categoryRows = sortCategories(Array.from(byCategory.keys())).map(cat => {
    const v = byCategory.get(cat)!;
    const catProfit = v.sales - v.material - v.install - v.measure - v.management;
    return `<tr>
      <td>${cat}</td>
      <td class="num">${v.count}</td>
      <td class="right" style="color:#16a34a">${fmt(v.sales)} ₽</td>
      <td class="right" style="color:#ef4444">${fmt(v.material)} ₽</td>
      <td class="right" style="color:#06b6d4">${fmt(v.install)} ₽</td>
      <td class="right" style="color:#14b8a6">${fmt(v.measure)} ₽</td>
      <td class="right" style="color:#d946ef">${fmt(v.management)} ₽</td>
      <td class="right" style="font-weight:800;color:${catProfit >= 0 ? "#16a34a" : "#ef4444"}">${fmt(catProfit)} ₽</td>
    </tr>`;
  }).join("");

  const body = `
    <div class="summary">
      <div class="summary-row" style="color:#16a34a"><span>💰 Продажная сумма</span><span><b>${fmt(salesTotal)} ₽</b></span></div>
      <div class="summary-row" style="color:#ef4444"><span>📦 Себестоимость материалов</span><span>−${fmt(materialCost)} ₽</span></div>
      <div class="summary-row" style="color:#06b6d4"><span>🔧 ЗП монтажников</span><span>−${fmt(installCost)} ₽</span></div>
      <div class="summary-row" style="color:#14b8a6"><span>📏 ЗП замерщика</span><span>−${fmt(measureCost)} ₽</span></div>
      <div class="summary-row" style="color:#d946ef"><span>💼 ЗП менеджмента</span><span>−${fmt(managementCost)} ₽</span></div>
      <div class="summary-row" style="font-weight:700;border-top:1px solid #ddd;padding-top:8px;margin-top:6px"><span>Итого затрат</span><span>−${fmt(totalCost)} ₽</span></div>
      <div class="summary-row profit"><span>Прибыль (маржа ${margin}%)</span><span>${profit >= 0 ? "+" : ""}${fmt(profit)} ₽</span></div>
    </div>
    <h2 style="margin-top:32px">Детализация по категориям</h2>
    <table>
      <thead><tr>
        <th>Категория</th>
        <th class="num">Позиций</th>
        <th class="right">Продажа</th>
        <th class="right">Закупка</th>
        <th class="right">Монтаж</th>
        <th class="right">Замер</th>
        <th class="right">Менеджмент</th>
        <th class="right">Прибыль</th>
      </tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
  `;
  return htmlWrapper(`Аналитика: ${projectName}`, name, phone, address, body);
}
import { PriceItem, EstimateBlock, PlanRoomForEstimate, parseValue, fmt, pricingRules } from "./estimateTypes";

// Генерация блоков сметы из данных комнат чертежа
export function buildBlocksFromRooms(rooms: PlanRoomForEstimate[], prices: PriceItem[]): EstimateBlock[] {
  const priceMap = new Map(prices.map(p => [p.id, p]));
  const blocks: EstimateBlock[] = [];

  for (const room of rooms) {
    if (!room.include_in_estimate) continue;
    const planData = (room.active_variant_data ?? room.data) as {
      segments?: { items?: { priceId: number; name: string; unit: string; quantity: number }[] }[];
      floorItems?: { priceId: number; name: string; unit: string; quantity: number }[];
    };
    if (!planData) continue;

    const agg = new Map<number, { name: string; unit: string; qty: number }>();
    const segments = planData.segments ?? [];
    const floorItems = planData.floorItems ?? [];

    for (const seg of segments) {
      for (const item of seg.items ?? []) {
        const ex = agg.get(item.priceId);
        if (ex) ex.qty += item.quantity ?? 1;
        else agg.set(item.priceId, { name: item.name, unit: item.unit, qty: item.quantity ?? 1 });
      }
    }
    for (const item of floorItems) {
      const ex = agg.get(item.priceId);
      if (ex) ex.qty += item.quantity ?? 1;
      else agg.set(item.priceId, { name: item.name, unit: item.unit, qty: item.quantity ?? 1 });
    }

    if (agg.size === 0) continue;

    const items = Array.from(agg.entries()).map(([priceId, { name, unit, qty }]) => {
      const p = priceMap.get(priceId);
      const price = p?.price ?? 0;
      const total = Math.round(qty * price);
      return { name, value: `${qty} ${unit} × ${price} ₽ = ${fmt(total)} ₽` };
    });

    blocks.push({ title: room.name, numbered: false, items });
  }

  return blocks;
}

// Пересчёт строк итогов из блоков
export function recalcTotals(bs: EstimateBlock[]): string[] {
  let standard = 0;
  for (const block of bs) {
    for (const item of block.items) {
      const p = parseValue(item.value);
      if (p) standard += p.total;
    }
  }
  const econom  = Math.round(standard * pricingRules.econom_mult);
  const premium = Math.round(standard * pricingRules.premium_mult);
  return [
    `${pricingRules.econom_label}: ${fmt(econom)} ₽`,
    `${pricingRules.standard_label}: ${fmt(standard)} ₽`,
    `${pricingRules.premium_label}: ${fmt(premium)} ₽`,
  ];
}

// Считаем итого Standard из блоков
export function calcStandardTotal(blocks: EstimateBlock[]): number {
  let s = 0;
  for (const block of blocks) {
    for (const item of block.items) {
      const p = parseValue(item.value);
      if (p) s += p.total;
    }
  }
  return s;
}

// Текст для копирования
export function generateCopyText(
  blocks: EstimateBlock[],
  standardTotal: number,
  clientName?: string | null,
  clientPhone?: string | null,
): string {
  const name = clientName || "Клиент";
  const phone = clientPhone || "";
  let text = `📋 Смета на натяжные потолки\n`;
  if (name) text += `Клиент: ${name}\n`;
  if (phone) text += `Телефон: ${phone}\n`;
  text += `\n`;
  for (const block of blocks) {
    text += `▪ ${block.title}\n`;
    for (const item of block.items) {
      text += `  • ${item.name}: ${item.value}\n`;
    }
  }
  text += `\n💰 Итого:\n`;
  text += `  ${pricingRules.econom_label}:   ${fmt(Math.round(standardTotal * pricingRules.econom_mult))} ₽\n`;
  text += `  ${pricingRules.standard_label}: ${fmt(standardTotal)} ₽\n`;
  text += `  ${pricingRules.premium_label}:  ${fmt(Math.round(standardTotal * pricingRules.premium_mult))} ₽\n`;
  return text;
}

// HTML для печати/PDF
export function generatePrintHtml(
  blocks: EstimateBlock[],
  standardTotal: number,
  clientName?: string | null,
  clientPhone?: string | null,
): string {
  const name = clientName || "Клиент";
  const econom  = Math.round(standardTotal * pricingRules.econom_mult);
  const premium = Math.round(standardTotal * pricingRules.premium_mult);
  let rows = "";
  for (const block of blocks) {
    rows += `<tr><td colspan="4" style="background:#1e1b4b;color:#f97316;font-weight:bold;padding:8px 12px;font-size:13px">${block.title}</td></tr>`;
    for (const item of block.items) {
      const p = parseValue(item.value);
      rows += `<tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 12px;font-size:13px">${item.name}</td>
        <td style="padding:6px 8px;text-align:center;font-size:13px">${p ? p.qty : ""}</td>
        <td style="padding:6px 8px;text-align:center;font-size:12px;color:#888">${p ? p.unit : ""}</td>
        <td style="padding:6px 12px;text-align:right;font-weight:600;font-size:13px">${p ? fmt(p.total) + " ₽" : item.value}</td>
      </tr>`;
    }
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Смета — ${name}</title>
  <style>body{font-family:sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse}
  h1{font-size:20px;margin-bottom:4px}p{color:#666;font-size:14px;margin:0 0 24px}
  .totals{margin-top:20px;background:#f5f5f5;padding:16px;border-radius:8px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
  .total-main{font-weight:800;font-size:18px;color:#f97316}</style></head>
  <body>
  <h1>Смета на натяжные потолки</h1>
  <p>Клиент: ${name}${clientPhone ? " · " + clientPhone : ""} · Дата: ${new Date().toLocaleDateString("ru-RU")}</p>
  <table>${rows}</table>
  <div class="totals">
    <div><span>${pricingRules.econom_label}</span><span style="color:#10b981;font-weight:600">${fmt(econom)} ₽</span></div>
    <div><span>${pricingRules.standard_label}</span><span class="total-main">${fmt(standardTotal)} ₽</span></div>
    <div><span>${pricingRules.premium_label}</span><span style="color:#8b5cf6;font-weight:600">${fmt(premium)} ₽</span></div>
  </div>
  </body></html>`;
}

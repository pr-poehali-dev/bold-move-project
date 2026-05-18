import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { AUTH_URL, PRICES_URL, PriceItem, EstimateBlock, SavedEstimate, PlanRoomForEstimate, parseValue, fmt, pricingRules } from "./estimateTypes";
import EstimateItemRow from "./EstimateItemRow";
import PlanRoomPreview from "@/pages/plan/PlanRoomPreview";

// Генерация блоков сметы из данных комнат чертежа
function buildBlocksFromRooms(rooms: PlanRoomForEstimate[], prices: PriceItem[]): EstimateBlock[] {
  const priceMap = new Map(prices.map(p => [p.id, p]));
  const blocks: EstimateBlock[] = [];

  for (const room of rooms) {
    if (!room.include_in_estimate) continue;
    // Берём данные активного варианта или основные данные комнаты
    const planData = (room.active_variant_data ?? room.data) as {
      segments?: { items?: { priceId: number; name: string; unit: string; quantity: number }[] }[];
      floorItems?: { priceId: number; name: string; unit: string; quantity: number }[];
    };
    if (!planData) continue;

    // Агрегируем товары по priceId
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

export default function EstimateEditor({ chatId, clientName, clientPhone }: {
  chatId: number;
  clientName?: string | null;
  clientPhone?: string | null;
}) {
  const t = useTheme();
  const [estimate, setEstimate] = useState<SavedEstimate | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [blocks,    setBlocks]    = useState<EstimateBlock[]>([]);
  const [totals,    setTotals]    = useState<string[]>([]);
  const [prices,    setPrices]    = useState<PriceItem[]>([]);
  const [planRooms, setPlanRooms] = useState<PlanRoomForEstimate[]>([]);

  // Пересчёт итогов (вынесен выше loadData чтобы использовать внутри)
  const recalcTotals = (bs: EstimateBlock[]) => {
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
  };

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${chatId}`).then(r => r.json()),
      fetch(PRICES_URL).then(r => r.json()).catch(() => ({ prices: [] })),
      crmFetch("plan-rooms-by-chat", undefined, { chat_id: String(chatId) }).catch(() => []),
    ]).then(([d, p, rooms]) => {
      const priceList: PriceItem[] = p.prices ?? [];
      const roomList: PlanRoomForEstimate[] = Array.isArray(rooms) ? rooms : [];
      setPrices(priceList);
      setPlanRooms(roomList);
      if (d.estimate) {
        setEstimate(d.estimate);
        setBlocks(d.estimate.blocks || []);
        setTotals(d.estimate.totals || []);
      } else if (roomList.length > 0) {
        // Автогенерация блоков из чертежа
        const autoBlocks = buildBlocksFromRooms(roomList, priceList);
        setBlocks(autoBlocks);
        setTotals(recalcTotals(autoBlocks));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
   
  }, [chatId]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateItem = (bi: number, ii: number, name: string, qty: number, price: number, unit: string) => {
    const total = Math.round(qty * price);
    const newValue = `${qty} ${unit} × ${price} ₽ = ${fmt(total)} ₽`;
    const newBlocks = blocks.map((block, bIdx) =>
      bIdx !== bi ? block : {
        ...block,
        items: block.items.map((item, iIdx) =>
          iIdx !== ii ? item : { ...item, name, value: newValue }
        ),
      }
    );
    setBlocks(newBlocks);
    setTotals(recalcTotals(newBlocks));
  };

  const deleteItem = (bi: number, ii: number) => {
    const newBlocks = blocks.map((block, bIdx) =>
      bIdx !== bi ? block : { ...block, items: block.items.filter((_, iIdx) => iIdx !== ii) }
    );
    setBlocks(newBlocks);
    setTotals(recalcTotals(newBlocks));
  };

  const addItem = (bi: number) => {
    const newBlocks = blocks.map((block, bIdx) =>
      bIdx !== bi ? block : {
        ...block,
        items: [...block.items, { name: "Новая позиция", value: "1 шт × 0 ₽ = 0 ₽" }],
      }
    );
    setBlocks(newBlocks);
  };

  const saveEstimate = async () => {
    if (!estimate) return;
    setSaving(true); setSaved(false);
    try {
      await fetch(`${AUTH_URL}?action=update-estimate&id=${estimate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, totals }),
      });
      const standardLine = totals.find(t => t.toLowerCase().startsWith("standard"));
      if (standardLine) {
        const nums = standardLine.match(/[\d\s]+/g);
        if (nums) {
          const val = parseInt(nums.map(n => n.replace(/\s/g, "")).join("").slice(0, 8), 10);
          if (!isNaN(val)) {
            await crmFetch("clients", { method: "PUT", body: JSON.stringify({ contract_sum: val }) }, { id: String(chatId) });
          }
        }
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const standardTotal = (() => {
    let s = 0;
    for (const block of blocks) {
      for (const item of block.items) {
        const p = parseValue(item.value);
        if (p) s += p.total;
      }
    }
    return s;
  })();

  const copyEstimateText = () => {
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
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const printEstimate = () => {
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Смета — ${name}</title>
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
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Создать смету из автоблоков (когда estimate=null но есть planRooms)
  const createEstimateFromPlan = async () => {
    if (blocks.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=save-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          blocks,
          totals,
          client_name: clientName ?? "",
          phone: clientPhone ?? "",
          final_phrase: "",
        }),
      });
      const data = await res.json();
      if (data.ok || data.estimate_id) {
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!estimate) {
    if (blocks.length > 0) {
      // Есть данные из чертежа — показываем предпросмотр с кнопкой создания
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold" style={{ color: t.text }}>Смета из чертежа</div>
              <div className="text-xs mt-0.5" style={{ color: t.textMute }}>Сформирована автоматически по товарам на чертеже</div>
            </div>
            <button
              onClick={createEstimateFromPlan}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="Save" size={14} />}
              Сохранить смету
            </button>
          </div>
          {blocks.map((block, bi) => (
            <div key={bi} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: t.surface2, color: "#f97316" }}>{block.title}</div>
              {block.items.map((item, ii) => (
                <div key={ii} className="flex justify-between items-center px-3 py-2 text-xs" style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <span>{item.name}</span>
                  <span style={{ color: t.textMute }}>{item.value}</span>
                </div>
              ))}
            </div>
          ))}
          {totals.length > 0 && (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              {totals.map((line, i) => (
                <div key={i} className="flex justify-between text-xs font-semibold" style={{ color: i === 1 ? "#f97316" : t.textMute }}>
                  <span>{line.split(":")[0]}</span>
                  <span>{line.split(":")[1]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: t.textMute }}>
        <Icon name="FileSpreadsheet" size={32} className="opacity-20" />
        <div className="text-sm text-center">
          <p>К этой заявке нет сохранённой сметы</p>
          <p className="text-xs mt-1 opacity-60">Добавьте товары на чертёж — смета сформируется автоматически</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: t.text }}>
            Смета на натяжные потолки{clientName ? ` — ${clientName}` : ""}
          </div>
          <div className="text-xs mt-0.5" style={{ color: t.textMute }}>
            Создана: {new Date(estimate.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            {clientPhone && <span className="ml-2 opacity-60">{clientPhone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyEstimateText}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: copied ? "#10b98122" : t.surface2, color: copied ? "#10b981" : t.textSub, border: `1px solid ${copied ? "#10b98140" : t.border}` }}>
            <Icon name={copied ? "Check" : "Copy"} size={13} />
            {copied ? "Скопировано" : "Копировать"}
          </button>
          <button onClick={printEstimate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            <Icon name="Printer" size={13} /> Печать / PDF
          </button>
          <button onClick={saveEstimate} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ background: saved ? "#10b981" : "#7c3aed" }}>
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : saved
              ? <><Icon name="CheckCircle2" size={13} /> Сохранено</>
              : <><Icon name="Save" size={13} /> Сохранить</>}
          </button>
        </div>
      </div>

      {/* Таблица */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
        <table className="w-full">
          <thead className="hidden sm:table-header-group">
            <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
              <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMute }}>Позиция</th>
              <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wide w-24" style={{ color: t.textMute }}>Кол-во</th>
              <th className="px-1 py-2.5 w-12" />
              <th className="text-right px-2 py-2.5 text-xs font-semibold uppercase tracking-wide w-28" style={{ color: t.textMute }}>Цена</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide w-28" style={{ color: t.textMute }}>Итого</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {blocks.map((block, bi) => {
              let numCounter = 0;
              blocks.slice(0, bi).forEach(b => { if (b.numbered) numCounter++; });
              if (block.numbered) numCounter++;
              const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
              return (
                <>
                  <tr key={`h-${bi}`} style={{ background: t.surface2 + "80" }}>
                    <td colSpan={6} className="px-3 py-2 text-xs font-bold" style={{ color: "#f97316", borderBottom: `1px solid ${t.border2}` }}>
                      {label}
                    </td>
                  </tr>
                  {block.items.map((item, ii) => (
                    <EstimateItemRow key={`${bi}-${ii}`} item={item}
                      onChange={(name, qty, price, unit) => updateItem(bi, ii, name, qty, price, unit)}
                      onDelete={() => deleteItem(bi, ii)}
                      prices={prices}
                    />
                  ))}
                  <tr key={`add-${bi}`}>
                    <td colSpan={6} className="px-3 py-1.5">
                      <button onClick={() => addItem(bi)}
                        className="text-xs flex items-center gap-1.5 transition"
                        style={{ color: t.textMute }}>
                        <Icon name="Plus" size={11} /> Добавить позицию
                      </button>
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Итоги */}
      <div className="rounded-2xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMute }}>Итого</div>
        <div className="space-y-2">
          {[
            { label: pricingRules.econom_label,   val: Math.round(standardTotal * pricingRules.econom_mult),   color: "#10b981" },
            { label: pricingRules.standard_label, val: standardTotal,                                           color: "#f97316", bold: true },
            { label: pricingRules.premium_label,  val: Math.round(standardTotal * pricingRules.premium_mult),  color: "#8b5cf6" },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="text-sm" style={{ color: t.textMute }}>{r.label}</span>
              <span className={`font-${r.bold ? "black text-base" : "semibold text-sm"}`} style={{ color: r.color }}>
                {fmt(r.val)} ₽
              </span>
            </div>
          ))}
        </div>

        {/* Разбивка: материалы / монтаж */}
        {estimate?.material_cost != null && estimate.material_cost > 0 && (
          <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${t.border}` }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: t.textMute }}>Себестоимость (закупка)</div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: t.textMute }}>Материалы</span>
              <span className="text-xs font-semibold text-blue-400">{fmt(estimate.material_cost)} ₽</span>
            </div>
            {standardTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMute }}>Монтаж (продажа)</span>
                <span className="text-xs font-semibold" style={{ color: t.textMute }}>
                  {fmt(standardTotal - estimate.material_cost)} ₽
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Чертежи комнат из плана */}
      {planRooms.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
            <Icon name="LayoutDashboard" size={13} style={{ color: t.textMute }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textMute }}>Чертежи комнат</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: t.border }}>
            {planRooms.map(room => {
              const drawData = room.active_variant_data ?? room.data;
              const variantName = room.active_variant_name;
              const hasVariant = !!room.active_variant_id;
              return (
                <div key={room.id} className="flex flex-col" style={{ background: t.bg }}>
                  <div className="relative" style={{ height: 140 }}>
                    <PlanRoomPreview data={drawData ?? {}} width={300} height={140} />
                    {hasVariant && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                        style={{ background: "rgba(124,58,237,0.85)", color: "#fff" }}>
                        {variantName}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
                    <span className="flex-1 text-xs font-semibold truncate" style={{ color: t.text }}>{room.name}</span>
                    {!room.include_in_estimate && (
                      <span className="text-[10px]" style={{ color: t.textMute }}>не в смете</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
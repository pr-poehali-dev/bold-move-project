import { useState, useEffect } from "react";
import { crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { AUTH_URL, PRICES_URL, PriceItem, EstimateBlock, SavedEstimate, parseValue, fmt, pricingRules } from "./estimateTypes";
import EstimateItemRow from "./EstimateItemRow";

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
  const [blocks,   setBlocks]   = useState<EstimateBlock[]>([]);
  const [totals,   setTotals]   = useState<string[]>([]);
  const [prices,   setPrices]   = useState<PriceItem[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${chatId}`).then(r => r.json()),
      fetch(PRICES_URL).then(r => r.json()).catch(() => ({ prices: [] })),
    ]).then(([d, p]) => {
      if (d.estimate) {
        setEstimate(d.estimate);
        setBlocks(d.estimate.blocks || []);
        setTotals(d.estimate.totals || []);
      }
      if (p.prices) setPrices(p.prices);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [chatId]);

  // Пересчёт итогов
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

  if (!estimate) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: t.textMute }}>
      <Icon name="FileSpreadsheet" size={32} className="opacity-20" />
      <div className="text-sm text-center">
        <p>К этой заявке нет сохранённой сметы</p>
        <p className="text-xs mt-1 opacity-60">Смета создаётся когда клиент нажимает «Сохранить заявку» на сайте</p>
      </div>
    </div>
  );

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
            { label: "Econom",   val: Math.round(standardTotal * 0.85), color: "#10b981" },
            { label: "Standard", val: standardTotal,                     color: "#f97316", bold: true },
            { label: "Premium",  val: Math.round(standardTotal * 1.27), color: "#8b5cf6" },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="text-sm" style={{ color: t.textMute }}>{r.label}</span>
              <span className={`font-${r.bold ? "black text-base" : "semibold text-sm"}`} style={{ color: r.color }}>
                {fmt(r.val)} ₽
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
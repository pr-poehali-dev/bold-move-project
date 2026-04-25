import { useState, useEffect, useRef } from "react";
import { crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const AUTH_URL    = (func2url as Record<string, string>)["auth"];
const PRICES_URL  = (func2url as Record<string, string>)["get-prices"];

interface PriceItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  category: string;
}

interface EstimateBlock {
  title: string;
  numbered: boolean;
  items: { name: string; value: string }[];
}

interface SavedEstimate {
  id: number;
  title: string;
  blocks: EstimateBlock[];
  totals: string[];
  final_phrase: string;
  total_econom: number | null;
  total_standard: number | null;
  total_premium: number | null;
  status: string;
  created_at: string;
}

// Парсим "20 м² × 399 ₽ = 7 980 ₽" → { qty, unit, price, total }
function parseValue(value: string) {
  const m = value.match(/([\d,.\s]+)\s*([а-яёa-z²³.]+)?\s*[×x*]\s*([\d\s]+)\s*₽\s*=\s*([\d\s]+)\s*₽/i);
  if (m) {
    const qty   = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
    const unit  = (m[2] || "шт").trim();
    const price = parseInt(m[3].replace(/\s/g, ""), 10);
    const total = parseInt(m[4].replace(/\s/g, ""), 10);
    return { qty, unit, price, total };
  }
  // Просто цена
  const simple = value.match(/([\d\s]+)\s*₽/);
  if (simple) return { qty: 1, unit: "шт", price: parseInt(simple[1].replace(/\s/g, ""), 10), total: parseInt(simple[1].replace(/\s/g, ""), 10) };
  return null;
}

function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU"); }

// Выбор позиции из прайса
function PricePicker({ prices, onSelect, onClose }: {
  prices: PriceItem[];
  onSelect: (p: PriceItem) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const filtered = q.length < 1
    ? prices
    : prices.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.category.toLowerCase().includes(q.toLowerCase())
      );

  // Группируем по категориям
  const grouped = filtered.reduce<Record<string, PriceItem[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "70vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Поиск */}
        <div className="p-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              placeholder="Поиск по прайсу..."
              className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>

        {/* Список */}
        <div className="overflow-y-auto flex-1">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider sticky top-0"
                style={{ background: t.surface2, color: "#f97316" }}>
                {cat || "Без категории"}
              </div>
              {items.map(p => (
                <button key={p.id} onClick={() => onSelect(p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left transition hover:opacity-80"
                  style={{ borderBottom: `1px solid ${t.border2}` }}>
                  <span className="text-sm" style={{ color: t.text }}>{p.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs" style={{ color: t.textMute }}>{p.unit}</span>
                    <span className="text-sm font-semibold text-emerald-500">{p.price.toLocaleString("ru-RU")} ₽</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm" style={{ color: t.textMute }}>Ничего не найдено</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Строка редактора
function ItemRow({ item, onChange, onDelete, prices }: {
  item: { name: string; value: string };
  onChange: (name: string, qty: number, price: number, unit: string) => void;
  onDelete: () => void;
  prices: PriceItem[];
}) {
  const t = useTheme();
  const parsed = parseValue(item.value);
  const [name,       setName]       = useState(item.name);
  const [qty,        setQty]        = useState(String(parsed?.qty   ?? 1));
  const [price,      setPrice]      = useState(String(parsed?.price ?? 0));
  const [unit,       setUnit]       = useState(parsed?.unit ?? "шт");
  const [showPicker, setShowPicker] = useState(false);

  const total = Math.round(parseFloat(qty || "0") * parseInt(price || "0", 10));

  const commit = (overrideName?: string, overrideUnit?: string) => {
    onChange(
      (overrideName ?? name).trim() || item.name,
      parseFloat(qty || "0"),
      parseInt(price || "0", 10),
      overrideUnit ?? unit,
    );
  };

  const handlePickPrice = (p: PriceItem) => {
    setName(p.name);
    setPrice(String(p.price));
    setUnit(p.unit || "шт");
    setShowPicker(false);
    // Сохраняем сразу с новыми значениями
    onChange(p.name, parseFloat(qty || "1"), p.price, p.unit || "шт");
  };

  return (
    <>
      {showPicker && <PricePicker prices={prices} onSelect={handlePickPrice} onClose={() => setShowPicker(false)} />}
      <tr className="group" style={{ borderBottom: `1px solid ${t.border2}` }}>
        <td className="py-1.5 px-2">
          <div className="flex items-center gap-1">
            {/* Кнопка замены из прайса */}
            <button
              onClick={() => setShowPicker(true)}
              title="Заменить из прайса"
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition rounded-md p-1 hover:bg-violet-500/15"
              style={{ color: "#7c3aed" }}>
              <Icon name="RefreshCw" size={11} />
            </button>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => commit()}
              onKeyDown={e => e.key === "Enter" && commit()}
              className="w-full text-sm rounded-lg px-2 py-1 focus:outline-none transition"
              style={{ background: "transparent", border: "1px solid transparent", color: t.text }}
              onFocus={e => { e.target.style.background = t.surface2; e.target.style.borderColor = "#7c3aed40"; }}
              onBlurCapture={e => { e.target.style.background = "transparent"; e.target.style.borderColor = "transparent"; }}
            />
          </div>
        </td>
        <td className="py-1.5 px-2 w-24">
          <input value={qty} onChange={e => setQty(e.target.value)} onBlur={() => commit()}
            onKeyDown={e => e.key === "Enter" && commit()}
            className="w-full text-sm text-center rounded-lg px-2 py-1 focus:outline-none"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
        </td>
        <td className="py-1.5 px-1 text-xs text-center" style={{ color: t.textMute }}>{unit}</td>
        <td className="py-1.5 px-2 w-28">
          <input value={price} onChange={e => setPrice(e.target.value)} onBlur={() => commit()}
            onKeyDown={e => e.key === "Enter" && commit()}
            className="w-full text-sm text-right rounded-lg px-2 py-1 focus:outline-none"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
        </td>
        <td className="py-1.5 px-3 text-sm font-semibold text-right w-28" style={{ color: t.text }}>
          {fmt(total)} ₽
        </td>
        <td className="py-1.5 px-1 w-8">
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300">
            <Icon name="X" size={13} />
          </button>
        </td>
      </tr>
    </>
  );
}

export default function EstimateEditor({ chatId, clientName, clientPhone }: { chatId: number; clientName?: string | null; clientPhone?: string | null }) {
  const t = useTheme();
  const [estimate, setEstimate]   = useState<SavedEstimate | null>(null);
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [copied,   setCopied]     = useState(false);
  const [blocks,   setBlocks]     = useState<EstimateBlock[]>([]);
  const [totals,   setTotals]     = useState<string[]>([]);
  const [prices,   setPrices]     = useState<PriceItem[]>([]);

  // Загружаем смету по chat_id
  useEffect(() => {
    setLoading(true);
    // Загружаем смету и прайс параллельно
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
    const econom  = Math.round(standard * 0.85);
    const premium = Math.round(standard * 1.27);
    return [
      `Econom: ${fmt(econom)} ₽`,
      `Standard: ${fmt(standard)} ₽`,
      `Premium: ${fmt(premium)} ₽`,
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
      // Обновляем contract_sum в заявке
      const standardLine = totals.find(t => t.toLowerCase().startsWith("standard"));
      if (standardLine) {
        const nums = standardLine.match(/[\d\s]+/g);
        if (nums) {
          const val = parseInt(nums.map(n => n.replace(/\s/g,"")).join("").slice(0, 8), 10);
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

  // Считаем итог Standard для отображения
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
    text += `  Эконом:   ${fmt(Math.round(standardTotal * 0.85))} ₽\n`;
    text += `  Стандарт: ${fmt(standardTotal)} ₽\n`;
    text += `  Премиум:  ${fmt(Math.round(standardTotal * 1.27))} ₽\n`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const printEstimate = () => {
    const name = clientName || "Клиент";
    const econom   = Math.round(standardTotal * 0.85);
    const premium  = Math.round(standardTotal * 1.27);
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
      <div><span>Эконом</span><span style="color:#10b981;font-weight:600">${fmt(econom)} ₽</span></div>
      <div><span>Стандарт</span><span class="total-main">${fmt(standardTotal)} ₽</span></div>
      <div><span>Премиум</span><span style="color:#8b5cf6;font-weight:600">${fmt(premium)} ₽</span></div>
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
          {/* Копировать текст */}
          <button onClick={copyEstimateText}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: copied ? "#10b98122" : t.surface2, color: copied ? "#10b981" : t.textSub, border: `1px solid ${copied ? "#10b98140" : t.border}` }}>
            <Icon name={copied ? "Check" : "Copy"} size={13} />
            {copied ? "Скопировано" : "Копировать"}
          </button>
          {/* Печать / PDF */}
          <button onClick={printEstimate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            <Icon name="Printer" size={13} /> Печать / PDF
          </button>
          {/* Сохранить */}
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
          <thead>
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
                    <ItemRow key={`${bi}-${ii}`} item={item}
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
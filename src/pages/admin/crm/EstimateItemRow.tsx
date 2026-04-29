import { useState } from "react";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { PriceItem, parseValue, fmt } from "./estimateTypes";
import EstimatePricePicker from "./EstimatePricePicker";

interface Props {
  item: { name: string; value: string };
  onChange: (name: string, qty: number, price: number, unit: string) => void;
  onDelete: () => void;
  prices: PriceItem[];
}

export default function EstimateItemRow({ item, onChange, onDelete, prices }: Props) {
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
    onChange(p.name, parseFloat(qty || "1"), p.price, p.unit || "шт");
  };

  return (
    <>
      {showPicker && <EstimatePricePicker prices={prices} onSelect={handlePickPrice} onClose={() => setShowPicker(false)} />}

      {/* ── МОБИЛЕ: карточка ─────────────────────────────────────────── */}
      <tr className="sm:hidden">
        <td colSpan={6} className="px-2 py-1.5">
          <div className="rounded-xl p-2.5 space-y-2" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
            {/* Название + кнопки */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowPicker(true)}
                className="flex-shrink-0 p-1 rounded-md transition"
                style={{ color: "#7c3aed", background: "#7c3aed15" }}>
                <Icon name="RefreshCw" size={11} />
              </button>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => commit()}
                onKeyDown={e => e.key === "Enter" && commit()}
                className="flex-1 text-sm rounded-lg px-2 py-1 focus:outline-none transition font-medium"
                style={{ background: "transparent", border: "1px solid transparent", color: t.text }}
                onFocus={e => { e.target.style.borderColor = "#7c3aed60"; }}
                onBlurCapture={e => { e.target.style.borderColor = "transparent"; }}
              />
              <button onClick={onDelete} className="flex-shrink-0 p-1 rounded-md text-red-400 hover:text-red-300 transition"
                style={{ background: "rgba(239,68,68,0.08)" }}>
                <Icon name="X" size={12} />
              </button>
            </div>

            {/* Кол-во × Цена = Итого */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider" style={{ color: t.textMute }}>Кол-во</span>
                <div className="flex items-center gap-1">
                  <input value={qty} onChange={e => setQty(e.target.value)} onBlur={() => commit()}
                    onKeyDown={e => e.key === "Enter" && commit()}
                    className="w-full text-sm text-center rounded-lg px-2 py-1.5 focus:outline-none"
                    style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
                  <span className="text-xs flex-shrink-0" style={{ color: t.textMute }}>{unit}</span>
                </div>
              </div>

              <div className="text-lg font-light" style={{ color: t.border }}>×</div>

              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider" style={{ color: t.textMute }}>Цена, ₽</span>
                <input value={price} onChange={e => setPrice(e.target.value)} onBlur={() => commit()}
                  onKeyDown={e => e.key === "Enter" && commit()}
                  className="w-full text-sm text-center rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
              </div>

              <div className="text-lg font-light" style={{ color: t.border }}>=</div>

              <div className="flex flex-col gap-0.5 items-end">
                <span className="text-[9px] uppercase tracking-wider" style={{ color: t.textMute }}>Итого</span>
                <span className="text-sm font-bold" style={{ color: t.text }}>{fmt(total)} ₽</span>
              </div>
            </div>
          </div>
        </td>
      </tr>

      {/* ── ДЕСКТОП: строка таблицы ──────────────────────────────────── */}
      <tr className="hidden sm:table-row group" style={{ borderBottom: `1px solid ${t.border2}` }}>
        <td className="py-1.5 px-2">
          <div className="flex items-center gap-1">
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

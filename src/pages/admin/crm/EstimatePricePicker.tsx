import { useState, useEffect, useRef } from "react";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { PriceItem } from "./estimateTypes";

interface Props {
  prices: PriceItem[];
  onSelect: (p: PriceItem) => void;
  onClose: () => void;
}

export default function EstimatePricePicker({ prices, onSelect, onClose }: Props) {
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

import { useState } from "react";
import Icon from "@/components/ui/icon";

interface PriceItem { category: string; name: string; price: number; unit: string; description: string; active: boolean; }

interface Props {
  byCategory: Record<string, PriceItem[]>;
  totalCount: number;
}

export default function TabPromptPricesPreview({ byCategory, totalCount }: Props) {
  const [showPrices, setShowPrices] = useState(false);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowPrices(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
        <div className="flex items-center gap-2">
          <Icon name="Tag" size={15} className="text-violet-400" />
          <span className="text-white/70 text-sm font-medium">Актуальный прайс — подставляется в AI автоматически</span>
          <span className="text-white/30 text-xs">({totalCount} позиций)</span>
        </div>
        <Icon name={showPrices ? "ChevronUp" : "ChevronDown"} size={15} className="text-white/30" />
      </button>

      {showPrices && (
        <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-4 max-h-[500px] overflow-y-auto">
          <p className="text-white/30 text-xs">Редактируется во вкладке «Цены». Здесь только просмотр.</p>
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-violet-300 text-xs font-semibold uppercase tracking-wider mb-1.5">{cat}</p>
              <div className="flex flex-col gap-0.5">
                {items.map(item => (
                  <div key={item.name} className="flex items-baseline gap-2 text-xs">
                    <span className="text-white/60 flex-1">{item.name}</span>
                    <span className="text-green-400 font-mono flex-shrink-0">{item.price} ₽/{item.unit}</span>
                    {item.description && <span className="text-white/25 flex-shrink-0 max-w-[240px] truncate">{item.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

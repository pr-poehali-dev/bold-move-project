import Icon from "@/components/ui/icon";
import type { PriceItem } from "./types";

interface Props {
  prices: PriceItem[];
  selectedPriceId?: number | null;
  bundleIds: number[];
  bundleSearch: string;
  bundleOpen: boolean;
  onToggleOpen: () => void;
  onBundleSearchChange: (v: string) => void;
  onToggleItem: (id: number) => void;
  onRemoveItem: (id: number) => void;
  excludeId?: number | null;
}

export default function BundleSelector({
  prices, selectedPriceId, bundleIds, bundleSearch, bundleOpen,
  onToggleOpen, onBundleSearchChange, onToggleItem, onRemoveItem, excludeId,
}: Props) {
  const filtered = prices.filter(p =>
    p.id !== excludeId &&
    p.id !== selectedPriceId &&
    (p.name.toLowerCase().includes(bundleSearch.toLowerCase()) ||
     p.category.toLowerCase().includes(bundleSearch.toLowerCase()))
  );
  const selected = prices.filter(p => bundleIds.includes(p.id));

  return (
    <div className="mt-1 border-t border-white/5 pt-2">
      <button
        onClick={onToggleOpen}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition w-full text-left"
      >
        <Icon name={bundleOpen ? "ChevronUp" : "Package"} size={12} />
        <span>Комплект — добавить сопутствующие позиции</span>
        {bundleIds.length > 0 && (
          <span className="ml-auto bg-violet-600/30 text-violet-300 text-[10px] px-1.5 py-0.5 rounded-full">
            {bundleIds.length}
          </span>
        )}
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(p => (
            <span key={p.id} className="flex items-center gap-1 text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
              {p.name}
              <button onClick={() => onRemoveItem(p.id)} className="text-violet-400/50 hover:text-red-400 transition">
                <Icon name="X" size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {bundleOpen && (
        <div className="flex flex-col gap-1 mt-1.5">
          <input
            value={bundleSearch}
            onChange={e => onBundleSearchChange(e.target.value)}
            placeholder="Найти позицию для комплекта..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition"
          />
          <div className="max-h-28 overflow-y-auto flex flex-col gap-0.5">
            {filtered.slice(0, 30).map(p => (
              <button
                key={p.id}
                onClick={() => onToggleItem(p.id)}
                className={`text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                  bundleIds.includes(p.id)
                    ? "bg-violet-600/20 border border-violet-500/30 text-white"
                    : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {bundleIds.includes(p.id) && <Icon name="Check" size={10} className="text-violet-400" />}
                  {p.name}
                </span>
                <span className="text-white/30 flex-shrink-0">{p.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

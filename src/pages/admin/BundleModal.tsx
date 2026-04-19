import Icon from "@/components/ui/icon";
import BundleSelector from "./BundleSelector";
import type { RuleItem } from "./RuleTypes";
import type { PriceItem } from "./types";

interface BundleModalState {
  ids: number[];
  search: string;
  open: boolean;
}

interface Props {
  item: RuleItem;
  prices: PriceItem[];
  state: BundleModalState;
  onChange: (patch: Partial<BundleModalState>) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function BundleModal({ item, prices, state, onChange, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#13131f] border border-violet-500/30 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-white text-sm font-semibold">Логика привязки комплектов</h3>
            <p className="text-white/40 text-xs mt-0.5">
              Позиции которые добавятся вместе с <span className="text-violet-300">{item.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition flex-shrink-0">
            <Icon name="X" size={16} />
          </button>
        </div>

        <BundleSelector
          prices={prices}
          selectedPriceId={item.id}
          excludeId={item.id}
          bundleIds={state.ids}
          bundleSearch={state.search}
          bundleOpen={state.open}
          onToggleOpen={() => onChange({ open: !state.open })}
          onBundleSearchChange={v => onChange({ search: v })}
          onToggleItem={id => onChange({ ids: state.ids.includes(id) ? state.ids.filter(x => x !== id) : [...state.ids, id] })}
          onRemoveItem={id => onChange({ ids: state.ids.filter(x => x !== id) })}
        />

        <div className="flex gap-2 pt-2 border-t border-white/5">
          <button onClick={onSave}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm py-2.5 rounded-xl transition flex items-center justify-center gap-2">
            <Icon name="Check" size={14} /> Сохранить
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-sm transition px-4 py-2.5">Отмена</button>
        </div>
      </div>
    </div>
  );
}

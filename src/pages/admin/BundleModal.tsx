import { useState } from "react";
import Icon from "@/components/ui/icon";
import BundleSelector from "./BundleSelector";
import type { RuleItem } from "./RuleTypes";
import type { PriceItem } from "./types";
import func2url from "@/../backend/func2url.json";

const PAGE_AI_URL = (func2url as Record<string, string>)["page-ai"];

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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAutoSuggest = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const pricesList = prices
        .filter(p => p.id !== item.id)
        .map(p => `id=${p.id} | ${p.name} | ${p.category}`)
        .join("\n");

      const prompt = `Ты помощник по настройке прайса натяжных потолков.

Позиция: "${item.name}" (категория: ${item.category || "не указана"})
Правило расчёта: ${item.calc_rule || "не задано"}
Добавляется если: ${item.when_condition || "не задано"}

Список всех позиций прайса (id | название | категория):
${pricesList}

Задача: определи какие позиции из прайса ОБЯЗАТЕЛЬНО должны добавляться вместе с "${item.name}" автоматически (bundle).
Например: к парящему профилю → лента + блоки питания + монтаж; к закладной → монтаж закладной; к полотну ПВХ → раскрой + огарпунивание.

Верни ТОЛЬКО JSON массив id позиций без пояснений. Пример: [41, 43, 44, 45]
Если bundle не нужен — верни пустой массив: []`;

      const res = await fetch(PAGE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 200 }),
      });

      const data = await res.json();
      const text: string = data.result || data.text || data.answer || "";
      const match = text.match(/\[[\d,\s]*\]/);
      if (!match) throw new Error("ИИ не вернул массив");

      const suggested: number[] = JSON.parse(match[0]);
      const valid = suggested.filter(id => prices.some(p => p.id === id && p.id !== item.id));

      // Объединяем с уже выбранными
      const merged = Array.from(new Set([...state.ids, ...valid]));
      onChange({ ids: merged });
    } catch (e) {
      setAiError("Не удалось получить предложение от ИИ");
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleAutoSuggest}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              title="ИИ предложит подходящие позиции для комплекта"
            >
              {aiLoading
                ? <Icon name="Loader2" size={12} className="animate-spin" />
                : <Icon name="Sparkles" size={12} />}
              Авто
            </button>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {aiError && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {aiError}
          </p>
        )}

        {aiLoading && (
          <p className="text-violet-300/60 text-xs text-center py-2">
            ИИ анализирует позицию и подбирает комплект...
          </p>
        )}

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

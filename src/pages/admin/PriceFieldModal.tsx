import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { PriceItem } from "./types";

interface Props {
  item: PriceItem;
  field: "description" | "synonyms";
  isLoading: boolean;
  onSave: (item: PriceItem, field: keyof PriceItem, val: string) => void;
  onGenerate: (item: PriceItem) => void;
  onClose: () => void;
  isDark: boolean;
}

export default function PriceFieldModal({ item, field, isLoading, onSave, onGenerate, onClose, isDark }: Props) {
  const isDesc = field === "description";
  const label = isDesc ? "Описание (AI)" : "Синонимы";
  const placeholder = isDesc
    ? "Как AI понимает эту позицию — подробное описание для точного распознавания..."
    : "Синонимы через запятую: карниз, гардина, ниша, рельс...";

  const [value, setValue] = useState(isDesc ? item.description : (item.synonyms || ""));

  useEffect(() => {
    const newVal = isDesc ? item.description : (item.synonyms || "");
    setValue(newVal);
  }, [item.description, item.synonyms, isDesc]);

  const handleSave = () => {
    onSave(item, field, value);
    onClose();
  };

  const surface = isDark ? "bg-[#1a1a2e]" : "bg-white";
  const surfaceInner = isDark ? "bg-white/5" : "bg-gray-50";
  const border = isDark ? "border-white/10" : "border-gray-200";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border ${surface} ${border}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div>
            <p className={`text-sm font-semibold ${textMain}`}>{label}</p>
            <p className={`text-xs mt-0.5 ${textMuted}`}>{item.name}</p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition hover:bg-white/10 ${textMuted}`}
          >
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Тело */}
        <div className="p-5 space-y-3">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            rows={isDesc ? 5 : 3}
            className={`w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition ${surfaceInner} border ${border} ${textMain}`}
            style={{ colorScheme: isDark ? "dark" : "light" }}
          />

          {/* Кнопка AI */}
          <button
            onClick={() => onGenerate(item)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition
              bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/30 text-violet-400 disabled:opacity-40"
          >
            {isLoading
              ? <><Icon name="Loader" size={14} className="animate-spin" /> Генерирую...</>
              : <><Icon name="Sparkles" size={14} /> Сгенерировать через AI</>
            }
          </button>
        </div>

        {/* Футер */}
        <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${border}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm transition hover:bg-white/5 ${textMuted}`}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition bg-violet-600 hover:bg-violet-500 text-white"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

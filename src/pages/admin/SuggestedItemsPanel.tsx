import { useState } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { SuggestedItem, PriceItem } from "./types";

interface Props {
  correctionId: number;
  items: SuggestedItem[];
  prices: PriceItem[];
  token: string;
  onDone: () => void;
}

export default function SuggestedItemsPanel({ correctionId, items, prices, token, onDone }: Props) {
  const categories = [...new Set(prices.map(p => p.category))];
  const [states, setStates] = useState<Record<number, "idle" | "saving" | "done" | "rejected">>(
    () => Object.fromEntries(items.map((_, i) => [i, "idle"]))
  );
  const [editedNames, setEditedNames] = useState<Record<number, string>>(
    () => Object.fromEntries(items.map((item, i) => [i, item.name]))
  );
  const [editedPrices, setEditedPrices] = useState<Record<number, string>>(
    () => Object.fromEntries(items.map((item, i) => [i, String(item.price)]))
  );
  const [editedCategories, setEditedCategories] = useState<Record<number, string>>(
    () => Object.fromEntries(items.map((_, i) => [i, categories[0] ?? "Дополнительно"]))
  );

  const accept = async (idx: number) => {
    setStates(prev => ({ ...prev, [idx]: "saving" }));
    const name = editedNames[idx].trim();
    const price = parseInt(editedPrices[idx]) || 0;
    const category = editedCategories[idx] || "Дополнительно";
    const syn = items[idx].name.toLowerCase() !== name.toLowerCase() ? items[idx].name : "";

    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({ name, category, price, unit: "шт", description: "", synonyms: syn }),
    }, token);

    if (r.ok) {
      setStates(prev => ({ ...prev, [idx]: "done" }));
      // Если все обработаны — помечаем correction как approved
      const next = { ...states, [idx]: "done" };
      if (Object.values(next).every(s => s === "done" || s === "rejected")) {
        await apiFetch("corrections", { method: "PUT", body: JSON.stringify({ id: correctionId, status: "approved" }) }, token, correctionId);
        onDone();
      }
    } else {
      setStates(prev => ({ ...prev, [idx]: "idle" }));
    }
  };

  const reject = async (idx: number) => {
    setStates(prev => ({ ...prev, [idx]: "rejected" }));
    const next = { ...states, [idx]: "rejected" };
    if (Object.values(next).every(s => s === "done" || s === "rejected")) {
      await apiFetch("corrections", { method: "PUT", body: JSON.stringify({ id: correctionId, status: "approved" }) }, token, correctionId);
      onDone();
    }
  };

  return (
    <div className="border-t border-violet-500/20 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon name="Sparkles" size={14} className="text-violet-400" />
        <span className="text-xs text-violet-300 font-medium">LLM нашла новые позиции — добавить в прайс?</span>
      </div>

      {items.map((item, idx) => {
        const state = states[idx];
        if (state === "done") return (
          <div key={idx} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
            <Icon name="CheckCircle" size={13} className="text-green-400" />
            <span className="text-green-300 text-xs">«{editedNames[idx]}» добавлена в прайс</span>
          </div>
        );
        if (state === "rejected") return (
          <div key={idx} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 opacity-40">
            <Icon name="X" size={13} className="text-white/30" />
            <span className="text-white/40 text-xs line-through">«{item.name}»</span>
          </div>
        );

        return (
          <div key={idx} className="bg-white/[0.03] border border-violet-500/20 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/40">Позиция из сметы:</span>
              <span className="text-xs text-violet-300 font-medium">«{item.name}»</span>
              <span className="text-xs text-white/30">{item.qty} шт × {item.price} ₽ = {item.total.toLocaleString("ru")} ₽</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                value={editedNames[idx]}
                onChange={e => setEditedNames(prev => ({ ...prev, [idx]: e.target.value }))}
                placeholder="Название позиции"
                className="flex-1 min-w-32 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition"
              />
              <input
                value={editedPrices[idx]}
                onChange={e => setEditedPrices(prev => ({ ...prev, [idx]: e.target.value }))}
                placeholder="Цена ₽"
                type="number"
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition"
              />
              <select
                value={editedCategories[idx]}
                onChange={e => setEditedCategories(prev => ({ ...prev, [idx]: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition">
                {categories.map(c => <option key={c} value={c} className="bg-[#0b0b11]">{c}</option>)}
                <option value="Дополнительно" className="bg-[#0b0b11]">Дополнительно</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => accept(idx)}
                disabled={state === "saving"}
                className="flex-1 bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-40 text-violet-300 text-xs py-1.5 rounded-lg transition flex items-center justify-center gap-1.5">
                <Icon name="Plus" size={12} />
                {state === "saving" ? "Добавляю..." : "Добавить в прайс"}
              </button>
              <button
                onClick={() => reject(idx)}
                className="bg-white/5 hover:bg-white/10 text-white/40 text-xs py-1.5 px-3 rounded-lg transition flex items-center gap-1.5">
                <Icon name="X" size={12} />
                Пропустить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

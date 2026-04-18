import { useState } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

interface Props {
  words: string[];
  prices: PriceItem[];
  token: string;
  onAdded: (priceName: string) => void;
}

type RowMode = "select" | "create";

interface WordRow {
  word: string;
  edited: string;
  selectedId: number | null;
  mode: RowMode;
  aiMatching: boolean;
  aiResult: "found" | "notfound" | null;
  // create mode fields
  newName: string;
  newPrice: string;
  newUnit: string;
  newCategory: string;
}

const UNITS = ["шт", "м²", "пог.м", "уп", "катушка"];

export default function AddSynonymPanel({ words, prices, token, onAdded }: Props) {
  const categories = [...new Set(prices.map(p => p.category))];
  const defaultCategory = categories[0] ?? "Дополнительно";

  const [rows, setRows] = useState<WordRow[]>(() =>
    words.map(w => ({
      word: w, edited: w, selectedId: null, mode: "select",
      aiMatching: false, aiResult: null,
      newName: w, newPrice: "", newUnit: "шт", newCategory: defaultCategory,
    }))
  );
  const [search, setSearch] = useState("");
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(words.length === 1 ? 0 : null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [aiMatchingAll, setAiMatchingAll] = useState(false);

  const updateRow = (i: number, patch: Partial<WordRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const matchRowWithAI = async (i: number) => {
    updateRow(i, { aiMatching: true, aiResult: null });
    try {
      const r = await apiFetch("match-synonym", {
        method: "POST",
        body: JSON.stringify({
          word: rows[i].edited,
          prices: prices.map(p => ({ id: p.id, name: p.name, category: p.category, synonyms: p.synonyms })),
        }),
      }, token);
      if (r.ok) {
        const data = await r.json();
        if (data.matched_id && data.matched_id !== 0) {
          updateRow(i, { selectedId: data.matched_id, mode: "select", aiResult: "found", aiMatching: false });
        } else {
          updateRow(i, { mode: "create", aiResult: "notfound", aiMatching: false });
        }
      }
    } catch {
      updateRow(i, { aiMatching: false });
    }
  };

  const matchAllWithAI = async () => {
    setAiMatchingAll(true);
    await Promise.all(rows.map((_, i) => matchRowWithAI(i)));
    setAiMatchingAll(false);
  };

  const saveAll = async () => {
    setSaving(true);
    const savedNames: string[] = [];

    for (const row of rows) {
      if (row.mode === "select" && row.selectedId) {
        const price = prices.find(p => p.id === row.selectedId);
        if (!price) continue;
        const existing = price.synonyms ? price.synonyms.split(",").map(s => s.trim()).filter(Boolean) : [];
        const syn = row.edited.trim();
        if (syn && !existing.includes(syn)) existing.push(syn);
        await apiFetch("prices", {
          method: "PUT",
          body: JSON.stringify({ ...price, synonyms: existing.join(", ") }),
        }, token, price.id);
        savedNames.push(price.name);
      } else if (row.mode === "create" && row.newName.trim()) {
        const name = row.newName.trim();
        const category = row.newCategory || defaultCategory;
        const syn = row.edited.trim() !== name ? row.edited.trim() : "";
        const r = await apiFetch("prices", {
          method: "POST",
          body: JSON.stringify({
            name, category,
            price: parseInt(row.newPrice) || 0,
            unit: row.newUnit,
            description: "",
            synonyms: syn,
          }),
        }, token);
        if (r.ok) savedNames.push(name);
      }
    }

    setSaving(false);
    if (savedNames.length > 0) {
      setDone(true);
      onAdded(savedNames[0]);
    }
  };

  const filtered = prices.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const canSave = rows.some(r =>
    (r.mode === "select" && r.selectedId) ||
    (r.mode === "create" && r.newName.trim())
  );

  if (done) {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mt-3">
        <Icon name="CheckCircle" size={15} className="text-green-400" />
        <span className="text-green-300 text-sm">
          {words.length > 1 ? `${words.length} синонима сохранены` : `«${words[0]}» добавлен`} — бот запомнил
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-violet-500/20 rounded-xl p-4 flex flex-col gap-3 mt-3">

      {/* Кнопка AI для всех сразу */}
      <button
        onClick={matchAllWithAI}
        disabled={aiMatchingAll || saving}
        className="w-full bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-50 border border-violet-500/30 text-violet-300 text-xs py-2 rounded-lg transition flex items-center justify-center gap-2">
        {aiMatchingAll
          ? <><Icon name="Loader" size={13} className="animate-spin" /> Подбираю позиции...</>
          : <><Icon name="Sparkles" size={13} /> Подобрать позиции через AI для всех</>
        }
      </button>

      {/* Строка для каждого слова */}
      {rows.map((row, i) => (
        <div key={i} className={`border rounded-xl overflow-hidden transition ${
          activeRowIdx === i ? "border-violet-500/40" : "border-white/10"
        }`}>
          {/* Заголовок строки */}
          <button
            onClick={() => setActiveRowIdx(activeRowIdx === i ? null : i)}
            className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] transition">
            <div className="flex items-center gap-2">
              {row.aiResult === "found" && row.selectedId
                ? <Icon name="CheckCircle" size={13} className="text-green-400" />
                : row.aiResult === "notfound"
                ? <Icon name="Plus" size={13} className="text-amber-400" />
                : <Icon name="Tag" size={13} className="text-white/30" />
              }
              <span className="text-xs text-red-300 font-medium">«{row.word}»</span>
              {row.selectedId && row.mode === "select" && (
                <span className="text-xs text-white/40">→ {prices.find(p => p.id === row.selectedId)?.name}</span>
              )}
              {row.mode === "create" && row.newName && (
                <span className="text-xs text-amber-300/60">→ создать «{row.newName}»</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {row.aiMatching && <Icon name="Loader" size={12} className="text-violet-400 animate-spin" />}
              {!row.aiMatching && (
                <button
                  onClick={e => { e.stopPropagation(); matchRowWithAI(i); }}
                  className="text-white/20 hover:text-violet-400 transition"
                  title="Подобрать через AI">
                  <Icon name="Sparkles" size={12} />
                </button>
              )}
              <Icon name={activeRowIdx === i ? "ChevronUp" : "ChevronDown"} size={13} className="text-white/30" />
            </div>
          </button>

          {/* Раскрытое тело строки */}
          {activeRowIdx === i && (
            <div className="p-3 flex flex-col gap-2 border-t border-white/5">
              <input
                value={row.edited}
                onChange={e => updateRow(i, { edited: e.target.value })}
                className="bg-white/5 border border-red-500/30 rounded-lg px-3 py-1.5 text-red-300 text-xs font-medium outline-none focus:border-violet-500 transition"
                placeholder="Синоним"
              />

              <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                <button onClick={() => updateRow(i, { mode: "select" })}
                  className={`flex-1 text-xs py-1 rounded-md transition ${row.mode === "select" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
                  Выбрать из прайса
                </button>
                <button onClick={() => updateRow(i, { mode: "create" })}
                  className={`flex-1 text-xs py-1 rounded-md transition ${row.mode === "create" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
                  Создать позицию
                </button>
              </div>

              {row.mode === "select" ? (
                <>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск позиции..."
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5">
                    {filtered.slice(0, 40).map(p => (
                      <button key={p.id} onClick={() => updateRow(i, { selectedId: p.id })}
                        className={`text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                          row.selectedId === p.id
                            ? "bg-violet-600/30 border border-violet-500/40 text-white"
                            : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white"
                        }`}>
                        <span>{p.name}</span>
                        <span className="text-white/30 flex-shrink-0">{p.category}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <input value={row.newName} onChange={e => updateRow(i, { newName: e.target.value })}
                    placeholder="Название позиции"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
                  <div className="flex gap-1.5">
                    <input value={row.newPrice} onChange={e => updateRow(i, { newPrice: e.target.value })}
                      placeholder="Цена ₽" type="number"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition w-24" />
                    <select value={row.newUnit} onChange={e => updateRow(i, { newUnit: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition">
                      {UNITS.map(u => <option key={u} value={u} className="bg-[#0b0b11]">{u}</option>)}
                    </select>
                    <select value={row.newCategory} onChange={e => updateRow(i, { newCategory: e.target.value })}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition">
                      {categories.map(c => <option key={c} value={c} className="bg-[#0b0b11]">{c}</option>)}
                      <option value="Дополнительно" className="bg-[#0b0b11]">Дополнительно</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Кнопка сохранить всё */}
      <button onClick={saveAll} disabled={!canSave || saving}
        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition flex items-center justify-center gap-2">
        <Icon name="Tag" size={14} />
        {saving ? "Сохраняю..." : `Сохранить ${rows.length > 1 ? `все (${rows.length})` : "синоним"}`}
      </button>
    </div>
  );
}

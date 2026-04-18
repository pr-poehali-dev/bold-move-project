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

export default function AddSynonymPanel({ words, prices, token, onAdded }: Props) {
  const primaryWord = words[0] ?? "";
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"select" | "create">("select");
  const [editedWords, setEditedWords] = useState<string[]>(words);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatchedName, setAiMatchedName] = useState<string | null>(null);

  const matchWithAI = async () => {
    setAiMatching(true);
    setAiMatchedName(null);
    try {
      const r = await apiFetch("match-synonym", {
        method: "POST",
        body: JSON.stringify({
          word: editedWords.join(", "),
          prices: prices.map(p => ({ id: p.id, name: p.name, category: p.category, synonyms: p.synonyms })),
        }),
      }, token);
      if (r.ok) {
        const data = await r.json();
        if (data.matched_id && data.matched_id !== 0) {
          setSelectedId(data.matched_id);
          const matched = prices.find(p => p.id === data.matched_id);
          if (matched) setAiMatchedName(matched.name);
        } else {
          setAiMatchedName("Не найдено — создай новую позицию");
          setMode("create");
        }
      }
    } finally {
      setAiMatching(false);
    }
  };

  const categories = [...new Set(prices.map(p => p.category))];
  const [newName, setNewName] = useState(primaryWord);
  const [newPrice, setNewPrice] = useState("");
  const [newUnit, setNewUnit] = useState("шт");
  const [newCategory, setNewCategory] = useState(categories[0] ?? "");
  const [newCategoryCustom, setNewCategoryCustom] = useState("");

  const filtered = prices.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const saveSynonym = async () => {
    if (!selectedId) return;
    const price = prices.find(p => p.id === selectedId);
    if (!price) return;
    setSaving(true);
    const existing = price.synonyms ? price.synonyms.split(",").map(s => s.trim()).filter(Boolean) : [];
    for (const syn of editedWords) {
      const s = syn.trim();
      if (s && !existing.includes(s)) existing.push(s);
    }
    await apiFetch("prices", {
      method: "PUT",
      body: JSON.stringify({ ...price, synonyms: existing.join(", ") }),
    }, token, price.id);
    setSaving(false);
    setDone(true);
    onAdded(price.name);
  };

  const createAndSave = async () => {
    const name = newName.trim();
    const category = newCategoryCustom.trim() || newCategory;
    if (!name || !category) return;
    setSaving(true);
    const syns = editedWords.map(w => w.trim()).filter(w => w && w !== name);
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({
        name,
        category,
        price: parseInt(newPrice) || 0,
        unit: newUnit,
        description: "",
        synonyms: syns.join(", "),
      }),
    }, token);
    setSaving(false);
    if (r.ok) { setDone(true); onAdded(name); }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mt-3">
        <Icon name="CheckCircle" size={15} className="text-green-400" />
        <span className="text-green-300 text-sm">
          {words.length > 1 ? `${words.length} синонима добавлены` : `«${primaryWord}» добавлен`} — бот запомнил
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-violet-500/20 rounded-xl p-4 flex flex-col gap-3 mt-3">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/40">
          {words.length > 1 ? `Синонимы для сохранения (${words.length}) — отредактируй если нужно:` : "Синоним для сохранения — отредактируй если нужно:"}
        </p>
        {editedWords.map((w, i) => (
          <input
            key={i}
            value={w}
            onChange={e => setEditedWords(prev => prev.map((x, j) => j === i ? e.target.value : x))}
            className="bg-white/5 border border-red-500/30 rounded-lg px-3 py-2 text-red-300 text-sm font-medium outline-none focus:border-violet-500 transition"
          />
        ))}
      </div>

      {/* Кнопка AI-подбора */}
      <button
        onClick={matchWithAI}
        disabled={aiMatching}
        className="w-full bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-50 border border-violet-500/30 text-violet-300 text-xs py-2 rounded-lg transition flex items-center justify-center gap-2">
        {aiMatching
          ? <><Icon name="Loader" size={13} className="animate-spin" /> Подбираю позицию...</>
          : <><Icon name="Sparkles" size={13} /> Подобрать позицию через AI</>
        }
      </button>
      {aiMatchedName && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          selectedId
            ? "bg-green-500/10 border-green-500/30 text-green-300"
            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
        }`}>
          <Icon name={selectedId ? "CheckCircle" : "AlertCircle"} size={13} />
          {selectedId ? `AI выбрал: «${aiMatchedName}»` : aiMatchedName}
        </div>
      )}

      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        <button onClick={() => setMode("select")}
          className={`flex-1 text-xs py-1.5 rounded-md transition ${mode === "select" ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"}`}>
          Выбрать из прайса
        </button>
        <button onClick={() => setMode("create")}
          className={`flex-1 text-xs py-1.5 rounded-md transition ${mode === "create" ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"}`}>
          Создать новую позицию
        </button>
      </div>

      {mode === "select" ? (
        <>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск позиции..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 transition" />
          <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
            {filtered.slice(0, 40).map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                  selectedId === p.id
                    ? "bg-violet-600/30 border border-violet-500/40 text-white"
                    : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white hover:border-white/20"
                }`}>
                <span>{p.name}</span>
                <span className="text-white/30 flex-shrink-0">{p.category}</span>
              </button>
            ))}
          </div>
          <button onClick={saveSynonym} disabled={!selectedId || saving}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition flex items-center justify-center gap-2">
            <Icon name="Tag" size={14} />
            {saving ? "Сохраняю..." : words.length > 1 ? `Добавить ${words.length} синонима` : `Добавить «${editedWords[0] || primaryWord}» как синоним`}
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Название позиции"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 transition" />
            <div className="flex gap-2">
              <input value={newPrice} onChange={e => setNewPrice(e.target.value)}
                placeholder="Цена ₽"
                type="number"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 transition w-28" />
              <select value={newUnit} onChange={e => setNewUnit(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 transition">
                {["шт", "м²", "пог.м", "уп", "катушка"].map(u => (
                  <option key={u} value={u} className="bg-[#0b0b11]">{u}</option>
                ))}
              </select>
            </div>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 transition">
              {categories.map(c => <option key={c} value={c} className="bg-[#0b0b11]">{c}</option>)}
            </select>
            <input value={newCategoryCustom} onChange={e => setNewCategoryCustom(e.target.value)}
              placeholder="Или новая категория..."
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-violet-500 transition" />
          </div>
          <button onClick={createAndSave} disabled={!newName.trim() || saving}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition flex items-center justify-center gap-2">
            <Icon name="Plus" size={14} />
            {saving ? "Создаю..." : "Создать позицию и добавить синоним"}
          </button>
        </>
      )}
    </div>
  );
}
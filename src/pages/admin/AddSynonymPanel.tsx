import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

interface Props {
  words: string[];
  prices: PriceItem[];
  token: string;
  onAdded: (priceName: string) => void;
}

type RowMode = "ai-loading" | "found" | "notfound-manual";

interface WordRow {
  word: string;
  edited: string;
  mode: RowMode;
  selectedId: number | null;
  manualOpen: boolean;
  newName: string;
  newPrice: string;
  newUnit: string;
  newCategory: string;
  createMode: boolean;
  bundleIds: number[];
  bundleSearch: string;
  bundleOpen: boolean;
}

const UNITS = ["шт", "м²", "пог.м", "уп", "катушка"];

export default function AddSynonymPanel({ words, prices, token, onAdded }: Props) {
  const categories = [...new Set(prices.map(p => p.category))];
  const defaultCategory = categories[0] ?? "Дополнительно";
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [groupMode, setGroupMode] = useState(words.length > 1);
  const [groupSelectedId, setGroupSelectedId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupBundleIds, setGroupBundleIds] = useState<number[]>([]);
  const [groupBundleSearch, setGroupBundleSearch] = useState("");
  const [groupBundleOpen, setGroupBundleOpen] = useState(false);

  const [rows, setRows] = useState<WordRow[]>(() =>
    words.map(w => ({
      word: w, edited: w, mode: "ai-loading" as RowMode,
      selectedId: null, manualOpen: false,
      newName: w, newPrice: "", newUnit: "шт",
      newCategory: defaultCategory, createMode: false,
      bundleIds: [], bundleSearch: "", bundleOpen: false,
    }))
  );

  const updateRow = (i: number, patch: Partial<WordRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const matchOne = async (i: number, currentRows: WordRow[]) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode: "ai-loading" } : r));
    try {
      const r = await apiFetch("match-synonym", {
        method: "POST",
        body: JSON.stringify({
          word: currentRows[i].edited,
          prices: prices.map(p => ({ id: p.id, name: p.name, category: p.category, synonyms: p.synonyms })),
        }),
      }, token);
      if (r.ok) {
        const data = await r.json();
        if (data.matched_id && data.matched_id !== 0) {
          const matched = prices.find(p => p.id === data.matched_id);
          const existingBundle = matched ? parseBundle(matched) : [];
          setRows(prev => prev.map((r, idx) => idx === i
            ? { ...r, mode: "found", selectedId: data.matched_id, bundleIds: existingBundle }
            : r));
        } else {
          setRows(prev => prev.map((r, idx) => idx === i
            ? { ...r, mode: "notfound-manual", manualOpen: true, createMode: true }
            : r));
        }
      } else {
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode: "notfound-manual", manualOpen: true } : r));
      }
    } catch {
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode: "notfound-manual", manualOpen: true } : r));
    }
  };

  useEffect(() => {
    const initial = words.map(w => ({
      word: w, edited: w, mode: "ai-loading" as RowMode,
      selectedId: null, manualOpen: false,
      newName: w, newPrice: "", newUnit: "шт",
      newCategory: defaultCategory, createMode: false,
      bundleIds: [], bundleSearch: "", bundleOpen: false,
    }));
    words.forEach((_, i) => matchOne(i, initial));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rematchAll = () => {
    setRows(prev => {
      prev.forEach((_, i) => matchOne(i, prev));
      return prev;
    });
  };

  const parseBundle = (price: PriceItem & { bundle?: string }): number[] => {
    try {
      const b = (price as { bundle?: string }).bundle;
      if (!b || b === "[]") return [];
      return JSON.parse(b) as number[];
    } catch { return []; }
  };

  const addSynonym = (existing: string, word: string): string => {
    const parts = existing ? existing.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (!parts.includes(word.trim())) parts.push(word.trim());
    return parts.join(", ");
  };

  const saveAll = async () => {
    setSaving(true);
    const savedNames: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.mode === "found" && row.selectedId) {
        const price = prices.find(p => p.id === row.selectedId) as (PriceItem & { bundle?: string; calc_rule?: string }) | undefined;
        if (!price) continue;
        const updatedSynonyms = addSynonym(price.synonyms, row.edited);
        const bundleJson = JSON.stringify(row.bundleIds);
        await apiFetch("prices", {
          method: "PUT",
          body: JSON.stringify({ ...price, synonyms: updatedSynonyms, bundle: bundleJson }),
        }, token, price.id);
        savedNames.push(price.name);
      } else if (row.mode === "notfound-manual") {
        if (row.createMode && row.newName.trim()) {
          const name = row.newName.trim();
          const syn = row.edited.trim() !== name ? row.edited.trim() : "";
          const r = await apiFetch("prices", {
            method: "POST",
            body: JSON.stringify({
              name, category: row.newCategory || defaultCategory,
              price: parseInt(row.newPrice) || 0, unit: row.newUnit,
              description: "", synonyms: syn,
            }),
          }, token);
          if (r.ok) {
            const created = await r.json();
            if (row.bundleIds.length > 0 && created.id) {
              await apiFetch("prices", {
                method: "PUT",
                body: JSON.stringify({
                  id: created.id, name, category: row.newCategory || defaultCategory,
                  price: parseInt(row.newPrice) || 0, unit: row.newUnit,
                  description: "", synonyms: syn, active: true,
                  bundle: JSON.stringify(row.bundleIds), calc_rule: "",
                }),
              }, token, created.id);
            }
            savedNames.push(name);
          }
        } else if (!row.createMode && row.selectedId) {
          const price = prices.find(p => p.id === row.selectedId) as (PriceItem & { bundle?: string; calc_rule?: string }) | undefined;
          if (!price) continue;
          const updatedSynonyms = addSynonym(price.synonyms, row.edited);
          const bundleJson = JSON.stringify(row.bundleIds);
          await apiFetch("prices", {
            method: "PUT",
            body: JSON.stringify({ ...price, synonyms: updatedSynonyms, bundle: bundleJson }),
          }, token, price.id);
          savedNames.push(price.name);
        }
      }
    }
    setSaving(false);
    if (savedNames.length > 0) { setDone(true); onAdded(savedNames[0]); }
  };

  const filtered = prices.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const groupFiltered = prices.filter(p =>
    p.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const saveGroup = async () => {
    if (!groupSelectedId) return;
    const price = prices.find(p => p.id === groupSelectedId) as (PriceItem & { bundle?: string; calc_rule?: string }) | undefined;
    if (!price) return;
    setSaving(true);
    let updatedSynonyms = price.synonyms || "";
    for (const w of words) {
      updatedSynonyms = addSynonym(updatedSynonyms, w);
    }
    const bundleJson = JSON.stringify(groupBundleIds);
    await apiFetch("prices", {
      method: "PUT",
      body: JSON.stringify({ ...price, synonyms: updatedSynonyms, bundle: bundleJson }),
    }, token, price.id);
    setSaving(false);
    setDone(true);
    onAdded(price.name);
  };

  const canSave = groupMode
    ? !!groupSelectedId
    : rows.some(r =>
        (r.mode === "found" && r.selectedId) ||
        (r.mode === "notfound-manual" && (r.createMode ? r.newName.trim() : r.selectedId))
      );

  const BundleSelector = ({
    selectedPriceId,
    bundleIds,
    bundleSearch,
    bundleOpen,
    onToggleOpen,
    onBundleSearchChange,
    onToggleItem,
    onRemoveItem,
    excludeId,
  }: {
    selectedPriceId: number | null;
    bundleIds: number[];
    bundleSearch: string;
    bundleOpen: boolean;
    onToggleOpen: () => void;
    onBundleSearchChange: (v: string) => void;
    onToggleItem: (id: number) => void;
    onRemoveItem: (id: number) => void;
    excludeId?: number | null;
  }) => {
    const bundleFiltered = prices.filter(p =>
      p.id !== excludeId &&
      p.id !== selectedPriceId &&
      (p.name.toLowerCase().includes(bundleSearch.toLowerCase()) ||
       p.category.toLowerCase().includes(bundleSearch.toLowerCase()))
    );
    const selectedBundleItems = prices.filter(p => bundleIds.includes(p.id));

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

        {selectedBundleItems.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {selectedBundleItems.map(p => (
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
              {bundleFiltered.slice(0, 30).map(p => (
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
  };

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
    <div className="bg-white/[0.02] border border-violet-500/20 rounded-xl p-4 flex flex-col gap-2 mt-3">

      {words.length > 1 && (
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 mb-1">
          <button onClick={() => setGroupMode(false)}
            className={`flex-1 text-xs py-1.5 rounded-md transition ${!groupMode ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
            Каждому слову — своя позиция
          </button>
          <button onClick={() => setGroupMode(true)}
            className={`flex-1 text-xs py-1.5 rounded-md transition ${groupMode ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
            Все слова → одна позиция
          </button>
        </div>
      )}

      {/* Групповой режим */}
      {groupMode && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {words.map(w => (
              <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-300">«{w}»</span>
            ))}
            <span className="text-xs text-white/30 self-center">→ одна позиция</span>
          </div>
          <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
            placeholder="Поиск позиции..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
          <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
            {groupFiltered.slice(0, 40).map(p => (
              <button key={p.id} onClick={() => setGroupSelectedId(p.id)}
                className={`text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                  groupSelectedId === p.id
                    ? "bg-violet-600/30 border border-violet-500/40 text-white"
                    : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white"
                }`}>
                <span>{p.name}</span>
                <span className="text-white/30 flex-shrink-0">{p.category}</span>
              </button>
            ))}
          </div>

          {groupSelectedId && (
            <BundleSelector
              selectedPriceId={groupSelectedId}
              bundleIds={groupBundleIds}
              bundleSearch={groupBundleSearch}
              bundleOpen={groupBundleOpen}
              onToggleOpen={() => setGroupBundleOpen(v => !v)}
              onBundleSearchChange={setGroupBundleSearch}
              onToggleItem={id => setGroupBundleIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )}
              onRemoveItem={id => setGroupBundleIds(prev => prev.filter(x => x !== id))}
            />
          )}
        </div>
      )}

      {/* Индивидуальный режим */}
      {!groupMode && rows.map((row, i) => {
        const matchedPrice = row.selectedId ? prices.find(p => p.id === row.selectedId) : null;
        return (
          <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02]">
              {row.mode === "ai-loading"
                ? <Icon name="Loader" size={13} className="text-violet-400 animate-spin flex-shrink-0" />
                : row.mode === "found"
                ? <Icon name="CheckCircle" size={13} className="text-green-400 flex-shrink-0" />
                : <Icon name="AlertCircle" size={13} className="text-amber-400 flex-shrink-0" />
              }
              <span className="text-xs text-red-300 font-medium flex-shrink-0">«{row.word}»</span>
              <span className="text-white/20 text-xs flex-shrink-0">→</span>
              {row.mode === "ai-loading" && <span className="text-xs text-white/30">Подбираю...</span>}
              {row.mode === "found" && matchedPrice && (
                <span className="text-xs text-green-300 truncate">{matchedPrice.name}</span>
              )}
              {row.mode === "notfound-manual" && <span className="text-xs text-amber-300/70">Не найдено — укажи вручную</span>}
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                {row.mode !== "ai-loading" && (
                  <button onClick={() => matchOne(i, rows)} title="Перезапустить AI"
                    className="text-white/20 hover:text-violet-400 transition">
                    <Icon name="Sparkles" size={11} />
                  </button>
                )}
                <button onClick={() => updateRow(i, { manualOpen: !row.manualOpen })}
                  className="text-white/20 hover:text-white/50 transition">
                  <Icon name={row.manualOpen ? "ChevronUp" : "ChevronDown"} size={13} />
                </button>
              </div>
            </div>

            {/* Синоним + комплект — показываем если found */}
            {row.mode === "found" && matchedPrice && !row.manualOpen && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-1.5 mt-2 text-xs text-white/30">
                  <Icon name="Tag" size={11} className="text-violet-400" />
                  <span>Синоним <span className="text-violet-300 font-medium">«{row.edited}»</span> будет добавлен к позиции</span>
                </div>
                <BundleSelector
                  selectedPriceId={row.selectedId}
                  bundleIds={row.bundleIds}
                  bundleSearch={row.bundleSearch}
                  bundleOpen={row.bundleOpen}
                  onToggleOpen={() => updateRow(i, { bundleOpen: !row.bundleOpen })}
                  onBundleSearchChange={v => updateRow(i, { bundleSearch: v })}
                  onToggleItem={id => updateRow(i, {
                    bundleIds: row.bundleIds.includes(id)
                      ? row.bundleIds.filter(x => x !== id)
                      : [...row.bundleIds, id]
                  })}
                  onRemoveItem={id => updateRow(i, { bundleIds: row.bundleIds.filter(x => x !== id) })}
                />
              </div>
            )}

            {row.manualOpen && (
              <div className="p-3 flex flex-col gap-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <Icon name="Tag" size={11} className="text-violet-400 flex-shrink-0" />
                  <input value={row.edited} onChange={e => updateRow(i, { edited: e.target.value })}
                    className="flex-1 bg-white/5 border border-red-500/30 rounded-lg px-3 py-1.5 text-red-300 text-xs font-medium outline-none focus:border-violet-500 transition"
                    placeholder="Синоним" />
                </div>
                <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                  <button onClick={() => updateRow(i, { createMode: false })}
                    className={`flex-1 text-xs py-1 rounded-md transition ${!row.createMode ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
                    Выбрать из прайса
                  </button>
                  <button onClick={() => updateRow(i, { createMode: true })}
                    className={`flex-1 text-xs py-1 rounded-md transition ${row.createMode ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
                    Создать позицию
                  </button>
                </div>
                {!row.createMode ? (
                  <>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск позиции..."
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
                      {filtered.slice(0, 40).map(p => (
                        <button key={p.id} onClick={() => {
                          const existingBundle = parseBundle(p as PriceItem & { bundle?: string });
                          updateRow(i, { selectedId: p.id, mode: "found", bundleIds: existingBundle });
                        }}
                          className={`text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                            row.selectedId === p.id ? "bg-violet-600/30 border border-violet-500/40 text-white" : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white"
                          }`}>
                          <span>{p.name}</span>
                          <span className="text-white/30 flex-shrink-0">{p.category}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <input value={row.newName} onChange={e => updateRow(i, { newName: e.target.value })} placeholder="Название позиции"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
                    <div className="flex gap-1.5">
                      <input value={row.newPrice} onChange={e => updateRow(i, { newPrice: e.target.value })} placeholder="Цена ₽" type="number"
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

                {(row.selectedId || row.createMode) && (
                  <BundleSelector
                    selectedPriceId={row.selectedId}
                    bundleIds={row.bundleIds}
                    bundleSearch={row.bundleSearch}
                    bundleOpen={row.bundleOpen}
                    onToggleOpen={() => updateRow(i, { bundleOpen: !row.bundleOpen })}
                    onBundleSearchChange={v => updateRow(i, { bundleSearch: v })}
                    onToggleItem={id => updateRow(i, {
                      bundleIds: row.bundleIds.includes(id)
                        ? row.bundleIds.filter(x => x !== id)
                        : [...row.bundleIds, id]
                    })}
                    onRemoveItem={id => updateRow(i, { bundleIds: row.bundleIds.filter(x => x !== id) })}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-2 mt-1">
        {!groupMode && (
          <button onClick={rematchAll} disabled={saving}
            className="bg-white/5 hover:bg-white/10 text-white/40 text-xs py-2 px-3 rounded-lg transition flex items-center gap-1.5">
            <Icon name="RefreshCw" size={12} /> Перезапустить AI
          </button>
        )}
        <button onClick={groupMode ? saveGroup : saveAll} disabled={!canSave || saving}
          className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
          {saving
            ? <><Icon name="Loader" size={14} className="animate-spin" /> Сохраняю...</>
            : <><Icon name="BookMarked" size={14} /> Сохранить</>
          }
        </button>
      </div>
    </div>
  );
}
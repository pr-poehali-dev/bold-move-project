import { useState } from "react";
import Icon from "@/components/ui/icon";
import BundleSelector from "./BundleSelector";
import { useWordMatching } from "./useWordMatching";
import { addSynonym, parseBundle } from "./utils";
import { PRICE_UNITS } from "./constants";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

interface Props {
  words: string[];
  prices: PriceItem[];
  token: string;
  onAdded: (priceName: string) => void;
  onRemoveWord?: (word: string) => void;
}

export default function AddSynonymPanel({ words, prices, token, onAdded, onRemoveWord }: Props) {
  const { rows, updateRow, matchOne, rematchAll, saveAll, categories, defaultCategory } = useWordMatching(words, prices, token);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [groupMode, setGroupMode] = useState(words.length > 1);
  const [groupSelectedId, setGroupSelectedId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupBundleIds, setGroupBundleIds] = useState<number[]>([]);
  const [groupBundleSearch, setGroupBundleSearch] = useState("");
  const [groupBundleOpen, setGroupBundleOpen] = useState(false);

  const filtered = prices.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );
  const groupFiltered = prices.filter(p =>
    p.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const canSave = groupMode
    ? !!groupSelectedId
    : rows.some(r =>
        (r.mode === "found" && !r.createMode && r.selectedId) ||
        (r.mode === "found" && r.createMode && r.newName.trim()) ||
        (r.mode === "notfound-manual" && (r.createMode ? r.newName.trim() : r.selectedId))
      );

  const handleSaveAll = () => saveAll(
    name => { setDone(true); onAdded(name); },
    setSaving
  );

  const handleSaveGroup = async () => {
    if (!groupSelectedId) return;
    const price = prices.find(p => p.id === groupSelectedId) as (PriceItem & { bundle?: string; calc_rule?: string }) | undefined;
    if (!price) return;
    setSaving(true);
    let updatedSynonyms = price.synonyms || "";
    for (const w of words) updatedSynonyms = addSynonym(updatedSynonyms, w);
    await apiFetch("prices", {
      method: "PUT",
      body: JSON.stringify({ ...price, synonyms: updatedSynonyms, bundle: JSON.stringify(groupBundleIds) }),
    }, token, price.id);
    setSaving(false);
    setDone(true);
    onAdded(price.name);
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

      {/* Бейджи выбранных слов + переключатель режима */}
      {words.length > 1 && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-0.5">
            {words.map(w => (
              <span key={w} className="flex items-center gap-1 text-xs pl-2 pr-1 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300">
                «{w}»
                {onRemoveWord && (
                  <button onClick={() => onRemoveWord(w)} className="text-violet-400/50 hover:text-violet-200 transition ml-0.5">
                    <Icon name="X" size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
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
        </>
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
          <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Поиск позиции..."
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
              prices={prices} selectedPriceId={groupSelectedId}
              bundleIds={groupBundleIds} bundleSearch={groupBundleSearch} bundleOpen={groupBundleOpen}
              onToggleOpen={() => setGroupBundleOpen(v => !v)}
              onBundleSearchChange={setGroupBundleSearch}
              onToggleItem={id => setGroupBundleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onRemoveItem={id => setGroupBundleIds(prev => prev.filter(x => x !== id))}
            />
          )}
        </div>
      )}

      {/* Индивидуальный режим — каждому слову своя строка */}
      {!groupMode && rows.length > 1 && (
        <p className="text-xs text-white/30 -mb-1">
          {rows.length} слова — каждому нужна своя позиция
        </p>
      )}
      {!groupMode && rows.map((row, i) => {
        const matchedPrice = row.selectedId ? prices.find(p => p.id === row.selectedId) : null;
        return (
          <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
            {/* Заголовок */}
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
              {row.mode === "found" && matchedPrice && <span className="text-xs text-green-300 truncate">{matchedPrice.name}</span>}
              {row.mode === "notfound-manual" && <span className="text-xs text-amber-300/70">Не найдено — укажи вручную</span>}
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                {row.mode !== "ai-loading" && (
                  <button onClick={() => matchOne(i, rows)} title="Перезапустить AI"
                    className="text-white/20 hover:text-violet-400 transition">
                    <Icon name="Sparkles" size={11} />
                  </button>
                )}
                {row.mode !== "ai-loading" && (
                  <button onClick={() => updateRow(i, { manualOpen: !row.manualOpen })}
                    className="text-white/20 hover:text-white/50 transition">
                    <Icon name={row.manualOpen ? "ChevronUp" : "ChevronDown"} size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Тело: found — показываем синоним + возможность сменить позицию или создать новую */}
            {row.manualOpen && row.mode === "found" && (
              <div className="p-3 flex flex-col gap-2 border-t border-white/5">
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
                    <div className="flex items-center gap-1.5 text-xs text-white/30">
                      <Icon name="Tag" size={11} className="text-violet-400" />
                      <span>Синоним <span className="text-violet-300 font-medium">«{row.edited}»</span> будет добавлен к позиции</span>
                    </div>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Сменить позицию..."
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
                      {[
                        ...filtered.filter(p => p.id === row.selectedId),
                        ...filtered.filter(p => p.id !== row.selectedId),
                      ].slice(0, 40).map(p => (
                        <button key={p.id} onClick={() => {
                          const existingBundle = parseBundle(p as PriceItem & { bundle?: string });
                          updateRow(i, { selectedId: p.id, bundleIds: existingBundle });
                        }}
                          className={`text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                            row.selectedId === p.id
                              ? "bg-violet-600/30 border border-violet-500/40 text-white"
                              : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white"
                          }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {row.selectedId === p.id && <Icon name="Check" size={10} className="text-violet-400 flex-shrink-0" />}
                            <span className="truncate">{p.name}</span>
                          </div>
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
                        {PRICE_UNITS.map(u => <option key={u} value={u} className="bg-[#0b0b11]">{u}</option>)}
                      </select>
                      <select value={row.newCategory} onChange={e => updateRow(i, { newCategory: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition">
                        {categories.map(c => <option key={c} value={c} className="bg-[#0b0b11]">{c}</option>)}
                        <option value="Дополнительно" className="bg-[#0b0b11]">Дополнительно</option>
                      </select>
                    </div>
                  </div>
                )}
                <BundleSelector
                  prices={prices} selectedPriceId={row.selectedId}
                  bundleIds={row.bundleIds} bundleSearch={row.bundleSearch} bundleOpen={row.bundleOpen}
                  onToggleOpen={() => updateRow(i, { bundleOpen: !row.bundleOpen })}
                  onBundleSearchChange={v => updateRow(i, { bundleSearch: v })}
                  onToggleItem={id => updateRow(i, { bundleIds: row.bundleIds.includes(id) ? row.bundleIds.filter(x => x !== id) : [...row.bundleIds, id] })}
                  onRemoveItem={id => updateRow(i, { bundleIds: row.bundleIds.filter(x => x !== id) })}
                />
              </div>
            )}

            {/* Тело: not found */}
            {row.manualOpen && row.mode === "notfound-manual" && (
              <div className="p-3 flex flex-col gap-2 border-t border-white/5">
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
                    <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                      <Icon name="Tag" size={10} className="text-violet-400" />
                      <span>Синоним <span className="text-violet-300">«{row.word}»</span> будет добавлен к выбранной позиции</span>
                    </div>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск позиции..."
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-violet-500 transition" />
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
                      {[
                        ...filtered.filter(p => p.id === row.selectedId),
                        ...filtered.filter(p => p.id !== row.selectedId),
                      ].slice(0, 40).map(p => (
                        <button key={p.id} onClick={() => {
                          const existing = parseBundle(p as PriceItem & { bundle?: string });
                          updateRow(i, { selectedId: p.id, mode: "found", bundleIds: existing });
                        }}
                          className={`text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                            row.selectedId === p.id ? "bg-violet-600/30 border border-violet-500/40 text-white" : "bg-white/[0.02] border border-white/5 text-white/60 hover:text-white"
                          }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {row.selectedId === p.id && <Icon name="Check" size={10} className="text-violet-400 flex-shrink-0" />}
                            <span className="truncate">{p.name}</span>
                          </div>
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
                        {PRICE_UNITS.map(u => <option key={u} value={u} className="bg-[#0b0b11]">{u}</option>)}
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
                    prices={prices} selectedPriceId={row.selectedId}
                    bundleIds={row.bundleIds} bundleSearch={row.bundleSearch} bundleOpen={row.bundleOpen}
                    onToggleOpen={() => updateRow(i, { bundleOpen: !row.bundleOpen })}
                    onBundleSearchChange={v => updateRow(i, { bundleSearch: v })}
                    onToggleItem={id => updateRow(i, { bundleIds: row.bundleIds.includes(id) ? row.bundleIds.filter(x => x !== id) : [...row.bundleIds, id] })}
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
        <button onClick={groupMode ? handleSaveGroup : handleSaveAll} disabled={!canSave || saving}
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
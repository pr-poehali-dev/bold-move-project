import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { BotCorrection, PriceItem } from "./types";

interface Props { token: string; }

interface SkipInfo {
  reason: "complex_keyword" | "no_area" | "unknown";
  unknown_word: string | null;
  unknown_words: string[];
}

interface RecognizedData {
  area?: number;
  canvas?: string;
  perim?: number;
  n_lyustra?: number;
  n_svetilnik?: number;
  has_nisha?: boolean;
  nisha_label?: string | null;
  nisha_len?: number | null;
  profile_len?: number;
  standard_total?: number;
  reason?: string;
  unknown_word?: string | null;
  unknown_words?: string[];
}

const RECOGNIZED_LABELS: { key: string; label: string; unit: string; icon: string }[] = [
  { key: "area",           label: "Площадь",           unit: "м²", icon: "Square" },
  { key: "canvas",         label: "Полотно",            unit: "",   icon: "Layers" },
  { key: "perim",          label: "Периметр",           unit: "мп", icon: "Maximize" },
  { key: "profile_len",    label: "Профиль",            unit: "мп", icon: "Minus" },
  { key: "n_lyustra",      label: "Люстры",             unit: "шт", icon: "Lightbulb" },
  { key: "n_svetilnik",    label: "Светильники GX-53",  unit: "шт", icon: "Zap" },
  { key: "has_nisha",      label: "Ниша для штор",      unit: "",   icon: "PanelRight" },
  { key: "nisha_label",    label: "Тип ниши",           unit: "",   icon: "Tag" },
  { key: "nisha_len",      label: "Длина ниши",         unit: "мп", icon: "Ruler" },
  { key: "standard_total", label: "Итого Standard",     unit: "₽",  icon: "Banknote" },
];

function HighlightedText({ text, pending, done }: { text: string; pending: string[]; done: string[] }) {
  const all = [...pending, ...done];
  if (!all.length) return <span className="text-white text-sm font-medium">«{text}»</span>;
  const pattern = new RegExp(`(${all.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const doneSet = new Set(done.map(w => w.toLowerCase()));
  const parts = text.split(pattern);
  return (
    <span className="text-white text-sm font-medium leading-relaxed">
      «{parts.map((part, i) =>
        pattern.test(part)
          ? doneSet.has(part.toLowerCase())
            ? <mark key={i} className="bg-green-500/20 text-green-300 rounded px-0.5 not-italic">{part}</mark>
            : <mark key={i} className="bg-red-500/30 text-red-300 rounded px-0.5 not-italic">{part}</mark>
          : part
      )}»
    </span>
  );
}

function AddSynonymPanel({ word, prices, token, onAdded }: {
  word: string; prices: PriceItem[]; token: string; onAdded: (priceName: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"select" | "create">("select");
  const [editedWord, setEditedWord] = useState(word);

  // Поля новой позиции
  const categories = [...new Set(prices.map(p => p.category))];
  const [newName, setNewName] = useState(word);
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
    const syn = editedWord.trim() || word;
    const existing = price.synonyms ? price.synonyms.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (!existing.includes(syn)) existing.push(syn);
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
    const syn = editedWord.trim() || word;
    const r = await apiFetch("prices", {
      method: "POST",
      body: JSON.stringify({
        name,
        category,
        price: parseInt(newPrice) || 0,
        unit: newUnit,
        description: "",
        synonyms: syn !== name ? syn : "",
      }),
    }, token);
    setSaving(false);
    if (r.ok) { setDone(true); onAdded(name); }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mt-3">
        <Icon name="CheckCircle" size={15} className="text-green-400" />
        <span className="text-green-300 text-sm">«{word}» добавлен — бот запомнил</span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-violet-500/20 rounded-xl p-4 flex flex-col gap-3 mt-3">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-white/40">Синоним для сохранения — отредактируй если нужно:</p>
        <input
          value={editedWord}
          onChange={e => setEditedWord(e.target.value)}
          className="bg-white/5 border border-red-500/30 rounded-lg px-3 py-2 text-red-300 text-sm font-medium outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Переключатель режима */}
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
            {saving ? "Сохраняю..." : `Добавить «${editedWord || word}» как синоним`}
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
                {["шт", "м²", "пог.м", "уп", "катушка"].map(u => <option key={u} value={u} className="bg-[#0b0b11]">{u}</option>)}
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

export default function TabCorrections({ token }: Props) {
  const [items, setItems] = useState<BotCorrection[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addingWord, setAddingWord] = useState<{ corrId: number; word: string } | null>(null);
  const [doneWords, setDoneWords] = useState<Record<number, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [cr, pr] = await Promise.all([apiFetch("corrections"), apiFetch("prices")]);
    if (cr.ok) { const d = await cr.json(); setItems(d.items); }
    if (pr.ok) { const d = await pr.json(); setPrices(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id: number, status: string) => {
    await apiFetch("corrections", { method: "PUT", body: JSON.stringify({ id, status }) }, token, id);
    setItems(prev => prev.map(c => c.id === id ? { ...c, status: status as BotCorrection["status"] } : c));
    setExpandedId(null);
    setAddingWord(null);
  };

  const remove = async (id: number) => {
    await apiFetch("corrections", { method: "DELETE", body: JSON.stringify({ id }) }, token, id);
    setItems(prev => prev.filter(c => c.id !== id));
  };

  const pending = items.filter(i => i.status === "pending");
  const reviewed = items.filter(i => i.status !== "pending");

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  const renderCard = (item: BotCorrection) => {
    const data = item.recognized_json as RecognizedData | null;
    const isExpanded = expandedId === item.id;
    const isLLM = !data || "reason" in (data ?? {});
    const skipInfo = isLLM ? (data as SkipInfo | null) : null;
    const allUnknownWords: string[] = skipInfo?.unknown_words?.length
      ? skipInfo.unknown_words
      : skipInfo?.unknown_word ? [skipInfo.unknown_word] : [];
    const unknownWords = allUnknownWords.filter(w => !(doneWords[item.id] ?? []).includes(w));

    return (
      <div key={item.id} className={`bg-white/[0.03] border rounded-xl overflow-hidden ${
        item.status === "pending" ? (isLLM ? "border-red-500/30" : "border-amber-500/30") :
        item.status === "approved" ? "border-green-500/20" : "border-white/10"
      }`}>
        {/* Заголовок */}
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                item.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                item.status === "approved" ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/40"
              }`}>
                {item.status === "pending" ? "Ожидает" : item.status === "approved" ? "Одобрено" : "Отклонено"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLLM ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                {isLLM ? "Передан в LLM" : "Авторасчёт"}
              </span>
              {skipInfo?.reason === "no_area" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">Нет площади</span>
              )}
              <span className="text-white/30 text-xs">{new Date(item.created_at).toLocaleString("ru")}</span>
            </div>

            {isLLM
              ? <HighlightedText text={item.user_text} pending={unknownWords} done={doneWords[item.id] ?? []} />
              : <p className="text-white text-sm font-medium">«{item.user_text}»</p>
            }

            {/* Кнопки нераспознанных слов */}
            {isLLM && unknownWords.length > 0 && item.status === "pending" && (
              <div className="flex flex-wrap gap-2 mt-3">
                {unknownWords.map(w => (
                  <div key={w} className="flex items-center gap-1">
                    <button
                      onClick={() => setAddingWord(
                        addingWord?.word === w && addingWord.corrId === item.id ? null : { corrId: item.id, word: w }
                      )}
                      className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${
                        addingWord?.word === w && addingWord.corrId === item.id
                          ? "bg-violet-600/30 border-violet-500/50 text-violet-300"
                          : "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                      }`}>
                      <Icon name="Tag" size={10} />
                      «{w}»
                    </button>
                    <button
                      onClick={() => {
                        const newDone = [...(doneWords[item.id] ?? []), w];
                        setDoneWords(prev => ({ ...prev, [item.id]: newDone }));
                        if (addingWord?.word === w && addingWord.corrId === item.id) setAddingWord(null);
                        const remaining = allUnknownWords.filter(x => !newDone.includes(x));
                        if (remaining.length === 0) update(item.id, "approved");
                      }}
                      title="Не учитывать это слово"
                      className="text-white/20 hover:text-white/50 transition flex-shrink-0">
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Панель назначения синонима */}
            {addingWord && addingWord.corrId === item.id && (
              <AddSynonymPanel
                word={addingWord.word}
                prices={prices}
                token={token}
                onAdded={async () => {
                  const word = addingWord!.word;
                  const newDone = [...(doneWords[item.id] ?? []), word];
                  setDoneWords(prev => ({ ...prev, [item.id]: newDone }));
                  setAddingWord(null);
                  const remaining = allUnknownWords.filter(w => !newDone.includes(w));
                  if (remaining.length === 0) await update(item.id, "approved");
                }}
              />
            )}
          </div>

          <div className="flex items-start gap-1 flex-shrink-0">
            <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="text-white/30 hover:text-white/60 transition mt-1">
              <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
            </button>
            <button onClick={() => remove(item.id)}
              className="text-white/20 hover:text-red-400 transition mt-1 ml-1">
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>

        {/* Детали LLM */}
        {isExpanded && isLLM && skipInfo && (
          <div className="border-t border-white/10 p-4 flex flex-col gap-2">
            {skipInfo.reason && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Icon name="AlertCircle" size={13} className="text-red-400 flex-shrink-0" />
                <span>Причина: <span className="text-white/70">{
                  skipInfo.reason === "complex_keyword" ? "Сложное ключевое слово"
                  : skipInfo.reason === "no_area" ? "Не указана площадь"
                  : "Неизвестная причина"
                }</span></span>
              </div>
            )}
            {allUnknownWords.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-white/50">
                <Icon name="Tag" size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Нераспознанные слова: <span className="text-amber-300">{allUnknownWords.join(", ")}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Детали авторасчёта */}
        {isExpanded && !isLLM && data && (
          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl overflow-hidden border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/10">
                    <th className="text-left text-white/30 font-normal px-4 py-2 text-xs">Позиция</th>
                    <th className="text-left text-white/30 font-normal px-4 py-2 text-xs">Значение</th>
                    <th className="text-center text-white/30 font-normal px-3 py-2 text-xs w-24">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {RECOGNIZED_LABELS.filter(l => {
                    const v = (data as Record<string, unknown>)[l.key];
                    return v !== null && v !== undefined && v !== false && v !== 0 && v !== "";
                  }).map((l, i) => {
                    const v = (data as Record<string, unknown>)[l.key];
                    const display = l.key === "has_nisha" ? "Да"
                      : l.key === "standard_total" ? `${Number(v).toLocaleString("ru")} ₽`
                      : `${v}${l.unit ? " " + l.unit : ""}`;
                    return (
                      <tr key={l.key} className={`border-b border-white/5 last:border-0 ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                        <td className="px-4 py-2.5 flex items-center gap-2">
                          <Icon name={l.icon} size={13} className="text-white/30 flex-shrink-0" />
                          <span className="text-white/60 text-xs">{l.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-white text-xs font-medium">{display}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
                            <Icon name="Check" size={10} /> OK
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Кнопки действий — только для авторасчёта */}
        {item.status === "pending" && !isLLM && (
          <div className="border-t border-white/10 px-4 py-3 flex gap-2">
            <button onClick={() => update(item.id, "approved")}
              className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
              <Icon name="Check" size={14} /> Принять
            </button>
            <button onClick={() => update(item.id, "rejected")}
              className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
              <Icon name="X" size={14} /> Пропустить
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <Icon name="GraduationCap" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-amber-300 font-medium">Обучение бота.</span>
          <span className="text-white/50 ml-1">Красным выделены слова которые бот не знает. Нажмите на слово → выберите позицию → бот запомнит синоним и в следующий раз распознает сам.</span>
        </div>
      </div>

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">Пока нет запросов</p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Ожидают проверки ({pending.length})</h3>
          {pending.map(renderCard)}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-white/30 text-xs font-semibold uppercase tracking-wider">Проверенные ({reviewed.length})</h3>
          {reviewed.map(renderCard)}
        </div>
      )}
    </div>
  );
}
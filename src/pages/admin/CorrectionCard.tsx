import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import HighlightedText from "./HighlightedText";
import AddSynonymPanel from "./AddSynonymPanel";
import SuggestedItemsPanel from "./SuggestedItemsPanel";
import { apiFetch } from "./api";
import EstimateTable, { isEstimate, parseEstimateBlocks, resolveItem } from "@/pages/EstimateTable";
import type { BotCorrection, PriceItem } from "./types";
import type { SkipInfo, RecognizedData } from "./corrections.types";
import { RECOGNIZED_LABELS } from "./corrections.types";
import func2url from "@/../backend/func2url.json";

const AI_EDIT_URL = (func2url as Record<string, string>)["ai-edit"];

interface Props {
  item: BotCorrection;
  prices: PriceItem[];
  token: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onUpdate: (status: string) => void;
  doneWords: string[];
  onDoneWordsChange: (words: string[]) => void;
  extraWords: string[];
  onExtraWordsChange: (words: string[]) => void;
}

export default function CorrectionCard({
  item, prices, token,
  isExpanded, onToggleExpand, onRemove, onUpdate,
  doneWords, onDoneWordsChange,
  extraWords, onExtraWordsChange,
}: Props) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagVal, setEditingTagVal] = useState("");
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [aiEditComments, setAiEditComments] = useState<Record<string, string>>({});
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditDone, setAiEditDone] = useState(false);

  const knownSynonyms = new Set(
    prices.flatMap(p => {
      const syns = p.synonyms ? p.synonyms.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      return [p.name.toLowerCase(), ...syns];
    })
  );
  const isKnown = (w: string) => {
    const wl = w.toLowerCase();
    return knownSynonyms.has(wl) || [...knownSynonyms].some(s => s === wl || s.includes(wl) || wl.includes(s));
  };

  const data = item.recognized_json as RecognizedData | null;
  const isLLM = !data || "reason" in (data ?? {});
  const skipInfo = isLLM ? (data as SkipInfo | null) : null;

  const baseUnknownWords: string[] = skipInfo?.unknown_words?.length
    ? skipInfo.unknown_words
    : skipInfo?.unknown_word ? [skipInfo.unknown_word] : [];

  const allUnknownWords: string[] = [
    ...baseUnknownWords.filter(w => !extraWords.some(e => e.includes(w) && e !== w)),
    ...extraWords,
  ];
  // Показываем все теги — done подсвечиваются зелёным, не убираются
  const unknownWords = allUnknownWords;

  const dragWord = useRef<string | null>(null);
  const [dragOverWord, setDragOverWord] = useState<string | null>(null);

  const handleMerge = (first: string, second: string) => {
    if (first === second) return;
    const merged = first + " " + second;
    const newExtras = [...extraWords.filter(e => e !== first && e !== second), merged];
    onExtraWordsChange(newExtras);
    const newDone = [...doneWords.filter(d => d !== first && d !== second), first, second];
    onDoneWordsChange(newDone);
    onMergeFirstChange(null);
    setSelectedWords([]);
    setPanelOpen(false);
  };

  const handleCheckbox = (w: string) => {
    const isSelected = selectedWords.includes(w);
    const next = isSelected ? selectedWords.filter(x => x !== w) : [...selectedWords, w];
    setSelectedWords(next);
    setPanelOpen(next.length > 0);
  };

  const handleTagOpen = (w: string) => {
    setSelectedWords([w]);
    setPanelOpen(true);
  };

  const handleIgnore = (w: string) => {
    const newDone = [...doneWords, w];
    onDoneWordsChange(newDone);
    setSelectedWords(prev => prev.filter(x => x !== w));
    if (mergeFirst?.word === w && mergeFirst.corrId === item.id) onMergeFirstChange(null);
    const remaining = allUnknownWords.filter(x => !newDone.includes(x));
    if (remaining.length === 0) onUpdate("approved");
  };

  const handleStopWord = async (w: string) => {
    await apiFetch("stop-words", { method: "POST", body: JSON.stringify({ word: w }) }, token);
    handleIgnore(w);
  };

  return (
    <>
    <div className={`bg-white/[0.03] border rounded-xl overflow-hidden ${
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
            ? <HighlightedText
                text={item.user_text}
                pending={unknownWords}
                done={[...doneWords, ...unknownWords.filter(w => isKnown(w))]}
                onAddSelection={item.status === "pending" ? (word) => {
                  if (!extraWords.includes(word) && !doneWords.includes(word) && !unknownWords.includes(word)) {
                    onExtraWordsChange([...extraWords, word]);
                  }
                } : undefined}
              />
            : <p className="text-white text-sm font-medium">«{item.user_text}»</p>
          }
          {item.status === "pending" && isLLM && (
            <p className="text-xs text-white/20 mt-1 select-none">Выдели текст мышкой чтобы добавить в обучение</p>
          )}



          {/* Теги нераспознанных слов */}
          {isLLM && unknownWords.length > 0 && item.status === "pending" && (
            <div className="flex flex-col gap-2 mt-3">
              {/* Строка подсказки + кнопки действий */}
              <div className="flex items-center gap-3 flex-wrap">
                {selectedWords.length > 0 && (
                  <div className="flex items-center gap-px border border-white/15 rounded-lg overflow-hidden">
                    <button
                      onClick={() => { selectedWords.forEach(w => handleIgnore(w)); setSelectedWords([]); setPanelOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-xs transition">
                      <Icon name="X" size={12} />
                      Удалить тег
                    </button>
                    <div className="w-px h-5 bg-white/10" />
                    <button
                      onClick={async () => { for (const w of selectedWords) await handleStopWord(w); setSelectedWords([]); setPanelOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/80 hover:text-red-300 text-xs transition">
                      <Icon name="Ban" size={12} />
                      Игнорировать
                    </button>
                  </div>
                )}
                <span className="text-xs text-white/30">
                  Нажми чтобы выбрать (можно несколько) · Перетащи на другой чтобы объединить
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
              {unknownWords.map(w => {
                const isSelected = selectedWords.includes(w);
                const isDone = doneWords.includes(w);
                const known = !isDone && isKnown(w);
                const isGreen = isDone || known;
                const isDragOver = dragOverWord === w;

                // Скрываем тег если явно удалён/проигнорирован (но не если просто known)
                if (isDone && !known) return null;

                if (editingTag === w) {
                  return (
                    <div key={w} className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editingTagVal}
                        onChange={e => setEditingTagVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const newVal = editingTagVal.trim();
                            if (newVal && newVal !== w) {
                              const newExtras = extraWords.includes(w)
                                ? extraWords.map(x => x === w ? newVal : x)
                                : [...extraWords.filter(x => x !== w), newVal];
                              onExtraWordsChange(newExtras);
                              setSelectedWords(prev => prev.map(x => x === w ? newVal : x));
                            }
                            setEditingTag(null);
                          }
                          if (e.key === "Escape") setEditingTag(null);
                        }}
                        onBlur={() => setEditingTag(null)}
                        className="text-xs px-2 py-0.5 rounded-full border border-violet-500/50 bg-violet-600/20 text-violet-200 outline-none w-32"
                      />
                      <button onClick={() => setEditingTag(null)} className="text-white/30 hover:text-white/60">
                        <Icon name="X" size={11} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={w}
                    className="inline-flex items-center gap-0.5"
                    draggable
                    onDragStart={() => { dragWord.current = w; }}
                    onDragEnter={() => setDragOverWord(w)}
                    onDragLeave={() => setDragOverWord(null)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      setDragOverWord(null);
                      if (dragWord.current && dragWord.current !== w) handleMerge(dragWord.current, w);
                      dragWord.current = null;
                    }}
                    onDragEnd={() => { dragWord.current = null; setDragOverWord(null); }}
                  >
                    {/* Чекбокс */}
                    <button
                      onClick={e => { e.stopPropagation(); handleCheckbox(w); }}
                      title="Выбрать тег"
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border transition flex-shrink-0 ${
                        isSelected
                          ? "bg-violet-600 border-violet-400"
                          : "border-white/20 hover:border-violet-400/60 bg-white/5"
                      }`}>
                      {isSelected && <Icon name="Check" size={9} className="text-white" />}
                    </button>

                    {/* Тег */}
                    <button
                      onClick={() => handleTagOpen(w)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 cursor-pointer ${
                        isDragOver
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 scale-105"
                          : isGreen
                          ? "bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20"
                          : "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                      }`}>
                      {isGreen ? <Icon name="Check" size={10} /> : <Icon name="Tag" size={10} />}
                      «{w}»
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Панель назначения синонима */}
          {panelOpen && selectedWords.length > 0 && (
            <AddSynonymPanel
              key={selectedWords.join(",")}
              words={selectedWords}
              prices={prices}
              token={token}
              onRemoveWord={w => {
                const next = selectedWords.filter(x => x !== w);
                setSelectedWords(next);
                if (next.length === 0) setPanelOpen(false);
              }}
              onAdded={async () => {
                const newDone = [...doneWords, ...selectedWords];
                onDoneWordsChange(newDone);
                setSelectedWords([]);
                setPanelOpen(false);
                const remaining = allUnknownWords.filter(w => !newDone.includes(w) && !isKnown(w));
                if (remaining.length === 0) await onUpdate("approved");
              }}
            />
          )}
        </div>

        <div className="flex items-start gap-1 flex-shrink-0">
          {isLLM && item.llm_answer && (
            <>
              <button
                onClick={() => setSplitViewOpen(v => !v)}
                title="Сравнить: ответ LLM vs что увидел клиент"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition mt-0.5 ${splitViewOpen ? "bg-violet-500/30 text-violet-200" : "bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 hover:text-violet-200"}`}>
                <Icon name="Columns2" size={12} />
                <span className="hidden sm:inline">Что увидел клиент</span>
              </button>
              <button
                onClick={() => { setAiEditOpen(true); setAiEditDone(false); setAiEditComments({}); }}
                title="Изменить смету через AI"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition mt-0.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200">
                <Icon name="Wand2" size={12} />
                <span className="hidden sm:inline">Изменить AI</span>
              </button>
            </>
          )}
          {!isLLM && (
            <button onClick={onToggleExpand}
              className="text-white/30 hover:text-white/60 transition mt-1">
              <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
            </button>
          )}
          <button onClick={onRemove}
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

      {/* Предложения LLM — новые позиции для прайса */}
      {item.status === "pending" && item.suggested_items && item.suggested_items.length > 0 && (
        <SuggestedItemsPanel
          correctionId={item.id}
          items={item.suggested_items}
          prices={prices}
          token={token}
          onDone={() => onUpdate("approved")}
        />
      )}

      {/* Кнопки действий — только для авторасчёта */}
      {item.status === "pending" && !isLLM && (
        <div className="border-t border-white/10 px-4 py-3 flex gap-2">
          <button onClick={() => onUpdate("approved")}
            className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
            <Icon name="Check" size={14} /> Принять
          </button>
          <button onClick={() => onUpdate("rejected")}
            className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
            <Icon name="X" size={14} /> Пропустить
          </button>
        </div>
      )}
    </div>

    {/* Модалка «Изменить AI» */}
    {aiEditOpen && item.llm_answer && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="flex flex-col w-full max-w-[960px] max-h-[92vh] rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden shadow-2xl">

          {/* Шапка */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Icon name="Wand2" size={14} className="text-amber-400" />
              <span className="text-white/80 text-sm font-medium">Изменить смету через AI</span>
              <span className="text-white/30 text-xs ml-1">— напиши правку рядом с позицией</span>
            </div>
            <button onClick={() => setAiEditOpen(false)} className="text-white/30 hover:text-white/60 transition">
              <Icon name="X" size={16} />
            </button>
          </div>

          {aiEditDone ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Icon name="CheckCircle" size={44} className="text-green-400" />
              <p className="text-green-300 text-sm font-medium">Смета обновлена!</p>
              <button onClick={() => setAiEditOpen(false)}
                className="mt-2 px-5 py-2 bg-white/10 hover:bg-white/15 text-white/70 text-sm rounded-lg transition">
                Закрыть
              </button>
            </div>
          ) : (
            <>
              {/* Тело — таблица сметы */}
              <div className="flex-1 overflow-auto">
                {(() => {
                  const parsed = parseEstimateBlocks(item.llm_answer!);

                  if (parsed.blocks.length === 0) {
                    return (
                      <div className="p-5 flex flex-col gap-3">
                        <p className="text-white/30 text-xs">Позиции сметы не распознаны. Введи общий комментарий:</p>
                        <textarea
                          placeholder="Например: убрать профиль, добавить 2 светильника..."
                          value={aiEditComments['__general__'] || ''}
                          onChange={e => setAiEditComments(prev => ({ ...prev, '__general__': e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-xs resize-none outline-none focus:border-amber-500/40"
                          rows={4}
                        />
                      </div>
                    );
                  }

                  const findItem = (name: string) => {
                    const items = item.suggested_items ?? [];
                    const nl = name.toLowerCase();
                    return items.find(i => i.name.toLowerCase() === nl || i.name.toLowerCase().includes(nl) || nl.includes(i.name.toLowerCase()));
                  };

                  let numCounter = 0;

                  return (
                    <div className="flex flex-col">
                      <div className="rounded-xl border border-white/10 overflow-hidden mx-4 mt-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-white/[0.06] border-b border-white/10">
                              <th className="text-left px-3 py-2 text-white/40 font-montserrat font-semibold text-[11px] uppercase tracking-wider">Позиция</th>
                              <th className="text-right px-3 py-2 text-white/40 font-montserrat font-semibold text-[11px] uppercase tracking-wider w-[120px]">Стоимость</th>
                              <th className="text-left px-3 py-2 text-orange-400/60 font-montserrat font-semibold text-[11px] uppercase tracking-wider w-[260px]">✏ Правка</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsed.blocks.map((block, bi) => {
                              if (block.numbered) numCounter++;
                              const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
                              if (/смета/i.test(label) && block.items.length === 0) return null;
                              return (
                                <>
                                  <tr key={`h-${bi}`} className={`${bi > 0 ? 'border-t border-white/15' : ''} bg-white/[0.02]`}>
                                    <td colSpan={3} className="px-3 pt-3 pb-2 font-montserrat font-bold text-orange-400 text-[13px]">
                                      {label}
                                    </td>
                                  </tr>
                                  {block.items.map((it, ii) => {
                                    const { cleanName, formula, total } = resolveItem(it, findItem);
                                    const hasComment = !!(aiEditComments[cleanName] || '').trim();
                                    return (
                                      <tr key={`r-${bi}-${ii}`} className={`group/row transition-colors ${hasComment ? 'bg-orange-500/10' : 'hover:bg-white/[0.03]'} ${ii > 0 ? 'border-t border-white/5' : ''}`}>
                                        {/* Позиция + формула в одну строку */}
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <span className="text-white/80 text-xs">{cleanName}</span>
                                          {formula && <span className="text-white/30 text-[11px] font-montserrat ml-2">{formula}</span>}
                                        </td>
                                        {/* Стоимость — только итог */}
                                        <td className="px-3 py-2 text-right whitespace-nowrap w-[120px]">
                                          {total && <span className="text-orange-400 font-montserrat font-bold text-xs">{total}</span>}
                                        </td>
                                        {/* Правка — раскрывается при клике */}
                                        <td className="px-2 py-1.5 w-[260px]">
                                          {hasComment ? (
                                            <input
                                              autoFocus
                                              type="text"
                                              placeholder="правка..."
                                              value={aiEditComments[cleanName] || ''}
                                              onChange={e => setAiEditComments(prev => ({ ...prev, [cleanName]: e.target.value }))}
                                              className="w-full rounded-lg px-2.5 py-1 text-[11px] outline-none transition bg-orange-500/15 border border-orange-500/40 text-orange-200 placeholder:text-orange-400/30"
                                            />
                                          ) : (
                                            <button
                                              onClick={() => setAiEditComments(prev => ({ ...prev, [cleanName]: ' ' }))}
                                              className="w-full text-left px-2.5 py-1 text-[11px] text-white/15 hover:text-orange-400/60 transition rounded-lg hover:bg-white/5 group-hover/row:text-white/25"
                                            >
                                              правка...
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </>
                              );
                            })}
                          </tbody>
                        </table>

                        {parsed.totals.length > 0 && (
                          <div className="border-t border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-rose-500/10 px-3 py-3">
                            <div className="space-y-1">
                              {parsed.totals.map((t, i) => {
                                const isHeader = /итогов|итого\s*стоим/i.test(t) && !t.includes('Econom') && !t.includes('Standard') && !t.includes('Premium');
                                const isHighlight = /standard/i.test(t);
                                if (isHeader) return <div key={i} className="text-white/40 font-montserrat text-[10px] mb-0.5 text-right">{t.replace(/:$/, '')}</div>;
                                return (
                                  <div key={i} className={`flex justify-end text-xs ${isHighlight ? 'text-orange-400 font-montserrat font-black text-sm' : 'text-white/70'}`}>
                                    <span className="text-right mr-3">{t.split(':')[0]}:</span>
                                    <span className="font-montserrat font-bold">{t.split(':').slice(1).join(':').trim()}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Общая правка */}
                      <div className="px-4 pb-4 pt-3 border-t border-white/[0.07] mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="BookOpen" size={12} className="text-violet-400/60" />
                          <span className="text-white/40 text-xs">Общая правка</span>
                          <span className="text-violet-400/60 text-xs">— сохранится в инструкцию AI навсегда</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Например: добавить 3 светильника, площадь 25м², убрать закладные..."
                          value={aiEditComments['__general__'] || ''}
                          onChange={e => setAiEditComments(prev => ({ ...prev, '__general__': e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white/70 text-sm outline-none focus:border-orange-500/40 focus:bg-orange-500/5 transition placeholder:text-white/20"
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Футер */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/10 flex-shrink-0 bg-white/[0.02]">
                <span className="text-white/25 text-xs">
                  {Object.values(aiEditComments).filter(v => v.trim()).length > 0
                    ? `${Object.values(aiEditComments).filter(v => v.trim()).length} правок`
                    : 'Нет правок'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setAiEditOpen(false)}
                    className="px-4 py-2 text-white/40 hover:text-white/60 text-sm transition">
                    Отмена
                  </button>
                  <button
                    disabled={aiEditLoading || Object.values(aiEditComments).every(v => !v.trim())}
                    onClick={async () => {
                      setAiEditLoading(true);
                      try {
                        const r = await fetch(AI_EDIT_URL, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
                          body: JSON.stringify({
                            correction_id: item.id,
                            original_answer: item.llm_answer,
                            user_text: item.user_text,
                            comments: aiEditComments,
                          }),
                        });
                        if (r.ok) setAiEditDone(true);
                      } finally {
                        setAiEditLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-sm rounded-lg transition font-medium">
                    {aiEditLoading ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Wand2" size={14} />}
                    {aiEditLoading ? 'Обрабатывается...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    )}

    {/* Полноэкранный сплит-вью — через портал поверх всего */}
    {splitViewOpen && item.llm_answer && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
        <div className="flex flex-col w-full max-w-[1400px] h-full max-h-[90vh] rounded-2xl border border-white/10 bg-[#111] overflow-hidden shadow-2xl">
          {/* Шапка — запрос клиента полностью */}
          <div className="flex items-start gap-3 px-5 py-3 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Запрос клиента</p>
              <p className="text-white/80 text-sm leading-relaxed">«{item.user_text}»</p>
            </div>
            <button
              onClick={() => setSplitViewOpen(false)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs transition mt-1">
              <Icon name="X" size={13} /> Закрыть
            </button>
          </div>
          {/* Тело: два столбца */}
          <div className="flex flex-1 min-h-0">
            {/* Левая панель — сырой текст LLM */}
            <div className="flex flex-col w-1/2 border-r border-white/10 min-h-0">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-violet-500/5 flex-shrink-0">
                <Icon name="Sparkles" size={13} className="text-violet-400" />
                <span className="text-xs text-violet-400 font-medium">Что пришло с LLM</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-mono">{item.llm_answer}</pre>
              </div>
            </div>
            {/* Правая панель — рендер как у клиента */}
            <div className="flex flex-col w-1/2 min-h-0">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-amber-500/5 flex-shrink-0">
                <Icon name="Eye" size={13} className="text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Что отдали клиенту</span>
              </div>
              <div className="flex-1 overflow-auto">
                {isEstimate(item.llm_answer)
                  ? <EstimateTable
                      text={item.llm_answer}
                      items={item.suggested_items?.map(i => ({ name: i.name, qty: i.qty, price: i.price })) ?? undefined}
                    />
                  : <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed p-4">{item.llm_answer}</p>
                }
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
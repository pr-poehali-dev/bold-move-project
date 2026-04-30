import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import HighlightedText from "./HighlightedText";
import AddSynonymPanel from "./AddSynonymPanel";
import { apiFetch } from "./api";
import type { BotCorrection, PriceItem } from "./types";
import type { SkipInfo } from "./corrections.types";

interface Props {
  item: BotCorrection;
  prices: PriceItem[];
  token: string;
  readOnly?: boolean;
  isLLM: boolean;
  skipInfo: SkipInfo | null;
  unknownWords: string[];
  allUnknownWords: string[];
  doneWords: string[];
  onDoneWordsChange: (words: string[]) => void;
  extraWords: string[];
  onExtraWordsChange: (words: string[]) => void;
  isKnown: (w: string) => boolean;
  splitViewOpen: boolean;
  onSplitViewToggle: () => void;
  onAiEditOpen: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onUpdate: (status: string) => void;
}

export default function CorrectionCardHeader({
  item, prices, token,
  readOnly = false,
  isLLM, skipInfo, unknownWords, allUnknownWords,
  doneWords, onDoneWordsChange,
  extraWords, onExtraWordsChange,
  isKnown,
  splitViewOpen, onSplitViewToggle, onAiEditOpen,
  isExpanded, onToggleExpand, onRemove, onUpdate,
}: Props) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagVal, setEditingTagVal] = useState("");
  const [dragOverWord, setDragOverWord] = useState<string | null>(null);
  const dragWord = useRef<string | null>(null);

  const handleMerge = (first: string, second: string) => {
    if (first === second) return;
    const merged = first + " " + second;
    const newExtras = [...extraWords.filter(e => e !== first && e !== second), merged];
    onExtraWordsChange(newExtras);
    const newDone = [...doneWords.filter(d => d !== first && d !== second), first, second];
    onDoneWordsChange(newDone);
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
    const remaining = allUnknownWords.filter(x => !newDone.includes(x));
    if (remaining.length === 0) onUpdate("approved");
  };

  const handleStopWord = async (w: string) => {
    await apiFetch("stop-words", { method: "POST", body: JSON.stringify({ word: w }) }, token);
    handleIgnore(w);
  };



  return (
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
          <span className="text-white/30 text-xs">{new Date(item.created_at).toLocaleString("ru", { timeZone: "Europe/Moscow" })}</span>
        </div>

        {isLLM
          ? <HighlightedText
              text={item.user_text}
              pending={unknownWords}
              done={[...doneWords, ...unknownWords.filter(w => isKnown(w))]}
              onAddSelection={(word) => {
                if (!extraWords.includes(word) && !doneWords.includes(word) && !unknownWords.includes(word)) {
                  onExtraWordsChange([...extraWords, word]);
                }
              }}
            />
          : <p className="text-white text-sm font-medium">«{item.user_text}»</p>
        }
        {isLLM && (
          <p className="text-xs text-white/20 mt-1 select-none">Выдели текст мышкой чтобы добавить в обучение</p>
        )}

        {/* Теги нераспознанных слов */}
        {isLLM && unknownWords.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
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

      <div className="flex items-center gap-1 flex-shrink-0">
        {!readOnly && isLLM && item.llm_answer && (
          <button
            onClick={onAiEditOpen}
            title="Исправить ответ AI — обучить систему"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 hover:text-violet-200">
            <Icon name="GraduationCap" size={12} />
            <span className="hidden sm:inline">Обучить AI</span>
          </button>
        )}
        {!isLLM && (
          <button onClick={onToggleExpand} className="text-white/30 hover:text-white/60 transition">
            <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
          </button>
        )}
        {isLLM && item.llm_answer && (
          <button
            onClick={onSplitViewToggle}
            title="Что увидел клиент"
            className={`flex items-center justify-center w-6 h-6 rounded transition ${splitViewOpen ? "text-violet-300" : "text-white/25 hover:text-white/60"}`}>
            <Icon name="Eye" size={14} />
          </button>
        )}
        {!readOnly && (
          <button onClick={onRemove} className="text-white/20 hover:text-red-400 transition">
            <Icon name="X" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
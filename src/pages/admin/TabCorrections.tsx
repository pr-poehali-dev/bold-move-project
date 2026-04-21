import { useState } from "react";
import Icon from "@/components/ui/icon";
import CorrectionCard from "./CorrectionCard";
import { useCorrectionsList } from "./useCorrectionsList";

interface Props { token: string; }

export default function TabCorrections({ token }: Props) {
  const {
    prices, loading,
    needsTraining, allGood,
    expandedId, setExpandedId,
    doneWords, extraWords,
    setItemDoneWords, setItemExtraWords,
    update, remove,
  } = useCorrectionsList(token);

  const [activeTab, setActiveTab] = useState<"needs" | "good">("needs");

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  const renderCard = (item: (typeof needsTraining)[0]) => (
    <CorrectionCard
      key={item.id}
      item={item}
      prices={prices}
      token={token}
      isExpanded={expandedId === item.id}
      onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
      onRemove={() => remove(item.id)}
      onUpdate={status => update(item.id, status)}
      doneWords={doneWords[item.id] ?? []}
      onDoneWordsChange={words => setItemDoneWords(item.id, words)}
      extraWords={extraWords[item.id] ?? []}
      onExtraWordsChange={words => setItemExtraWords(item.id, words)}
    />
  );

  const activeItems = activeTab === "needs" ? needsTraining : allGood;

  return (
    <div className="flex flex-col gap-4">

      {/* Подкладки */}
      <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("needs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
            activeTab === "needs"
              ? "bg-amber-500/20 text-amber-300"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <Icon name="AlertCircle" size={14} />
          Нужно обучить
          {needsTraining.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === "needs" ? "bg-amber-500/30 text-amber-200" : "bg-white/10 text-white/40"
            }`}>
              {needsTraining.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("good")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
            activeTab === "good"
              ? "bg-green-500/20 text-green-300"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <Icon name="CheckCircle" size={14} />
          Всё понятно LLM
          {allGood.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === "good" ? "bg-green-500/30 text-green-200" : "bg-white/10 text-white/40"
            }`}>
              {allGood.length}
            </span>
          )}
        </button>
      </div>

      {/* Подсказка */}
      {activeTab === "needs" && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Icon name="GraduationCap" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-amber-300 font-medium">Обучение бота.</span>
            <span className="text-white/50 ml-1">Красным выделены слова которые бот не знает. Нажмите на слово → выберите позицию → бот запомнит синоним и в следующий раз распознает сам.</span>
          </div>
        </div>
      )}

      {activeTab === "good" && (
        <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <Icon name="CheckCircle" size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-green-300 font-medium">LLM всё понял.</span>
            <span className="text-white/50 ml-1">Эти сметы рассчитаны корректно. Если заметишь ошибку — нажми «Обучить AI» рядом с нужной позицией.</span>
          </div>
        </div>
      )}

      {/* Список */}
      {activeItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          {activeTab === "needs" ? (
            <>
              <Icon name="GraduationCap" size={32} className="text-white/10" />
              <p className="text-white/30 text-sm">Нет запросов для обучения</p>
            </>
          ) : (
            <>
              <Icon name="CheckCircle" size={32} className="text-white/10" />
              <p className="text-white/30 text-sm">Нет обработанных запросов</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeItems.map(renderCard)}
        </div>
      )}
    </div>
  );
}
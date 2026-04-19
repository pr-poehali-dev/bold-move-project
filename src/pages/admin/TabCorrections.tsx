import Icon from "@/components/ui/icon";
import CorrectionCard from "./CorrectionCard";
import { useCorrectionsList } from "./useCorrectionsList";

interface Props { token: string; }

export default function TabCorrections({ token }: Props) {
  const {
    prices, loading,
    pending, reviewed,
    expandedId, setExpandedId,
    mergeFirst, setMergeFirst,
    doneWords, extraWords,
    setItemDoneWords, setItemExtraWords,
    update, remove,
  } = useCorrectionsList(token);

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  const renderCard = (item: (typeof pending)[0]) => (
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
      mergeFirst={mergeFirst}
      onMergeFirstChange={setMergeFirst}
    />
  );

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

import Icon from "@/components/ui/icon";
import SuggestedItemsPanel from "./SuggestedItemsPanel";
import type { BotCorrection, PriceItem } from "./types";
import type { SkipInfo, RecognizedData } from "./corrections.types";
import { RECOGNIZED_LABELS } from "./corrections.types";

interface Props {
  item: BotCorrection;
  prices: PriceItem[];
  token: string;
  isLLM: boolean;
  skipInfo: SkipInfo | null;
  data: RecognizedData | null;
  allUnknownWords: string[];
  isExpanded: boolean;
  onUpdate: (status: string) => void;
}

export default function CorrectionCardDetails({
  item, prices, token,
  isLLM, skipInfo, data, allUnknownWords,
  isExpanded, onUpdate,
}: Props) {
  return (
    <>
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
      {item.suggested_items && item.suggested_items.length > 0 && (
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
    </>
  );
}
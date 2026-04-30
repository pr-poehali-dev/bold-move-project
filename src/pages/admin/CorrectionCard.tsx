import { useState } from "react";
import CorrectionCardHeader from "./CorrectionCardHeader";
import CorrectionCardDetails from "./CorrectionCardDetails";
import AiEditModal from "./AiEditModal";
import SplitViewModal from "./SplitViewModal";
import type { BotCorrection, PriceItem } from "./types";
import type { SkipInfo, RecognizedData } from "./corrections.types";

interface Props {
  item: BotCorrection;
  prices: PriceItem[];
  token: string;
  readOnly?: boolean;
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
  readOnly = false,
  isExpanded, onToggleExpand, onRemove, onUpdate,
  doneWords, onDoneWordsChange,
  extraWords, onExtraWordsChange,
}: Props) {
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);

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
  const unknownWords = allUnknownWords;

  return (
    <>
      <div className={`bg-white/[0.03] border rounded-xl overflow-hidden ${
        item.status === "pending" ? (isLLM ? "border-red-500/30" : "border-amber-500/30") :
        item.status === "approved" ? "border-green-500/20" : "border-white/10"
      }`}>
        <CorrectionCardHeader
          item={item}
          prices={prices}
          token={token}
          readOnly={readOnly}
          isLLM={isLLM}
          skipInfo={skipInfo}
          unknownWords={unknownWords}
          allUnknownWords={allUnknownWords}
          doneWords={doneWords}
          onDoneWordsChange={onDoneWordsChange}
          extraWords={extraWords}
          onExtraWordsChange={onExtraWordsChange}
          isKnown={isKnown}
          splitViewOpen={splitViewOpen}
          onSplitViewToggle={() => setSplitViewOpen(v => !v)}
          onAiEditOpen={() => setAiEditOpen(true)}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />

        <CorrectionCardDetails
          item={item}
          prices={prices}
          token={token}
          isLLM={isLLM}
          skipInfo={skipInfo}
          data={data}
          allUnknownWords={allUnknownWords}
          isExpanded={isExpanded}
          onUpdate={onUpdate}
        />
      </div>

      {aiEditOpen && (
        <AiEditModal
          item={item}
          token={token}
          onClose={() => setAiEditOpen(false)}
        />
      )}

      {splitViewOpen && (
        <SplitViewModal
          item={item}
          onClose={() => setSplitViewOpen(false)}
        />
      )}
    </>
  );
}
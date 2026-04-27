import React from "react";
import Icon from "@/components/ui/icon";
import { resolveItem, ensureRub, type LLMItem } from "./estimateUtils";

interface Block {
  title: string;
  numbered: boolean;
  items: { name: string; value: string }[];
}

interface Props {
  blocks: Block[];
  totals: string[];
  finalPhrase: string;
  findItem: (name: string) => LLMItem | undefined;
}

export default function EstimateBody({ blocks, totals, finalPhrase, findItem }: Props) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="FileSpreadsheet" size={16} className="text-orange-400" />
        <span className="font-montserrat font-bold text-sm text-white">Смета на натяжные потолки</span>
      </div>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[0.06] border-b border-white/10">
              <th className="text-left px-3 py-2 text-white/40 font-montserrat font-semibold text-[11px] uppercase tracking-wider">Позиция</th>
              <th className="text-right px-3 py-2 text-white/40 font-montserrat font-semibold text-[11px] uppercase tracking-wider w-[160px]">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let numCounter = 0;
              return blocks.map((block, bi) => {
                if (block.numbered) numCounter++;
                const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
                return (
                  <React.Fragment key={`block-${bi}`}>
                    <tr className={`${bi > 0 ? "border-t border-white/15" : ""} bg-white/[0.02]`}>
                      <td colSpan={2} className="px-3 pt-3 pb-2 font-montserrat font-bold text-orange-400 text-[13px]">
                        {label}
                      </td>
                    </tr>
                    {block.items.map((item, ii) => {
                      const { cleanName, formula, total } = resolveItem(item, findItem);
                      return (
                        <tr key={`r-${bi}-${ii}`} className={`hover:bg-white/3 transition-colors ${ii > 0 ? "border-t border-white/5" : ""}`}>
                          <td className="px-3 py-2 text-white/80 text-xs leading-snug">{cleanName}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formula && <div className="text-white/40 text-[11px] font-montserrat leading-snug">{ensureRub(formula)}</div>}
                            {total && <div className="text-orange-400 font-montserrat font-bold text-xs leading-snug">{ensureRub(total)}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>

        {totals.length > 0 && (
          <div className="border-t border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-rose-500/10 px-3 py-3">
            <div className="space-y-1">
              {totals.map((t, i) => {
                const isHeader = /итогов|итого\s*стоим/i.test(t) && !t.includes("Econom") && !t.includes("Standard") && !t.includes("Premium");
                const isHighlight = /standard/i.test(t);
                if (isHeader) {
                  return (
                    <div key={i} className="text-white/40 font-montserrat text-[10px] mb-0.5 text-right">
                      {t.replace(/:$/, "")}
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex justify-end text-xs ${isHighlight ? "text-orange-400 font-montserrat font-black text-sm" : "text-white/70"}`}>
                    <span className="text-right mr-3">{t.split(":")[0]}:</span>
                    <span className="font-montserrat font-bold">{ensureRub(t.split(":").slice(1).join(":").trim())}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {finalPhrase && (
        <div className="mt-3 text-[11px] text-white/40 italic leading-relaxed">{finalPhrase}</div>
      )}
    </>
  );
}

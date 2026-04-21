import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import EstimateTable, { isEstimate } from "@/pages/EstimateTable";
import type { BotCorrection } from "./types";

interface Props {
  item: BotCorrection;
  onClose: () => void;
}

export default function SplitViewModal({ item, onClose }: Props) {
  if (!item.llm_answer) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div className="flex flex-col w-full max-w-[1400px] h-full max-h-[90vh] rounded-2xl border border-white/10 bg-[#111] overflow-hidden shadow-2xl">
        {/* Шапка — запрос клиента полностью */}
        <div className="flex items-start gap-3 px-5 py-3 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Запрос клиента</p>
            <p className="text-white/80 text-sm leading-relaxed">«{item.user_text}»</p>
          </div>
          <button
            onClick={onClose}
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
  );
}

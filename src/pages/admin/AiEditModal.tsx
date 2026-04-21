import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { parseEstimateBlocks, resolveItem } from "@/pages/EstimateTable";
import type { BotCorrection } from "./types";
import func2url from "@/../backend/func2url.json";

const AI_EDIT_URL = (func2url as Record<string, string>)["ai-edit"];

interface Props {
  item: BotCorrection;
  token: string;
  onClose: () => void;
}

export default function AiEditModal({ item, token, onClose }: Props) {
  const [aiEditComments, setAiEditComments] = useState<Record<string, string>>({});
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditDone, setAiEditDone] = useState(false);
  const [aiEditResult, setAiEditResult] = useState<{ saved: string[]; not_found: string[] } | null>(null);

  if (!item.llm_answer) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-[960px] max-h-[92vh] rounded-2xl border border-violet-500/20 bg-[#0f0f0f] overflow-hidden shadow-2xl">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Icon name="GraduationCap" size={15} className="text-violet-400" />
              <span className="text-white/80 text-sm font-medium">Исправить ответ AI</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-white/25 text-xs">Запрос: «{item.user_text.slice(0, 60)}{item.user_text.length > 60 ? '…' : ''}»</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Подсказка */}
        <div className="px-5 py-2.5 border-b border-white/[0.06] bg-violet-500/[0.04] flex items-start gap-2.5 flex-shrink-0">
          <Icon name="Lightbulb" size={13} className="text-violet-400/70 mt-0.5 flex-shrink-0" />
          <p className="text-white/40 text-xs leading-relaxed">
            Укажи что AI посчитал неверно — система запомнит это как пример и будет учитывать при похожих запросах в будущем.
            <span className="text-violet-400/60 ml-1">Это не меняет текущую смету, а обучает систему.</span>
          </p>
        </div>

        {aiEditDone ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-8">
            <div className="w-14 h-14 rounded-full bg-violet-500/15 flex items-center justify-center">
              <Icon name="GraduationCap" size={28} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-white/80 text-sm font-medium">AI запомнил исправления</p>
              <p className="text-white/30 text-xs mt-1">При похожих запросах система учтёт эти примеры</p>
            </div>
            {aiEditResult && (
              <div className="w-full max-w-sm flex flex-col gap-2 mt-1">
                {aiEditResult.saved.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                    <p className="text-green-400 text-xs font-medium mb-1.5">Сохранено в правилах расчёта:</p>
                    {aiEditResult.saved.map(n => (
                      <div key={n} className="flex items-center gap-2 text-xs text-green-300/70">
                        <Icon name="Check" size={11} />
                        {n}
                      </div>
                    ))}
                  </div>
                )}
                {aiEditResult.not_found.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                    <p className="text-amber-400 text-xs font-medium mb-1.5">Позиции не найдены в прайсе:</p>
                    {aiEditResult.not_found.map(n => (
                      <div key={n} className="flex items-center gap-2 text-xs text-amber-300/70">
                        <Icon name="AlertCircle" size={11} />
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose}
              className="mt-1 px-5 py-2 bg-white/10 hover:bg-white/15 text-white/70 text-sm rounded-lg transition">
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
                      <p className="text-white/30 text-xs">Позиции сметы не распознаны. Опиши что было неверно:</p>
                      <textarea
                        placeholder="Например: площадь должна быть 25м², не нужны закладные под светильники..."
                        value={aiEditComments['__general__'] || ''}
                        onChange={e => setAiEditComments(prev => ({ ...prev, '__general__': e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-xs resize-none outline-none focus:border-violet-500/40"
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
                            <th className="text-left px-3 py-2 text-violet-400/60 font-montserrat font-semibold text-[11px] uppercase tracking-wider w-[280px]">
                              <span className="flex items-center gap-1.5">
                                <Icon name="AlertCircle" size={11} />
                                Что было неверно?
                              </span>
                            </th>
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
                                  const hasComment = cleanName in aiEditComments;
                                  return (
                                    <tr key={`r-${bi}-${ii}`} className={`group/row transition-colors ${hasComment ? 'bg-violet-500/10' : 'hover:bg-white/[0.03]'} ${ii > 0 ? 'border-t border-white/5' : ''}`}>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span className="text-white/80 text-xs">{cleanName}</span>
                                        {formula && <span className="text-white/30 text-[11px] font-montserrat ml-2">{formula}</span>}
                                      </td>
                                      <td className="px-3 py-2 text-right whitespace-nowrap w-[120px]">
                                        {total && <span className="text-orange-400 font-montserrat font-bold text-xs">{total}</span>}
                                      </td>
                                      <td className="px-2 py-1.5 w-[280px]">
                                        {hasComment ? (
                                          <div className="flex items-center gap-1">
                                            <input
                                              autoFocus
                                              type="text"
                                              placeholder="что не так..."
                                              value={aiEditComments[cleanName] || ''}
                                              onChange={e => setAiEditComments(prev => ({ ...prev, [cleanName]: e.target.value }))}
                                              className="w-full rounded-lg px-2.5 py-1 text-[11px] outline-none transition bg-violet-500/15 border border-violet-500/40 text-violet-200 placeholder:text-violet-400/30"
                                            />
                                            <button
                                              onClick={() => setAiEditComments(prev => { const n = { ...prev }; delete n[cleanName]; return n; })}
                                              className="text-white/20 hover:text-white/50 transition flex-shrink-0 ml-1"
                                            >
                                              <Icon name="X" size={11} />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setAiEditComments(prev => ({ ...prev, [cleanName]: '' }))}
                                            className="w-full text-left px-2.5 py-1 text-[11px] text-white/15 hover:text-violet-400/60 transition rounded-lg hover:bg-white/5 group-hover/row:text-white/20"
                                          >
                                            указать ошибку...
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

                    {/* Общий комментарий */}
                    <div className="px-4 pb-4 pt-3 border-t border-white/[0.07] mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="MessageSquare" size={12} className="text-violet-400/60" />
                        <span className="text-white/40 text-xs">Общий комментарий</span>
                        <span className="text-violet-400/60 text-xs">— что в целом было неправильно в этом ответе</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Например: площадь посчитана неверно, не нужно было добавлять закладные..."
                        value={aiEditComments['__general__'] || ''}
                        onChange={e => setAiEditComments(prev => ({ ...prev, '__general__': e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white/70 text-sm outline-none focus:border-violet-500/40 focus:bg-violet-500/5 transition placeholder:text-white/20"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Футер */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/10 flex-shrink-0 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                {Object.values(aiEditComments).filter(v => v.trim()).length > 0 ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-violet-300/70 text-xs">
                      {Object.values(aiEditComments).filter(v => v.trim()).length} исправлений готово к сохранению
                    </span>
                  </>
                ) : (
                  <span className="text-white/20 text-xs">Нажми на позицию чтобы указать ошибку</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-white/40 hover:text-white/60 text-sm transition">
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
                          user_text: item.user_text,
                          comments: aiEditComments,
                        }),
                      });
                      if (r.ok) {
                        const data = await r.json();
                        setAiEditResult({ saved: data.saved || [], not_found: data.not_found || [] });
                        setAiEditDone(true);
                      }
                    } finally {
                      setAiEditLoading(false);
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-violet-300 text-sm rounded-lg transition font-medium">
                  {aiEditLoading ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="GraduationCap" size={14} />}
                  {aiEditLoading ? 'Сохраняю...' : 'Обучить AI'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

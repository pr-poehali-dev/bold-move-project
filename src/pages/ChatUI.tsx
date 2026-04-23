import { useRef, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import EstimateTable, { isEstimate } from "./EstimateTable";
import { Msg, Panel, NAV, AVATAR } from "./chatConfig";

// Парсит текст: разбивает на обычный текст и картинки ![alt](url)
function MsgContent({ text }: { text: string }) {
  const parts = text.split(/(!\[.*?\]\(.*?\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const img = part.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (img) {
          return <SearchImage key={i} src={img[2]} alt={img[1]} />;
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </>
  );
}

function SearchImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className="block w-full max-w-[220px] rounded-xl mt-2 cursor-pointer hover:opacity-90 transition-opacity object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {open && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={() => setOpen(false)}>
          <img src={src} alt={alt} className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

interface Props {
  messages: Msg[];
  input: string;
  typing: boolean;
  panel: Panel;
  onInput: (v: string) => void;
  onSend: (text: string) => void;
  onPreset: (text: string) => void;
  onPanel: (p: Panel) => void;
  onNewEstimate?: () => void;
}

export default function ChatUI({ messages, input, typing, panel, onInput, onSend, onPreset, onPanel, onNewEstimate }: Props) {
  const hasEstimate = messages.some((m) => m.role === "assistant" && isEstimate(m.text));
  const chatRef = useRef<HTMLDivElement>(null);
  const estimateRef = useRef<HTMLDivElement>(null);

  // id последней сметы в чате
  const lastEstimateId = messages.findLast?.((m) => m.role === "assistant" && isEstimate(m.text))?.id ?? null;
  const prevEstimateIdRef = useRef<string | null>(null);

  useEffect(() => {
    const estimateChanged = lastEstimateId !== prevEstimateIdRef.current;

    if (estimateChanged && lastEstimateId) {
      // Смета появилась/обновилась — ждём отрисовки и скроллим к ней
      prevEstimateIdRef.current = lastEstimateId;
      const timer = setTimeout(() => {
        estimateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => clearTimeout(timer);
    }

    // Сметы нет или она не изменилась — скроллим вниз как обычно
    if (!lastEstimateId && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative z-10">

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3 scroll-smooth">
        {messages.map((m, idx) => {
          const estimate = m.role === "assistant" && isEstimate(m.text);
          const showAvatar = m.role === "assistant" && !estimate;
          const isLast = idx === messages.length - 1;
          return (
            <div key={m.id} ref={estimate && m.id === lastEstimateId ? estimateRef : null} className={`flex items-end ${estimate ? "" : "gap-2.5"} ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "assistant" && !estimate && (
                showAvatar
                  ? <img src={AVATAR} alt="Женя" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-orange-500/20 shadow-lg shadow-orange-500/10" />
                  : <div className="w-8 shrink-0" />
              )}
              {m.role === "user" ? (
                <div className="group flex flex-col items-end gap-1 max-w-[75%] md:max-w-[60%]">
                  <div className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed bg-white/[0.08] border border-white/[0.08] text-white/90 rounded-br-md whitespace-pre-wrap w-full">
                    <MsgContent text={m.text} />
                  </div>
                  {!typing && isLast && (
                    <button
                      onClick={() => onSend(m.text)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white/30 hover:text-orange-400 hover:bg-orange-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
                    >
                      <Icon name="RotateCcw" size={10} />
                      повторить
                    </button>
                  )}
                </div>
              ) : (
                <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  estimate
                    ? "w-full bg-white/[0.03] border border-white/[0.06] rounded-bl-md"
                    : "max-w-[75%] md:max-w-[60%] bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.06] text-white/70 rounded-bl-md whitespace-pre-wrap"
                }`}>
                  {estimate ? <EstimateTable text={m.text} items={m.items} /> : <MsgContent text={m.text} />}
                </div>
              )}
            </div>
          );
        })}

        {/* Пресет — показываем только пока нет сообщений от пользователя */}
        {messages.length === 1 && !typing && (
          <div className="flex items-end gap-2.5">
            <div className="w-8 shrink-0" />
            <button
              onClick={() => onPreset("Потолок 12 кв.м., 1 люстра, 4 светильника и ниша для шторы ПК-14")}
              className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.04] border border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/[0.06] transition-all duration-200 active:scale-[0.97] text-left"
            >
              <span className="text-base shrink-0">⚡</span>
              <div>
                <div className="text-[11px] text-white/35 mb-0.5">Пример расчёта</div>
                <div className="text-[12px] text-orange-300/80 group-hover:text-orange-300 font-medium leading-snug transition-colors">
                  Потолок 12 м² · люстра · 4 светильника · ниша ПК-14
                </div>
              </div>
              <Icon name="ArrowRight" size={13} className="text-orange-500/40 group-hover:text-orange-400 shrink-0 ml-1 transition-colors" />
            </button>
          </div>
        )}

        {typing && (
          <div className="flex items-end gap-2.5">
            <img src={AVATAR} alt="Женя" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-orange-500/20" />
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <span className="typing-dot" style={{ background: "rgb(251 146 60)" }} />
              <span className="typing-dot" style={{ background: "rgb(251 146 60)", animationDelay: "0.15s" }} />
              <span className="typing-dot" style={{ background: "rgb(251 146 60)", animationDelay: "0.3s" }} />
              <span className="text-white/25 text-xs">Женя анализирует…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 md:px-8 pb-2 pt-2">
        <PromptInputBox
          value={input}
          onValueChange={onInput}
          onSubmit={(text) => onSend(text)}
          isLoading={typing}
          placeholder={hasEstimate ? "Что изменить в текущей смете?" : "Спросите Женю о потолках…"}
          hasEstimate={hasEstimate}
          onNewEstimate={onNewEstimate}
        />
      </div>

      {/* Nav — 4 кнопки */}
      <div className="shrink-0 px-4 md:px-8 pb-3 pt-1 flex items-center justify-center gap-1.5">
        {NAV.map((n) => {
          const isActive = panel === n.id;
          return (
            <button
              key={n.id}
              onClick={() => onPanel(isActive ? "none" : n.id)}
              aria-label={n.label}
              className={`flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-2xl ring-1 shadow-md transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-gradient-to-b from-orange-500/40 to-rose-600/40 ring-orange-500/50 text-orange-300"
                  : "bg-gradient-to-b from-neutral-800/60 to-neutral-900/70 ring-white/8 text-white/45 hover:text-white/75"
              }`}
            >
              <Icon name={n.icon} size={15} />
              <span className={`text-[9px] font-medium leading-none text-center ${isActive ? "text-orange-300" : "text-white/35"}`}>
                {n.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
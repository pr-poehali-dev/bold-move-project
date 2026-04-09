import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import EstimateTable, { isEstimate } from "./EstimateTable";
import { Msg, Panel, NAV, AVATAR } from "./chatConfig";

interface Props {
  messages: Msg[];
  input: string;
  typing: boolean;
  panel: Panel;
  onInput: (v: string) => void;
  onSend: (text: string) => void;
  onPanel: (p: Panel) => void;
}

export default function ChatUI({ messages, input, typing, panel, onInput, onSend, onPanel }: Props) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative z-10">

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3 scroll-smooth">
        {messages.map((m) => (
          <div key={m.id} className={`flex items-end gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <img src={AVATAR} alt="Женя" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-orange-500/20 shadow-lg shadow-orange-500/10" />
            )}
            <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
              m.role === "user"
                ? "max-w-[75%] md:max-w-[60%] bg-white/[0.08] border border-white/[0.08] text-white/90 rounded-br-md whitespace-pre-wrap"
                : isEstimate(m.text)
                  ? "max-w-[90%] md:max-w-[75%] w-full bg-white/[0.03] border border-white/[0.06] rounded-bl-md"
                  : "max-w-[75%] md:max-w-[60%] bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.06] text-white/70 rounded-bl-md whitespace-pre-wrap"
            }`}>
              {m.role === "assistant" && isEstimate(m.text) ? <EstimateTable text={m.text} /> : m.text}
            </div>
          </div>
        ))}

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
          onSubmit={() => onSend(input)}
          isLoading={typing}
          placeholder="Спросите Женю о потолках…"
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
import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Msg } from "./AiHubTypes";

interface Props {
  messages: Msg[];
  input: string;
  typing: boolean;
  onInput: (val: string) => void;
  onSend: (text: string) => void;
  onClear: () => void;
}

export default function AiHubChat({ messages, input, typing, onInput, onSend, onClear }: Props) {
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }, [input]);

  return (
    <div className="shrink-0 flex flex-col border-b border-white/8" style={{ height: "42%" }}>
      {/* Chat header */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-white/6 bg-[#0e0e1a]/60">
        <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
          <Icon name="Bot" size={14} className="text-violet-400" />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">AI-помощник MOSPOTOLKI</div>
          <div className="text-[10px] text-green-400">● Онлайн</div>
        </div>
        <button
          onClick={onClear}
          className="ml-auto text-white/20 hover:text-white/50 transition-colors p-1"
          title="Очистить чат"
        >
          <Icon name="RotateCcw" size={12} />
        </button>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scroll-smooth">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-sm"
                  : "bg-white/6 border border-white/8 text-white/80 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1">
              <span className="typing-dot" style={{ background: "rgb(167 139 250)" }} />
              <span className="typing-dot" style={{ background: "rgb(167 139 250)", animationDelay: "0.15s" }} />
              <span className="typing-dot" style={{ background: "rgb(167 139 250)", animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2.5 border-t border-white/6">
        <form
          onSubmit={(e) => { e.preventDefault(); onSend(input); }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(input); }
            }}
            placeholder="Написать сообщение…"
            rows={1}
            style={{ height: "40px", maxHeight: "100px", resize: "none" }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2 text-white text-xs outline-none transition-colors placeholder:text-white/25 overflow-y-auto"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-br from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 disabled:opacity-30 rounded-xl transition-all active:scale-95"
          >
            <Icon name="Send" size={14} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";
import EstimateTable, { isEstimate } from "./EstimateTable";
import useVoiceInput from "./useVoiceInput";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

const QUICK_QUESTIONS = [
  "Сколько стоит потолок в комнату 18 м²?",
  "Какой потолок лучше для ванной?",
  "Что входит в стоимость монтажа?",
  "Сделайте расчёт на 3 комнаты",
];

const AI_CHAT_URL = func2url["ai-chat"];
const FALLBACK_ANSWER = "Извините, сейчас помощник недоступен. Позвоните нам: +7 (977) 606-89-01 — посчитаем всё по телефону!";

interface Props {
  assistantRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function AiAssistant({ assistantRef }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "Привет! Я AI-помощник MOSPOTOLKI. Задайте вопрос о натяжных потолках — помогу с расчётом, подбором материала или сформирую коммерческое предложение.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, hasSpeech, toggleVoice } = useVoiceInput(setInput);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "44px";
    const newH = Math.min(el.scrollHeight, 120);
    el.style.height = newH + "px";
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now(), role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const allMessages = [...messages, userMsg];

    fetch(AI_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: allMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, text: m.text })),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const botMsg: Message = {
          id: Date.now() + 1,
          role: "assistant",
          text: data.answer || FALLBACK_ANSWER,
        };
        setMessages((prev) => [...prev, botMsg]);
      })
      .catch(() => {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", text: FALLBACK_ANSWER },
        ]);
      })
      .finally(() => setIsTyping(false));
  };

  return (
    <section id="ai-assistant" className="py-16 md:py-24">
      <div ref={assistantRef.ref} className="max-w-4xl mx-auto px-4">
        <div
          className={`mb-8 text-center transition-all duration-700 ${assistantRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
            <div className="w-8 h-px bg-violet-400" />
            AI-помощник
            <div className="w-8 h-px bg-violet-400" />
          </div>
          <h2 className="font-montserrat font-black text-3xl md:text-5xl mb-3">
            Спросите у AI<br />
            <span className="text-white/30">мгновенный расчёт и подбор</span>
          </h2>
          <p className="text-white/50 text-sm md:text-base max-w-xl mx-auto">
            Задайте вопрос — помощник рассчитает стоимость, подберёт тип потолка и сформирует предложение за секунды.
          </p>
        </div>

        <div
          className={`relative transition-all duration-700 delay-200 ${assistantRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/15 to-orange-500/15 rounded-3xl blur-xl" />
          <div className="relative rounded-3xl border border-white/10 bg-[#0c0c14]/95 backdrop-blur overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Icon name="Bot" size={20} className="text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0c0c14]" />
              </div>
              <div>
                <div className="font-montserrat font-bold text-sm">AI-помощник MOSPOTOLKI</div>
                <div className="flex items-center gap-1.5 text-green-400 text-xs">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Онлайн
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2.5 py-1 rounded-full font-montserrat font-semibold">
                  BETA
                </span>
              </div>
            </div>

            <div ref={chatRef} className="h-[340px] sm:h-[440px] md:h-[500px] overflow-y-auto px-4 md:px-6 py-5 space-y-4 scroll-smooth">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "max-w-[85%] bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-md"
                        : msg.role === "assistant" && isEstimate(msg.text)
                          ? "max-w-full w-full bg-white/4 border border-white/10 rounded-bl-md"
                          : "max-w-[85%] bg-white/6 border border-white/8 text-white/80 rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" && isEstimate(msg.text) ? (
                      <EstimateTable text={msg.text} />
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {messages.length === 1 && !isTyping && (
              <div className="px-4 md:px-6 pb-3">
                <div className="text-white/30 text-[11px] font-montserrat uppercase tracking-widest mb-2">Популярные вопросы</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-white/5 border border-white/10 text-white/60 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white hover:border-violet-500/30 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 py-4 border-t border-white/8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex items-end gap-3"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder={isListening ? "Говорите..." : "Напишите или надиктуйте..."}
                  rows={1}
                  style={{ height: "44px", overflowY: "hidden" }}
                  className={`flex-1 bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:bg-white/7 transition-all resize-none leading-relaxed ${isListening ? "border-red-500/50 bg-red-500/5" : "border-white/10 focus:border-violet-500/50"}`}
                />
                {hasSpeech && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${isListening ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/30" : "bg-white/8 border border-white/10 hover:bg-white/15 hover:border-violet-500/30"}`}
                  >
                    <Icon name={isListening ? "MicOff" : "Mic"} size={18} className="text-white" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="w-11 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-orange-500 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100 shadow-lg shadow-violet-500/20 shrink-0"
                >
                  <Icon name="SendHorizontal" size={18} className="text-white" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
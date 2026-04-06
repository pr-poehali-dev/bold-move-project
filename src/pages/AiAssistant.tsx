import { useState, useRef, useEffect, useMemo } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

function isEstimate(text: string) {
  return (
    (text.includes("Econom") || text.includes("Standard") || text.includes("Premium")) &&
    (text.includes("₽") || text.includes("руб"))
  );
}

function parseEstimateBlocks(text: string) {
  const lines = text.split("\n");
  const blocks: { title: string; items: { name: string; value: string }[] }[] = [];
  let current: { title: string; items: { name: string; value: string }[] } | null = null;
  const totals: string[] = [];
  let finalPhrase = "";
  let inTotals = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^(Econom|Standard|Premium)/i.test(line) || inTotals) {
      inTotals = true;
      if (/^(Econom|Standard|Premium)/i.test(line)) {
        totals.push(line);
      } else if (line.toLowerCase().includes("предварительный") || line.toLowerCase().includes("замер")) {
        finalPhrase = line;
        inTotals = false;
      } else {
        totals.push(line);
      }
      continue;
    }

    if (line.toLowerCase().includes("предварительный") || line.toLowerCase().includes("замер") || line.toLowerCase().includes("на какой день")) {
      finalPhrase += (finalPhrase ? " " : "") + line;
      continue;
    }

    if (/итого/i.test(line)) {
      inTotals = true;
      continue;
    }

    const headerMatch = line.match(/^(\d+)\.\s*(.+?):\s*$/);
    if (headerMatch) {
      if (current) blocks.push(current);
      current = { title: headerMatch[2], items: [] };
      continue;
    }

    const headerMatch2 = line.match(/^(\d+)\.\s*(.+?)$/);
    if (headerMatch2 && !line.includes("₽") && !line.includes("руб") && line.length < 50) {
      if (current) blocks.push(current);
      current = { title: headerMatch2[2].replace(/:$/, ""), items: [] };
      continue;
    }

    if (current) {
      const priceMatch = line.match(/^[-–—•·]?\s*(.+?)\s*[-–—]\s*([\d\s,.]+\s*₽.*)$/);
      if (priceMatch) {
        current.items.push({ name: priceMatch[1].trim(), value: priceMatch[2].trim() });
      } else {
        const eqMatch = line.match(/^[-–—•·]?\s*(.+?)\s*=\s*([\d\s,.]+\s*₽.*)$/);
        if (eqMatch) {
          current.items.push({ name: eqMatch[1].trim(), value: eqMatch[2].trim() });
        } else {
          const simplePrice = line.match(/^[-–—•·]?\s*(.+?)\s+([\d\s,.]+\s*₽.*)$/);
          if (simplePrice && simplePrice[2].includes("₽")) {
            current.items.push({ name: simplePrice[1].trim().replace(/[-–—:]+$/, "").trim(), value: simplePrice[2].trim() });
          } else {
            current.items.push({ name: line.replace(/^[-–—•·]\s*/, ""), value: "" });
          }
        }
      }
    } else {
      if (line.includes("₽")) {
        if (!current) current = { title: "Позиции", items: [] };
        current.items.push({ name: line, value: "" });
      }
    }
  }
  if (current) blocks.push(current);
  return { blocks, totals, finalPhrase };
}

function EstimateTable({ text }: { text: string }) {
  const { blocks, totals, finalPhrase } = useMemo(() => parseEstimateBlocks(text), [text]);

  if (blocks.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="FileSpreadsheet" size={16} className="text-orange-400" />
        <span className="font-montserrat font-bold text-sm text-white">Смета на натяжные потолки</span>
      </div>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/8">
              <th className="text-left px-3 py-2 text-white/50 font-montserrat font-semibold">Позиция</th>
              <th className="text-right px-3 py-2 text-white/50 font-montserrat font-semibold w-[110px]">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block, bi) => (
              <>
                <tr key={`h-${bi}`} className="bg-white/4">
                  <td colSpan={2} className="px-3 py-2 font-montserrat font-bold text-orange-400 text-xs">
                    {bi + 1}. {block.title}
                  </td>
                </tr>
                {block.items.map((item, ii) => (
                  <tr key={`r-${bi}-${ii}`} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-3 py-1.5 text-white/70">{item.name}</td>
                    <td className="px-3 py-1.5 text-right text-white/90 font-montserrat font-semibold whitespace-nowrap">{item.value}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>

        {totals.length > 0 && (
          <div className="border-t border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-rose-500/10 px-3 py-3">
            <div className="text-[11px] text-white/40 font-montserrat uppercase tracking-widest mb-2">Итого</div>
            <div className="space-y-1">
              {totals.map((t, i) => {
                const isStandard = /standard/i.test(t);
                return (
                  <div key={i} className={`flex justify-between text-xs ${isStandard ? "text-orange-400 font-montserrat font-black text-sm" : "text-white/70"}`}>
                    <span>{t.split(":")[0]}:</span>
                    <span className="font-montserrat font-bold">{t.split(":").slice(1).join(":").trim()}</span>
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
    </div>
  );
}

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
  const inputRef = useRef<HTMLInputElement>(null);

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
    <section id="ai-assistant" className="py-24">
      <div ref={assistantRef.ref} className="max-w-4xl mx-auto px-5">
        <div
          className={`mb-10 text-center transition-all duration-700 ${assistantRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
            <div className="w-8 h-px bg-violet-400" />
            AI-помощник
            <div className="w-8 h-px bg-violet-400" />
          </div>
          <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-3">
            Спросите у AI<br />
            <span className="text-white/30">мгновенный расчёт и подбор</span>
          </h2>
          <p className="text-white/50 text-base max-w-xl mx-auto">
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

            <div ref={chatRef} className="h-[500px] overflow-y-auto px-6 py-5 space-y-4 scroll-smooth">
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
              <div className="px-6 pb-3">
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
                className="flex items-center gap-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Напишите вопрос..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/7 transition-all"
                />
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
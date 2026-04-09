import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const LIVE_URL = func2url["live-chat"];

interface LiveMsg {
  id: number;
  role: "client" | "operator";
  text: string;
}

interface Props {
  onClose: () => void;
}

export default function LiveChat({ onClose }: Props) {
  const [step, setStep] = useState<"name" | "chat">("name");
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LiveMsg[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Авто-скролл
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Polling ответов оператора — ref вместо state чтобы не пересоздавать интервал
  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${LIVE_URL}?action=poll&session_id=${sessionId}&since_id=${lastIdRef.current}`);
      const data = await r.json();
      if (data.messages?.length) {
        lastIdRef.current = data.messages[data.messages.length - 1].id;
        setMessages((prev) => [...prev, ...data.messages.map((m: { id: number; text: string }) => ({
          id: m.id, role: "operator" as const, text: m.text,
        }))]);
      }
    } catch { /* silent */ }
  }, [sessionId]);

  useEffect(() => {
    if (step !== "chat") return;
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, poll]);

  const startChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    // Отправляем приветственное сообщение
    const greeting = `Здравствуйте, меня зовут ${name.trim()}. Хочу проконсультироваться.`;
    setSending(true);
    try {
      await fetch(`${LIVE_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, text: greeting, name: name.trim() }),
      });
      setMessages([{ id: Date.now(), role: "client", text: greeting }]);
      setStep("chat");
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    const tmpId = Date.now();
    setMessages((prev) => [...prev, { id: tmpId, role: "client", text }]);
    setSending(true);
    try {
      await fetch(`${LIVE_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, text, name: name.trim() }),
      });
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-orange-500/5 to-transparent">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/20 flex items-center justify-center">
            <Icon name="Headphones" size={16} className="text-orange-400" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0e0e15]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Чат с менеджером</div>
          <div className="text-[10px] text-green-400">● Онлайн · ответим за 5 минут</div>
        </div>
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
          <Icon name="X" size={16} />
        </button>
      </div>

      {step === "name" ? (
        /* Форма имени */
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xs space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">👋</div>
              <div className="text-white font-semibold text-sm">Как вас зовут?</div>
              <div className="text-white/40 text-xs mt-1">Менеджер ответит вам в Telegram</div>
            </div>
            <form onSubmit={startChat} className="space-y-3">
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя" autoFocus required
                className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all placeholder:text-white/20"
              />
              <button type="submit" disabled={!name.trim() || sending}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 disabled:opacity-30 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <Icon name="MessageCircle" size={15} />
                Начать чат
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* Сообщения */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {/* Системное сообщение */}
            <div className="flex justify-center">
              <span className="text-[10px] text-white/20 bg-white/[0.03] border border-white/[0.05] px-3 py-1 rounded-full">
                Сообщение отправлено менеджеру в Telegram
              </span>
            </div>

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "client" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "client"
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-sm"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/80 rounded-bl-sm"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {/* Ожидание ответа */}
            {messages.length > 0 && messages[messages.length - 1].role === "client" && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Icon name="Clock" size={12} className="text-white/25" />
                  <span className="text-white/25 text-xs">Менеджер печатает ответ…</span>
                </div>
              </div>
            )}
          </div>

          {/* Поле ввода */}
          <div className="shrink-0 px-4 py-3 border-t border-white/[0.05]">
            <form onSubmit={sendMsg} className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.07] focus-within:border-orange-500/30 rounded-2xl px-3 py-2 transition-all">
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(e); } }}
                placeholder="Написать менеджеру…"
                rows={1} style={{ resize: "none", height: 38 }}
                className="flex-1 bg-transparent text-white text-[13px] outline-none placeholder:text-white/20 py-1"
              />
              <button type="submit" disabled={!input.trim() || sending}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-rose-500 hover:brightness-110 disabled:opacity-20 rounded-xl transition-all active:scale-95">
                <Icon name="ArrowUp" size={16} className="text-white" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
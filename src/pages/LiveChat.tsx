import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const LIVE_URL = func2url["live-chat"];

// Генерация ID без crypto.randomUUID (совместимость)
function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface LiveMsg {
  role: "client" | "operator";
  text: string;
  ts: number;
}

export default function LiveChat({ onClose }: { onClose: () => void }) {
  const [step, setStep]   = useState<"name" | "chat">("name");
  const [name, setName]   = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs]   = useState<LiveMsg[]>([]);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  const sessionRef = useRef(makeId());
  const lastIdRef  = useRef(0);
  const chatRef    = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs]);

  // Запускаем polling когда перешли в чат
  useEffect(() => {
    if (step !== "chat") return;
    pollRef.current = setInterval(async () => {
      try {
        const url = `${LIVE_URL}?action=poll&session_id=${sessionRef.current}&since_id=${lastIdRef.current}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.messages?.length) {
          lastIdRef.current = data.messages[data.messages.length - 1].id;
          setMsgs(prev => [...prev, ...data.messages.map((m: {id: number; text: string}) => ({
            role: "operator" as const, text: m.text, ts: m.id,
          }))]);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [step]);

  async function doSend(text: string, isFirst = false) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${LIVE_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionRef.current, text, name }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsgs(prev => [...prev, { role: "client", text, ts: Date.now() }]);
        if (isFirst) setStep("chat");
      } else {
        setError("Ошибка отправки, попробуйте ещё раз");
      }
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    doSend(`Здравствуйте, меня зовут ${name.trim()}. Хочу проконсультироваться.`, true);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    doSend(text);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
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
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xs space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">👋</div>
              <div className="text-white font-semibold text-sm">Как вас зовут?</div>
              <div className="text-white/40 text-xs mt-1">Менеджер ответит в этом чате</div>
            </div>
            <form onSubmit={handleStart} className="space-y-3">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ваше имя" autoFocus required
                className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-orange-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all placeholder:text-white/20" />
              {error && <div className="text-red-400 text-xs text-center">{error}</div>}
              <button type="submit" disabled={!name.trim() || busy}
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                {busy ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="MessageCircle" size={15} />}
                {busy ? "Подключаем…" : "Начать чат"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            <div className="flex justify-center">
              <span className="text-[10px] text-white/20 bg-white/[0.03] border border-white/[0.05] px-3 py-1 rounded-full">
                ✓ Сообщение отправлено менеджеру
              </span>
            </div>
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "client" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "client"
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-br-sm"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/80 rounded-bl-sm"
                }`}>{m.text}</div>
              </div>
            ))}
            {msgs[msgs.length - 1]?.role === "client" && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Icon name="Clock" size={12} className="text-white/25" />
                  <span className="text-white/25 text-xs">Ожидаем ответа менеджера…</span>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-white/[0.05]">
            {error && <div className="text-red-400 text-xs mb-2 text-center">{error}</div>}
            <form onSubmit={handleSend}
              className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.07] focus-within:border-orange-500/30 rounded-2xl px-3 py-2 transition-all">
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Написать менеджеру…"
                className="flex-1 bg-transparent text-white text-[13px] outline-none placeholder:text-white/20 py-1.5"
              />
              <button type="submit" disabled={!input.trim() || busy}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-rose-500 hover:brightness-110 disabled:opacity-20 rounded-xl transition-all active:scale-95">
                {busy ? <Icon name="Loader2" size={14} className="text-white animate-spin" /> : <Icon name="ArrowUp" size={16} className="text-white" />}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const LIVE_URL = (func2url as Record<string, string>)["live-chat"];

interface Message {
  id: number;
  role: "client" | "operator";
  text: string;
  created_at: string;
}

interface Session {
  session_id: string;
  client_name: string;
  created_at: string;
  last_message_at: string;
  last_text: string;
  msg_count: number;
}

interface Props {
  token: string;
  isOperator: boolean;
  clientName?: string;
  clientSessionId?: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} д назад`;
}

// ─── Оператор: панель чатов ──────────────────────────────────────────────────
function OperatorView({ token }: { token: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    const r = await fetch(`${LIVE_URL}?action=op_sessions`, {
      headers: { "X-Admin-Token": token },
    });
    if (r.ok) {
      const d = await r.json();
      setSessions(d.sessions || []);
    }
  }, [token]);

  const loadHistory = useCallback(async (sid: string) => {
    setLoading(true);
    const r = await fetch(`${LIVE_URL}?action=history&session_id=${sid}`);
    if (r.ok) {
      const d = await r.json();
      setMessages(d.messages || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
    const t = setInterval(loadSessions, 15000);
    return () => clearInterval(t);
  }, [loadSessions]);

  useEffect(() => {
    if (selected) {
      loadHistory(selected);
      const t = setInterval(() => loadHistory(selected), 5000);
      return () => clearInterval(t);
    }
  }, [selected, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    await fetch(`${LIVE_URL}?action=op_reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ session_id: selected, text: reply.trim() }),
    });
    setReply("");
    setSending(false);
    loadHistory(selected);
  };

  const selectedSession = sessions.find(s => s.session_id === selected);

  return (
    <div className="flex gap-4 h-[620px]">
      {/* Список чатов */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-1 overflow-y-auto">
        <p className="text-white/30 text-xs px-1 mb-1">Обращения клиентов</p>
        {sessions.length === 0 && (
          <p className="text-white/20 text-sm text-center py-8">Пока нет обращений</p>
        )}
        {sessions.map(s => (
          <button
            key={s.session_id}
            onClick={() => setSelected(s.session_id)}
            className={`text-left p-3 rounded-xl border transition flex flex-col gap-1 ${
              selected === s.session_id
                ? "bg-violet-600/20 border-violet-500/40"
                : "bg-white/[0.03] border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium truncate">{s.client_name}</span>
              <span className="text-white/30 text-xs flex-shrink-0 ml-1">{s.last_message_at ? timeAgo(s.last_message_at) : ""}</span>
            </div>
            <span className="text-white/40 text-xs truncate">{s.last_text || "—"}</span>
            <span className="text-violet-400/60 text-xs">{s.msg_count} сообщ.</span>
          </button>
        ))}
      </div>

      {/* Чат */}
      <div className="flex-1 flex flex-col bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-sm">Выберите обращение слева</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Icon name="User" size={16} className="text-violet-400" />
              <span className="text-white font-medium text-sm">{selectedSession?.client_name}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {loading && <p className="text-white/30 text-xs text-center">Загрузка...</p>}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "operator" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "operator"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-white/10 text-white/90 rounded-tl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.role === "operator" ? "text-violet-200/60" : "text-white/30"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-white/10 p-3 flex gap-2">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder="Ответить клиенту... (Enter — отправить)"
                rows={2}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-violet-500 resize-none transition"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-4 rounded-xl transition flex-shrink-0">
                <Icon name="Send" size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Клиент: форма обращения ──────────────────────────────────────────────────
function ClientView({ clientName, clientSessionId }: { clientName: string; clientSessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(clientSessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const loadHistory = useCallback(async () => {
    const r = await fetch(`${LIVE_URL}?action=history&session_id=${sessionId}`);
    if (r.ok) {
      const d = await r.json();
      setMessages(d.messages || []);
      const last = d.messages?.at(-1);
      if (last) lastIdRef.current = last.id;
    }
  }, [sessionId]);

  const pollNew = useCallback(async () => {
    const r = await fetch(`${LIVE_URL}?action=poll&session_id=${sessionId}&since_id=${lastIdRef.current}`);
    if (r.ok) {
      const d = await r.json();
      if (d.messages?.length) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = d.messages.filter((m: Message) => !ids.has(m.id));
          if (newMsgs.length) lastIdRef.current = newMsgs.at(-1).id;
          return newMsgs.length ? [...prev, ...newMsgs] : prev;
        });
      }
    }
  }, [sessionId]);

  useEffect(() => {
    loadHistory();
    const t = setInterval(pollNew, 4000);
    return () => clearInterval(t);
  }, [loadHistory, pollNew]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const msg = text.trim();
    setText("");
    const r = await fetch(`${LIVE_URL}?action=request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, text: msg, name: clientName }),
    });
    if (r.ok) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "client",
        text: msg,
        created_at: new Date().toISOString(),
      }]);
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[540px]">
      <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 mb-4">
        <Icon name="MessageSquare" size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-violet-300 font-medium">Чат с разработчиком.</span>
          <span className="text-white/50 ml-1">Напишите что нужно изменить — Юра ответит и сделает.</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 bg-white/[0.02] border border-white/10 rounded-xl p-4 mb-3">
        {messages.length === 0 && (
          <p className="text-white/20 text-sm text-center py-8">Напишите ваш первый запрос</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "client" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "client"
                ? "bg-violet-600 text-white rounded-tr-sm"
                : "bg-white/10 text-white/90 rounded-tl-sm"
            }`}>
              {msg.role === "operator" && (
                <p className="text-violet-300 text-xs font-medium mb-1">Юра</p>
              )}
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.role === "client" ? "text-violet-200/60" : "text-white/30"}`}>
                {new Date(msg.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Напишите запрос... (Enter — отправить, Shift+Enter — перенос)"
          rows={3}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500 resize-none transition"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-5 rounded-xl transition flex-shrink-0 flex items-center gap-2">
          <Icon name="Send" size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TabRequests({ token, isOperator, clientName = "Клиент", clientSessionId = "" }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {isOperator ? (
        <OperatorView token={token} />
      ) : (
        <ClientView clientName={clientName} clientSessionId={clientSessionId} />
      )}
    </div>
  );
}

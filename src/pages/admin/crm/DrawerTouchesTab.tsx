import { useState, useEffect, useRef } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Touch {
  id: number;
  channel: string;
  direction: "in" | "out";
  external_id: string | null;
  text: string | null;
  audio_url: string | null;
  duration_sec: number | null;
  attachments: unknown;
  status: string;
  created_at: string;
}

interface TouchClient {
  id: number;
  phone: string | null;
  name: string | null;
  state_summary: string | null;
  next_action: string | null;
  interest: string | null;
  stage: string | null;
}

interface Props {
  phone: string;
  name?: string;
}

// Канал → иконка + подпись
const CHANNELS: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "Phone",          label: "Звонок",   color: "#22c55e" },
  telegram: { icon: "Send",           label: "Telegram", color: "#3b82f6" },
  max:      { icon: "MessageCircle",  label: "MAX",      color: "#a855f7" },
  avito:    { icon: "MessagesSquare", label: "Avito",    color: "#f97316" },
  whatsapp: { icon: "Phone",          label: "WhatsApp", color: "#25d366" },
  webchat:  { icon: "MessageSquareText", label: "Веб-чат", color: "#0ea5e9" },
};
const channelMeta = (c: string) => CHANNELS[c] || { icon: "MessageSquare", label: c, color: "#8b5cf6" };

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const fmtDuration = (sec: number | null) => {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function DrawerTouchesTab({ phone, name }: Props) {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<TouchClient | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState("");
  const [sendChannel, setSendChannel] = useState("telegram");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!phone) { setLoading(false); return; }
    setLoading(true);
    try {
      const extra: Record<string, string> = { phone };
      if (name) extra.name = name;
      const d = await crmFetch("touches", undefined, extra) as { client?: TouchClient; touches?: Touch[]; error?: string };
      if (d && !d.error) {
        setClient(d.client ?? null);
        setTouches(d.touches ?? []);
      }
    } catch { /* тихо */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "auto" }); }, [touches.length, loading]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !client || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const d = await crmFetch("send-message", {
        method: "POST",
        body: JSON.stringify({ client_id: client.id, channel: sendChannel, text }),
      }) as { touch_id?: number; created_at?: string; error?: string };
      if (d?.error) {
        setSendError(d.error);
      } else {
        setDraft("");
        // Оптимистично добавляем в ленту, не дожидаясь фонового опроса воркера
        setTouches(prev => [...prev, {
          id: d.touch_id ?? Date.now(),
          channel: sendChannel, direction: "out", external_id: null,
          text, audio_url: null, duration_sec: null, attachments: null,
          status: "pending", created_at: d.created_at ?? new Date().toISOString(),
        }]);
      }
    } catch {
      setSendError("Не удалось связаться с сервером");
    }
    setSending(false);
  };

  if (!phone) {
    return (
      <div className="px-3 sm:px-6 py-10 text-center text-sm flex flex-col items-center gap-2" style={{ color: t.textMute }}>
        <Icon name="PhoneOff" size={24} style={{ color: t.textMute }} />
        <div>У клиента не указан номер телефона.</div>
        <div className="text-xs max-w-xs">
          Лента касаний и звонок привязаны к номеру телефона. Если клиент пришёл из Avito или
          другого канала без номера — добавьте телефон на вкладке «Клиент», и здесь появится вся история.
        </div>
      </div>
    );
  }

  const interestMeta: Record<string, { label: string; color: string }> = {
    high:   { label: "Высокий интерес", color: "#22c55e" },
    medium: { label: "Средний интерес", color: "#eab308" },
    low:    { label: "Низкий интерес",  color: "#ef4444" },
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Шапка: номер телефона + звонок */}
      <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2"
        style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: t.textSub }}>
          <Icon name="Phone" size={12} style={{ color: t.textMute }} />
          {phone}
        </div>
        <a href={`tel:${phone}`}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.97]"
          style={{ background: "#22c55e22", color: "#22c55e" }}>
          <Icon name="PhoneCall" size={13} /> Позвонить
        </a>
      </div>

      {/* Мини-шапка состояния клиента (быстрый контекст) */}
      {client && (client.next_action || client.interest || client.stage) && (
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5" style={{ borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {client.interest && interestMeta[client.interest] && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: interestMeta[client.interest].color + "22", color: interestMeta[client.interest].color }}>
                {interestMeta[client.interest].label}
              </span>
            )}
            {client.stage && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: t.accent + "22", color: t.accentLight }}>
                {client.stage}
              </span>
            )}
          </div>
          {client.next_action && (
            <div className="text-[11px] flex items-start gap-1.5" style={{ color: t.textSub }}>
              <Icon name="Lightbulb" size={12} style={{ color: "#eab308", marginTop: 1 }} />
              <span><b style={{ color: t.text }}>Следующий шаг:</b> {client.next_action}</span>
            </div>
          )}
        </div>
      )}

      {/* Лента */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-6 py-4 flex flex-col gap-2.5">
        {loading ? (
          <div className="text-center text-sm py-8" style={{ color: t.textMute }}>Загрузка…</div>
        ) : touches.length === 0 ? (
          <div className="text-center text-sm py-8" style={{ color: t.textMute }}>
            Пока нет касаний. Здесь появятся звонки и сообщения из мессенджеров.
          </div>
        ) : (
          touches.map(tt => {
            const meta = channelMeta(tt.channel);
            const out = tt.direction === "out";
            const isCall = tt.channel === "call";
            return (
              <div key={tt.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2"
                  style={{
                    background: out ? t.accent + "22" : t.surface2,
                    border: `1px solid ${out ? t.accent + "40" : t.border}`,
                  }}>
                  {/* Заголовок: канал + время */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name={meta.icon} size={12} style={{ color: meta.color }} />
                    <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-[10px]" style={{ color: t.textMute }}>· {fmtTime(tt.created_at)}</span>
                  </div>

                  {/* Звонок */}
                  {isCall ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="PhoneCall" size={13} style={{ color: t.textSub }} />
                        <span className="text-xs font-medium" style={{ color: t.text }}>
                          Звонок {fmtDuration(tt.duration_sec)}
                        </span>
                        {tt.status === "transcribing" && (
                          <span className="text-[10px]" style={{ color: t.textMute }}>расшифровка…</span>
                        )}
                      </div>
                      {tt.audio_url && (
                        <audio controls src={tt.audio_url} className="w-full h-8 mb-1" style={{ maxWidth: 260 }} />
                      )}
                      {tt.text && (
                        <>
                          <div className="text-xs whitespace-pre-wrap" style={{ color: t.textSub }}>
                            {expanded[tt.id] ? tt.text : tt.text.slice(0, 120) + (tt.text.length > 120 ? "…" : "")}
                          </div>
                          {tt.text.length > 120 && (
                            <button onClick={() => setExpanded(e => ({ ...e, [tt.id]: !e[tt.id] }))}
                              className="text-[10px] mt-1 font-semibold" style={{ color: t.accentLight }}>
                              {expanded[tt.id] ? "Свернуть" : "Показать транскрипт"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs sm:text-sm whitespace-pre-wrap break-words" style={{ color: t.text }}>
                        {tt.text || <span style={{ color: t.textMute }}>(без текста)</span>}
                      </div>
                      {out && tt.status === "pending" && (
                        <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: t.textMute }}>
                          <Icon name="Clock" size={10} /> отправляется…
                        </div>
                      )}
                      {out && tt.status === "error" && (
                        <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "#ef4444" }}>
                          <Icon name="AlertTriangle" size={10} /> не удалось отправить
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div className="flex-shrink-0 px-3 sm:px-6 py-3 flex items-end gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
        <select value={sendChannel} onChange={e => setSendChannel(e.target.value)}
          className="text-xs rounded-lg px-2 py-2 focus:outline-none flex-shrink-0"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
          <option value="telegram">Telegram</option>
          <option value="max">MAX</option>
          <option value="avito">Avito</option>
        </select>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          rows={1} placeholder="Написать сообщение…"
          className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none resize-none"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, maxHeight: 120 }} />
        <button onClick={handleSend} disabled={!draft.trim() || sending}
          className="flex-shrink-0 rounded-lg px-3 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: t.accent, color: "#fff" }}>
          <Icon name={sending ? "Loader" : "Send"} size={16} className={sending ? "animate-spin" : ""} />
        </button>
      </div>
      {sendError && (
        <div className="px-3 sm:px-6 pb-2 text-[11px] flex items-center gap-1" style={{ color: "#ef4444" }}>
          <Icon name="AlertTriangle" size={11} /> {sendError}
        </div>
      )}
    </div>
  );
}
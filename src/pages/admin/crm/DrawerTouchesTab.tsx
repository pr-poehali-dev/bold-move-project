import { useState, useEffect, useRef } from "react";
import { crmFetch, uploadFile } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { useCallClient } from "./useCallClient";
import { useAutoTranscribe } from "./useAutoTranscribe";
import { fmtMoscowDateTime } from "./timeMoscow";

interface AttachmentItem {
  type: "image" | "file" | "voice";
  url: string;
  filename?: string;
  duration_sec?: number;
}

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
  /** Кто принял звонок: 'human' — ответил человек, 'voicemail' — включился
   * автоответчик/автоинформатор оператора, null — неизвестно (нет текста
   * расшифровки или звонок не состоялся). Вычисляется на бэкенде по тексту. */
  answered_by?: "human" | "voicemail" | null;
  /** id сообщения, на которое отвечаем (реплай), только для CRM-интерфейса */
  reply_to_id?: number | null;
}

// Достаёт вложения сообщения в типизированном виде. Формат приходит из
// разных каналов, поэтому проверяем аккуратно.
function attachmentsOf(attachments: unknown): AttachmentItem[] {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((a): a is AttachmentItem => !!a && typeof a === "object" && typeof (a as AttachmentItem).url === "string")
    .map(a => ({ ...a, type: (a.type as AttachmentItem["type"]) || "file" }));
}
function imagesOf(attachments: unknown): string[] {
  return attachmentsOf(attachments).filter(a => a.type === "image").map(a => a.url);
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
  /** id заявки (live_chats). Нужен для каналов без телефона (Avito): история грузится по нему. */
  contactId?: number;
  /** Увеличивать при каждом запросе «поставить курсор в поле ввода» (напр. переход с другой вкладки) */
  focusSignal?: number;
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

const fmtTime = (iso: string) => fmtMoscowDateTime(iso);

const fmtDuration = (sec: number | null) => {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Статус звонка → иконка/подпись/цвет. Пропущенный — красным (даже если карточка
// сама «исходящая» по направлению записи — статус missed важнее направления).
const MISSED_STATUSES = new Set(["missed", "no-answer", "noanswer", "busy", "declined"]);
const callMeta = (status: string, out: boolean): { icon: string; label: string; color: string } => {
  if (MISSED_STATUSES.has(status)) {
    return { icon: "PhoneMissed", label: "Пропущенный", color: "#ef4444" };
  }
  if (status === "initiated") {
    return { icon: "PhoneCall", label: "Звонок…", color: "#eab308" };
  }
  return out
    ? { icon: "PhoneOutgoing", label: "Исходящий", color: "#22c55e" }
    : { icon: "PhoneIncoming", label: "Входящий", color: "#3b82f6" };
};

export default function DrawerTouchesTab({ phone, name, contactId, focusSignal }: Props) {
  const t = useTheme();
  const { call: callViaUis, calling: callingUis } = useCallClient();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<TouchClient | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState("");
  // По умолчанию Avito, если у клиента нет телефона (пришёл из Avito), иначе Telegram
  const [sendChannel, setSendChannel] = useState(phone ? "telegram" : "avito");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [flashInput, setFlashInput] = useState(false);

  // Вложение к отправляемому сообщению (файл/картинка или голосовая запись) —
  // одно за раз, как в большинстве мессенджеров для быстрого ответа.
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentItem | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Запись голосового сообщения
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Сообщение, на которое отвечаем (реплай) — показываем цитату над полем ввода
  const [replyTo, setReplyTo] = useState<Touch | null>(null);

  // Каналы, доступные для отправки текстового сообщения (звонок сюда не входит)
  const TEXT_CHANNELS = new Set(["telegram", "max", "avito"]);

  const focusDraft = () => {
    // Переключаем канал отправки на последний, которым реально переписывались
    // с клиентом; если такого канала ещё не было — по умолчанию MAX.
    const lastTextTouch = [...touches].reverse().find(tt => TEXT_CHANNELS.has(tt.channel));
    setSendChannel(lastTextTouch ? lastTextTouch.channel : "max");

    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textareaRef.current?.focus();

    // Плавное мигание контура красным 3 раза, чтобы привлечь внимание к полю
    setFlashInput(false);
    requestAnimationFrame(() => setFlashInput(true));
    setTimeout(() => setFlashInput(false), 1900);
  };

  // Запрос фокуса извне (напр. клик по иконке «написать» рядом с телефоном на
  // другой вкладке) — увеличение focusSignal триггерит скролл + фокус сюда.
  useEffect(() => {
    if (focusSignal) focusDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  // silent=true — фоновое обновление (поллинг): не показываем спиннер загрузки,
  // чтобы лента не «мигала» каждые несколько секунд.
  const load = async (silent = false) => {
    // Грузим по id заявки (contact_id) — он в приоритете, чтобы не терять уже начатую
    // переписку (напр. Avito), если у заявки позже появился телефон. Телефон передаём
    // ТОЖЕ (если есть) — backend сам дозапишет его в найденную по заявке запись,
    // не создавая нового клиента и не обрывая историю касаний.
    if (!phone && !contactId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (contactId) extra.contact_id = String(contactId);
      if (phone) extra.phone = phone;
      if (name) extra.name = name;
      const d = await crmFetch("touches", undefined, extra) as { client?: TouchClient; touches?: Touch[]; error?: string };
      if (d && !d.error) {
        setClient(d.client ?? null);
        setTouches(d.touches ?? []);
      }
    } catch { /* тихо */ }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone, contactId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "auto" }); }, [touches.length, loading]);

  // Звонки без расшифровки (запись есть, текста ещё нет) — расшифровываем
  // по одному, пока лента открыта, и подтягиваем текст в неё же.
  useAutoTranscribe(touches, () => load(true));

  // Тихий поллинг ленты — подхватывает новые сообщения от клиента и статус
  // отправленных («отправляется» → «отправлено») без перезахода на страницу.
  useEffect(() => {
    if (!phone && !contactId) return;
    const timer = setInterval(() => { load(true); }, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, contactId]);

  const handleSend = async () => {
    const text = draft.trim();
    const attachments = pendingAttachment ? [pendingAttachment] : [];
    if (!text && !attachments.length) return;
    if (!client || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const d = await crmFetch("send-message", {
        method: "POST",
        body: JSON.stringify({
          client_id: client.id, channel: sendChannel, text, attachments,
          reply_to_id: replyTo?.id ?? null,
        }),
      }) as { touch_id?: number; created_at?: string; error?: string };
      if (d?.error) {
        setSendError(d.error);
      } else {
        setDraft("");
        setPendingAttachment(null);
        const sentReplyTo = replyTo?.id ?? null;
        setReplyTo(null);
        // Оптимистично добавляем в ленту, не дожидаясь фонового опроса воркера
        setTouches(prev => [...prev, {
          id: d.touch_id ?? Date.now(),
          channel: sendChannel, direction: "out", external_id: null,
          text, audio_url: null, duration_sec: null,
          attachments: attachments.length ? attachments : null,
          status: "pending", created_at: d.created_at ?? new Date().toISOString(),
          reply_to_id: sentReplyTo,
        }]);
      }
    } catch {
      setSendError("Не удалось связаться с сервером");
    }
    setSending(false);
  };

  // Прикрепление файла/картинки через диалог выбора
  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setUploadingFile(true);
    setSendError(null);
    try {
      const url = await uploadFile(file);
      setPendingAttachment({ type: file.type.startsWith("image/") ? "image" : "file", url, filename: file.name });
    } catch {
      setSendError("Не удалось загрузить файл");
    }
    setUploadingFile(false);
  };

  // Запись голосового сообщения (тот же приём, что и в форме баг-репорта)
  const startVoiceRecording = async () => {
    setSendError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setSendError("Нет доступа к микрофону");
      return;
    }
    const formats = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", ""];
    const mimeType = formats.find(m => m === "" || MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(tr => tr.stop());
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      const durationSec = recSeconds;
      setRecSeconds(0);
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/mp4" });
      if (blob.size === 0) return;
      const ext = (mimeType.split("/")[1] || "mp4").split(";")[0];
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
      setUploadingFile(true);
      try {
        const url = await uploadFile(file);
        setPendingAttachment({ type: "voice", url, duration_sec: durationSec });
      } catch {
        setSendError("Не удалось загрузить голосовое сообщение");
      }
      setUploadingFile(false);
    };
    recorderRef.current = recorder;
    recorder.start(500);
    setIsRecording(true);
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
  };

  const stopVoiceRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  };

  // Нет ни телефона, ни истории по заявке (contactId) — показываем подсказку.
  // Для Avito история грузится по contactId, поэтому заглушку показываем только когда
  // и телефона нет, и переписки не нашлось.
  if (!phone && !loading && touches.length === 0) {
    return (
      <div className="px-3 sm:px-6 py-10 text-center text-sm flex flex-col items-center gap-2" style={{ color: t.textMute }}>
        <Icon name="MessagesSquare" size={24} style={{ color: t.textMute }} />
        <div>Переписки пока нет.</div>
        <div className="text-xs max-w-xs">
          Здесь появится вся история сообщений из Avito, мессенджеров и звонков по этому клиенту.
          Для звонка добавьте телефон на вкладке «Клиент».
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
      {/* Шапка: номер телефона + звонок — только если телефон указан */}
      {phone ? (
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: t.textSub }}>
            <Icon name="Phone" size={12} style={{ color: t.textMute }} />
            {phone}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={focusDraft}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.97]"
              style={{ background: t.accent + "22", color: t.accentLight }}>
              <Icon name="MessageCircle" size={13} /> Написать
            </button>
            <button onClick={() => callViaUis(phone, client?.id)}
              disabled={callingUis}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.97] disabled:opacity-60"
              style={{ background: "#22c55e22", color: "#22c55e" }}>
              <Icon name={callingUis ? "Loader2" : "PhoneCall"} size={13} className={callingUis ? "animate-spin" : ""} /> Позвонить
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 flex items-center gap-1.5 text-xs font-medium"
          style={{ borderBottom: `1px solid ${t.border}`, color: t.textSub }}>
          <Icon name="MessagesSquare" size={12} style={{ color: "#f97316" }} />
          Переписка Avito
        </div>
      )}

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
            const quoted = tt.reply_to_id ? touches.find(x => x.id === tt.reply_to_id) : null;
            const nonImageAttachments = attachmentsOf(tt.attachments).filter(a => a.type !== "image");
            return (
              <div key={tt.id} className={`group flex items-center gap-1.5 ${out ? "justify-end" : "justify-start"}`}>
                {/* Кнопка «Ответить» — слева от чужого сообщения, справа от своего */}
                {!isCall && (
                  <button onClick={() => { setReplyTo(tt); textareaRef.current?.focus(); }}
                    className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-full ${out ? "order-2" : ""}`}
                    style={{ background: t.surface2, color: t.textMute }} title="Ответить">
                    <Icon name="Reply" size={13} />
                  </button>
                )}
                <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2"
                  style={{
                    background: out ? t.accent + "22" : t.surface2,
                    border: `1px solid ${out ? t.accent + "40" : t.border}`,
                  }}>
                  {/* Заголовок: канал */}
                  <div className="flex items-center gap-1 mb-1">
                    <Icon name={meta.icon} size={11} style={{ color: meta.color }} />
                    <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  </div>

                  {/* Цитата сообщения, на которое отвечаем */}
                  {quoted && (
                    <div className="mb-1.5 pl-2 py-1 rounded-md text-[11px] truncate"
                      style={{ borderLeft: `2px solid ${t.accent}`, background: t.bg + "55", color: t.textMute }}>
                      {quoted.text || (attachmentsOf(quoted.attachments).length ? "Вложение" : "Сообщение")}
                    </div>
                  )}

                  {/* Звонок */}
                  {isCall ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name={callMeta(tt.status, out).icon} size={13} style={{ color: callMeta(tt.status, out).color }} />
                        <span className="text-xs font-medium" style={{ color: callMeta(tt.status, out).color }}>
                          {callMeta(tt.status, out).label}
                          {tt.duration_sec ? ` · ${fmtDuration(tt.duration_sec)}` : ""}
                        </span>
                        {tt.status === "transcribing" && (
                          <span className="text-[10px]" style={{ color: t.textMute }}>расшифровка…</span>
                        )}
                        {tt.answered_by === "voicemail" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "#f59e0b22", color: "#f59e0b" }}>
                            <Icon name="Voicemail" size={10} /> Автоответчик
                          </span>
                        )}
                        {tt.answered_by === "human" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "#22c55e22", color: "#22c55e" }}>
                            <Icon name="User" size={10} /> Ответил человек
                          </span>
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
                      <div className="text-right mt-1">
                        <span className="text-[10px]" style={{ color: t.textMute }}>{fmtTime(tt.created_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Картинки из переписки (например, фото объекта от клиента) */}
                      {imagesOf(tt.attachments).map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" className="block mb-1.5">
                          <img src={src} alt="Вложение" loading="lazy"
                            className="rounded-lg max-w-full object-cover"
                            style={{ maxHeight: 260, border: `1px solid ${t.border}` }} />
                        </a>
                      ))}
                      {/* Голосовые сообщения и обычные файлы */}
                      {nonImageAttachments.map((a, i) => a.type === "voice" ? (
                        <div key={i} className="mb-1.5 flex items-center gap-2">
                          <audio controls src={a.url} className="h-8" style={{ maxWidth: 220 }} />
                        </div>
                      ) : (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer"
                          className="mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:brightness-110"
                          style={{ background: t.bg + "55", border: `1px solid ${t.border}` }}>
                          <Icon name="FileText" size={16} style={{ color: t.accentLight }} />
                          <span className="text-xs truncate" style={{ color: t.textSub }}>{a.filename || "Файл"}</span>
                        </a>
                      ))}
                      {(tt.text || !attachmentsOf(tt.attachments).length) && (
                        <div className="text-xs sm:text-sm whitespace-pre-wrap break-words" style={{ color: t.text }}>
                          {tt.text || <span style={{ color: t.textMute }}>(без текста)</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        {out && tt.status === "pending" && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: t.textMute }}>
                            <Icon name="Clock" size={10} /> отправляется
                          </span>
                        )}
                        {out && tt.status === "error" && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "#ef4444" }}>
                            <Icon name="AlertTriangle" size={10} /> не отправлено
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: t.textMute }}>{fmtTime(tt.created_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Цитата сообщения, на которое отвечаем */}
      {replyTo && (
        <div className="flex-shrink-0 px-3 sm:px-6 pt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
            style={{ background: t.surface2, borderLeft: `2px solid ${t.accent}` }}>
            <Icon name="Reply" size={13} style={{ color: t.accentLight }} className="flex-shrink-0" />
            <span className="text-[11px] truncate" style={{ color: t.textMute }}>
              {replyTo.text || (attachmentsOf(replyTo.attachments).length ? "Вложение" : "Сообщение")}
            </span>
          </div>
          <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 rounded-full" style={{ color: t.textMute }}>
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Превью прикреплённого файла/голоса перед отправкой */}
      {pendingAttachment && (
        <div className="flex-shrink-0 px-3 sm:px-6 pt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: t.surface2 }}>
            <Icon name={pendingAttachment.type === "voice" ? "Mic" : pendingAttachment.type === "image" ? "Image" : "FileText"}
              size={14} style={{ color: t.accentLight }} className="flex-shrink-0" />
            <span className="text-[11px] truncate" style={{ color: t.textSub }}>
              {pendingAttachment.type === "voice" ? "Голосовое сообщение" : (pendingAttachment.filename || "Файл")}
            </span>
          </div>
          <button onClick={() => setPendingAttachment(null)} className="flex-shrink-0 p-1 rounded-full" style={{ color: t.textMute }}>
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Поле ввода */}
      <div className="flex-shrink-0 px-3 sm:px-6 py-3 flex items-end gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
        <select value={sendChannel} onChange={e => setSendChannel(e.target.value)}
          className="text-xs rounded-lg px-2 py-2 focus:outline-none flex-shrink-0"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
          <option value="telegram">Telegram</option>
          <option value="max">MAX</option>
          <option value="avito">Avito</option>
        </select>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handlePickFile} />
        <button onClick={() => fileInputRef.current?.click()}
          disabled={sendChannel === "avito" || uploadingFile || isRecording}
          title={sendChannel === "avito" ? "Avito не поддерживает вложения" : "Прикрепить файл"}
          className="flex-shrink-0 rounded-lg p-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: t.surface2, color: t.textSub }}>
          <Icon name={uploadingFile ? "Loader2" : "Paperclip"} size={16} className={uploadingFile ? "animate-spin" : ""} />
        </button>

        {isRecording ? (
          <button onClick={stopVoiceRecording}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: "#ef444422", color: "#ef4444" }}>
            <Icon name="Square" size={13} /> {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, "0")}
          </button>
        ) : (
          <button onClick={startVoiceRecording}
            disabled={sendChannel === "avito" || uploadingFile || !!pendingAttachment}
            title={sendChannel === "avito" ? "Avito не поддерживает вложения" : "Голосовое сообщение"}
            className="flex-shrink-0 rounded-lg p-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: t.surface2, color: t.textSub }}>
            <Icon name="Mic" size={16} />
          </button>
        )}

        <textarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          rows={1} placeholder="Написать сообщение…"
          className={`flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none resize-none ${flashInput ? "animate-ring-flash-red" : ""}`}
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, maxHeight: 120 }} />
        <button onClick={handleSend} disabled={(!draft.trim() && !pendingAttachment) || sending}
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
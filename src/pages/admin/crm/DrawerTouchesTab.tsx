import { useState, useEffect, useRef } from "react";
import { crmFetch, uploadFile } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { useCallClient } from "./useCallClient";
import { useAutoTranscribe } from "./useAutoTranscribe";
import { Touch, AttachmentItem, TouchClient, MessengerAccount } from "./touchesShared";
import TouchesHeader from "./TouchesHeader";
import TouchesFeed from "./TouchesFeed";
import TouchesComposer from "./TouchesComposer";

interface Props {
  phone: string;
  name?: string;
  /** id заявки (live_chats). Нужен для каналов без телефона (Avito): история грузится по нему. */
  contactId?: number;
  /** id записи touch_clients — приоритетный способ найти диалог, когда нет
   * ни телефона, ни привязанной заявки (напр. чат MAX/Telegram без номера). */
  clientId?: number;
  /** Увеличивать при каждом запросе «поставить курсор в поле ввода» (напр. переход с другой вкладки) */
  focusSignal?: number;
  /**
   * Скрыть строку «телефон + Написать/Позвонить» над лентой.
   * Нужно там, где эти же действия УЖЕ есть в шапке экрана (вкладка «Сообщения»),
   * чтобы номер и кнопка «Позвонить» не дублировались двумя строками подряд.
   * По умолчанию false — в карточке клиента строка показывается как раньше.
   */
  hideContactBar?: boolean;
}

export default function DrawerTouchesTab({ phone, name, contactId, clientId, focusSignal, hideContactBar }: Props) {
  const t = useTheme();
  const { call: callViaUis, calling: callingUis } = useCallClient();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<TouchClient | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState("");
  // По умолчанию Avito, если у клиента нет телефона (пришёл из Avito), иначе Telegram
  const [sendChannel, setSendChannel] = useState(phone ? "telegram" : "avito");
  // Линии (аккаунты) компании в Telegram/MAX — чтобы менеджер мог сам выбрать,
  // с какого номера отправить сообщение, если линий несколько. Пусто = автовыбор
  // на backend (последняя линия переписки или первая активная).
  const [accounts, setAccounts] = useState<MessengerAccount[]>([]);
  const [sendAccountId, setSendAccountId] = useState<string>("");
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
    // Грузим по id записи touch_clients (clientId) — он в наивысшем приоритете:
    // это точный, всегда существующий идентификатор диалога, включая чаты MAX/
    // Telegram без телефона и без привязанной заявки (иначе, если у диалога нет
    // ни phone, ни contactId, лента просто не грузится, хотя диалог есть в списке).
    // Дальше — id заявки (contact_id), чтобы не терять уже начатую переписку
    // (напр. Avito), если у заявки позже появился телефон. Телефон передаём
    // ТОЖЕ (если есть) — backend сам дозапишет его в найденную запись,
    // не создавая нового клиента и не обрывая историю касаний.
    if (!clientId && !phone && !contactId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (clientId) extra.client_id = String(clientId);
      if (contactId) extra.contact_id = String(contactId);
      if (phone) extra.phone = phone;
      if (name) extra.name = name;
      const d = await crmFetch("touches", undefined, extra) as { client?: TouchClient; touches?: Touch[]; error?: string };
      if (d && !d.error) {
        setClient(d.client ?? null);
        const loadedTouches = d.touches ?? [];
        setTouches(loadedTouches);
        // Канал отправки по умолчанию — последний, которым реально переписывались
        // с клиентом (а не жёсткое "Avito без телефона / Telegram с телефоном"),
        // иначе менеджер стартует не с того канала, где клиент уже привык отвечать.
        const lastTextTouch = [...loadedTouches].reverse().find(tt => TEXT_CHANNELS.has(tt.channel));
        if (lastTextTouch) setSendChannel(lastTextTouch.channel);
      }
    } catch { /* тихо */ }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone, contactId, clientId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "auto" }); }, [touches.length, loading]);

  // Список линий (аккаунтов) Telegram/MAX компании — грузим один раз, чтобы
  // менеджер мог выбрать, с какого номера отправить сообщение.
  useEffect(() => {
    crmFetch("messenger-accounts-list")
      .then((d) => setAccounts((d as { accounts?: MessengerAccount[] })?.accounts || []))
      .catch(() => {});
  }, []);

  // При смене канала отправки сбрасываем выбор линии — старая линия могла
  // относиться к другому каналу (Telegram/MAX линии не взаимозаменяемы).
  useEffect(() => { setSendAccountId(""); }, [sendChannel]);

  // Звонки без расшифровки (запись есть, текста ещё нет) — расшифровываем
  // по одному, пока лента открыта, и подтягиваем текст в неё же.
  useAutoTranscribe(touches, () => load(true));

  // Тихий поллинг ленты — подхватывает новые сообщения от клиента и статус
  // отправленных («отправляется» → «отправлено») без перезахода на страницу.
  useEffect(() => {
    if (!clientId && !phone && !contactId) return;
    const timer = setInterval(() => {
      if (document.hidden) return; // вкладка браузера свёрнута/неактивна — не дёргаем сервер впустую
      load(true);
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, contactId, clientId]);

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
          account_id: sendAccountId ? Number(sendAccountId) : null,
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

  // ── Действия над отдельным сообщением ───────────────────────────────────
  // Везде сначала меняем состояние локально (интерфейс отзывается мгновенно), затем
  // сохраняем на сервере; при ошибке перечитываем ленту и откатываемся.
  const handleResend = async (tt: Touch) => {
    setTouches(prev => prev.map(x => x.id === tt.id ? { ...x, status: "pending" } : x));
    try {
      await crmFetch("touch-resend", { method: "POST", body: JSON.stringify({ touch_id: tt.id }) });
    } catch {
      load(true);
    }
  };

  const handleStar = async (tt: Touch) => {
    const next = !tt.starred;
    setTouches(prev => prev.map(x => x.id === tt.id ? { ...x, starred: next } : x));
    try {
      await crmFetch("touch-star", { method: "POST", body: JSON.stringify({ touch_id: tt.id, starred: next }) });
    } catch {
      load(true);
    }
  };

  const handleReact = async (tt: Touch, emoji: string) => {
    const prevList = Array.isArray(tt.reactions) ? tt.reactions as Record<string, unknown>[] : [];
    const mine = prevList.filter(r => r?.by === "out")[0] as { emoji?: string } | undefined;
    // Повторный клик по той же реакции — снимаем её
    const nextEmoji = mine?.emoji === emoji ? "" : emoji;
    const optimistic = [
      ...prevList.filter(r => r?.by !== "out"),
      ...(nextEmoji ? [{ emoji: nextEmoji, author: "Менеджер", by: "out" }] : []),
    ];
    setTouches(prev => prev.map(x => x.id === tt.id ? { ...x, reactions: optimistic } : x));
    try {
      await crmFetch("touch-react", { method: "POST", body: JSON.stringify({ touch_id: tt.id, emoji: nextEmoji }) });
    } catch {
      load(true);
    }
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
      // Тип вложения по MIME файла: от него зависит, как сообщение отрисуется
      // в ленте и как воркер отправит его в мессенджер (фото/видео/голос/файл).
      const kind = file.type.startsWith("image/") ? "image"
        : file.type.startsWith("video/") ? "video"
        : file.type.startsWith("audio/") ? "voice"
        : "file";
      setPendingAttachment({ type: kind, url, filename: file.name });
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <TouchesHeader
        phone={phone}
        client={client}
        callingUis={callingUis}
        onFocusDraft={focusDraft}
        onCall={callViaUis}
        hideContactBar={hideContactBar}
      />

      <TouchesFeed
        loading={loading}
        touches={touches}
        expanded={expanded}
        setExpanded={setExpanded}
        onReply={(tt) => { setReplyTo(tt); textareaRef.current?.focus(); }}
        onResend={handleResend}
        onStar={handleStar}
        onReact={handleReact}
        bottomRef={bottomRef}
      />

      <TouchesComposer
        sendChannel={sendChannel}
        setSendChannel={setSendChannel}
        accounts={accounts}
        sendAccountId={sendAccountId}
        setSendAccountId={setSendAccountId}
        draft={draft}
        setDraft={setDraft}
        sending={sending}
        sendError={sendError}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        pendingAttachment={pendingAttachment}
        setPendingAttachment={setPendingAttachment}
        uploadingFile={uploadingFile}
        isRecording={isRecording}
        recSeconds={recSeconds}
        fileInputRef={fileInputRef}
        textareaRef={textareaRef}
        flashInput={flashInput}
        onPickFile={handlePickFile}
        onStartVoiceRecording={startVoiceRecording}
        onStopVoiceRecording={stopVoiceRecording}
        onSend={handleSend}
      />
    </div>
  );
}
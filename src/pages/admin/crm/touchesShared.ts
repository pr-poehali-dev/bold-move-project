// ── Общие типы и хелперы вкладки «Касания» (переписка с клиентом) ──────────
// Вынесены отдельно, т.к. используются сразу в нескольких компонентах
// (лента сообщений, поле ввода, шапка).

export interface AttachmentItem {
  type: "image" | "file" | "voice";
  url: string;
  filename?: string;
  duration_sec?: number;
}

export interface Touch {
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
  /** Имя автора сообщения — заполнено только для группового чата (кто из
   * участников написал), в личных диалогах не используется */
  sender_name?: string | null;
}

// Достаёт вложения сообщения в типизированном виде. Формат приходит из
// разных каналов, поэтому проверяем аккуратно.
export function attachmentsOf(attachments: unknown): AttachmentItem[] {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((a): a is AttachmentItem => !!a && typeof a === "object" && typeof (a as AttachmentItem).url === "string")
    .map(a => ({ ...a, type: (a.type as AttachmentItem["type"]) || "file" }));
}
export function imagesOf(attachments: unknown): string[] {
  return attachmentsOf(attachments).filter(a => a.type === "image").map(a => a.url);
}

// Линия (аккаунт) компании в Telegram/MAX — для ручного выбора, с какого
// номера отправить сообщение, если у компании их несколько.
export interface MessengerAccount {
  id: number;
  channel: "telegram" | "max";
  title: string;
  phone: string | null;
  is_active: boolean;
  auth_status: string;
}

export interface TouchClient {
  id: number;
  phone: string | null;
  name: string | null;
  state_summary: string | null;
  next_action: string | null;
  interest: string | null;
  stage: string | null;
  /** 'private' — личный диалог, 'group'/'channel' — групповой чат Telegram */
  chat_type?: "private" | "group" | "channel";
  /** Название группы/канала (заполнено только для группового чата) */
  group_title?: string | null;
}

// Канал → иконка + подпись
export const CHANNELS: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "Phone",          label: "Звонок",   color: "#22c55e" },
  telegram: { icon: "Send",           label: "Telegram", color: "#3b82f6" },
  max:      { icon: "MessageCircle",  label: "MAX",      color: "#a855f7" },
  avito:    { icon: "MessagesSquare", label: "Avito",    color: "#f97316" },
  whatsapp: { icon: "Phone",          label: "WhatsApp", color: "#25d366" },
  webchat:  { icon: "MessageSquareText", label: "Веб-чат", color: "#0ea5e9" },
};
export const channelMeta = (c: string) => CHANNELS[c] || { icon: "MessageSquare", label: c, color: "#8b5cf6" };

export { fmtMoscowDateTime as fmtTime } from "./timeMoscow";

export const fmtDuration = (sec: number | null) => {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Статус звонка → иконка/подпись/цвет. Пропущенный — красным (даже если карточка
// сама «исходящая» по направлению записи — статус missed важнее направления).
export const MISSED_STATUSES = new Set(["missed", "no-answer", "noanswer", "busy", "declined"]);
export const callMeta = (status: string, out: boolean): { icon: string; label: string; color: string } => {
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
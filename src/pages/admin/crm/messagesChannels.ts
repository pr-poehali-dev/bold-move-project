// Каналы диалогов: иконка, подпись, цвет. Общий источник для списка и шапки чата.
export const CHANNELS: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "Phone",             label: "Звонок",   color: "#22c55e" },
  telegram: { icon: "Send",              label: "Telegram", color: "#3b82f6" },
  max:      { icon: "MessageCircle",     label: "MAX",      color: "#a855f7" },
  avito:    { icon: "MessagesSquare",    label: "Avito",    color: "#f97316" },
  whatsapp: { icon: "Phone",             label: "WhatsApp", color: "#25d366" },
  webchat:  { icon: "MessageSquareText", label: "Веб-чат",  color: "#0ea5e9" },
};

// Табы фильтра источника над списком диалогов. Порядок = порядок кнопок.
// Чтобы добавить канал в фильтр — достаточно дописать сюда строку.
export const CHANNEL_FILTERS: { value: string; label: string }[] = [
  { value: "all",      label: "Все" },
  { value: "telegram", label: "Telegram" },
  { value: "max",      label: "MAX" },
  { value: "avito",    label: "Avito" },
  { value: "call",     label: "Звонки" },
];

export const channelMeta = (c: string) =>
  CHANNELS[c] || { icon: "MessageSquare", label: c, color: "#8b5cf6" };

export interface Dialog {
  client_id: number;
  name: string | null;
  phone: string | null;
  contact_id: number | null;
  interest: string | null;
  stage: string | null;
  last_channel: string;
  last_direction: "in" | "out";
  last_text: string;
  last_at: string;
  unread: boolean;
  in_count: number;
  pinned: boolean;
  favorite: boolean;
  source: string | null;
  avito_chat_url: string | null;
  /** 'private' — личный диалог, 'group'/'channel' — групповой чат Telegram */
  chat_type?: "private" | "group" | "channel";
  /** Название группы/канала (заполнено только для группового чата) */
  group_title?: string | null;
  /** Статус последнего сообщения: pending/sending — в пути, error — не доставлено */
  last_status?: string | null;
  /** У последнего сообщения есть вложение (фото/файл/аудио) */
  last_has_attachments?: boolean;
}
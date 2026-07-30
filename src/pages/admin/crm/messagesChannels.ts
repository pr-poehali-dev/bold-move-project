// Каналы диалогов: иконка, подпись, цвет. Общий источник для списка и шапки чата.
export const CHANNELS: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "Phone",             label: "Звонок",   color: "#22c55e" },
  telegram: { icon: "Send",              label: "Telegram", color: "#3b82f6" },
  max:      { icon: "MessageCircle",     label: "MAX",      color: "#a855f7" },
  avito:    { icon: "MessagesSquare",    label: "Avito",    color: "#f97316" },
  whatsapp: { icon: "Phone",             label: "WhatsApp", color: "#25d366" },
  webchat:  { icon: "MessageSquareText", label: "Веб-чат",  color: "#0ea5e9" },
};

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
}

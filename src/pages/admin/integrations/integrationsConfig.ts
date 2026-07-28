export interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  options?: string[];   // если задано — рендерим выпадающий список
}

export interface ProviderOption {
  id: string;
  label: string;
  fields: FieldDef[];
}

export interface SectionDef {
  id: string;
  group: string;   // ключ группы
  title: string;
  desc: string;
  icon: string;
  providers: ProviderOption[];
}

// Смысловые группы вкладки «Интеграции»
export const GROUPS: { id: string; title: string; desc: string }[] = [
  { id: "channels", title: "Каналы общения с клиентом",
    desc: "Двусторонняя переписка: клиент пишет — сообщение попадает в ленту «Касания», отвечаете из CRM." },
  { id: "ai", title: "ИИ и обработка",
    desc: "Распознавание звонков и модель, которая анализирует историю клиента." },
  { id: "telephony", title: "Телефония (АТС)",
    desc: "Входящие звонки для транскрибации и анализа." },
];

export const SECTIONS: SectionDef[] = [
  // ── Каналы общения с клиентом ──
  {
    id: "tg_bot", group: "channels",
    title: "Telegram-бот",
    desc: "Двусторонняя переписка с клиентом через вашего Telegram-бота.",
    icon: "Send",
    providers: [
      { id: "tg_bot", label: "Telegram", fields: [
        { key: "tg_channel_token", label: "Токен бота (для переписки)", placeholder: "123456:AA...", type: "password" },
      ]},
    ],
  },
  {
    id: "max_bot", group: "channels",
    title: "MAX-бот",
    desc: "Двусторонняя переписка с клиентом через MAX-бота.",
    icon: "MessageCircle",
    providers: [
      { id: "max_bot", label: "MAX", fields: [
        { key: "max_channel_token", label: "Токен бота MAX (для переписки)", placeholder: "...", type: "password" },
      ]},
    ],
  },
  {
    id: "avito", group: "channels",
    title: "Avito",
    desc: "Приём и отправка сообщений через Avito Messenger API.",
    icon: "MessagesSquare",
    providers: [
      { id: "avito", label: "Avito", fields: [
        { key: "avito_client_id", label: "Client ID", placeholder: "..." },
        { key: "avito_client_secret", label: "Client Secret", placeholder: "...", type: "password" },
      ]},
    ],
  },
  {
    id: "webchat", group: "channels",
    title: "Веб-чат на сайте",
    desc: "Виджет чата на вашем сайте — клиент пишет прямо там, без мессенджеров.",
    icon: "MessageSquareText",
    providers: [
      { id: "webchat", label: "Веб-чат", fields: [
        { key: "webchat_site_url", label: "Адрес сайта", placeholder: "https://..." },
      ]},
    ],
  },
  {
    id: "whatsapp", group: "channels",
    title: "WhatsApp",
    desc: "Приём и отправка через официальный WhatsApp Cloud API.",
    icon: "Phone",
    providers: [
      { id: "whatsapp", label: "WhatsApp", fields: [
        { key: "whatsapp_phone_id", label: "Phone Number ID", placeholder: "..." },
        { key: "whatsapp_token", label: "Access Token", placeholder: "...", type: "password" },
      ]},
    ],
  },
  // ── ИИ и обработка ──
  {
    id: "transcription", group: "ai",
    title: "Транскрибация звонков",
    desc: "Сервис, который превращает записи звонков в текст.",
    icon: "AudioLines",
    providers: [
      { id: "assemblyai", label: "AssemblyAI", fields: [
        { key: "assemblyai_key", label: "API-ключ", placeholder: "sk-...", type: "password" },
      ]},
      { id: "whisper", label: "Whisper (OpenAI)", fields: [
        { key: "whisper_key", label: "API-ключ OpenAI", placeholder: "sk-...", type: "password" },
        { key: "whisper_model", label: "Модель", placeholder: "whisper-1" },
      ]},
    ],
  },
  {
    id: "llm", group: "ai",
    title: "Думающая LLM",
    desc: "Модель, которая анализирует историю клиента и даёт рекомендации.",
    icon: "BrainCircuit",
    providers: [
      { id: "mistral", label: "Mistral AI", fields: [
        { key: "mistral_key", label: "API-ключ", placeholder: "...", type: "password" },
        { key: "mistral_model", label: "Модель", placeholder: "Модель",
          options: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"] },
      ]},
      { id: "openai", label: "OpenAI", fields: [
        { key: "openai_key", label: "API-ключ", placeholder: "sk-...", type: "password" },
        { key: "openai_model", label: "Модель", placeholder: "Модель",
          options: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"] },
      ]},
      { id: "other", label: "Другая", fields: [
        { key: "other_base_url", label: "Base URL", placeholder: "https://api.example.com/v1" },
        { key: "other_key", label: "API-ключ", placeholder: "...", type: "password" },
        { key: "other_model", label: "Модель", placeholder: "название-модели" },
      ]},
    ],
  },
  // ── Телефония ──
  {
    id: "telephony", group: "telephony",
    title: "Телефония (АТС)",
    desc: "Входящие звонки приходят на этот вебхук.",
    icon: "PhoneCall",
    providers: [
      { id: "webhook", label: "Вебхук АТС", fields: [
        { key: "telephony_webhook", label: "URL вебхука", placeholder: "https://..." },
      ]},
    ],
  },
];

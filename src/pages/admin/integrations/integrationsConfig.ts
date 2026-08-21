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
  /** Ключ в config для тумблера вкл/выкл этой карточки (если задан — тумблер показывается) */
  enabledKey?: string;
  /** true — выключение реально останавливает приём на бэкенде; false/не задано — только визуально */
  realToggle?: boolean;
}

export const SECTIONS: SectionDef[] = [
  // ── Боты (уведомления по токену) ──
  {
    id: "tg_bot", group: "bots",
    title: "Telegram-бот",
    desc: "Официальный бот по токену от @BotFather — уведомления о заявках.",
    icon: "Bot",
    providers: [
      { id: "tg_bot", label: "Telegram", fields: [
        { key: "tg_channel_token", label: "Токен бота (получить у @BotFather)", placeholder: "123456:AA...", type: "password" },
      ]},
    ],
    enabledKey: "tg_bot_enabled", realToggle: false,
  },
  {
    id: "max_bot", group: "bots",
    title: "MAX-бот",
    desc: "Официальный бот MAX по токену — уведомления о заявках.",
    icon: "Bot",
    providers: [
      { id: "max_bot", label: "MAX", fields: [
        { key: "max_channel_token", label: "Токен бота MAX (получить у @MasterBot)", placeholder: "...", type: "password" },
      ]},
    ],
    enabledKey: "max_bot_enabled", realToggle: false,
  },
  // ── Другие каналы ──
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
    enabledKey: "avito_enabled", realToggle: true,
  },
  {
    id: "tg_leads", group: "channels",
    title: "Заявки из Telegram-группы",
    desc: "Свой бот стоит в группе, куда падают заявки от бота-агрегатора, и автоматически заводит по ним карточки в CRM.",
    icon: "Inbox",
    providers: [
      { id: "tg_leads", label: "Telegram", fields: [
        { key: "tg_leads_bot_token", label: "Токен бота (получить у @BotFather)", placeholder: "123456:AA...", type: "password" },
      ]},
    ],
    enabledKey: "tg_leads_enabled", realToggle: true,
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
    enabledKey: "webchat_enabled", realToggle: false,
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
    enabledKey: "transcription_enabled", realToggle: false,
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
    enabledKey: "llm_enabled", realToggle: false,
  },
  // ── Телефония ──
  {
    id: "telephony", group: "telephony",
    title: "Телефония (UIS)",
    desc: "Входящие и исходящие звонки, кнопка «Позвонить», расшифровка и ИИ-анализ разговоров.",
    icon: "PhoneCall",
    providers: [
      { id: "uis", label: "UIS", fields: [
        { key: "uis_api_key", label: "API-ключ (Data/Call API)", placeholder: "...", type: "password" },
        { key: "uis_virtual_phone_number", label: "Виртуальный номер UIS", placeholder: "+7..." },
      ]},
    ],
    // У UIS уже есть свой встроенный тумблер внутри TelephonyUisCard (uis_enabled) — здесь не дублируем.
  },
];
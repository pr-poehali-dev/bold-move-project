// ── Все константы и данные страницы личного бренда ───────────────────────────

export const PHOTO_URL = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/dc3581be-1604-4c86-b70f-dbd17ca4d283.jpg";

export const TG_LINK = "https://t.me/JoniKras";
export const MAX_LINK = "https://max.ru/u/f9LHodD0cOKSEfyoFHNHDKKda2DJEQla4TIbxIDSi7pGygeScJtM9PafS5g";

// ── Все скриншоты для общей галереи ──────────────────────────────────────────
export const ALL_SCREENSHOTS = [
  // AI-агент
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/4ecbbf9f-399f-4dfa-9f82-0f510e65acf4.png", caption: "AI-агент: чат-интерфейс" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3416564e-b468-4a79-8b8e-eaade4459b53.png", caption: "AI-агент: голосовой ввод" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/81d9f4de-68ac-481f-9ddd-432a4dd308af.png", caption: "AI-агент: готовая смета" },
  // CRM
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/b515b10a-e8bf-4688-90d3-5ac68107f14e.png", caption: "CRM: воронка заявок" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/a27669c1-a604-4b08-b399-93e45198ecc5.png", caption: "CRM: канбан-доска" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/326f400c-4845-4d7c-990b-4d4a918273e2.png", caption: "CRM: календарь" },
  // Аналитика
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c506c61e-4161-4bae-b929-90e70814ce92.png", caption: "Аналитика: обзор" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/2d466914-6eae-455d-b18f-8d21a26b7569.png", caption: "Аналитика: финансы P&L" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/5959ad19-5d27-4d4c-8828-12a95c55513b.png", caption: "Аналитика: динамика" },
  // CAD-построитель
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3b311dfe-644d-46a7-9072-ddef2335e583.png", caption: "Построитель: чертёж комнаты" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/a9e8b3c2-947f-4019-ab92-ba13b0ca8182.png", caption: "Построитель: сложный контур" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/6ac33c1e-a2a6-4211-abba-7095f4923d5f.png", caption: "Построитель: диагонали" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/64854ee6-cee5-47bc-829f-bc2796aa079b.png", caption: "Построитель: материалы на чертеже" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/9c53f861-98e1-49a0-bfe5-2494dca933d5.png", caption: "Построитель: мультикомнатный" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/0263eb88-1d0a-4c36-9be1-f0d1db6730ec.png", caption: "Построитель: выгрузка PDF" },
  // White-label панель
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3df2c7ac-4cdc-4747-958f-0946f4db2fe3.png", caption: "Панель: вход" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/8ad1558a-3630-4de7-bc86-0867d74be5e7.png", caption: "Панель: настройка агента" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/f0aa33cd-c1f8-416e-9e9e-82974e4e7e87.png", caption: "Панель: управление прайсами" },
  { url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/1ee941f1-5b50-4584-86e4-973dde134db0.png", caption: "Панель: мультикомнатные проекты" },
];

export const PROJECTS = [
  {
    id: "agent",
    title: "AI-Агент для бизнеса",
    subtitle: "Голосовой консультант + умная смета",
    description: "Персональный AI-агент, который знает прайс 50+ поставщиков, ведёт диалог голосом, мгновенно рассчитывает стоимость и формирует смету в PDF. Интегрируется в Telegram и на сайт.",
    tags: ["AI / LLM", "RAG", "Telegram Bot", "Voice", "Python"],
    color: "#f97316",
    glow: "rgba(249,115,22,0.25)",
    link: "/",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/4ecbbf9f-399f-4dfa-9f82-0f510e65acf4.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3416564e-b468-4a79-8b8e-eaade4459b53.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/81d9f4de-68ac-481f-9ddd-432a4dd308af.png",
    ],
    features: ["Голосовой ввод и ответ", "RAG по базе прайсов", "Мгновенный расчёт сметы", "PDF-выгрузка КП", "Telegram-интеграция"],
  },
  {
    id: "crm",
    title: "CRM + Аналитика",
    subtitle: "Воронка · Канбан · P&L · Динамика · Календарь",
    description: "Полноценная CRM для отдела продаж: канбан-доска, воронка заявок, финансовая аналитика P&L с графиками динамики, календарь замеров и монтажей, матрица прав для менеджеров.",
    tags: ["React", "PostgreSQL", "Python", "Аналитика", "REST API"],
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.25)",
    link: "/crm",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/b515b10a-e8bf-4688-90d3-5ac68107f14e.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/a27669c1-a604-4b08-b399-93e45198ecc5.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/326f400c-4845-4d7c-990b-4d4a918273e2.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c506c61e-4161-4bae-b929-90e70814ce92.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/2d466914-6eae-455d-b18f-8d21a26b7569.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/5959ad19-5d27-4d4c-8828-12a95c55513b.png",
    ],
    features: ["Воронка заявок + Канбан", "Финансы P&L в реальном времени", "Динамика выручки/затрат — графики", "Календарь замеров/монтажей", "Матрица прав менеджеров"],
  },
  {
    id: "plan",
    title: "CAD-Построитель",
    subtitle: "Чертёж · Материалы · Смета в браузере",
    description: "Браузерный CAD-редактор: рисование произвольных контуров, автоматический расчёт материалов, диагонали, мультикомнатные проекты, экспорт в PDF с чертежом и детализацией.",
    tags: ["Canvas API", "Geometry", "React", "PDF", "CAD"],
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.25)",
    link: "/plan",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3b311dfe-644d-46a7-9072-ddef2335e583.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/a9e8b3c2-947f-4019-ab92-ba13b0ca8182.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/6ac33c1e-a2a6-4211-abba-7095f4923d5f.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/64854ee6-cee5-47bc-829f-bc2796aa079b.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/9c53f861-98e1-49a0-bfe5-2494dca933d5.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/0263eb88-1d0a-4c36-9be1-f0d1db6730ec.png",
    ],
    features: ["Произвольные контуры комнат", "Авто-расчёт периметра и площади", "Интерактивные диагонали", "Мультикомнатные проекты", "Экспорт PDF с чертежом"],
  },
  {
    id: "company",
    title: "White-label платформа",
    subtitle: "Агент под брендом · Прайсы · Команда · API",
    description: "Административная платформа: настройка white-label агента под бренд компании, управление прайсами и правилами расчёта, ролевая система доступа, интеграция с Telegram и API.",
    tags: ["White-label", "Multi-tenant", "React", "Python", "PostgreSQL"],
    color: "#10b981",
    glow: "rgba(16,185,129,0.25)",
    link: "/company",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3df2c7ac-4cdc-4747-958f-0946f4db2fe3.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/8ad1558a-3630-4de7-bc86-0867d74be5e7.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/f0aa33cd-c1f8-416e-9e9e-82974e4e7e87.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/1ee941f1-5b50-4584-86e4-973dde134db0.png",
    ],
    features: ["White-label брендинг агента", "Управление прайсами и правилами", "Роли: компания / менеджер / мастер", "Telegram-бот под своим именем", "Аналитика по всей компании"],
  },
];

export const STACK = [
  { name: "React + TypeScript", level: 95, color: "#06b6d4" },
  { name: "Python / FastAPI", level: 88, color: "#f97316" },
  { name: "AI / LLM / RAG", level: 90, color: "#8b5cf6" },
  { name: "PostgreSQL", level: 85, color: "#10b981" },
  { name: "Canvas / CAD", level: 80, color: "#f59e0b" },
  { name: "Telegram Bot API", level: 92, color: "#3b82f6" },
  { name: "MCP / API интеграции", level: 85, color: "#ec4899" },
  { name: "Vite / CI/CD", level: 88, color: "#84cc16" },
];

export const STATS = [
  { value: "5+", label: "лет в разработке" },
  { value: "30+", label: "реализованных проектов" },
  { value: "4", label: "собственных платформы" },
  { value: "8+", label: "компаний-клиентов" },
];

export const REVIEWS = [
  {
    text: "Евгений разработал для нас полноценную CRM с AI-агентом с нуля. Сроки — 6 недель, результат превзошёл ожидания. Наш отдел продаж перестал терять заявки.",
    author: "Алексей К.",
    role: "Директор, МосПотолки",
    avatar: "АК",
    color: "#8b5cf6",
  },
  {
    text: "Построитель смет сократил время расчёта с 40 минут до 3. Менеджеры теперь делают КП прямо на замере. Женя сделал то, что другие разработчики считали невозможным.",
    author: "Михаил Р.",
    role: "Операционный директор, Unistory.app",
    avatar: "МР",
    color: "#f97316",
  },
  {
    text: "Голосовой агент для нашего колл-центра работает уже 8 месяцев без единого сбоя. Скорость ответа на запрос клиента упала с 2 часов до 30 секунд.",
    author: "Наталья В.",
    role: "Руководитель call-центра, СтройСервис",
    avatar: "НВ",
    color: "#06b6d4",
  },
  {
    text: "Работали над интеграцией IP-телефонии и CRM. Чёткая коммуникация, никаких «ещё чуть-чуть». Всё сдано в срок, документация в порядке.",
    author: "Дмитрий С.",
    role: "CTO, ТехноЛаб",
    avatar: "ДС",
    color: "#10b981",
  },
];

export const PRICING = [
  {
    title: "Консультация",
    price: "Бесплатно",
    duration: "до 1 часа",
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.2)",
    description: "Разбираем вашу задачу, предлагаем архитектуру и честно оцениваем стоимость",
    items: [
      "Аудит текущих процессов",
      "Рекомендации по стеку",
      "Оценка сроков и бюджета",
      "Дорожная карта проекта",
    ],
    cta: "Записаться бесплатно",
    href: TG_LINK,
  },
  {
    title: "Проект под ключ",
    price: "от 150 000 ₽",
    duration: "4–8 недель",
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.25)",
    description: "Полная разработка продукта: архитектура, код, деплой, обучение команды",
    items: [
      "Техническое задание",
      "Архитектура и прототип",
      "Фронтенд + бэкенд + БД",
      "AI/LLM интеграция",
      "Деплой и поддержка 1 мес.",
    ],
    cta: "Обсудить проект",
    href: TG_LINK,
    popular: true,
  },
  {
    title: "Найм в команду",
    price: "от 250 000 ₽/мес",
    duration: "Полная занятость",
    color: "#10b981",
    glow: "rgba(16,185,129,0.2)",
    description: "Старший разработчик / CPO в команду — удалённо или офис в Москве",
    items: [
      "Fullstack React + Python",
      "AI-архитектура и агенты",
      "Готов к офферу сейчас",
      "Удалённо / офис МСК",
    ],
    cta: "Пригласить в команду",
    href: MAX_LINK,
  },
];

export const TECH_LOGOS = [
  { name: "React" },
  { name: "TypeScript" },
  { name: "Python" },
  { name: "FastAPI" },
  { name: "PostgreSQL" },
  { name: "OpenAI API" },
  { name: "LangChain" },
  { name: "RAG" },
  { name: "Telegram Bot" },
  { name: "Canvas API" },
  { name: "Docker" },
  { name: "Vite" },
  { name: "REST API" },
  { name: "VoIP / SIP" },
  { name: "MCP" },
  { name: "PDF Generation" },
];

export const NAV_ITEMS = [
  { label: "Обо мне", href: "#hero" },
  { label: "Проекты", href: "#projects" },
  { label: "Галерея", href: "#gallery" },
  { label: "Стек", href: "#stack" },
  { label: "Опыт", href: "#experience" },
  { label: "Отзывы", href: "#reviews" },
  { label: "Стоимость", href: "#pricing" },
];

export const EXPERIENCE = [
  {
    year: "2021–2026",
    company: "Unistory.app",
    companyFull: "Unistory.app — Технологии для бизнеса",
    role: "AI-Архитектор бизнес-процессов",
    items: [
      "CRM-система с AI-агентами для автоматизации продаж",
      "Мультиагентные системы для ведения клиентов",
      "CAD-построитель с автоматическим расчётом смет",
      "Система голосового управления корпоративными ресурсами",
      "Классификация звонков — автоматическая категоризация голосовых обращений",
      "AI-калькуляторы и сметчики для быстрого расчёта стоимости",
      "Интеграция платёжных систем (банковские карты, СБП)",
      "IP-телефония с функциями маршрутизации и записи звонков",
    ],
  },
  {
    year: "2020–2021",
    company: "DigitalCore",
    companyFull: "DigitalCore — Автоматизация и интеграции",
    role: "Fullstack-разработчик",
    items: [
      "Разработка и интеграция корпоративных API",
      "Автоматизация рутинных бизнес-процессов",
      "Внедрение аналитических дашбордов",
      "Интеграция внешних сервисов и платёжных шлюзов",
    ],
  },
  {
    year: "2019–2020",
    company: "TechFlow",
    companyFull: "TechFlow — Веб-разработка",
    role: "Frontend-разработчик",
    items: [
      "Разработка SPA-приложений на React",
      "Интеграция REST API",
      "Оптимизация производительности интерфейсов",
    ],
  },
];

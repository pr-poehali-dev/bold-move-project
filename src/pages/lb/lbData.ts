// ── Все константы и данные страницы личного бренда ───────────────────────────

export const PHOTO_URL = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/dc3581be-1604-4c86-b70f-dbd17ca4d283.jpg";

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
    ],
    features: ["Голосовой ввод и ответ", "RAG по базе прайсов", "Мгновенный расчёт сметы", "PDF-выгрузка КП", "Telegram-интеграция"],
  },
  {
    id: "crm",
    title: "CRM-система",
    subtitle: "Воронка · Канбан · Аналитика · Календарь",
    description: "Полноценная CRM для отдела продаж: канбан-доска, воронка заявок, финансовая аналитика P&L, календарь замеров и монтажей, матрица прав для менеджеров.",
    tags: ["React", "PostgreSQL", "Python", "REST API", "Аналитика"],
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.25)",
    link: "/crm",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/b515b10a-e8bf-4688-90d3-5ac68107f14e.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/c506c61e-4161-4bae-b929-90e70814ce92.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/326f400c-4845-4d7c-990b-4d4a918273e2.png",
    ],
    features: ["Воронка заявок + Канбан", "Финансы P&L в реальном времени", "Календарь замеров/монтажей", "Матрица прав менеджеров", "Динамика выручки — графики"],
  },
  {
    id: "plan",
    title: "CAD-Построитель",
    subtitle: "Чертёж · Материалы · Смета в браузере",
    description: "Браузерный CAD-редактор для проектирования натяжных потолков: рисование произвольных контуров, автоматический расчёт материалов, диагонали, мультикомнатные проекты, экспорт в PDF.",
    tags: ["Canvas API", "Geometry", "React", "PDF", "CAD"],
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.25)",
    link: "/plan",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/a9e8b3c2-947f-4019-ab92-ba13b0ca8182.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/6ac33c1e-a2a6-4211-abba-7095f4923d5f.png",
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/9c53f861-98e1-49a0-bfe5-2494dca933d5.png",
    ],
    features: ["Произвольные контуры комнат", "Авто-расчёт периметра и площади", "Интерактивные диагонали", "Мультикомнатные проекты", "Экспорт PDF с чертежом"],
  },
  {
    id: "company",
    title: "Панель управления компанией",
    subtitle: "White-label · Агент · Прайсы · Команда",
    description: "Административная панель для компаний: настройка white-label агента под свой бренд, управление прайсами и правилами расчёта, онбординг команды с ролями и правами доступа.",
    tags: ["White-label", "Multi-tenant", "React", "Python", "PostgreSQL"],
    color: "#10b981",
    glow: "rgba(16,185,129,0.25)",
    link: "/company",
    screenshots: [
      "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/3df2c7ac-4cdc-4747-958f-0946f4db2fe3.png",
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
  { value: "10+", label: "продуктов запущено" },
  { value: "3", label: "собственных платформы" },
  { value: "250K", label: "желаемая зарплата ₽" },
];

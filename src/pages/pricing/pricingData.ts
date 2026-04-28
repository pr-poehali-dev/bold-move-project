export const PHONE     = "+7 977 606 89 01";
export const PHONE_RAW = "+79776068901";
export const BANK      = "ФОРА-БАНК";
export const SBP_HINT  = "Перевод по СБП по номеру телефона";

export interface Package {
  id: string;
  name: string;
  estimates: number;
  price: number;
  perEstimate: number;
  color: string;
  glow: string;
  features: string[];
  badge: string | null;
}

export const PACKAGES: Package[] = [
  {
    id: "start",
    name: "Старт",
    estimates: 5,
    price: 490,
    perEstimate: 98,
    color: "#64748b",
    glow:  "rgba(100,116,139,0.18)",
    features: [
      "5 смет на расчёт",
      "Все материалы и расценки",
      "PDF и отправка клиенту",
      "Поддержка в чате",
    ],
    badge: null,
  },
  {
    id: "standard",
    name: "Стандарт",
    estimates: 20,
    price: 990,
    perEstimate: 49,
    color: "#10b981",
    glow:  "rgba(16,185,129,0.22)",
    features: [
      "20 смет — хватит на месяц",
      "Все материалы и расценки",
      "PDF, ссылки, отправка клиенту",
      "Приоритетная поддержка",
      "Скидка 50% на смету",
    ],
    badge: "Популярный",
  },
  {
    id: "pro",
    name: "Про",
    estimates: 60,
    price: 1990,
    perEstimate: 33,
    color: "#a78bfa",
    glow:  "rgba(167,139,250,0.22)",
    features: [
      "60 смет — для активных мастеров",
      "Все материалы и расценки",
      "PDF, ссылки, отправка клиенту",
      "Приоритетная поддержка",
      "Цена сметы — всего 33 ₽",
    ],
    badge: "Выгодно",
  },
  {
    id: "business",
    name: "Бизнес",
    estimates: 150,
    price: 3990,
    perEstimate: 27,
    color: "#f59e0b",
    glow:  "rgba(245,158,11,0.22)",
    features: [
      "150 смет — для бригад и компаний",
      "Все материалы и расценки",
      "PDF, ссылки, отправка клиенту",
      "Персональный менеджер",
      "Минимальная цена сметы — 27 ₽",
    ],
    badge: "Максимум",
  },
];

export const ADVANTAGES = [
  { icon: "Mic",         title: "Управление голосом",          text: "Диктуй замеры и комментарии — сервис превратит в смету. Руки свободны." },
  { icon: "Users",       title: "Своя CRM",                    text: "Все клиенты, заявки и сметы в одном месте. Не теряй ни одного контакта." },
  { icon: "Tag",         title: "Управление ценой",            text: "Свои наценки, скидки и расценки. Цена под твой стиль работы." },
  { icon: "Settings2",   title: "Авто-правила расходов",       text: "Замер, монтаж, доставка — настрой один раз и всё считается само." },
  { icon: "TrendingUp",  title: "Авто-расчёт маржи",           text: "Видишь чистую прибыль и маргинальность по каждому заказу — мгновенно." },
  { icon: "FileText",    title: "Готовый PDF клиенту",         text: "Брендированная смета и КП в один клик. Отправил — получил подпись." },
  { icon: "Zap",         title: "Считает за 30 секунд",        text: "Загрузил план — получил смету. Без Excel и калькуляторов." },
  { icon: "Headset",     title: "Живой менеджер на связи",     text: "Поможем настроить, ответим на вопросы. Не оставим один на один." },
];

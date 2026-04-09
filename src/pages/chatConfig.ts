import func2url from "@/../backend/func2url.json";

export type Panel = "none" | "production" | "portfolio" | "tips" | "reviews" | "faq" | "contacts" | "booking" | "livechat";

export interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export const AVATAR = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/b12f254a-ee38-4ef7-abc3-2517a55b4909.jpg";

export const AI_URL = func2url["ai-chat"];

export const GREETING: Msg = {
  id: 0,
  role: "assistant",
  text: "Привет! Я Женя — ваш персональный консультант по натяжным потолкам 👋\n\nЗнаю предложения 50+ компаний Москвы. Спросите что угодно — найду лучшую цену, сравню варианты и рассчитаю стоимость.",
};

export const NAV: { id: Panel; label: string; icon: string; hint: string }[] = [
  { id: "livechat",   label: "Менеджер",     icon: "MessageCircle", hint: "Чат с живым менеджером — ответим за 5 минут"   },
  { id: "booking",    label: "Заказать",     icon: "CalendarCheck",hint: "Записаться на бесплатный замер и 3D-проект"     },
  { id: "production", label: "Производство", icon: "Factory",      hint: "Собственное производство в Мытищах с 2009 года"},
  { id: "portfolio",  label: "Портфолио",    icon: "Image",        hint: "Фото готовых работ — квартиры, офисы, дома"    },
  { id: "contacts",   label: "Контакты",     icon: "Phone",        hint: "Телефон, WhatsApp, Telegram и адрес офиса"     },
  { id: "tips",       label: "AI-советы",    icon: "Sparkles",     hint: "Умные подсказки — что спросить у Жени"         },
  { id: "reviews",    label: "Отзывы",       icon: "Heart",        hint: "2800+ отзывов на Яндекс.Картах, рейтинг 4.9"  },
  { id: "faq",        label: "FAQ",          icon: "HelpCircle",   hint: "Частые вопросы о потолках, монтаже и гарантии" },
];

export const TIPS: { icon: string; q: string }[] = [
  { icon: "TrendingDown", q: "Сравни цены на матовый потолок" },
  { icon: "Search",       q: "Какой потолок лучше для ванной?" },
  { icon: "BarChart3",    q: "Средние цены по Москве" },
  { icon: "Shield",       q: "Расскажи про гарантию" },
  { icon: "Zap",          q: "Кто делает монтаж за 1 день?" },
  { icon: "Calculator",   q: "Рассчитай потолок на 3 комнаты" },
];

export const CONTACTS: { icon: string; label: string; val: string; href: string }[] = [
  { icon: "Phone",         label: "Телефон",  val: "+7 (977) 606-89-01",    href: "tel:+79776068901" },
  { icon: "Send",          label: "Telegram", val: "Написать в Telegram",   href: "https://t.me/JoniKras" },
  { icon: "MessageSquare", label: "MAX",      val: "Написать в MAX",        href: "https://web.max.ru/#/chat/phone/79776068901" },
  { icon: "MapPin",        label: "Адрес",    val: "Мытищи, Пограничная 24", href: "#" },
  { icon: "Clock",         label: "Часы",     val: "Пн–Вс 8:00–22:00",     href: "#" },
];

export const PROD_FEATURES: { icon: string; label: string }[] = [
  { icon: "Award",     label: "Плёнка MSD Premium" },
  { icon: "Ruler",     label: "Точность до 1 мм"   },
  { icon: "FileCheck", label: "Сертификаты ISO"     },
  { icon: "Truck",     label: "Доставка за 1 день"  },
];

export const BOOKING_TIMES = ["9:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

export function localAnswer(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("привет") || s.includes("здравств")) return "Рад знакомству! Расскажите, какой потолок вам нужен — помогу найти лучший вариант на рынке.";
  if (s.includes("каталог") || s.includes("вид"))     return "Смотрите — на рынке 8 основных типов потолков. Матовый от 249 ₽/м² — самый популярный. Глянец от 299 ₽. Звёздное небо — премиум от 1200 ₽. Что ближе вам?";
  if (s.includes("калькулятор") || s.includes("рассч")) return "Конечно! Откройте калькулятор в меню — там я сравню нашу цену со средней по Москве. Вы увидите экономию.";
  if (s.includes("цена") || s.includes("стоим") || s.includes("сколько")) return "По данным рынка Москвы: матовый от 249 ₽/м², глянец от 299 ₽/м², тканевый от 399 ₽/м². Назовите площадь — посчитаю точнее.";
  if (s.includes("гарантия"))  return "Средняя гарантия по рынку — 5-10 лет. Мы даём 12 лет письменно. За 15 лет работы — ни одного гарантийного случая.";
  if (s.includes("монтаж") || s.includes("установ")) return "Обычно компании делают за 1-3 дня. Мы — за 3-5 часов на одну комнату. Квартира целиком — 1 день.";
  if (s.includes("конкурент") || s.includes("сравн")) return "Я анализирую 50+ компаний Москвы. Наши цены на 15-20% ниже среднерыночных, а гарантия — одна из лучших на рынке (12 лет).";
  return "Отличный вопрос! Я знаю рынок натяжных потолков Москвы вдоль и поперёк. Спросите о ценах, материалах, гарантии или сроках — дам честное сравнение.";
}
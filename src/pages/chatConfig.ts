import func2url from "@/../backend/func2url.json";

export type Panel = "none" | "production" | "portfolio" | "tips" | "reviews" | "faq" | "contacts" | "booking" | "livechat" | "other";

export interface EstimateItem {
  name: string;
  qty: number;
  price: number;
  unit?: string;
  group?: string;
}

export interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  items?: EstimateItem[];
}

export const AVATAR = "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/60e2335c-4916-41e5-b894-7f4d9ca6a923.jpg";

export const AI_URL = func2url["ai-chat"];

export const GREETING: Msg = {
  id: 0,
  role: "assistant",
  text: "Привет! Я Женя — ваш персональный консультант по натяжным потолкам 👋\n\nЗнаю предложения 50+ компаний Москвы и МО. Спросите что угодно — найду лучшую цену, сравню варианты и рассчитаю стоимость.",
};

export const NAV: { id: Panel; label: string; icon: string; hint: string }[] = [
  { id: "booking",    label: "Заказать",     icon: "CalendarCheck", hint: "Записаться на бесплатный замер и 3D-проект"     },
  { id: "production", label: "Производство", icon: "Factory",       hint: "Собственное производство в Мытищах с 2009 года" },
  { id: "portfolio",  label: "Портфолио",    icon: "Image",         hint: "Фото готовых работ — квартиры, офисы, дома"     },
  { id: "other",      label: "Другое",       icon: "LayoutGrid",    hint: "Контакты, отзывы, советы и вопросы"             },
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
  { icon: "Phone",         label: "Телефон",      val: "+7 (977) 606-89-01",      href: "tel:+79776068901" },
  { icon: "Send",          label: "Telegram",     val: "Написать в Telegram",     href: "https://t.me/JoniKras" },
  { icon: "MessageSquare", label: "MAX",          val: "Написать в MAX",          href: "https://max.ru/u/f9LHodD0cOImGR_bXwRjzpNeWQv7qzBR-lP0W9lvbuzV8iU1J5lngmKBGgA" },
  { icon: "MessageCircle", label: "Чат на сайте", val: "Написать менеджеру",      href: "#livechat" },
  { icon: "MapPin",        label: "Адрес",        val: "Мытищи, Пограничная 24",  href: "#" },
  { icon: "Clock",         label: "Часы",         val: "Пн–Вс 8:00–22:00",       href: "#" },
];

export const PROD_FEATURES: { icon: string; label: string }[] = [
  { icon: "Award",     label: "Плёнка MSD Premium" },
  { icon: "Ruler",     label: "Точность до 1 мм"   },
  { icon: "FileCheck", label: "Сертификаты ISO"     },
  { icon: "Truck",     label: "Доставка за 1 день"  },
];

export const BOOKING_TIMES = ["9:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

export function localAnswer(_t: string): string {
  return "Секунду, связь чуть подвисла — попробуйте отправить сообщение ещё раз.";
}
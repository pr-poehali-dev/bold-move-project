import func2url from "@/../backend/func2url.json";

export type Panel = "none" | "production" | "portfolio" | "tips" | "reviews" | "faq" | "contacts";

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

export const NAV: { id: Panel; label: string; icon: string }[] = [
  { id: "production", label: "Производство", icon: "Factory"    },
  { id: "portfolio",  label: "Портфолио",    icon: "Image"      },
  { id: "tips",       label: "AI-советы",    icon: "Sparkles"   },
  { id: "reviews",    label: "Отзывы",       icon: "Heart"      },
  { id: "faq",        label: "FAQ",           icon: "HelpCircle" },
  { id: "contacts",   label: "Контакты",      icon: "Phone"      },
];

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

// ─── types ────────────────────────────────────────────────────────────────────
export type Section = "catalog" | "calc" | "portfolio" | "ai" | "reviews" | "faq" | "contacts";

// Re-export Msg and AI_URL from the canonical source
export type { Msg } from "./chatConfig";
export { AI_URL } from "./chatConfig";

// ─── menu config ──────────────────────────────────────────────────────────────
export const MENU: { id: Section; label: string; emoji: string; icon: string; hint: string }[] = [
  { id: "catalog",   label: "Каталог",     emoji: "📁", icon: "LayoutGrid",  hint: "Все виды потолков с ценами и фото"            },
  { id: "calc",      label: "Калькулятор", emoji: "🧮", icon: "Calculator",  hint: "Введите площадь — получите смету за секунду"  },
  { id: "portfolio", label: "Портфолио",   emoji: "🖼️", icon: "Image",       hint: "Фото наших работ — квартиры, офисы, дома"    },
  { id: "ai",        label: "AI-советы",   emoji: "🤖", icon: "Sparkles",    hint: "Готовые вопросы для умного расчёта"           },
  { id: "reviews",   label: "Отзывы",      emoji: "⭐", icon: "Star",        hint: "2800+ отзывов, рейтинг 4.9 на Яндексе"       },
  { id: "faq",       label: "FAQ",         emoji: "❓", icon: "HelpCircle",  hint: "Частые вопросы о монтаже и гарантии"          },
  { id: "contacts",  label: "Контакты",    emoji: "📞", icon: "Phone",       hint: "Телефон, WhatsApp, Telegram и адрес офиса"   },
];

export const FALLBACK = "Извините, сейчас помощник недоступен. Позвоните: +7 (977) 606-89-01";

// ─── AI responses (fallback) ──────────────────────────────────────────────────
export function localAnswer(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("привет") || t.includes("здравств")) return "Здравствуйте! Чем могу помочь?";
  if (t.includes("каталог")) return "Посмотрите каталог в панели ниже — там все виды потолков с ценами!";
  if (t.includes("калькулятор") || t.includes("рассч")) return "Используйте калькулятор в нижней панели — введите площадь и получите цену!";
  if (t.includes("цена") || t.includes("стоим") || t.includes("сколько")) return "Цены от 249 ₽/м². Точный расчёт сделаю через калькулятор — откройте его в меню ниже.";
  if (t.includes("гарантия")) return "Даём письменную гарантию 12 лет на все виды потолков.";
  if (t.includes("монтаж") || t.includes("установ")) return "Монтаж одной комнаты занимает 3–5 часов. Работаем по Москве и области.";
  return "Спасибо за вопрос! Изучите наши разделы через меню ниже — там вся информация о потолках, ценах и примерах работ.";
}
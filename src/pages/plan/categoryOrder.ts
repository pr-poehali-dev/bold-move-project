// Единый порядок категорий: используется везде — в материалах, PDF, сметах
// Порядок: Полотна → Профили → Парящие/Теневые → Закладные → Освещение → Остальное → Монтаж

export const CATEGORY_ORDER: string[] = [
  "Полотна",
  "Профиль стандартный",
  "Теневой профиль",
  "Парящий профиль",
  "Ниши для штор",
  "Двухуровневые",
  "Закладные",
  "Освещение",
  "Вентиляция",
  "Вставки и заглушки",
  "Углы и заглушки",
  "Дополнительно",
  // Монтаж — всегда последний
  "Монтаж",
];

/** Сортирует массив категорий по заданному порядку. Неизвестные — перед Монтажом. */
export function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    const wa = ia === -1 ? CATEGORY_ORDER.indexOf("Монтаж") - 0.5 : ia;
    const wb = ib === -1 ? CATEGORY_ORDER.indexOf("Монтаж") - 0.5 : ib;
    if (wa !== wb) return wa - wb;
    return a.localeCompare(b, "ru");
  });
}

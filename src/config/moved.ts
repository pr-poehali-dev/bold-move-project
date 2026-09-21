/**
 * Настройки заглушки «Проект переехал».
 *
 * Одно место, где это включается и выключается — чтобы вернуть сайт обратно
 * не нужно было искать правки по всему коду.
 *
 * SHOW_MOVED_BANNER = false → сайт работает как раньше, заглушки нет.
 */
export const SHOW_MOVED_BANNER = true;

/** Адрес нового расположения проекта */
export const MOVED_URL = "https://ai-potolki.ru/crm";

/**
 * Адреса, на которых заглушка НЕ показывается.
 *
 * ⚠️ Сюда обязательно входит адрес самого переезда (/crm): если закрыть и его,
 * кнопка «Перейти на новый адрес» вела бы снова на заглушку — пользователь
 * попал бы в замкнутый круг без выхода.
 *
 * Остальные пути — служебные: ссылки, которыми уже поделились с клиентами,
 * и возвраты после входа через Google/Яндекс/Авито. Если их закрыть, у людей
 * сломаются рабочие ссылки и вход в систему.
 */
export const MOVED_ALLOWED_PATHS = [
  "/crm",
  "/plan-share",
  "/order-share",
  "/auth/google/callback",
  "/auth/yandex/callback",
  "/auth/avito/callback",
];

/** Показывать ли заглушку на этом адресе */
export function isMovedBannerVisible(pathname: string): boolean {
  if (!SHOW_MOVED_BANNER) return false;
  const path = (pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  return !MOVED_ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/"),
  );
}

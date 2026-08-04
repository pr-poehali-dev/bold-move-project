// ── Единая работа со временем: вся CRM живёт в часовом поясе МОСКВА ───────────
// Проблема была в несогласованности: время записывалось без пояса, а показывалось
// с переводом в локальный пояс устройства → сдвиг ±3 часа. Здесь всё приведено к
// одному правилу: пользователь вводит и видит МОСКОВСКОЕ время, где бы он ни был.

const TZ = "Europe/Moscow";

// Смещение московского пояса в минутах для конкретного момента (обычно +180).
// Берём через Intl, чтобы не зависеть от возможных будущих переводов часов.
function moscowOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - at.getTime()) / 60000);
}

function pad(n: number) { return String(n).padStart(2, "0"); }

// Пользователь выбрал в пикере "часы:минуты" (в своей голове — по Москве).
// Собираем ISO-строку с явной московской зоной (+03:00), чтобы сервер сохранил
// именно тот момент, который человек имел в виду.
export function toMoscowIso(year: number, month0: number, day: number, hour: number, minute: number): string {
  // Оценка момента, чтобы вычислить корректное смещение (учёт возможного DST — у РФ его нет, но безопасно)
  const approx = new Date(Date.UTC(year, month0, day, hour, minute) - 180 * 60000);
  const off = moscowOffsetMinutes(approx);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const offStr = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return `${year}-${pad(month0 + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offStr}`;
}

// Парсит ISO из БД. Если в строке НЕТ пояса — трактуем её как московское время
// (сервер отдаёт psycopg2-строки вида "2026-08-08 14:21:00+00:00" с зоной, но
// подстрахуемся и для строк без зоны, чтобы не было двойного сдвига).
function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso.trim());
  if (hasTz) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  // Нет зоны → считаем как московское. Заменяем пробел на T и добавляем +03:00.
  const norm = iso.trim().replace(" ", "T");
  const d = new Date(`${norm}+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

// Дата+время: "8 авг, 14:21" (в московском поясе)
export function fmtMoscowDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "";
  return d.toLocaleString("ru-RU", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Только время: "14:21" (московское)
export function fmtMoscowTime(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "";
  return d.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

// Только дата: "8 авг" (московская)
export function fmtMoscowDateShort(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "";
  return d.toLocaleDateString("ru-RU", { timeZone: TZ, day: "numeric", month: "short" });
}

// Компоненты московской даты (для фильтрации событий по дню календаря)
export function moscowDateParts(iso: string | null | undefined): { day: number; month: number; year: number } | null {
  const d = parse(iso);
  if (!d) return null;
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = dtf.formatToParts(d);
  const get = (t: string) => Number(p.find(x => x.type === t)?.value);
  return { day: get("day"), month: get("month"), year: get("year") };
}

// Текущий момент, отформатированный как московское дата+время (для лога активности)
export function nowMoscowLabel(): string {
  return fmtMoscowDateTime(new Date().toISOString());
}

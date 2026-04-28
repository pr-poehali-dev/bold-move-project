/**
 * Простая, но строгая валидация email.
 * Принимает: что-то@что-то.домен (с минимум двумя символами после точки).
 */
export function isEmailValid(email: string): boolean {
  const v = (email || "").trim();
  if (!v) return false;
  // Базовый шаблон: локальная часть, @, домен с TLD ≥ 2 символов
  const re = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return re.test(v);
}

export { isPhoneValid, formatPhone } from "@/hooks/use-phone";

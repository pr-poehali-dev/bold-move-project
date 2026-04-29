/** Утилиты маски и валидации телефона для CRM-компонентов */

export function applyPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("8") ? "7" + digits.slice(1)
          : digits.startsWith("7") ? digits
          : digits.length > 0 ? "7" + digits
          : "";
  if (!d) return "";
  const p = d.slice(1);
  let result = "+7";
  if (p.length > 0) result += " (" + p.slice(0, 3);
  if (p.length >= 3) result += ") " + p.slice(3, 6);
  if (p.length >= 6) result += "-" + p.slice(6, 8);
  if (p.length >= 8) result += "-" + p.slice(8, 10);
  return result;
}

export function isPhoneValid(masked: string): boolean {
  return masked.replace(/\D/g, "").length === 11;
}

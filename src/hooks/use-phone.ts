import { useState, useCallback } from "react";

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("7") ? digits.slice(1) : digits.startsWith("8") ? digits.slice(1) : digits;
  const n = d.slice(0, 10);
  if (n.length === 0) return "";
  if (n.length <= 3) return `+7 (${n}`;
  if (n.length <= 6) return `+7 (${n.slice(0, 3)}) ${n.slice(3)}`;
  if (n.length <= 8) return `+7 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  return `+7 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}`;
}

export function isPhoneValid(formatted: string): boolean {
  return formatted.replace(/\D/g, "").length === 11;
}

export function usePhone(initial = "") {
  // Если initial — пустая строка маски "+7 (" — оставляем её как есть, чтобы маска была видна сразу.
  const [phone, setPhoneRaw] = useState(() => {
    if (!initial) return "";
    if (initial === "+7 (") return "+7 (";
    return formatPhone(initial);
  });

  const setPhone = useCallback((val: string) => {
    setPhoneRaw(formatPhone(val));
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Если стёрли всё до "+7 (" или меньше — сбрасываем в пустую строку
    if (val.replace(/\D/g, "").length <= 1) {
      setPhoneRaw("");
    } else {
      setPhoneRaw(formatPhone(val));
    }
  }, []);

  const handleFocus = useCallback(() => {
    setPhoneRaw((prev) => prev || "+7 (");
  }, []);

  const handleBlur = useCallback(() => {
    // Маска "+7 (" остаётся видимой даже при пустом значении — это требование UX.
  }, []);

  return { phone, setPhone, handleChange, handleFocus, handleBlur, isValid: isPhoneValid(phone) };
}
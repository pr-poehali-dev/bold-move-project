import { TOKEN_KEY } from "@/context/useAuthInit";

// Заголовки с токеном текущего пользователя — для запросов в мастер-админку.
// Backend проверяет через check_is_master, что это реально мастер-аккаунт.
export function masterHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  return { "X-Authorization": `Bearer ${token}`, ...extra };
}

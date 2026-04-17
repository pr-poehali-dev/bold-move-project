import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  const t = token ?? "";
  const method = (opts?.method || "GET").toUpperCase();
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  if (t) url += `&_token=${encodeURIComponent(t)}`;

  if (method === "GET") {
    return fetch(url);
  }

  // POST/PUT/DELETE: отправляем как POST с text/plain — НЕ вызывает preflight
  // Метод передаём в URL, тело как есть
  url += `&_method=${method}`;
  return fetch(url, {
    method: "POST",
    body: opts?.body,
    // НЕ ставим Content-Type: application/json — это вызывает preflight
    // text/plain или без заголовка — preflight не нужен
  });
}
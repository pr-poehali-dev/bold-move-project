import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  const t = token ?? "";
  const method = (opts?.method || "GET").toUpperCase();
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  if (t) url += `&_token=${encodeURIComponent(t)}`;
  // Метод передаём через URL чтобы не было preflight
  if (method !== "GET") url += `&_method=${method}`;

  // Данные передаём через URL параметр — полностью избегаем preflight
  if (opts?.body) {
    url += `&_body=${encodeURIComponent(opts.body as string)}`;
  }

  // Всегда GET — нет preflight, нет CORS проблем
  return fetch(url);
}
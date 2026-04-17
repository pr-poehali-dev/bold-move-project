import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  const method = (opts?.method || "GET").toUpperCase();
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  if (token) url += `&_token=${encodeURIComponent(token)}`;
  if (method !== "GET") url += `&_method=${method}`;

  // Все запросы — простой fetch без кастомных заголовков = нет preflight = нет CORS
  return fetch(url, method === "GET" ? undefined : { method: "POST", body: opts?.body });
}
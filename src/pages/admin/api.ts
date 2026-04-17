import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  const t = token ?? "";
  const method = (opts?.method || "GET").toUpperCase();
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  if (t) url += `&_token=${encodeURIComponent(t)}`;

  if (method === "GET") {
    // GET — нет preflight, нет кастомных заголовков
    return fetch(url);
  }

  // POST/PUT/DELETE — данные кладём в URL как base64 чтобы избежать preflight
  const body = opts?.body ? btoa(unescape(encodeURIComponent(opts.body as string))) : "";
  const fullUrl = body ? `${url}&_body=${encodeURIComponent(body)}` : url;
  return fetch(fullUrl, { method });
}

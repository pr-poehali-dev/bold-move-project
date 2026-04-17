import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  const t = token ?? "";
  const method = (opts?.method || "GET").toUpperCase();
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  if (t) url += `&_token=${encodeURIComponent(t)}`;

  // Все запросы делаем простыми (no preflight):
  // GET — без body и заголовков
  // POST/PUT/DELETE — body в параметре _body (base64), Content-Type не ставим
  if (method === "GET") {
    return fetch(url);
  }

  let bodyParam = "";
  if (opts?.body) {
    try {
      bodyParam = encodeURIComponent(btoa(unescape(encodeURIComponent(opts.body as string))));
    } catch {
      bodyParam = encodeURIComponent(opts.body as string);
    }
  }

  return fetch(bodyParam ? `${url}&_body=${bodyParam}` : url, { method });
}

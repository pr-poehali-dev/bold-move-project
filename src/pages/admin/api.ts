import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  // Берём токен из localStorage если не передан явно
  const t = token ?? localStorage.getItem("admin_token") ?? "";
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { "X-Admin-Token": t } : {}),
      ...(opts?.headers || {}),
    },
  });
  return res;
}
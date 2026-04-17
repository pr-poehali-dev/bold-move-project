import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  // Для login не добавляем токен (его ещё нет)
  const isLogin = resource === "login";
  const t = isLogin ? "" : (token ?? localStorage.getItem("admin_token") ?? "");
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
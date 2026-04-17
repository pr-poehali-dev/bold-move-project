import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export async function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number) {
  const isLogin = resource === "login";
  const t = isLogin ? "" : (token ?? localStorage.getItem("admin_token") ?? "");
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  // Передаём токен через query-параметр чтобы избежать CORS preflight
  if (t) url += `&_token=${encodeURIComponent(t)}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  return res;
}
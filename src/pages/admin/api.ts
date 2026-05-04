import func2url from "@/../backend/func2url.json";

const BASE = (func2url as Record<string, string>)["parse-xlsx"];

export function apiFetch(resource: string, opts?: RequestInit, token?: string, id?: number, userToken?: string) {
  let url = `${BASE}?r=${resource}`;
  if (id !== undefined) url += `&id=${id}`;
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Admin-Token": token } : {}),
      ...(userToken ? { "Authorization": userToken } : {}),
      ...(opts?.headers || {}),
    },
  });
}
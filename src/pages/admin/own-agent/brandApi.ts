import func2url from "@/../backend/func2url.json";
import type { Brand } from "@/context/AuthContext";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const CRM_URL  = (func2url as Record<string, string>)["crm-manager"];

function authHeaders(token: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-Authorization": `Bearer ${token}` } : {}),
  };
}

export async function updateBrand(token: string | null, brand: Brand): Promise<void> {
  const res = await fetch(`${AUTH_URL}?action=update-brand`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify(brand),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось сохранить бренд");
}

/** Загрузка изображения (логотип/аватар) в S3 через crm-manager. Возвращает CDN url. */
export async function uploadBrandImage(token: string | null, file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve((fr.result as string).split(",")[1] ?? "");
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const res = await fetch(`${CRM_URL}?r=upload`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({
      data: base64,
      filename: file.name,
      content_type: file.type || "image/png",
    }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось загрузить файл");
  return d.url as string;
}

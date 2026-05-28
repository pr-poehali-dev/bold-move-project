import func2url from "@/../backend/func2url.json";

export const UPLOAD_URL = (func2url as Record<string, string>)["parse-xlsx"];

export function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function uploadFaqImage(token: string, file: File): Promise<string> {
  const b64 = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload  = () => res((fr.result as string).split(",")[1] ?? "");
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const r = await fetch(`${UPLOAD_URL}?r=faq-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ data: b64, content_type: file.type || "image/jpeg" }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || "Ошибка загрузки");
  return d.url as string;
}

export async function searchProductImages(token: string, productName: string, limit = 5): Promise<string[]> {
  const query = productName;
  const r = await fetch(`${UPLOAD_URL}?r=faq-search-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ query, limit }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || "Ошибка поиска картинок");
  return (d.urls as string[]) ?? [];
}
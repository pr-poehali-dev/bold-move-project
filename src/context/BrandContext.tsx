import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

/**
 * Бренд страницы — либо подгруженный по ?c=ID, либо дефолтный (mospotolki).
 * Если ?c=ID присутствует, но компания не имеет активной услуги — используется дефолт.
 */
export interface Brand {
  company_id?:         number | null;
  company_name?:       string | null;
  bot_name:            string;
  bot_greeting:        string;
  bot_avatar_url:      string;
  brand_logo_url:      string;
  brand_color:         string;
  support_phone:       string;
  support_email?:      string | null;
  telegram_url:        string;
  max_url:             string;
  website?:            string | null;
  working_hours:       string;
  pdf_footer_address?: string | null;
}

/** Дефолтные значения (как было до white-label). */
export const DEFAULT_BRAND: Brand = {
  company_id:    null,
  company_name:  "MOSPOTOLKI",
  bot_name:      "Женя",
  bot_greeting:  "Привет! Я Женя — ваш персональный консультант по натяжным потолкам 👋\n\nЗнаю предложения 50+ компаний Москвы и МО. Спросите что угодно — найду лучшую цену, сравню варианты и рассчитаю стоимость.",
  bot_avatar_url: "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/60e2335c-4916-41e5-b894-7f4d9ca6a923.jpg",
  brand_logo_url: "https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png",
  brand_color:    "#f97316",
  support_phone:  "+7 (977) 606-89-01",
  support_email:  null,
  telegram_url:   "https://t.me/JoniKras",
  max_url:        "https://max.ru/u/f9LHodD0cOImGR_bXwRjzpNeWQv7qzBR-lP0W9lvbuzV8iU1J5lngmKBGgA",
  website:        "mospotolki.net",
  working_hours:  "Ежедневно 8:00–22:00",
  pdf_footer_address: null,
};

interface BrandCtx {
  brand: Brand;
  loading: boolean;
  isCustom: boolean;        // true, если это бренд компании (не дефолт)
}

const Ctx = createContext<BrandCtx>({ brand: DEFAULT_BRAND, loading: false, isCustom: false });

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand,   setBrand]   = useState<Brand>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("c");
    if (!cid) return;

    setLoading(true);
    fetch(`${AUTH_URL}?action=get-brand&company_id=${encodeURIComponent(cid)}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.brand) return; // компания без активного «Свой агент» → остаётся дефолт
        const b = d.brand as Partial<Brand> & { telegram?: string };
        // Мерджим с дефолтом — пустые/null поля не перетирают дефолт
        const merged: Brand = {
          ...DEFAULT_BRAND,
          company_id:    b.company_id ?? Number(cid),
          company_name:  nonEmpty(b.company_name)  ?? DEFAULT_BRAND.company_name,
          bot_name:      nonEmpty(b.bot_name)      ?? DEFAULT_BRAND.bot_name,
          bot_greeting:  nonEmpty(b.bot_greeting)  ?? DEFAULT_BRAND.bot_greeting,
          bot_avatar_url: nonEmpty(b.bot_avatar_url) ?? DEFAULT_BRAND.bot_avatar_url,
          brand_logo_url: nonEmpty(b.brand_logo_url) ?? DEFAULT_BRAND.brand_logo_url,
          brand_color:    nonEmpty(b.brand_color)    ?? DEFAULT_BRAND.brand_color,
          support_phone:  nonEmpty(b.support_phone)  ?? DEFAULT_BRAND.support_phone,
          support_email:  nonEmpty(b.support_email)  ?? null,
          telegram_url:   normalizeTelegram(b.telegram) ?? DEFAULT_BRAND.telegram_url,
          max_url:        nonEmpty(b.max_url)         ?? DEFAULT_BRAND.max_url,
          website:        nonEmpty(b.website)         ?? null,
          working_hours:  nonEmpty(b.working_hours)   ?? DEFAULT_BRAND.working_hours,
          pdf_footer_address: nonEmpty(b.pdf_footer_address) ?? null,
        };
        setBrand(merged);
        setIsCustom(true);
      })
      .catch(() => { /* остаётся дефолт */ })
      .finally(() => setLoading(false));
  }, []);

  // Применяем CSS-переменную --brand-color на корневой документ
  useEffect(() => {
    document.documentElement.style.setProperty("--brand-color", brand.brand_color);
  }, [brand.brand_color]);

  return (
    <Ctx.Provider value={{ brand, loading, isCustom }}>
      {children}
    </Ctx.Provider>
  );
}

function nonEmpty(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeTelegram(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t.trim();
  if (!s) return null;
  if (s.startsWith("http")) return s;
  // "@username" или "username"
  const username = s.replace(/^@/, "");
  return `https://t.me/${username}`;
}

export const useBrand = () => useContext(Ctx);

import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Brand } from "@/context/AuthContext";
import { updateBrand } from "./brandApi";
import BrandPreview from "./BrandPreview";
import { CopyLink } from "./OwnAgentFields";
import {
  SectionCompany,
  SectionBot,
  SectionVisual,
  SectionContacts,
  SectionPdf,
} from "./OwnAgentSections";
import func2url from "@/../backend/func2url.json";

const PARSE_SITE_URL = (func2url as Record<string, string>)["parse-site"];
const AUTH_URL_F     = (func2url as Record<string, string>)["auth"];

interface Props { isDark: boolean }

export default function OwnAgentEditor({ isDark }: Props) {
  const { user, token, updateUser } = useAuth();

  const [brand, setBrand] = useState<Brand>({
    bot_name:           user?.brand?.bot_name           ?? "",
    bot_greeting:       user?.brand?.bot_greeting       ?? "",
    bot_avatar_url:     user?.brand?.bot_avatar_url     ?? "",
    brand_logo_url:     user?.brand?.brand_logo_url     ?? "",
    brand_logo_url_dark:    user?.brand?.brand_logo_url_dark    ?? "",
    brand_logo_orientation: user?.brand?.brand_logo_orientation ?? "horizontal",
    pdf_logo_bg:        user?.brand?.pdf_logo_bg        ?? "auto",
    brand_color:        user?.brand?.brand_color        ?? "#f97316",
    support_phone:      user?.brand?.support_phone      ?? "",
    support_email:      user?.brand?.support_email      ?? "",
    max_url:            user?.brand?.max_url            ?? "",
    working_hours:      user?.brand?.working_hours      ?? "Ежедневно 9:00–22:00",
    pdf_footer_address: user?.brand?.pdf_footer_address ?? "",
    telegram_url:       user?.brand?.telegram_url       ?? "",
    pdf_text_color:     user?.brand?.pdf_text_color     ?? "#111827",
  });

  // Профиль (название компании и сайт) — отдельно через update-profile
  const [companyName, setCompanyName] = useState(user?.company_name ?? "");
  const [website,     setWebsite]     = useState(user?.website ?? "");

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  // AI-дозаполнение полей
  const [aiAttempts, setAiAttempts] = useState<Record<string, number>>({});
  const [aiBusy,     setAiBusy]     = useState<Record<string, boolean>>({});

  // Маппинг: поле Brand → поле в ответе parse-site
  const AI_FIELD_MAP: Record<string, keyof Brand> = {
    support_phone:      "support_phone",
    support_email:      "support_email",
    telegram_url:       "telegram_url",
    pdf_footer_address: "pdf_footer_address",
    working_hours:      "working_hours",
  };

  const runAi = async (field: string) => {
    const attempts = aiAttempts[field] || 0;
    if (attempts >= 2) return;
    const siteUrl = website || user?.website || "";
    if (!siteUrl) return;
    setAiBusy(p => ({ ...p, [field]: true }));
    try {
      const r = await fetch(PARSE_SITE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ url: siteUrl }),
      });
      const d = await r.json();
      const parseField = field === "telegram_url" ? "telegram" : field;
      const val = d.brand?.[parseField] || d.brand?.[field];
      if (val) {
        const brandKey = AI_FIELD_MAP[field];
        if (brandKey) {
          set(brandKey, val);
          await fetch(`${AUTH_URL_F}?action=update-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
            body: JSON.stringify({ [field]: val }),
          }).catch(() => {});
        }
      }
      setAiAttempts(p => ({ ...p, [field]: attempts + 1 }));
    } catch {
      setAiAttempts(p => ({ ...p, [field]: attempts + 1 }));
    } finally {
      setAiBusy(p => ({ ...p, [field]: false }));
    }
  };

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setBrand(b => ({ ...b, [k]: v }));

  const save = async () => {
    setErr(""); setSaved(false); setSaving(true);
    try {
      await updateBrand(token, brand);
      const profileChanged = (companyName !== (user?.company_name ?? "")) || (website !== (user?.website ?? ""));
      if (profileChanged) {
        const { default: func2url } = await import("@/../backend/func2url.json");
        const AUTH_URL = (func2url as Record<string, string>)["auth"];
        const res = await fetch(`${AUTH_URL}?action=update-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            name:         user?.name || "",
            phone:        user?.phone || "",
            company_name: companyName,
            company_inn:  user?.company_inn || "",
            company_addr: user?.company_addr || "",
            website:      website,
            telegram:     user?.telegram || "",
          }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error || "Ошибка сохранения профиля");
      }
      updateUser({ brand, company_name: companyName, website });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const text  = isDark ? "#fff" : "#0f1623";
  const muted = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const link  = `${window.location.origin}/?c=${user?.id}`;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5" style={{ color: text }}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6">

        {/* ─── Левая колонка: форма ─── */}
        <div className="min-w-0">

          {/* Шапка */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black">Свой агент</h1>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                  style={{ background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.32)" }}>
                  Активирован
                </span>
              </div>
              <div className="text-[12px]" style={{ color: muted }}>
                Настройте имя бота, контакты и логотип — всё подменится у клиентов
              </div>
            </div>
            <CopyLink link={link} isDark={isDark} />
          </div>

          <SectionCompany
            companyName={companyName} setCompanyName={setCompanyName}
            website={website} setWebsite={setWebsite}
            runAi={runAi} aiAttempts={aiAttempts} aiBusy={aiBusy}
            isDark={isDark}
          />

          <SectionBot brand={brand} set={set} token={token}
            website={website} runAi={runAi} aiAttempts={aiAttempts} aiBusy={aiBusy}
            isDark={isDark} />

          <SectionVisual brand={brand} set={set} token={token}
            website={website} runAi={runAi} aiAttempts={aiAttempts} aiBusy={aiBusy}
            isDark={isDark} />

          <SectionContacts
            brand={brand} set={set}
            website={website} runAi={runAi}
            aiAttempts={aiAttempts} aiBusy={aiBusy}
            isDark={isDark}
          />

          <SectionPdf
            brand={brand} set={set}
            website={website} runAi={runAi}
            aiAttempts={aiAttempts} aiBusy={aiBusy}
            isDark={isDark}
          />

          {/* Сохранить */}
          {err && (
            <div className="rounded-xl px-3.5 py-2.5 mb-3 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}

          <div className="sticky bottom-0 pt-3 pb-1"
            style={{ background: isDark ? "linear-gradient(to top, #07070f 60%, transparent)" : "linear-gradient(to top, #eef0f6 60%, transparent)" }}>
            <button onClick={save} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: saved ? "#10b981" : "#7c3aed" }}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
                : saved
                ? <><Icon name="CheckCircle2" size={14} /> Сохранено</>
                : <><Icon name="Save" size={14} /> Сохранить настройки бренда</>}
            </button>
          </div>
        </div>

        {/* ─── Правая колонка: превью ─── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <BrandPreview brand={brand} isDark={isDark} />
        </div>

      </div>
    </div>
  );
}
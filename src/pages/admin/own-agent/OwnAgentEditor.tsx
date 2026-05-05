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
import { SectionNav } from "./SectionNav";
import func2url from "@/../backend/func2url.json";

const PARSE_SITE_URL = (func2url as Record<string, string>)["parse-site"];
const AUTH_URL_F     = (func2url as Record<string, string>)["auth"];

interface Props { isDark: boolean }

export default function OwnAgentEditor({ isDark }: Props) {
  const { user, token, updateUser } = useAuth();

  // Если контакты пустые — автоподставляем из профиля (телефон из user.phone)
  const _phone = user?.brand?.support_phone || user?.phone || "";
  const [brand, setBrand] = useState<Brand>({
    bot_name:           user?.brand?.bot_name           ?? "",
    bot_greeting:       user?.brand?.bot_greeting       ?? "",
    bot_avatar_url:     user?.brand?.bot_avatar_url     ?? "",
    brand_logo_url:     user?.brand?.brand_logo_url     ?? "",
    brand_logo_url_dark:    user?.brand?.brand_logo_url_dark    ?? "",
    brand_logo_orientation: user?.brand?.brand_logo_orientation ?? "horizontal",
    pdf_logo_bg:        user?.brand?.pdf_logo_bg        ?? "auto",
    brand_color:        user?.brand?.brand_color        ?? "#f97316",
    support_phone:      _phone,
    support_email:      user?.brand?.support_email      ?? "",
    max_url:            user?.brand?.max_url            ?? "",
    working_hours:      user?.brand?.working_hours      ?? "",
    pdf_footer_address: user?.brand?.pdf_footer_address ?? user?.company_addr ?? "",
    telegram_url:       user?.brand?.telegram_url       ?? "",
    pdf_text_color:     user?.brand?.pdf_text_color     ?? "#111827",
  });

  // Профиль (название компании и сайт) — отдельно через update-profile
  const [companyName, setCompanyName] = useState(user?.company_name ?? "");
  const [website,     setWebsite]     = useState(user?.website ?? "");

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  // Telegram интеграция
  const [tgToken,  setTgToken]  = useState(user?.tg_bot_token      ?? "");
  const [tgChat,   setTgChat]   = useState(user?.tg_notify_chat_id ?? "");
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<"ok" | "err" | null>(null);

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

  const testTelegram = async () => {
    if (!tgToken || !tgChat) return;
    setTgTesting(true); setTgTestResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: "✅ Интеграция работает! Уведомления о заявках будут приходить сюда.", parse_mode: "HTML" }),
      });
      const d = await res.json();
      setTgTestResult(d.ok ? "ok" : "err");
    } catch {
      setTgTestResult("err");
    } finally {
      setTgTesting(false);
    }
  };

  const save = async () => {
    setErr(""); setSaved(false); setSaving(true);
    try {
      await updateBrand(token, { ...brand, tg_bot_token: tgToken || null, tg_notify_chat_id: tgChat || null } as Brand);
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
                {(() => {
                  const trialUntil = user?.trial_until ? new Date(user.trial_until) : null;
                  const isTrial = trialUntil && !user?.agent_purchased_at;
                  const trialDaysLeft = isTrial ? Math.max(0, Math.ceil((trialUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
                  if (isTrial && trialDaysLeft > 0) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                        style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.32)" }}>
                        Триал · {trialDaysLeft} дн.
                      </span>
                    );
                  }
                  if (isTrial && trialDaysLeft === 0) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                        style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.32)" }}>
                        Триал истёк
                      </span>
                    );
                  }
                  return (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                      style={{ background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.32)" }}>
                      Активирован
                    </span>
                  );
                })()}
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

          <SectionNav
            value={brand.nav_config}
            onChange={v => set("nav_config", v)}
            isDark={isDark}
          />

          {/* Интеграция с Telegram */}
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(96,165,250,0.15)" }}>
                <Icon name="Send" size={14} style={{ color: "#60a5fa" }} />
              </div>
              <div>
                <div className="text-sm font-black" style={{ color: text }}>Интеграция с Telegram</div>
                <div className="text-[11px]" style={{ color: muted }}>Новые заявки будут приходить в ваш бот</div>
              </div>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: muted }}>
                  Токен бота <span className="font-normal opacity-60">(получить у @BotFather)</span>
                </label>
                <input
                  value={tgToken}
                  onChange={e => setTgToken(e.target.value)}
                  placeholder="7123456789:AAF..."
                  className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    color: text,
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: muted }}>
                  ID чата или группы <span className="font-normal opacity-60">(узнать у @userinfobot)</span>
                </label>
                <input
                  value={tgChat}
                  onChange={e => setTgChat(e.target.value)}
                  placeholder="-1001234567890 или @username"
                  className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    color: text,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={testTelegram}
                  disabled={!tgToken || !tgChat || tgTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
                  {tgTesting
                    ? <><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Проверка...</>
                    : <><Icon name="Zap" size={11} /> Проверить</>}
                </button>
                {tgTestResult === "ok" && (
                  <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
                    <Icon name="CheckCircle2" size={12} /> Сообщение отправлено!
                  </span>
                )}
                {tgTestResult === "err" && (
                  <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <Icon name="AlertTriangle" size={12} /> Ошибка — проверьте токен и ID чата
                  </span>
                )}
              </div>
            </div>
          </div>

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
          <BrandPreview brand={brand} isDark={isDark} companyName={companyName} />
        </div>

      </div>
    </div>
  );
}
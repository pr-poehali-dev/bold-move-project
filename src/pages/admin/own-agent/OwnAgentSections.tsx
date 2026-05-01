import type { Brand } from "@/context/AuthContext";
import {
  Section, Field, AiFieldBtn, ChoiceField,
  PhoneField, ColorField, ImageUploader,
} from "./OwnAgentFields";

interface CommonProps { isDark: boolean }

// ── SectionCompany ────────────────────────────────────────────────────────────
export function SectionCompany({ companyName, setCompanyName, website, setWebsite, isDark }: {
  companyName: string; setCompanyName: (v: string) => void;
  website: string;     setWebsite:     (v: string) => void;
} & CommonProps) {
  return (
    <Section title="Компания" icon="Building2" isDark={isDark}>
      <Field label="Название компании" placeholder="ООО «Ваша компания»"
        value={companyName} onChange={setCompanyName} isDark={isDark} />
      <Field label="Сайт" placeholder="yourcompany.ru"
        value={website} onChange={setWebsite} isDark={isDark} />
    </Section>
  );
}

// ── SectionBot ────────────────────────────────────────────────────────────────
export function SectionBot({ brand, set, token, isDark }: {
  brand: Brand; set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  token: string | null;
} & CommonProps) {
  return (
    <Section title="Бот" icon="Bot" isDark={isDark}>
      <Field label="Имя бота" placeholder="Например: Анна, Максим, Алина"
        value={brand.bot_name || ""} onChange={v => set("bot_name", v)} isDark={isDark} />
      <Field label="Приветствие" multiline rows={3}
        placeholder="Привет! Я Анна — консультант компании «...». Расскажу о потолках, помогу выбрать и рассчитаю стоимость."
        value={brand.bot_greeting || ""} onChange={v => set("bot_greeting", v)} isDark={isDark} />
      <ImageUploader label="Аватар бота" hint="Квадрат 200×200, PNG/JPG"
        value={brand.bot_avatar_url || ""} onChange={v => set("bot_avatar_url", v)}
        token={token} isDark={isDark} />
    </Section>
  );
}

// ── SectionVisual ─────────────────────────────────────────────────────────────
export function SectionVisual({ brand, set, token, isDark }: {
  brand: Brand; set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  token: string | null;
} & CommonProps) {
  return (
    <Section title="Визуал" icon="Palette" isDark={isDark}>
      <ColorField label="Цвет акцента" value={brand.brand_color || "#f97316"}
        onChange={v => set("brand_color", v)} isDark={isDark} />

      <ChoiceField label="Ориентация логотипа"
        value={brand.brand_logo_orientation || "horizontal"}
        options={[
          { val: "horizontal", label: "Горизонтальный", icon: "RectangleHorizontal" },
          { val: "vertical",   label: "Квадратный",     icon: "Square" },
        ]}
        onChange={v => set("brand_logo_orientation", v)} isDark={isDark} />

      <ImageUploader label="Логотип для светлой подложки (тёмный)"
        hint="PNG с прозрачным фоном, до 1 МБ"
        value={brand.brand_logo_url || ""} onChange={v => set("brand_logo_url", v)}
        token={token} isDark={isDark}
        onOrientationDetected={o => set("brand_logo_orientation", o)} />

      <ImageUploader label="Логотип для тёмной подложки (светлый)"
        hint="Опционально. Используется когда подложка тёмная"
        value={brand.brand_logo_url_dark || ""} onChange={v => set("brand_logo_url_dark", v)}
        token={token} isDark={isDark} />

      <ChoiceField label="Подложка логотипа в PDF"
        value={brand.pdf_logo_bg || "auto"}
        options={[
          { val: "auto",        label: "Авто",       icon: "Sparkles" },
          { val: "transparent", label: "Прозрачная", icon: "EyeOff" },
          { val: "white",       label: "Белая",      icon: "Sun" },
          { val: "dark",        label: "Тёмная",     icon: "Moon" },
        ]}
        onChange={v => set("pdf_logo_bg", v)} isDark={isDark} />
    </Section>
  );
}

// ── SectionContacts ───────────────────────────────────────────────────────────
export function SectionContacts({ brand, set, website, runAi, aiAttempts, aiBusy, isDark }: {
  brand: Brand; set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  website: string;
  runAi: (field: string) => void;
  aiAttempts: Record<string, number>;
  aiBusy: Record<string, boolean>;
} & CommonProps) {
  return (
    <Section title="Контакты" icon="Phone" isDark={isDark}>
      <PhoneField label="Телефон" value={brand.support_phone || ""}
        onChange={v => set("support_phone", v)} isDark={isDark} />
      <Field label="Email" placeholder="info@yourcompany.ru" type="email"
        value={brand.support_email || ""} onChange={v => set("support_email", v)} isDark={isDark}
        aiBtn={<AiFieldBtn field="support_email" busy={aiBusy["support_email"] || false} attempts={aiAttempts["support_email"] || 0} onRun={runAi} siteUrl={website} />} />
      <Field label="Telegram (ссылка)" placeholder="https://t.me/yourcompany"
        value={brand.telegram_url || ""} onChange={v => set("telegram_url", v)} isDark={isDark}
        aiBtn={<AiFieldBtn field="telegram_url" busy={aiBusy["telegram_url"] || false} attempts={aiAttempts["telegram_url"] || 0} onRun={runAi} siteUrl={website} />} />
      <Field label="MAX (ссылка)" placeholder="https://max.ru/u/..."
        value={brand.max_url || ""} onChange={v => set("max_url", v)} isDark={isDark} />
      <Field label="Часы работы" placeholder="Ежедневно 9:00–22:00"
        value={brand.working_hours || ""} onChange={v => set("working_hours", v)} isDark={isDark}
        aiBtn={<AiFieldBtn field="working_hours" busy={aiBusy["working_hours"] || false} attempts={aiAttempts["working_hours"] || 0} onRun={runAi} siteUrl={website} />} />
    </Section>
  );
}

// ── SectionPdf ────────────────────────────────────────────────────────────────
export function SectionPdf({ brand, set, website, runAi, aiAttempts, aiBusy, isDark }: {
  brand: Brand; set: <K extends keyof Brand>(k: K, v: Brand[K]) => void;
  website: string;
  runAi: (field: string) => void;
  aiAttempts: Record<string, number>;
  aiBusy: Record<string, boolean>;
} & CommonProps) {
  const muted = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  return (
    <Section title="PDF-сметы" icon="FileText" isDark={isDark}>
      <ColorField label="Цвет текста в PDF" value={brand.pdf_text_color || "#111827"}
        onChange={v => set("pdf_text_color", v)} isDark={isDark} />
      <Field label="Подвал PDF (адрес, ИНН, сайт)" multiline rows={2}
        placeholder="г. Москва, ул. Примерная 1 · ИНН 1234567890 · сайт.рф"
        value={brand.pdf_footer_address || ""} onChange={v => set("pdf_footer_address", v)} isDark={isDark}
        aiBtn={<AiFieldBtn field="pdf_footer_address" busy={aiBusy["pdf_footer_address"] || false} attempts={aiAttempts["pdf_footer_address"] || 0} onRun={runAi} siteUrl={website} />} />
      <div className="text-[11px] mt-1 px-1" style={{ color: muted }}>
        Логотип и цвет акцента берутся из настроек выше.
      </div>
    </Section>
  );
}
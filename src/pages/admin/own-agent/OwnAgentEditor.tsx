import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import PhoneInput from "@/components/ui/PhoneInput";
import { useAuth, type Brand } from "@/context/AuthContext";
import { updateBrand, uploadBrandImage } from "./brandApi";
import BrandPreview from "./BrandPreview";

interface Props { isDark: boolean }

export default function OwnAgentEditor({ isDark }: Props) {
  const { user, token, updateUser } = useAuth();

  const [brand, setBrand] = useState<Brand>({
    bot_name:           user?.brand?.bot_name           ?? "",
    bot_greeting:       user?.brand?.bot_greeting       ?? "",
    bot_avatar_url:     user?.brand?.bot_avatar_url     ?? "",
    brand_logo_url:     user?.brand?.brand_logo_url     ?? "",
    brand_color:        user?.brand?.brand_color        ?? "#f97316",
    support_phone:      user?.brand?.support_phone      ?? "",
    support_email:      user?.brand?.support_email      ?? "",
    max_url:            user?.brand?.max_url            ?? "",
    working_hours:      user?.brand?.working_hours      ?? "Ежедневно 9:00–22:00",
    pdf_footer_address: user?.brand?.pdf_footer_address ?? "",
    telegram_url:       user?.brand?.telegram_url       ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setBrand(b => ({ ...b, [k]: v }));

  const save = async () => {
    setErr(""); setSaved(false); setSaving(true);
    try {
      await updateBrand(token, brand);
      updateUser({ brand });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const text   = isDark ? "#fff" : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const link   = `${window.location.origin}/?c=${user?.id}`;

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

        {/* Бренд: бот */}
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

        {/* Бренд: визуал */}
        <Section title="Визуал" icon="Palette" isDark={isDark}>
          <ImageUploader label="Логотип компании" hint="PNG с прозрачным фоном, до 1 МБ"
            value={brand.brand_logo_url || ""} onChange={v => set("brand_logo_url", v)}
            token={token} isDark={isDark} />
          <ColorField label="Цвет акцента" value={brand.brand_color || "#f97316"}
            onChange={v => set("brand_color", v)} isDark={isDark} />
        </Section>

        {/* Контакты */}
        <Section title="Контакты" icon="Phone" isDark={isDark}>
          <PhoneField label="Телефон" value={brand.support_phone || ""}
            onChange={v => set("support_phone", v)} isDark={isDark} />
          <Field label="Email" placeholder="info@yourcompany.ru" type="email"
            value={brand.support_email || ""} onChange={v => set("support_email", v)} isDark={isDark} />
          <Field label="Telegram (ссылка)" placeholder="https://t.me/yourcompany"
            value={brand.telegram_url || ""} onChange={v => set("telegram_url", v)} isDark={isDark} />
          <Field label="MAX (ссылка)" placeholder="https://max.ru/u/..."
            value={brand.max_url || ""} onChange={v => set("max_url", v)} isDark={isDark} />
          <Field label="Часы работы" placeholder="Ежедневно 9:00–22:00"
            value={brand.working_hours || ""} onChange={v => set("working_hours", v)} isDark={isDark} />
        </Section>

        {/* PDF */}
        <Section title="PDF-сметы" icon="FileText" isDark={isDark}>
          <Field label="Подвал PDF" multiline rows={2}
            placeholder="г. Москва, ул. Примерная 1 · ИНН 1234567890 · сайт.рф"
            value={brand.pdf_footer_address || ""} onChange={v => set("pdf_footer_address", v)} isDark={isDark} />
          <div className="text-[11px] mt-2 px-1" style={{ color: muted }}>
            Эта строка появится внизу каждой PDF-сметы клиенту. Логотип и название берутся из настроек выше.
          </div>
        </Section>

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

/* ─── Building blocks ────────────────────────────────────────────────── */

function Section({ title, icon, children, isDark }: {
  title: string; icon: string; children: React.ReactNode; isDark: boolean;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} size={13} style={{ color: "#a78bfa" }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: muted }}>{title}</span>
      </div>
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: bg, border: `1px solid ${border}` }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", multiline, rows = 2, isDark }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean; rows?: number; isDark: boolean;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const text   = isDark ? "#fff" : "#0f1623";
  const cls = "w-full px-3.5 py-2.5 rounded-xl text-sm transition focus:outline-none";
  const style = { background: bg, border: `1px solid ${border}`, color: text };
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      {multiline
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} className={cls + " resize-none"} style={style} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} className={cls} style={style} />
      }
    </div>
  );
}

function PhoneField({ label, value, onChange, isDark }: {
  label: string; value: string; onChange: (v: string) => void; isDark: boolean;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const text   = isDark ? "#fff" : "#0f1623";
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <PhoneInput value={value} onChange={onChange} showValidation
        className="w-full px-3.5 py-2.5 rounded-xl text-sm transition focus:outline-none"
        style={{ background: bg, border: `1px solid ${border}`, color: text }} />
    </div>
  );
}

function ColorField({ label, value, onChange, isDark }: {
  label: string; value: string; onChange: (v: string) => void; isDark: boolean;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const text   = isDark ? "#fff" : "#0f1623";
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-12 h-10 rounded-lg cursor-pointer flex-shrink-0"
          style={{ background: bg, border: `1px solid ${border}` }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="#f97316"
          className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase transition focus:outline-none"
          style={{ background: bg, border: `1px solid ${border}`, color: text }} />
        <div className="w-10 h-10 rounded-lg flex-shrink-0"
          style={{ background: value, border: `1px solid ${border}` }} />
      </div>
    </div>
  );
}

function ImageUploader({ label, hint, value, onChange, token, isDark }: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
  token: string | null; isDark: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState("");
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("Файл больше 2 МБ"); return; }
    setErr(""); setBusy(true);
    try {
      const url = await uploadBrandImage(token, file);
      onChange(url);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: bg, border: `1px dashed ${border}` }}>
          {value
            ? <img src={value} alt="" className="w-full h-full object-contain" />
            : <Icon name="Image" size={20} style={{ color: muted }} />}
        </div>
        <div className="flex-1 min-w-0">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => inputRef.current?.click()} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition disabled:opacity-50"
              style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.32)" }}>
              {busy
                ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Загрузка...</>
                : <><Icon name="Upload" size={11} /> {value ? "Заменить" : "Загрузить"}</>}
            </button>
            {value && (
              <button onClick={() => onChange("")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition"
                style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Icon name="X" size={11} /> Убрать
              </button>
            )}
          </div>
          <div className="text-[10px] mt-1" style={{ color: muted }}>{hint}</div>
        </div>
      </div>
      {err && <div className="text-[10.5px] mt-1.5" style={{ color: "#ef4444" }}>{err}</div>}
    </div>
  );
}

function CopyLink({ link, isDark }: { link: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.04)" : "#f9fafb";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <Icon name="Link" size={11} style={{ color: muted }} />
      <span className="text-[11px] font-mono max-w-[220px] truncate" style={{ color: muted }}>{link}</span>
      <button onClick={copy}
        className="flex items-center gap-1 text-[11px] font-bold transition"
        style={{ color: copied ? "#10b981" : "#a78bfa" }}>
        <Icon name={copied ? "Check" : "Copy"} size={11} />
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </div>
  );
}
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props { onClose: () => void; }

export default function ProfileModal({ onClose }: Props) {
  const { user, token } = useAuth();
  const [form, setForm] = useState({
    name:         user?.name     || "",
    phone:        user?.phone    || "",
    company_name: "",
    company_inn:  "",
    company_addr: "",
    website:      "",
    telegram:     "",
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  const save = async () => {
    setSaving(true); setSaved(false); setError("");
    try {
      const res = await fetch(`${AUTH_URL}?action=update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#f9731615" }}>
              <Icon name="User" size={15} style={{ color: "#f97316" }} />
            </div>
            <span className="text-sm font-bold text-white">Профиль</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Контент */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Личные данные */}
          <Section title="Личные данные" icon="User">
            <Field label="Имя" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Иван Петров" />
            <Field label="Телефон" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+7 (999) 000-00-00" type="tel" />
            <div className="py-2 flex justify-between items-center border-b border-white/[0.04]">
              <span className="text-xs text-white/30">Email</span>
              <span className="text-xs text-white/50">{user?.email}</span>
            </div>
          </Section>

          {/* Компания */}
          <Section title="Компания" icon="Building2">
            <Field label="Название" value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="ООО «Натяжные потолки»" />
            <Field label="ИНН" value={form.company_inn} onChange={v => setForm(f => ({ ...f, company_inn: v }))} placeholder="7712345678" />
            <Field label="Адрес" value={form.company_addr} onChange={v => setForm(f => ({ ...f, company_addr: v }))} placeholder="г. Москва, ул. Примерная, 1" />
          </Section>

          {/* Контакты */}
          <Section title="Контакты" icon="Globe">
            <Field label="Сайт" value={form.website} onChange={v => setForm(f => ({ ...f, website: v }))} placeholder="https://mysite.ru" />
            <Field label="Telegram" value={form.telegram} onChange={v => setForm(f => ({ ...f, telegram: v }))} placeholder="@username" />
          </Section>

          {error && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
          )}
        </div>

        {/* Футер */}
        <div className="flex gap-2 px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: saved ? "#10b981" : "#f97316" }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : saved
              ? <><Icon name="CheckCircle2" size={14} /> Сохранено</>
              : <><Icon name="Save" size={14} /> Сохранить</>}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={13} style={{ color: "#f97316" }} />
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">{title}</span>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-white/30 w-28 flex-shrink-0">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-xs bg-transparent text-right text-white/70 placeholder-white/15 focus:outline-none focus:text-white transition" />
    </div>
  );
}

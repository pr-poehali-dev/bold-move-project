import { useState } from "react";
import { useAuth, type UserRole, BUSINESS_ROLES, CLIENT_ROLES } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import PhoneInput from "@/components/ui/PhoneInput";
import { isPhoneValid } from "@/hooks/use-phone";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props { onClose: () => void; }

const ROLE_OPTIONS: { value: UserRole; label: string; icon: string; color: string; desc: string }[] = [
  { value: "client",    label: "Клиент",    icon: "Home",      color: "#f97316", desc: "Хочу натяжные потолки" },
  { value: "designer",  label: "Дизайнер",  icon: "Pencil",    color: "#a78bfa", desc: "Работаю с интерьерами" },
  { value: "foreman",   label: "Прораб",    icon: "HardHat",   color: "#34d399", desc: "Веду строительные проекты" },
  { value: "installer", label: "Монтажник", icon: "Wrench",    color: "#60a5fa", desc: "Монтирую натяжные потолки" },
  { value: "company",   label: "Компания",  icon: "Building2", color: "#f59e0b", desc: "Продаю и монтирую потолки" },
];

export default function ProfileModal({ onClose }: Props) {
  const { user, token, updateUser } = useAuth();
  const [form, setForm] = useState({
    name:         user?.name         || "",
    phone:        user?.phone        || "",
    company_name: user?.company_name || "",
    company_inn:  user?.company_inn  || "",
    company_addr: user?.company_addr || "",
    website:      user?.website      || "",
    telegram:     user?.telegram     || "",
    role:         (user?.role || "client") as UserRole,
  });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");
  const [showRolePicker, setShowRolePicker] = useState(false);

  const currentRoleOpt = ROLE_OPTIONS.find(r => r.value === form.role)!;
  const isBusiness = BUSINESS_ROLES.includes(form.role);
  const roleChanged = form.role !== user?.role;

  const save = async () => {
    setError("");
    // Валидация телефона: если введён хоть какой-то набор цифр — должно быть полных 11
    const phoneDigits = (form.phone || "").replace(/\D/g, "").length;
    if (phoneDigits > 1 && !isPhoneValid(form.phone)) {
      setError("Введите корректный телефон или оставьте поле пустым");
      return;
    }
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${AUTH_URL}?action=update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (d.user) updateUser(d.user);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

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

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Роль */}
          <Section title="Роль" icon="BadgeCheck">
            <div className="px-4 py-3">
              {!showRolePicker ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${currentRoleOpt.color}20` }}>
                      <Icon name={currentRoleOpt.icon} size={15} style={{ color: currentRoleOpt.color }} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{currentRoleOpt.label}</div>
                      <div className="text-[10px] text-white/30">{currentRoleOpt.desc}</div>
                    </div>
                  </div>
                  <button onClick={() => setShowRolePicker(true)}
                    className="text-[11px] px-3 py-1.5 rounded-lg transition"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    Сменить
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-white/40">Выберите новую роль</span>
                    <button onClick={() => setShowRolePicker(false)} className="text-white/30 hover:text-white/60 transition">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                  {ROLE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => { setForm(f => ({ ...f, role: opt.value })); setShowRolePicker(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                      style={{
                        background: form.role === opt.value ? `${opt.color}18` : "rgba(255,255,255,0.03)",
                        border: form.role === opt.value ? `1.5px solid ${opt.color}50` : "1.5px solid rgba(255,255,255,0.06)",
                      }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${opt.color}20` }}>
                        <Icon name={opt.icon} size={13} style={{ color: opt.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-white">{opt.label}</span>
                        <span className="text-[10px] text-white/30 ml-2">{opt.desc}</span>
                      </div>
                      {form.role === opt.value && <Icon name="Check" size={13} style={{ color: opt.color }} />}
                    </button>
                  ))}
                </div>
              )}

              {/* Предупреждение при смене на бизнес-роль */}
              {roleChanged && isBusiness && (
                <div className="mt-3 rounded-xl px-3 py-2.5 text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                  <Icon name="Clock" size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
                  <span>После сохранения заявка уйдёт на проверку. Доступ к CRM откроется в течение 24 часов.</span>
                </div>
              )}
              {roleChanged && CLIENT_ROLES.includes(form.role) && (
                <div className="mt-3 rounded-xl px-3 py-2.5 text-[11px] text-green-300/80 bg-green-500/10 border border-green-500/20 flex items-start gap-2">
                  <Icon name="CheckCircle2" size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#34d399" }} />
                  <span>Роль будет изменена сразу после сохранения.</span>
                </div>
              )}
            </div>
          </Section>

          {/* Личные данные */}
          <Section title="Личные данные" icon="User">
            <Field label="Имя"     value={form.name}  onChange={v => setForm(f => ({ ...f, name: v }))}  placeholder="Иван Петров" />
            <PhoneField label="Телефон" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            <Field label="Email"   value={user?.email || ""} readonly />
          </Section>

          {/* Компания */}
          <Section title="Компания" icon="Building2">
            <Field label="Название" value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="ООО «Натяжные потолки»" />
            <Field label="ИНН"      value={form.company_inn}  onChange={v => setForm(f => ({ ...f, company_inn: v }))}  placeholder="7712345678" />
            <Field label="Адрес"    value={form.company_addr} onChange={v => setForm(f => ({ ...f, company_addr: v }))} placeholder="г. Москва, ул. Примерная, 1" />
          </Section>

          {/* Контакты */}
          <Section title="Контакты" icon="Globe">
            <Field label="Сайт"     value={form.website}  onChange={v => setForm(f => ({ ...f, website: v }))}  placeholder="https://mysite.ru" />
            <Field label="Telegram" value={form.telegram} onChange={v => setForm(f => ({ ...f, telegram: v }))} placeholder="@username" />
          </Section>

          {/* Безопасность */}
          <Section title="Безопасность" icon="ShieldCheck">
            <ChangePasswordBlock />
          </Section>

          {error && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
          )}
        </div>

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

function Field({ label, value, onChange, placeholder, type = "text", readonly = false }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readonly?: boolean;
}) {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-white/30 w-24 flex-shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readonly}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-xs bg-transparent text-right placeholder-white/15 focus:outline-none transition"
        style={{ color: readonly ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)" }}
      />
    </div>
  );
}

function PhoneField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-white/30 w-24 flex-shrink-0">{label}</span>
      <PhoneInput
        value={value}
        onChange={onChange}
        showValidation
        className="flex-1 text-xs bg-transparent text-right placeholder-white/15 focus:outline-none transition"
        style={{ color: "rgba(255,255,255,0.7)" }}
      />
    </div>
  );
}

function ChangePasswordBlock() {
  const { token } = useAuth();
  const [open,    setOpen]    = useState(false);
  const [oldPwd,  setOldPwd]  = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [repPwd,  setRepPwd]  = useState("");
  const [show,    setShow]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");

  const reset = () => { setOldPwd(""); setNewPwd(""); setRepPwd(""); setErr(""); setDone(false); };

  const submit = async () => {
    setErr(""); setDone(false);
    if (!oldPwd || !newPwd || !repPwd) { setErr("Заполните все поля"); return; }
    if (newPwd.length < 6)              { setErr("Новый пароль минимум 6 символов"); return; }
    if (newPwd !== repPwd)              { setErr("Новые пароли не совпадают"); return; }

    setBusy(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      setDone(true);
      setTimeout(() => { reset(); setOpen(false); }, 1800);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 transition hover:bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <Icon name="KeyRound" size={13} style={{ color: "#a78bfa" }} />
          <span className="text-xs font-semibold text-white/75">Сменить пароль</span>
        </div>
        <Icon name="ChevronRight" size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="KeyRound" size={13} style={{ color: "#a78bfa" }} />
          <span className="text-xs font-bold text-white">Смена пароля</span>
        </div>
        <button onClick={() => setShow(s => !s)}
          className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 transition">
          <Icon name={show ? "EyeOff" : "Eye"} size={11} />
          {show ? "Скрыть" : "Показать"}
        </button>
      </div>

      <PwdField label="Текущий пароль" value={oldPwd} onChange={setOldPwd} show={show} />
      <PwdField label="Новый пароль"   value={newPwd} onChange={setNewPwd} show={show} />
      <PwdField label="Повторите"      value={repPwd} onChange={setRepPwd} show={show} />

      {err && (
        <div className="rounded-lg px-3 py-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20">
          {err}
        </div>
      )}
      {done && (
        <div className="rounded-lg px-3 py-2 text-[11px] text-green-300 bg-green-500/10 border border-green-500/20 flex items-center gap-1.5">
          <Icon name="CheckCircle2" size={12} /> Пароль изменён
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={busy}
          className="flex-1 py-2 rounded-lg text-[11px] font-bold text-white transition disabled:opacity-50"
          style={{ background: "#a78bfa" }}>
          {busy ? "Сохранение..." : "Изменить пароль"}
        </button>
        <button onClick={() => { reset(); setOpen(false); }}
          className="px-3 py-2 rounded-lg text-[11px] text-white/50 transition"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          Отмена
        </button>
      </div>

      <div className="text-[10px] text-white/30 leading-snug pt-1">
        После смены пароля все остальные устройства будут разлогинены.
      </div>
    </div>
  );
}

function PwdField({ label, value, onChange, show }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean;
}) {
  return (
    <div className="flex items-center px-3 py-2 rounded-lg"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-[10px] text-white/35 w-24 flex-shrink-0">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        className="flex-1 text-xs bg-transparent placeholder-white/15 focus:outline-none transition text-right text-white/80"
      />
    </div>
  );
}
import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { inviteMember, type TeamMember } from "./teamApi";

interface Props {
  isDark: boolean;
  onClose:   () => void;
  onInvited: (member: TeamMember) => void;
}

export default function InviteMemberModal({ isDark, onClose, onInvited }: Props) {
  const { token } = useAuth();
  const [email, setEmail] = useState("");
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  const submit = async () => {
    setErr("");
    if (!email.trim()) { setErr("Укажите email"); return; }
    setBusy(true);
    try {
      const { member, temp_password } = await inviteMember(token, {
        email: email.trim(), name: name.trim(), phone: phone.trim(),
      });
      setTempPwd(temp_password);
      onInvited(member);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!tempPwd) return;
    const text = `Логин: ${email}\nПароль: ${tempPwd}\n\nВходи на сайте, в разделе «Войти».`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  // Шаг 2: Показ временного пароля
  if (tempPwd) {
    return (
      <Backdrop onClose={onClose}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{ background: bg, border: `1px solid ${border}`, color: text }}
          onClick={e => e.stopPropagation()}>
          <div className="px-6 py-5 border-b" style={{ borderColor: border }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                <Icon name="CheckCircle2" size={18} style={{ color: "#10b981" }} />
              </div>
              <div>
                <div className="text-base font-bold">Сотрудник создан</div>
                <div className="text-[11px]" style={{ color: muted }}>Скопируйте данные и передайте сотруднику</div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl px-4 py-3" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${border}` }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: muted }}>Email</div>
              <div className="text-sm font-mono">{email}</div>
            </div>
            <div className="rounded-xl px-4 py-3"
              style={{ background: "rgba(124,58,237,0.10)", border: "1.5px solid rgba(124,58,237,0.35)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#a78bfa" }}>Временный пароль</div>
              <div className="text-lg font-mono font-black" style={{ color: "#a78bfa" }}>{tempPwd}</div>
            </div>

            <div className="rounded-xl px-3 py-2.5 text-[11px] flex items-start gap-2"
              style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              <Icon name="AlertTriangle" size={12} className="mt-0.5 flex-shrink-0" />
              <span>Пароль показывается один раз. Сохраните его сейчас — посмотреть позже будет нельзя.</span>
            </div>

            <button onClick={copyAll}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2"
              style={{ background: copied ? "#10b981" : "#7c3aed" }}>
              <Icon name={copied ? "Check" : "Copy"} size={14} />
              {copied ? "Скопировано" : "Скопировать логин и пароль"}
            </button>

            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-medium transition"
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
              Готово
            </button>
          </div>
        </div>
      </Backdrop>
    );
  }

  // Шаг 1: Форма приглашения
  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: border }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.18)" }}>
              <Icon name="UserPlus" size={18} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <div className="text-base font-bold">Пригласить сотрудника</div>
              <div className="text-[11px]" style={{ color: muted }}>Создаст менеджера с доступом к вашей CRM</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: muted }}>
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <Input label="Email *"   value={email} onChange={setEmail} placeholder="manager@example.com" type="email" isDark={isDark} />
          <Input label="Имя"       value={name}  onChange={setName}  placeholder="Иван Петров"          isDark={isDark} />
          <Input label="Телефон"   value={phone} onChange={setPhone} placeholder="+7 (999) 000-00-00"   type="tel" isDark={isDark} />

          {err && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: border }}>
          <button onClick={submit} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#7c3aed" }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Создание...</>
              : <><Icon name="Send" size={13} /> Создать сотрудника</>}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
            Отмена
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", isDark }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; isDark: boolean;
}) {
  const muted = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: muted }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm transition focus:outline-none"
        style={{
          background: isDark ? "rgba(255,255,255,0.05)" : "#f9fafb",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
          color: isDark ? "#fff" : "#0f1623",
        }}
      />
    </div>
  );
}

import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Permissions } from "@/context/AuthContext";
import { inviteMember, updatePermissions, showMemberPassword, type TeamMember } from "./teamApi";
import PermissionsEditor from "./PermissionsEditor";

interface Props {
  isDark: boolean;
  onClose:   () => void;
  onInvited: (member: TeamMember) => void;
  onUpdated: (member: TeamMember) => void;
}

type Step = "form" | "permissions" | "password";

export default function InviteMemberModal({ isDark, onClose, onInvited, onUpdated }: Props) {
  const { token } = useAuth();
  const [step,  setStep]  = useState<Step>("form");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  // Шаг 1
  const [email, setEmail] = useState("");
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");

  // Созданный сотрудник
  const [member, setMember] = useState<TeamMember | null>(null);

  // Шаг 2: права
  const [perms, setPerms] = useState<Permissions>({
    crm_view: true, crm_edit: false, kanban: true, calendar: true,
    finance: false, analytics: false, files: true, settings: false,
  });

  // Шаг 3: пароль
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  // === Шаг 1: создание ===
  const submitForm = async () => {
    setErr("");
    if (!email.trim()) { setErr("Укажите email"); return; }
    setBusy(true);
    try {
      const { member: m } = await inviteMember(token, {
        email: email.trim(), name: name.trim(), phone: phone.trim(),
      });
      setMember(m);
      onInvited(m);
      // Берём дефолтные пермы с бэка, если пришли
      if (m.permissions) setPerms(m.permissions);
      setStep("permissions");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  // === Шаг 2: сохранение прав ===
  const savePerms = async () => {
    if (!member) return;
    setErr(""); setBusy(true);
    try {
      await updatePermissions(token, member.id, perms);
      onUpdated({ ...member, permissions: perms });
      setStep("password");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  // === Шаг 3: показ пароля ===
  const fetchPassword = async () => {
    if (!member) return;
    setErr(""); setBusy(true);
    try {
      const { temp_password } = await showMemberPassword(token, member.id);
      setTempPwd(temp_password);
      onUpdated({ ...member, has_pending_password: false });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!tempPwd || !member) return;
    const txt = `Логин: ${member.email}\nПароль: ${tempPwd}\n\nВходи на сайте, в разделе «Войти».`;
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: border }}>
          <div className="flex items-center gap-2.5">
            <StepIcon step={step} />
            <div>
              <div className="text-base font-bold">
                {step === "form"        && "Пригласить сотрудника"}
                {step === "permissions" && "Настройка доступа"}
                {step === "password"    && "Передайте пароль"}
              </div>
              <div className="text-[11px]" style={{ color: muted }}>
                Шаг {step === "form" ? 1 : step === "permissions" ? 2 : 3} из 3
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: muted }}>
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Прогресс */}
        <Progress step={step} isDark={isDark} />

        {/* Содержимое */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">

          {step === "form" && (
            <>
              <Input label="Email *"   value={email} onChange={setEmail} placeholder="manager@example.com" type="email" isDark={isDark} />
              <Input label="Имя"       value={name}  onChange={setName}  placeholder="Иван Петров"          isDark={isDark} />
              <Input label="Телефон"   value={phone} onChange={setPhone} placeholder="+7 (999) 000-00-00"   type="tel"   isDark={isDark} />
            </>
          )}

          {step === "permissions" && (
            <>
              <div className="rounded-xl px-3 py-2.5 text-[11px] flex items-start gap-2 mb-1"
                style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.25)", color: isDark ? "#c4b5fd" : "#6d28d9" }}>
                <Icon name="Info" size={12} className="mt-0.5 flex-shrink-0" />
                <span>Сначала настройте доступ — потом получите пароль для передачи сотруднику.</span>
              </div>
              <PermissionsEditor isDark={isDark} permissions={perms} onChange={setPerms} />
            </>
          )}

          {step === "password" && (
            <>
              <div className="rounded-xl px-4 py-3"
                style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${border}` }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: muted }}>Email</div>
                <div className="text-sm font-mono">{member?.email}</div>
              </div>

              {!tempPwd ? (
                <>
                  <div className="rounded-xl px-3 py-2.5 text-[11px] flex items-start gap-2"
                    style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
                    <Icon name="AlertTriangle" size={12} className="mt-0.5 flex-shrink-0" />
                    <span>Пароль показывается <b>один раз</b>. После закрытия окна посмотреть его уже нельзя — только сгенерировать новый кнопкой «Сбросить пароль».</span>
                  </div>
                  <button onClick={fetchPassword} disabled={busy}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "#7c3aed" }}>
                    {busy
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Получение...</>
                      : <><Icon name="KeyRound" size={14} /> Получить пароль</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: "rgba(124,58,237,0.10)", border: "1.5px solid rgba(124,58,237,0.35)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#a78bfa" }}>Временный пароль</div>
                    <div className="text-lg font-mono font-black" style={{ color: "#a78bfa" }}>{tempPwd}</div>
                  </div>
                  <button onClick={copyAll}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2"
                    style={{ background: copied ? "#10b981" : "#7c3aed" }}>
                    <Icon name={copied ? "Check" : "Copy"} size={14} />
                    {copied ? "Скопировано" : "Скопировать логин и пароль"}
                  </button>
                </>
              )}
            </>
          )}

          {err && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="flex gap-2 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: border }}>

          {step === "form" && (
            <>
              <button onClick={submitForm} disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#7c3aed" }}>
                {busy
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Создание...</>
                  : <>Далее: настроить доступ <Icon name="ArrowRight" size={13} /></>}
              </button>
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
                Отмена
              </button>
            </>
          )}

          {step === "permissions" && (
            <button onClick={savePerms} disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#7c3aed" }}>
              {busy
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
                : <>Далее: получить пароль <Icon name="ArrowRight" size={13} /></>}
            </button>
          )}

          {step === "password" && (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
              style={{ background: tempPwd ? "#10b981" : "rgba(255,255,255,0.05)" }}>
              {tempPwd ? "Готово" : "Закрыть"}
            </button>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

function StepIcon({ step }: { step: Step }) {
  const cfg = step === "form"
    ? { icon: "UserPlus",  bg: "rgba(124,58,237,0.18)", color: "#a78bfa" }
    : step === "permissions"
    ? { icon: "ShieldCheck", bg: "rgba(167,139,250,0.18)", color: "#a78bfa" }
    : { icon: "KeyRound",  bg: "rgba(16,185,129,0.18)", color: "#10b981" };
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cfg.bg }}>
      <Icon name={cfg.icon} size={18} style={{ color: cfg.color }} />
    </div>
  );
}

function Progress({ step, isDark }: { step: Step; isDark: boolean }) {
  const stepIdx = step === "form" ? 0 : step === "permissions" ? 1 : 2;
  const bg = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  return (
    <div className="px-6 py-3 flex gap-1.5" style={{ background: isDark ? "rgba(255,255,255,0.015)" : "#f9fafb" }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="flex-1 h-1 rounded-full transition-all"
          style={{ background: i <= stepIdx ? "#7c3aed" : bg }} />
      ))}
    </div>
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

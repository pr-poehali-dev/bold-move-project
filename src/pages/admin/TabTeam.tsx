import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Member {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  is_owner: boolean;
  created_at: string | null;
}

interface Props { token: string }

export default function TabTeam({ token }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Форма приглашения
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail,   setInvEmail]   = useState("");
  const [invName,    setInvName]    = useState("");
  const [invPhone,   setInvPhone]   = useState("");
  const [inviting,   setInviting]   = useState(false);
  const [invError,   setInvError]   = useState("");
  const [invitedPwd, setInvitedPwd] = useState<{email: string; password: string} | null>(null);

  // Удаление и сброс пароля
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<Member | null>(null);
  const [resetResult, setResetResult] = useState<{email: string; password: string} | null>(null);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${AUTH_URL}?action=team-list`, {
        headers: { "X-Authorization": `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      setMembers(d.members || []);
      setCanManage(!!d.can_manage);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load();   }, [token]);

  const invite = async () => {
    setInvError("");
    if (!invEmail.trim()) { setInvError("Email обязателен"); return; }
    setInviting(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=team-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: invEmail.trim(), name: invName.trim(), phone: invPhone.trim() }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      setInvitedPwd({ email: d.user.email, password: d.password });
      setInvEmail(""); setInvName(""); setInvPhone("");
      setShowInvite(false);
      load();
    } catch (e: unknown) {
      setInvError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setInviting(false);
    }
  };

  const remove = async (m: Member) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${AUTH_URL}?action=team-remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ user_id: m.id }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      setConfirmDel(null);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (m: Member) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${AUTH_URL}?action=team-reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ user_id: m.id }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Ошибка");
      setResetResult({ email: m.email, password: d.password });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
  };

  return (
    <div className="max-w-4xl mx-auto">

      {/* Заголовок */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-white mb-1">Команда</h2>
          <p className="text-xs text-white/45">
            {canManage
              ? "Пригласите менеджеров — они увидят CRM и заявки вашей компании"
              : "Список сотрудников вашей компании"}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition"
            style={{ background: "#7c3aed" }}>
            <Icon name="UserPlus" size={13} />
            Пригласить
          </button>
        )}
      </div>

      {/* Ошибка */}
      {err && (
        <div className="mb-4 rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">
          {err}
        </div>
      )}

      {/* Список */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-10 text-white/35 text-xs">Пока никого нет</div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id}
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                background: m.is_owner ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)",
                border: m.is_owner ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.06)",
              }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
                style={{
                  background: m.is_owner ? "rgba(245,158,11,0.18)" : "rgba(167,139,250,0.18)",
                  color: m.is_owner ? "#f59e0b" : "#a78bfa",
                }}>
                {(m.name || m.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white truncate">{m.name || m.email}</span>
                  {m.is_owner && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                      style={{ background: "#f59e0b", color: "#0a0a14" }}>Владелец</span>
                  )}
                  {!m.is_owner && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa" }}>Менеджер</span>
                  )}
                  {!m.approved && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style={{ background: "#fbbf2418", color: "#fbbf24" }}>Ожидает</span>
                  )}
                </div>
                <div className="text-[11px] text-white/40 truncate mt-0.5">
                  {m.email}{m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>
              {canManage && !m.is_owner && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => resetPassword(m)} disabled={busyId === m.id}
                    title="Сбросить пароль"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-50"
                    style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                    <Icon name="KeyRound" size={13} />
                  </button>
                  <button onClick={() => setConfirmDel(m)} disabled={busyId === m.id}
                    title="Удалить"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-50"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Модал приглашения ── */}
      {showInvite && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "#0e0e1c", border: "1.5px solid rgba(124,58,237,0.4)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.18)" }}>
                <Icon name="UserPlus" size={16} style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Пригласить менеджера</div>
                <div className="text-[10px] text-white/40">Получит доступ к CRM и заявкам компании</div>
              </div>
            </div>

            <div className="space-y-2.5">
              <InvField label="Email *"   value={invEmail} onChange={setInvEmail} placeholder="manager@company.ru" autoFocus />
              <InvField label="Имя"       value={invName}  onChange={setInvName}  placeholder="Иван Петров" />
              <InvField label="Телефон"   value={invPhone} onChange={setInvPhone} placeholder="+7 (999) 000-00-00" />
            </div>

            {invError && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20">
                {invError}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={invite} disabled={inviting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
                style={{ background: "#7c3aed" }}>
                {inviting ? "Создаём..." : "Создать аккаунт"}
              </button>
              <button onClick={() => setShowInvite(false)}
                className="px-5 py-2.5 rounded-xl text-sm text-white/50 transition"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модал с показом пароля (после создания) ── */}
      {invitedPwd && (
        <PasswordModal
          title="Менеджер создан"
          email={invitedPwd.email}
          password={invitedPwd.password}
          hint="Передайте сотруднику email и пароль. Он сможет сменить пароль в профиле."
          onClose={() => setInvitedPwd(null)}
          onCopy={copy}
        />
      )}

      {/* ── Модал с показом пароля (после сброса) ── */}
      {resetResult && (
        <PasswordModal
          title="Пароль сброшен"
          email={resetResult.email}
          password={resetResult.password}
          hint="Передайте сотруднику новый пароль. Все его сессии разлогинены."
          onClose={() => setResetResult(null)}
          onCopy={copy}
        />
      )}

      {/* ── Модал подтверждения удаления ── */}
      {confirmDel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#0e0e1c", border: "1.5px solid #ef444430" }}
            onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "#ef444415" }}>
              <Icon name="Trash2" size={20} style={{ color: "#ef4444" }} />
            </div>
            <div className="text-sm font-bold text-white mb-1">Удалить сотрудника?</div>
            <div className="text-xs text-white/35 mb-4">{confirmDel.name || confirmDel.email}</div>
            <div className="text-xs text-red-300/65 bg-red-500/08 border border-red-500/15 rounded-xl px-3 py-2 mb-5">
              Доступ к CRM закроется немедленно. Действие необратимо.
            </div>
            <div className="flex gap-2">
              <button onClick={() => remove(confirmDel)} disabled={busyId === confirmDel.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#ef4444" }}>
                {busyId === confirmDel.id ? "Удаление..." : "Удалить"}
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-white/40 transition"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvField({ label, value, onChange, placeholder, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1">{label}</div>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-xs text-white/85 placeholder-white/20 focus:outline-none transition"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}

function PasswordModal({ title, email, password, hint, onClose, onCopy }: {
  title: string; email: string; password: string; hint: string;
  onClose: () => void; onCopy: (s: string) => void;
}) {
  const [copied, setCopied] = useState<"email" | "password" | "both" | null>(null);
  const flash = (k: typeof copied) => { setCopied(k); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#0e0e1c", border: "1.5px solid rgba(16,185,129,0.4)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.18)" }}>
            <Icon name="CheckCircle2" size={16} style={{ color: "#10b981" }} />
          </div>
          <div className="text-sm font-bold text-white">{title}</div>
        </div>

        <div className="space-y-2 mb-4">
          <CopyRow label="Email"  value={email}    flash={copied === "email"}    onCopy={() => { onCopy(email);    flash("email"); }} />
          <CopyRow label="Пароль" value={password} flash={copied === "password"} onCopy={() => { onCopy(password); flash("password"); }} />
        </div>

        <button
          onClick={() => { onCopy(`Email: ${email}\nПароль: ${password}`); flash("both"); }}
          className="w-full mb-3 py-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5"
          style={{ background: copied === "both" ? "#10b981" : "rgba(167,139,250,0.18)", color: copied === "both" ? "#fff" : "#a78bfa" }}>
          <Icon name={copied === "both" ? "Check" : "Copy"} size={12} />
          {copied === "both" ? "Скопировано" : "Скопировать всё"}
        </button>

        <div className="text-[10.5px] text-white/45 leading-snug mb-5 px-1">
          ⚠️ {hint}
        </div>

        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
          style={{ background: "#7c3aed" }}>
          Понятно
        </button>
      </div>
    </div>
  );
}

function CopyRow({ label, value, flash, onCopy }: { label: string; value: string; flash: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[10px] text-white/35 uppercase font-bold tracking-wider w-14 flex-shrink-0">{label}</div>
      <div className="flex-1 text-xs font-mono text-white/85 truncate">{value}</div>
      <button onClick={onCopy}
        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded transition"
        style={{ background: flash ? "#10b981" : "rgba(255,255,255,0.06)", color: flash ? "#fff" : "rgba(255,255,255,0.5)" }}>
        <Icon name={flash ? "Check" : "Copy"} size={10} />
        {flash ? "Ок" : "Копировать"}
      </button>
    </div>
  );
}

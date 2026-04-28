import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { fetchTeam, removeMember, type TeamMember } from "./teamApi";
import InviteMemberModal from "./InviteMemberModal";
import ResetPasswordModal from "./ResetPasswordModal";
import EditPermissionsModal from "./EditPermissionsModal";
import { PERM_GROUPS } from "./PermissionsEditor";

interface Props { isDark: boolean }

export default function TeamPanel({ isDark }: Props) {
  const { token } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [resetFor,   setResetFor]   = useState<TeamMember | null>(null);
  const [editFor,    setEditFor]    = useState<TeamMember | null>(null);
  const [confirmDel, setConfirmDel] = useState<TeamMember | null>(null);
  const [delBusy,    setDelBusy]    = useState(false);

  const reload = async () => {
    setLoading(true); setErr("");
    try {
      const list = await fetchTeam(token);
      setMembers(list);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload();   }, [token]);

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelBusy(true);
    try {
      await removeMember(token, confirmDel.id);
      setMembers(prev => prev.filter(m => m.id !== confirmDel.id));
      setConfirmDel(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDelBusy(false);
    }
  };

  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const cardBg = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5" style={{ color: text }}>
      <div className="max-w-5xl mx-auto">

        {/* Шапка */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black mb-1">Команда</h1>
            <div className="text-[12px]" style={{ color: muted }}>
              Сотрудники с доступом к вашей CRM
            </div>
          </div>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#7c3aed" }}>
            <Icon name="UserPlus" size={14} />
            Пригласить сотрудника
          </button>
        </div>

        {/* Информашка */}
        <div className="rounded-xl px-4 py-3 mb-5 text-[12px] flex items-start gap-2.5"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)", color: isDark ? "#c4b5fd" : "#6d28d9" }}>
          <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Сначала <b>создайте сотрудника</b> → затем <b>настройте доступ</b> к разделам → и только потом <b>передайте пароль</b>.
            До передачи пароля сотрудник не сможет войти.
          </span>
        </div>

        {/* Содержимое */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : err ? (
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
            {err}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center"
            style={{ background: cardBg, border: `1px dashed ${border}` }}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.12)" }}>
              <Icon name="Users" size={26} style={{ color: "#a78bfa" }} />
            </div>
            <div className="text-base font-bold mb-1">Сотрудников пока нет</div>
            <div className="text-[12px] mb-5" style={{ color: muted }}>
              Пригласите первого менеджера — он сразу получит доступ к CRM
            </div>
            <button onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#7c3aed" }}>
              <Icon name="UserPlus" size={14} />
              Пригласить
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {members.map(m => (
              <MemberCard key={m.id} member={m} isDark={isDark}
                onEditPermissions={() => setEditFor(m)}
                onResetPassword={() => setResetFor(m)}
                onRemove={() => setConfirmDel(m)} />
            ))}
          </div>
        )}
      </div>

      {/* Модалки */}
      {showInvite && (
        <InviteMemberModal isDark={isDark}
          onClose={() => setShowInvite(false)}
          onInvited={(m) => setMembers(prev => [m, ...prev])}
          onUpdated={(m) => setMembers(prev => prev.map(x => x.id === m.id ? { ...x, ...m } : x))} />
      )}
      {editFor && (
        <EditPermissionsModal isDark={isDark} member={editFor}
          onClose={() => setEditFor(null)}
          onSaved={(m) => setMembers(prev => prev.map(x => x.id === m.id ? { ...x, ...m } : x))} />
      )}
      {resetFor && (
        <ResetPasswordModal isDark={isDark} member={resetFor} onClose={() => setResetFor(null)} />
      )}
      {confirmDel && (
        <ConfirmDeleteModal isDark={isDark} member={confirmDel} busy={delBusy}
          onCancel={() => setConfirmDel(null)} onConfirm={doDelete} />
      )}
    </div>
  );
}

function MemberCard({ member, isDark, onEditPermissions, onResetPassword, onRemove }: {
  member: TeamMember; isDark: boolean;
  onEditPermissions: () => void;
  onResetPassword: () => void;
  onRemove: () => void;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const initials = (member.name || member.email).slice(0, 1).toUpperCase();

  // Подсчёт активных прав
  const activeCount = member.permissions
    ? Object.values(member.permissions).filter(Boolean).length
    : PERM_GROUPS.length;
  const totalCount  = PERM_GROUPS.length;

  const isPwdPending = member.has_pending_password === true;

  return (
    <div className="rounded-2xl p-4"
      style={{
        background: bg,
        border: isPwdPending
          ? "1.5px solid rgba(251,191,36,0.45)"
          : `1px solid ${border}`,
      }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa" }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{member.name || "—"}</div>
          <div className="text-[11px] truncate" style={{ color: muted }}>{member.email}</div>
          {member.phone && (
            <div className="text-[11px] mt-0.5" style={{ color: muted }}>{member.phone}</div>
          )}
        </div>
        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
          style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa" }}>
          Менеджер
        </span>
      </div>

      {/* Состояние: пароль не передан */}
      {isPwdPending && (
        <div className="mb-3 rounded-lg px-2.5 py-2 text-[10.5px] flex items-center gap-2"
          style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.30)", color: "#fbbf24" }}>
          <Icon name="AlertTriangle" size={11} className="flex-shrink-0" />
          <span>Пароль не передан — сотрудник пока не может войти</span>
        </div>
      )}

      {/* Счётчик прав */}
      <div className="mb-3 flex items-center justify-between text-[10.5px]" style={{ color: muted }}>
        <span className="flex items-center gap-1.5">
          <Icon name="ShieldCheck" size={11} />
          Доступ
        </span>
        <span className="font-bold" style={{ color: activeCount === 0 ? "#ef4444" : isDark ? "#fff" : "#0f1623" }}>
          {activeCount} / {totalCount} разделов
        </span>
      </div>

      <div className="flex gap-2 mb-2">
        <button onClick={onEditPermissions}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.32)" }}>
          <Icon name="ShieldCheck" size={11} />
          Настроить доступ
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={onResetPassword}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.28)" }}>
          <Icon name="KeyRound" size={11} />
          Сбросить пароль
        </button>
        <button onClick={onRemove}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Icon name="Trash2" size={11} />
        </button>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ isDark, member, busy, onCancel, onConfirm }: {
  isDark: boolean; member: TeamMember; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: bg, border: `1.5px solid rgba(239,68,68,0.30)`, color: text }}
        onClick={e => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(239,68,68,0.15)" }}>
          <Icon name="Trash2" size={20} style={{ color: "#ef4444" }} />
        </div>
        <div className="text-sm font-bold mb-1">Удалить сотрудника?</div>
        <div className="text-xs mb-4" style={{ color: muted }}>{member.name || member.email}</div>
        <div className="text-xs rounded-xl px-3 py-2 mb-5"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#fca5a5" }}>
          Все его сессии будут завершены. Доступ к CRM пропадёт сразу. Восстановить нельзя.
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center"
            style={{ background: "#ef4444" }}>
            {busy
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : "Удалить"}
          </button>
          <button onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm transition"
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
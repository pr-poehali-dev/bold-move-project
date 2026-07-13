import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { fetchTeamRoles, deleteTeamRole, type TeamRole } from "./teamApi";
import { ALL_PERM_KEYS } from "./PermissionsEditor";
import EditRoleModal from "./EditRoleModal";

interface Props { isDark: boolean }

export default function TeamRolesPanel({ isDark }: Props) {
  const { token } = useAuth();
  const [roles,   setRoles]   = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  const [editFor,    setEditFor]    = useState<TeamRole | "new" | null>(null);
  const [confirmDel, setConfirmDel] = useState<TeamRole | null>(null);
  const [delBusy,    setDelBusy]    = useState(false);

  const reload = async () => {
    setLoading(true); setErr("");
    try {
      const list = await fetchTeamRoles(token);
      setRoles(list);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelBusy(true);
    try {
      await deleteTeamRole(token, confirmDel.id);
      setRoles(prev => prev.filter(r => r.id !== confirmDel.id));
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
            <h1 className="text-xl sm:text-2xl font-black mb-1">Роли команды</h1>
            <div className="text-[12px]" style={{ color: muted }}>
              Готовые наборы прав — назначайте сотруднику роль одним кликом
            </div>
          </div>
          <button onClick={() => setEditFor("new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#7c3aed" }}>
            <Icon name="Plus" size={14} />
            Создать роль
          </button>
        </div>

        {/* Информашка */}
        <div className="rounded-xl px-4 py-3 mb-5 text-[12px] flex items-start gap-2.5"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)", color: isDark ? "#c4b5fd" : "#6d28d9" }}>
          <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Создайте роль (например «Замерщик» или «Колл-центр») с нужным набором прав. При приглашении сотрудника
            или в настройке доступа выберите роль — все галочки подставятся сразу. Изменения роли применяются
            ко всем сотрудникам, которые её используют.
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
        ) : roles.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center"
            style={{ background: cardBg, border: `1px dashed ${border}` }}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.12)" }}>
              <Icon name="Tags" size={26} style={{ color: "#a78bfa" }} />
            </div>
            <div className="text-base font-bold mb-1">Ролей пока нет</div>
            <div className="text-[12px] mb-5" style={{ color: muted }}>
              Создайте первую роль, например «Технолог» или «Замерщик»
            </div>
            <button onClick={() => setEditFor("new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#7c3aed" }}>
              <Icon name="Plus" size={14} />
              Создать роль
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {roles.map(r => (
              <RoleCard key={r.id} role={r} isDark={isDark}
                onEdit={() => setEditFor(r)}
                onDelete={() => setConfirmDel(r)} />
            ))}
          </div>
        )}
      </div>

      {/* Модалки */}
      {editFor && (
        <EditRoleModal isDark={isDark}
          role={editFor === "new" ? null : editFor}
          onClose={() => setEditFor(null)}
          onSaved={(r, isNew) => {
            setRoles(prev => isNew ? [...prev, r] : prev.map(x => x.id === r.id ? r : x));
            setEditFor(null);
          }} />
      )}
      {confirmDel && (
        <ConfirmDeleteRoleModal isDark={isDark} role={confirmDel} busy={delBusy}
          onCancel={() => setConfirmDel(null)} onConfirm={doDelete} />
      )}
    </div>
  );
}

function RoleCard({ role, isDark, onEdit, onDelete }: {
  role: TeamRole; isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";

  const activeCount = Object.values(role.permissions || {}).filter(Boolean).length;
  const totalCount  = ALL_PERM_KEYS.length;

  return (
    <div className="rounded-2xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.18)" }}>
          <Icon name="Tag" size={17} style={{ color: "#a78bfa" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{role.name}</div>
          <div className="text-[11px]" style={{ color: muted }}>{activeCount} / {totalCount} разделов</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.32)" }}>
          <Icon name="Pencil" size={11} />
          Изменить
        </button>
        <button onClick={onDelete}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
          <Icon name="Trash2" size={11} />
        </button>
      </div>
    </div>
  );
}

function ConfirmDeleteRoleModal({ isDark, role, busy, onCancel, onConfirm }: {
  isDark: boolean; role: TeamRole; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: bg, border: `1.5px solid rgba(239,68,68,0.30)`, color: text }}
        onClick={e => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(239,68,68,0.15)" }}>
          <Icon name="Trash2" size={20} style={{ color: "#ef4444" }} />
        </div>
        <div className="text-sm font-bold mb-1">Удалить роль?</div>
        <div className="text-xs mb-4" style={{ color: muted }}>{role.name}</div>
        <div className="text-xs rounded-xl px-3 py-2 mb-5"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#fca5a5" }}>
          Сотрудники, у которых была назначена эта роль, сохранят свои текущие права — но привязка к роли пропадёт.
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
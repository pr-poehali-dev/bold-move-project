import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser, UserEstimate } from "./masterAdminTypes";

interface Props {
  users: AppUser[];
  loading: boolean;
  search: string;
  selectedUser: AppUser | null;
  userEstimates: UserEstimate[];
  estLoading: boolean;
  approvingId: number | null;
  onSearch: (v: string) => void;
  onSelectUser: (u: AppUser) => void;
  onApprove: (id: number) => void;
}

export default function MasterTabAllUsers({
  users, loading, search, selectedUser, userEstimates,
  estLoading, approvingId, onSearch, onSelectUser, onApprove,
}: Props) {
  const filtered = users.filter(u =>
    !search ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)]">

      {/* Левая: список */}
      <div className="w-80 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">Пользователи</span>
            <span className="text-xs px-2 py-0.5 rounded-lg font-bold"
              style={{ background: "#10b98120", color: "#10b981" }}>{users.length}</span>
          </div>
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.map(u => (
            <button key={u.id} onClick={() => onSelectUser(u)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left transition border-b border-white/[0.04] hover:bg-white/[0.03]"
              style={selectedUser?.id === u.id ? { background: "rgba(16,185,129,0.08)" } : {}}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "#10b98120", color: "#10b981" }}>
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold truncate text-white/90">{u.name || "—"}</span>
                  <RoleBadge role={u.role} />
                </div>
                <div className="text-xs truncate text-white/30">{u.email}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/20">{new Date(u.created_at).toLocaleDateString("ru-RU")}</span>
                  {!u.approved && (
                    <span className="text-[10px] text-red-400">ожидает</span>
                  )}
                  {u.estimates_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: "#7c3aed18", color: "#a78bfa" }}>
                      {u.estimates_count} смет
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Правая: детали */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
            <Icon name="Users" size={40} className="opacity-30" />
            <span className="text-sm">Выберите пользователя</span>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-6 p-5 rounded-2xl"
              style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: "#10b98120", color: "#10b981" }}>
                {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">{selectedUser.name || "—"}</span>
                  <RoleBadge role={selectedUser.role} />
                  {!selectedUser.approved && (
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-500/20 text-amber-400">ожидает одобрения</span>
                  )}
                </div>
                <div className="text-sm text-white/40">{selectedUser.email}</div>
                {selectedUser.phone && <div className="text-sm text-white/40">{selectedUser.phone}</div>}
                {selectedUser.discount > 0 && (
                  <div className="text-xs text-violet-300 mt-1">Скидка: {selectedUser.discount}%</div>
                )}
                <div className="text-xs text-white/20 mt-1">
                  Зарегистрирован: {new Date(selectedUser.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
                <div className="text-xs text-white/30">смет сохранено</div>
              </div>
            </div>

            {!selectedUser.approved && (
              <button onClick={() => onApprove(selectedUser.id)} disabled={approvingId === selectedUser.id}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white mb-4 transition disabled:opacity-50"
                style={{ background: "#10b981" }}>
                {approvingId === selectedUser.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Icon name="CheckCircle2" size={16} />}
                Одобрить доступ
              </button>
            )}

            <div>
              <div className="text-sm font-bold mb-3 text-white/70">Сметы и заявки</div>
              {estLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userEstimates.length === 0 ? (
                <div className="text-center py-8 text-sm text-white/20">Смет нет</div>
              ) : (
                <div className="space-y-2">
                  {userEstimates.map(e => (
                    <div key={e.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "#7c3aed18" }}>
                        <Icon name="FileSpreadsheet" size={14} style={{ color: "#a78bfa" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{e.title}</div>
                        <div className="text-xs text-white/30 mt-0.5">
                          {new Date(e.created_at).toLocaleDateString("ru-RU")}
                          {e.crm_status && <span className="ml-2 text-violet-300">· {e.crm_status}</span>}
                        </div>
                      </div>
                      {e.total_standard && (
                        <div className="text-sm font-bold text-emerald-400 flex-shrink-0">
                          {Math.round(e.total_standard).toLocaleString("ru-RU")} ₽
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

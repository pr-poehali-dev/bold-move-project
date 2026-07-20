import { useState } from "react";
import Icon from "@/components/ui/icon";
import MasterTabBusiness from "./MasterTabBusiness";
import MasterTabAllUsers from "./MasterTabAllUsers";
import type { AppUser, UserEstimate } from "./masterAdminTypes";

type RoleTab = "company" | "installer" | "designer" | "foreman" | "client" | "all";
type SourceFilter = "all" | "self" | "invited";
type ViewMode = "cards" | "table";

interface Props {
  allUsers:   AppUser[];
  allLoading: boolean;
  onReloadAll:   () => void;
  search:        string;
  selectedUser:  AppUser | null;
  userEstimates: UserEstimate[];
  estLoading:    boolean;
  approvingId:   number | null;
  onSearch:      (v: string) => void;
  onSelectUser:  (u: AppUser) => void;
  onApprove:     (id: number) => void;
}

const ROLE_TABS: { id: RoleTab; label: string }[] = [
  { id: "company",   label: "Компании" },
  { id: "installer", label: "Монтажники" },
  { id: "designer",  label: "Дизайнеры" },
  { id: "foreman",   label: "Прорабы" },
  { id: "client",    label: "Клиенты" },
  { id: "all",       label: "Все" },
];

export default function MasterTabUsers({
  allUsers, allLoading, onReloadAll,
  search, selectedUser, userEstimates, estLoading, approvingId,
  onSearch, onSelectUser, onApprove,
}: Props) {
  const [roleTab, setRoleTab] = useState<RoleTab>("company");
  const [source,  setSource]  = useState<SourceFilter>("all");
  const [view,    setView]    = useState<ViewMode>("cards");

  // Счётчик "ожидают" для бейджа таба
  const pendingCount = (role: string) =>
    allUsers.filter(u => u.role === role && !u.approved && !u.rejected).length;

  // Список для текущего таба (для табличного вида)
  const scopedUsers = roleTab === "all"
    ? allUsers
    : allUsers.filter(u => u.role === roleTab);

  const showSourceFilter = roleTab === "company" || roleTab === "installer";
  const removedGroup: "business" | "pro" = (roleTab === "designer" || roleTab === "foreman") ? "pro" : "business";

  return (
    <div className="flex flex-col h-full">
      {/* Табы по ролям + переключатель вида */}
      <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-0 border-b border-white/[0.06] overflow-x-auto" style={{ background: "#07070f" }}>
        <div className="flex gap-1">
          {ROLE_TABS.map(t => {
            const badge = t.id !== "all" && t.id !== "client" ? pendingCount(t.id) : 0;
            return (
              <button key={t.id} onClick={() => setRoleTab(t.id)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap"
                style={roleTab === t.id
                  ? { background: "rgba(255,255,255,0.06)", color: "#fff", borderBottom: "2px solid #a78bfa" }
                  : { color: "rgba(255,255,255,0.35)" }}>
                {t.label}
                {badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#ef4444", color: "#fff" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Переключатель вида — единый для всех ролей */}
        <div className="flex gap-1 flex-shrink-0 pb-2">
          <button onClick={() => setView("cards")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition border"
            style={view === "cards"
              ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
              : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
            <Icon name="LayoutGrid" size={11} /> Карточки
          </button>
          <button onClick={() => setView("table")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition border"
            style={view === "table"
              ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
              : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
            <Icon name="Table" size={11} /> Таблица
          </button>
        </div>
      </div>

      {/* Фильтр источника (только для компаний/монтажников) */}
      {showSourceFilter && (
        <div className="flex items-center gap-1.5 px-5 pt-3" style={{ background: "#07070f" }}>
          <span className="text-[10px] text-white/25 mr-1">Источник:</span>
          {([
            { id: "all",     label: "Все" },
            { id: "self",    label: "Сам зашёл" },
            { id: "invited", label: "Приглашён вами" },
          ] as { id: SourceFilter; label: string }[]).map(s => (
            <button key={s.id} onClick={() => setSource(s.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
              style={source === s.id
                ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
                : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
              {s.id === "self" && <Icon name="UserPlus" size={10} />}
              {s.id === "invited" && <Icon name="Send" size={10} />}
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {view === "cards" ? (
          <MasterTabBusiness
            users={allUsers}
            loading={allLoading}
            onReload={onReloadAll}
            roleFilter={roleTab === "all" ? undefined : roleTab}
            sourceFilter={showSourceFilter ? source : "all"}
            removedGroup={removedGroup}
          />
        ) : (
          <MasterTabAllUsers
            users={scopedUsers} loading={allLoading} search={search}
            selectedUser={selectedUser} userEstimates={userEstimates}
            estLoading={estLoading} approvingId={approvingId}
            onSearch={onSearch} onSelectUser={onSelectUser}
            onApprove={onApprove} onReload={onReloadAll}
          />
        )}
      </div>
    </div>
  );
}

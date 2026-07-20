import { useState } from "react";
import Icon from "@/components/ui/icon";
import MasterTabBusiness from "./MasterTabBusiness";
import MasterTabPro      from "./MasterTabPro";
import MasterTabAllUsers from "./MasterTabAllUsers";
import type { BusinessUser, ProUser, AppUser, UserEstimate } from "./masterAdminTypes";

type RoleTab = "all" | "company" | "installer" | "pro" | "client";
type SourceFilter = "all" | "self" | "invited";

interface Props {
  // bizUsers — компании и монтажники (богатые карточки)
  bizUsers:   BusinessUser[];
  bizLoading: boolean;
  onReloadBiz: () => void;
  // proUsers — дизайнеры/прорабы
  proUsers:   ProUser[];
  proLoading: boolean;
  editDiscount:   { id: number; value: string } | null;
  savingDiscount: boolean;
  onEditDiscount: (val: { id: number; value: string } | null) => void;
  onSaveDiscount: () => void;
  onReloadPro:    () => void;
  // allUsers — общий список (для клиентов и вида "Все")
  allUsers:   AppUser[];
  allLoading: boolean;
  search:     string;
  selectedUser:  AppUser | null;
  userEstimates: UserEstimate[];
  estLoading:    boolean;
  approvingId:   number | null;
  onSearch:      (v: string) => void;
  onSelectUser:  (u: AppUser) => void;
  onApprove:     (id: number) => void;
  onReloadAll:   () => void;
}

export default function MasterTabUsers(props: Props) {
  const {
    bizUsers, bizLoading, onReloadBiz,
    proUsers, proLoading, editDiscount, savingDiscount, onEditDiscount, onSaveDiscount, onReloadPro,
    allUsers, allLoading, search, selectedUser, userEstimates, estLoading, approvingId,
    onSearch, onSelectUser, onApprove, onReloadAll,
  } = props;

  const [roleTab, setRoleTab]     = useState<RoleTab>("company");
  const [source,  setSource]      = useState<SourceFilter>("all");

  const clientUsers = allUsers.filter(u => u.role === "client");

  const ROLE_TABS: { id: RoleTab; label: string; badge?: number }[] = [
    { id: "company",   label: "Компании",  badge: bizUsers.filter(u => u.role === "company" && !u.approved && !u.rejected).length },
    { id: "installer", label: "Монтажники", badge: bizUsers.filter(u => u.role === "installer" && !u.approved && !u.rejected).length },
    { id: "pro",       label: "Дизайнеры / Прорабы", badge: proUsers.filter(u => !u.approved).length },
    { id: "client",    label: "Клиенты" },
    { id: "all",       label: "Все" },
  ];

  const showSourceFilter = roleTab === "company" || roleTab === "installer";

  return (
    <div className="flex flex-col h-full">
      {/* Табы по ролям */}
      <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-white/[0.06] overflow-x-auto" style={{ background: "#07070f" }}>
        {ROLE_TABS.map(t => (
          <button key={t.id} onClick={() => setRoleTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap"
            style={roleTab === t.id
              ? { background: "rgba(255,255,255,0.06)", color: "#fff", borderBottom: "2px solid #a78bfa" }
              : { color: "rgba(255,255,255,0.35)" }}>
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#ef4444", color: "#fff" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
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
        {(roleTab === "company" || roleTab === "installer") && (
          <MasterTabBusiness
            users={bizUsers}
            loading={bizLoading}
            onReload={onReloadBiz}
            roleFilter={roleTab}
            sourceFilter={source}
          />
        )}

        {roleTab === "pro" && (
          <MasterTabPro
            users={proUsers}
            loading={proLoading}
            editDiscount={editDiscount}
            savingDiscount={savingDiscount}
            onEditDiscount={onEditDiscount}
            onSaveDiscount={onSaveDiscount}
            onReload={onReloadPro}
          />
        )}

        {roleTab === "client" && (
          <MasterTabAllUsers
            users={clientUsers} loading={allLoading} search={search}
            selectedUser={selectedUser} userEstimates={userEstimates}
            estLoading={estLoading} approvingId={approvingId}
            onSearch={onSearch} onSelectUser={onSelectUser}
            onApprove={onApprove} onReload={onReloadAll}
          />
        )}

        {roleTab === "all" && (
          <MasterTabAllUsers
            users={allUsers} loading={allLoading} search={search}
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
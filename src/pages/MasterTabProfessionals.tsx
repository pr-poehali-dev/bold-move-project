import { useState } from "react";
import MasterTabBusiness from "./MasterTabBusiness";
import MasterTabPro      from "./MasterTabPro";
import type { BusinessUser, ProUser } from "./masterAdminTypes";

type SubTab = "business" | "pro";

interface Props {
  bizUsers:       BusinessUser[];
  bizLoading:     boolean;
  proUsers:       ProUser[];
  proLoading:     boolean;
  editDiscount:   { id: number; value: string } | null;
  savingDiscount: boolean;
  pendingCount:   number;
  onEditDiscount: (val: { id: number; value: string } | null) => void;
  onSaveDiscount: () => void;
  onReloadBiz:    () => void;
  onReloadPro:    () => void;
}

export default function MasterTabProfessionals({
  bizUsers, bizLoading, proUsers, proLoading,
  editDiscount, savingDiscount, pendingCount,
  onEditDiscount, onSaveDiscount, onReloadBiz, onReloadPro,
}: Props) {
  const [sub, setSub] = useState<SubTab>("business");

  const SUBTABS: { id: SubTab; label: string; badge?: number }[] = [
    { id: "business", label: "Монтажники / Компании", badge: pendingCount },
    { id: "pro",      label: "Дизайнеры / Прорабы" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Подтабы */}
      <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-white/[0.06]"
        style={{ background: "#07070f" }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap"
            style={sub === t.id
              ? { background: "rgba(255,255,255,0.06)", color: "#fff", borderBottom: "2px solid #a78bfa" }
              : { color: "rgba(255,255,255,0.35)" }}>
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "#ef4444", color: "#fff" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {sub === "business" && (
          <MasterTabBusiness
            users={bizUsers}
            loading={bizLoading}
            onReload={onReloadBiz}
          />
        )}
        {sub === "pro" && (
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
      </div>
    </div>
  );
}

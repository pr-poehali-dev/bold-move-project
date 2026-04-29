import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser, UserEstimate } from "./masterAdminTypes";
import { fmtDate, ROLE_LABELS } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";
import { useAuth } from "@/context/AuthContext";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

const PACKAGES = [
  { id: "start",    label: "Старт",    estimates: 5,   price: 490 },
  { id: "standard", label: "Стандарт", estimates: 20,  price: 990 },
  { id: "pro",      label: "Про",      estimates: 60,  price: 1990 },
  { id: "business", label: "Бизнес",   estimates: 150, price: 3990 },
];

interface Props {
  selectedUser:  AppUser | null;
  userEstimates: UserEstimate[];
  estLoading:    boolean;
  approvingId:   number | null;
  onApprove:     (id: number) => void;
  onConfirmDel:  (u: AppUser) => void;
  onAddBalance:  (userId: number, amount: number, reason: string) => Promise<void>;
  onToggleOwnAgent: (userId: number, enable: boolean) => Promise<void>;
}

export default function AllUsersPanel({
  selectedUser, userEstimates, estLoading, approvingId,
  onApprove, onConfirmDel, onAddBalance, onToggleOwnAgent,
}: Props) {
  const { user: masterUser } = useAuth();
  const [agentBusy,  setAgentBusy]  = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [addingPkg,    setAddingPkg]    = useState<string | null>(null);
  const [loginBusy,  setLoginBusy]  = useState(false);

  const loginAsUser = async () => {
    if (!selectedUser) return;
    setLoginBusy(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${localStorage.getItem("mp_user_token")}`,
        },
        body: JSON.stringify({ user_id: selectedUser.id }),
      });
      const d = await r.json();
      if (d.token) {
        const masterToken = localStorage.getItem("mp_user_token");
        const masterName  = masterUser?.name || masterUser?.email?.split("@")[0] || "Мастер";
        if (masterToken) {
          localStorage.setItem("mp_master_token", masterToken);
          localStorage.setItem("mp_master_name", masterName);
        }
        localStorage.setItem("mp_user_token", d.token);
        window.location.href = "/company";
      } else {
        alert("Не удалось войти: " + (d.error || "?"));
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleAddPackage = async (pkg: typeof PACKAGES[0]) => {
    if (!selectedUser) return;
    setAddingPkg(pkg.id);
    await onAddBalance(selectedUser.id, pkg.estimates, `package_${pkg.id}`);
    setAddingPkg(null);
    setShowPackages(false);
  };

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8"
        style={{ color: "rgba(255,255,255,0.12)" }}>
        <Icon name="MousePointerClick" size={28} />
        <span className="text-xs text-center">Нажмите на строку чтобы открыть детали</span>
      </div>
    );
  }

  const roleColor  = ROLE_LABELS[selectedUser.role]?.color ?? "#94a3b8";
  const hasSubRole = ["installer","company"].includes(selectedUser.role);
  const balance    = selectedUser.estimates_balance ?? 0;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">

      {/* Шапка */}
      <div className="p-5 border-b border-white/[0.05]">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ background: roleColor + "18", color: roleColor }}>
            {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white mb-1 truncate">{selectedUser.name || "—"}</div>
            <div className="flex items-center gap-1 flex-wrap mb-1">
              <RoleBadge role={selectedUser.role} />
              {selectedUser.rejected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>✗ откл.</span>
              )}
              {!selectedUser.approved && !selectedUser.rejected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#f59e0b15", color: "#f59e0b" }}>ожидает</span>
              )}
              {selectedUser.approved && !selectedUser.rejected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#10b98115", color: "#10b981" }}>✓ одобрен</span>
              )}
            </div>
            <div className="text-[10px] text-white/30 truncate">{selectedUser.email}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-black" style={{ color: "#10b981" }}>{selectedUser.estimates_count}</div>
            <div className="text-[9px] text-white/25">смет</div>
          </div>
        </div>

        {/* Войти как этот пользователь */}
        <button onClick={loginAsUser} disabled={loginBusy}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-50"
          style={{ background: "rgba(217,119,6,0.15)", color: "#fbbf24", border: "1px solid rgba(217,119,6,0.35)" }}>
          {loginBusy
            ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Входим...</>
            : <><Icon name="Eye" size={12} /> Войти как этот пользователь</>}
        </button>
      </div>

      {/* Поля */}
      <div className="px-5 py-3 space-y-0 border-b border-white/[0.05]">
        {[
          { label: "ID",      value: `#${selectedUser.id}` },
          { label: "Зарег.",  value: fmtDate(selectedUser.created_at) },
          { label: "Телефон", value: selectedUser.phone || "—" },
          ...(selectedUser.discount > 0 ? [{ label: "Скидка", value: `${selectedUser.discount}%` }] : []),
        ].map(row => (
          <div key={row.label} className="flex justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0">
            <span className="text-white/28">{row.label}</span>
            <span className="text-white/60">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Баланс смет (для монтажников/компаний) */}
      {hasSubRole && (
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <div className="text-[9px] font-bold text-white/25 uppercase tracking-wider mb-2">Баланс смет</div>

          {/* Счётчик */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg"
                style={{ background: balance > 0 ? "#10b98118" : "#ef444418", color: balance > 0 ? "#10b981" : "#ef4444" }}>
                {balance}
              </div>
              <div>
                <div className="text-xs font-semibold text-white/70">
                  {balance > 0 ? `${balance} смет` : "Нет смет"}
                </div>
                <div className="text-[9px] text-white/25">
                  {balance > 0 ? "доступно для расчёта" : "пополните баланс"}
                </div>
              </div>
            </div>
          </div>

          {/* Начислить пакет */}
          {showPackages ? (
            <div className="space-y-1.5">
              <div className="text-[9px] text-white/30 mb-2">Выберите пакет для начисления:</div>
              {PACKAGES.map(pkg => (
                <button key={pkg.id}
                  onClick={() => handleAddPackage(pkg)}
                  disabled={addingPkg === pkg.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition disabled:opacity-50"
                  style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                  <span className="font-semibold">{pkg.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">+{pkg.estimates} смет</span>
                    <span className="font-bold">{pkg.price.toLocaleString("ru-RU")} ₽</span>
                    {addingPkg === pkg.id && (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </button>
              ))}
              <button onClick={() => setShowPackages(false)}
                className="w-full text-center text-[10px] text-white/25 hover:text-white/50 py-1 transition">
                Отмена
              </button>
            </div>
          ) : (
            <button onClick={() => setShowPackages(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition"
              style={{ background: "#7c3aed15", color: "#a78bfa", border: "1px solid #7c3aed28" }}>
              <Icon name="Plus" size={11} /> Начислить пакет
            </button>
          )}
        </div>
      )}

      {/* Свой агент (только для компаний) */}
      {selectedUser.role === "company" && (
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <div className="text-[9px] font-bold text-white/25 uppercase tracking-wider mb-2">Свой агент · 80 000 ₽</div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: selectedUser.has_own_agent ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.04)" }}>
                <Icon name={selectedUser.has_own_agent ? "BotMessageSquare" : "Bot"} size={13}
                  style={{ color: selectedUser.has_own_agent ? "#10b981" : "rgba(255,255,255,0.4)" }} />
              </div>
              <div>
                <div className="text-[11px] font-bold" style={{ color: selectedUser.has_own_agent ? "#10b981" : "rgba(255,255,255,0.55)" }}>
                  {selectedUser.has_own_agent ? "Активирован" : "Не активирован"}
                </div>
                {selectedUser.agent_purchased_at && selectedUser.has_own_agent && (
                  <div className="text-[9px] text-white/25">с {fmtDate(selectedUser.agent_purchased_at)}</div>
                )}
              </div>
            </div>
            <button
              onClick={async () => {
                if (agentBusy) return;
                setAgentBusy(true);
                await onToggleOwnAgent(selectedUser.id, !selectedUser.has_own_agent);
                setAgentBusy(false);
              }}
              disabled={agentBusy}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
              style={{
                background: selectedUser.has_own_agent ? "#ef444415" : "#10b981",
                color: selectedUser.has_own_agent ? "#ef4444" : "#fff",
                border: selectedUser.has_own_agent ? "1px solid #ef444430" : "none",
              }}>
              {agentBusy
                ? "..."
                : selectedUser.has_own_agent ? "Отключить" : "Активировать"}
            </button>
          </div>
        </div>
      )}

      {/* Одобрить */}
      {!selectedUser.approved && !selectedUser.rejected && (
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <button onClick={() => onApprove(selectedUser.id)} disabled={approvingId === selectedUser.id}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "#10b981" }}>
            {approvingId === selectedUser.id
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Icon name="Check" size={13} /> Одобрить</>}
          </button>
        </div>
      )}

      {/* Сметы */}
      {estLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : userEstimates.length > 0 && (
        <div className="px-5 py-3 flex-1">
          <div className="text-[9px] font-bold text-white/25 uppercase tracking-wider mb-2">Сметы</div>
          <div className="space-y-1.5">
            {userEstimates.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/65 truncate">{e.title}</div>
                  <div className="text-[9px] text-white/25">{fmtDate(e.created_at)}</div>
                </div>
                {e.total_standard != null && (
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#10b981" }}>
                    {e.total_standard.toLocaleString("ru-RU")} ₽
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Удалить */}
      <div className="p-4 mt-auto border-t border-white/[0.05]">
        <button onClick={() => onConfirmDel(selectedUser)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition"
          style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444420" }}>
          <Icon name="Trash2" size={12} /> Удалить пользователя
        </button>
      </div>
    </div>
  );
}
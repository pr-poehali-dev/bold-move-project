import { useState } from "react";
import Icon from "@/components/ui/icon";
import RoleBadge from "./MasterRoleBadge";
import type { AppUser, UserTransaction } from "./masterAdminTypes";
import { fmtDate } from "./masterAdminTypes";
import CompanyMembers from "./CompanyMembers";
import { masterHeaders } from "./masterAuthFetch";
import { AUTH_URL, loginAsUser, daysSince, trialDaysLeft, PACKAGES } from "./masterBusinessShared";

// ── Карточка пользователя ─────────────────────────────────────────────────
export default function BusinessCard({ u, actionId, onApprove, onReject, onDelete, onAddBalance, onSetDiscount }: {
  u: AppUser;
  actionId: number | null;
  onApprove: (id: number) => void;
  onReject:  (id: number) => void;
  onDelete:  () => void;
  onAddBalance: (userId: number, amount: number, reason: string) => Promise<void>;
  onSetDiscount?: (userId: number, discount: number) => Promise<void>;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [txLoading, setTxLoading]       = useState(false);
  const [transactions, setTransactions] = useState<UserTransaction[] | null>(null);
  const [showPackages, setShowPackages] = useState(false);
  const [addingPkg,    setAddingPkg]    = useState<string | null>(null);
  const [showMembers,  setShowMembers]  = useState(false);
  const [loginBusy,    setLoginBusy]    = useState(false);
  const [editDiscount, setEditDiscount] = useState<string | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);

  // Бизнес-роли (компании/монтажники) имеют баланс, пробный, агента.
  // Дизайнеры/прорабы — скидку. Клиенты — только базовую инфу.
  const isBusiness = u.role === "company" || u.role === "installer";
  const isPro      = u.role === "designer" || u.role === "foreman";

  const isLoading   = actionId === u.id;
  const borderColor = u.rejected ? "#ef444430" : u.approved ? "#10b98130" : "#f59e0b30";
  const trialLeft   = trialDaysLeft(u.trial_until ?? null);
  const hasTrial    = !!u.trial_until;
  const trialActive = trialLeft > 0;
  const hasBalance  = u.estimates_balance > 0;

  const handleSaveDiscount = async () => {
    if (editDiscount === null || !onSetDiscount) return;
    setDiscountBusy(true);
    await onSetDiscount(u.id, parseInt(editDiscount) || 0);
    setDiscountBusy(false);
    setEditDiscount(null);
  };

  const loadTransactions = async () => {
    if (transactions) { setExpanded(v => !v); return; }
    setTxLoading(true);
    setExpanded(true);
    const r = await fetch(`${AUTH_URL}?action=admin-user-transactions&user_id=${u.id}`, { headers: masterHeaders() });
    const d = await r.json();
    setTransactions(d.transactions || []);
    setTxLoading(false);
  };

  const handleAddPackage = async (pkg: typeof PACKAGES[0]) => {
    setAddingPkg(pkg.id);
    await onAddBalance(u.id, pkg.estimates, `package_${pkg.id}`);
    setAddingPkg(null);
    setShowPackages(false);
  };

  // Статус пробного периода
  const getTrialStatus = () => {
    if (!hasTrial) return { label: "Пробный не выдан", color: "#475569", icon: "CircleDashed" };
    if (trialActive) return { label: `Пробный активен · ${trialLeft} дн. осталось`, color: "#10b981", icon: "CheckCircle2" };
    if (hasBalance)   return { label: "Пробный истёк · доступ по балансу смет", color: "#10b981", icon: "CheckCircle2" };
    return { label: "Пробный истёк · доступ закрыт", color: "#ef4444", icon: "XCircle" };
  };
  const trial = getTrialStatus();

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d1b", border: `1.5px solid ${borderColor}` }}>
      <div className="p-5">
        {/* Шапка */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: u.role === "company" ? "#f59e0b18" : "#60a5fa18", color: u.role === "company" ? "#f59e0b" : "#60a5fa" }}>
            {(u.name || u.email || "?")[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-sm font-bold text-white">{u.name || "—"}</span>
              <RoleBadge role={u.role} />
              {u.approved && !u.rejected && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#10b98118", color: "#10b981" }}>✓ одобрен</span>}
              {u.rejected && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#ef444418", color: "#ef4444" }}>✗ отклонён</span>}
              {!u.approved && !u.rejected && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#f59e0b18", color: "#f59e0b" }}>ожидает</span>}
              {u.has_own_agent && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#a78bfa18", color: "#a78bfa" }}>✦ WL агент</span>}
              {u.source === "invited"
                ? <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#a78bfa18", color: "#a78bfa" }}>➤ приглашён вами</span>
                : <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#60a5fa18", color: "#60a5fa" }}>➤ сам зашёл</span>}
            </div>
            <div className="text-[11px] text-white/35">{u.email}</div>
            {u.phone && <div className="text-[10px] text-white/25 mt-0.5">{u.phone}</div>}
          </div>

          {/* Действия */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!u.approved && !u.rejected && (
              <>
                <button onClick={() => onApprove(u.id)} disabled={isLoading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-40"
                  style={{ background: "#10b981" }}>
                  {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={12} />}
                  Одобрить
                </button>
                <button onClick={() => onReject(u.id)} disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40"
                  style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
                  <Icon name="X" size={12} /> Отклонить
                </button>
              </>
            )}
            {u.approved && !u.rejected && (
              <button onClick={() => onReject(u.id)} disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                style={{ background: "#ef444410", color: "#ef4444", border: "1px solid #ef444425" }}>
                <Icon name="UserX" size={11} /> Отозвать
              </button>
            )}
            {u.rejected && (
              <button onClick={() => onApprove(u.id)} disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                style={{ background: "#10b98110", color: "#10b981", border: "1px solid #10b98125" }}>
                <Icon name="UserCheck" size={11} /> Одобрить
              </button>
            )}
            <button onClick={async () => { setLoginBusy(true); await loginAsUser(u.id); setLoginBusy(false); }}
              disabled={loginBusy}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-50"
              style={{ background: "rgba(217,119,6,0.15)", color: "#fbbf24", border: "1px solid rgba(217,119,6,0.3)" }}
              title="Войти как этот пользователь">
              {loginBusy ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name="Eye" size={13} />}
            </button>
            <button onClick={onDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
              style={{ background: "#ef444410", color: "#ef4444" }}>
              <Icon name="Trash2" size={13} />
            </button>
          </div>
        </div>

        {/* Блок данных */}
        <div className="mt-4 pt-3.5 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-3 gap-3">

          {/* Регистрация */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">Зарегистрирован</div>
            <div className="text-xs font-semibold text-white/80">{fmtDate(u.created_at)}</div>
            <div className="text-[10px] text-white/30 mt-0.5">{daysSince(u.created_at)} дн. назад · ID #{u.id}</div>
          </div>

          {/* Скидка (для дизайнеров/прорабов) */}
          {isPro && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">Скидка</div>
              {editDiscount !== null ? (
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} max={100} value={editDiscount}
                    onChange={e => setEditDiscount(e.target.value)}
                    className="w-12 rounded px-1.5 py-1 text-xs text-center focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(167,139,250,0.35)", color: "#fff" }} />
                  <span className="text-xs text-white/30">%</span>
                  <button onClick={handleSaveDiscount} disabled={discountBusy}
                    className="px-2 py-1 rounded text-[10px] font-bold text-white disabled:opacity-50" style={{ background: "#a78bfa" }}>
                    {discountBusy ? "..." : "✓"}
                  </button>
                  <button onClick={() => setEditDiscount(null)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => setEditDiscount(String(u.discount))}
                  className="flex items-center gap-1 text-sm font-black" style={{ color: "#a78bfa" }}>
                  {u.discount > 0 ? `${u.discount}%` : "0%"}
                  <Icon name="Pencil" size={10} style={{ color: "#a78bfa80" }} />
                </button>
              )}
            </div>
          )}

          {/* Бизнес-блоки: пробный, агент, баланс — только для компаний/монтажников */}
          {isBusiness && (<>
          {/* Пробный период */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">Пробный период</div>
            <div className="flex items-center gap-1.5">
              <Icon name={trial.icon as "CheckCircle2"} size={11} style={{ color: trial.color }} />
              <span className="text-[11px] font-semibold" style={{ color: trial.color }}>{trial.label}</span>
            </div>
            {hasTrial && (
              <div className="text-[10px] text-white/30 mt-0.5">
                До {fmtDate(u.trial_until ?? null)}
              </div>
            )}
          </div>

          {/* Агент */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">White Label Агент</div>
            {u.has_own_agent ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Icon name="Sparkles" size={11} style={{ color: "#a78bfa" }} />
                  <span className="text-[11px] font-bold" style={{ color: "#a78bfa" }}>Оплачен</span>
                </div>
                {u.agent_purchased_at && (
                  <div className="text-[10px] text-white/30 mt-0.5">{fmtDate(u.agent_purchased_at)}</div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <Icon name="Circle" size={11} style={{ color: "#475569" }} />
                <span className="text-[11px] text-white/30">Не оплачен</span>
              </div>
            )}
          </div>

          {/* Смет сейчас */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">Смет сейчас</div>
            <div className="text-lg font-black" style={{ color: u.estimates_balance > 0 ? "#10b981" : "#ef4444" }}>
              {u.estimates_balance}
            </div>
            <div className="text-[10px] text-white/30">доступно</div>
          </div>

          {/* Куплено всего */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[9px] uppercase tracking-wider text-white/25 mb-1">Куплено всего</div>
            <div className="text-lg font-black text-white/80">{u.total_bought ?? 0}</div>
            <div className="text-[10px] text-white/30">смет за всё время</div>
          </div>

          {/* История покупок — кнопка */}
          <div className="rounded-xl px-3 py-2.5 flex items-center justify-center cursor-pointer transition hover:bg-white/[0.05]"
            style={{ background: "rgba(255,255,255,0.03)" }}
            onClick={loadTransactions}>
            <div className="text-center">
              <Icon name="History" size={16} style={{ color: "#a78bfa", margin: "0 auto 4px" }} />
              <div className="text-[10px] font-bold" style={{ color: "#a78bfa" }}>
                {txLoading ? "Загрузка..." : expanded ? "Скрыть историю" : "История покупок"}
              </div>
            </div>
          </div>
          </>)}
        </div>

        {/* Пополнить баланс смет — только для бизнес-ролей */}
        {isBusiness && (
        <div className="mt-3">
          {showPackages ? (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div className="text-[9px] text-white/30 mb-1.5">Выберите пакет для начисления:</div>
              {PACKAGES.map(pkg => (
                <button key={pkg.id}
                  onClick={() => handleAddPackage(pkg)}
                  disabled={addingPkg === pkg.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition disabled:opacity-50"
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
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition"
              style={{ background: "#7c3aed15", color: "#a78bfa", border: "1px solid #7c3aed28" }}>
              <Icon name="Plus" size={12} /> Пополнить баланс смет
            </button>
          )}
        </div>
        )}

        {/* Сотрудники компании */}
        {u.role === "company" && (
          <div className="mt-3">
            <button onClick={() => setShowMembers(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition"
              style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="flex items-center gap-1.5">
                <Icon name="Users" size={12} style={{ color: "#94a3b8" }} />
                Сотрудники{typeof u.members_count === "number" ? ` (${u.members_count})` : ""}
              </span>
              <Icon name={showMembers ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
            </button>
            {showMembers && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <CompanyMembers companyId={u.id} />
              </div>
            )}
          </div>
        )}

        {/* История транзакций */}
        {expanded && !txLoading && transactions && (
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {transactions.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-white/25 text-center">Нет транзакций</div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: tx.amount > 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                      <Icon name={tx.amount > 0 ? "Plus" : "Minus"} size={10}
                        style={{ color: tx.amount > 0 ? "#10b981" : "#ef4444" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white/70 truncate">{tx.reason || "—"}</div>
                      <div className="text-[9px] text-white/30">{fmtDate(tx.created_at)}</div>
                    </div>
                    <span className="text-[11px] font-bold flex-shrink-0"
                      style={{ color: tx.amount > 0 ? "#10b981" : "#ef4444" }}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} смет
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

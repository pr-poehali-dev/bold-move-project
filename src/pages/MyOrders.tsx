import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, CLIENT_ROLES } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

const CRM_STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  new:                { label: "Новая заявка",     color: "#3b82f6", icon: "Sparkles" },
  call:               { label: "Связываемся",      color: "#8b5cf6", icon: "Phone" },
  measure:            { label: "Запись на замер",   color: "#f59e0b", icon: "CalendarDays" },
  measured:           { label: "Замер проведён",    color: "#a78bfa", icon: "Ruler" },
  contract:           { label: "Договор подписан",  color: "#06b6d4", icon: "FileCheck" },
  prepaid:            { label: "Предоплата внесена",color: "#0ea5e9", icon: "CreditCard" },
  install_scheduled:  { label: "Монтаж назначен",  color: "#f97316", icon: "Hammer" },
  install_done:       { label: "Монтаж выполнен",  color: "#fb923c", icon: "CheckSquare" },
  extra_paid:         { label: "Доплата получена", color: "#84cc16", icon: "Banknote" },
  done:               { label: "Завершено",        color: "#10b981", icon: "CheckCircle2" },
  cancelled:          { label: "Отменено",         color: "#ef4444", icon: "XCircle" },
};

const STATUS_ORDER = [
  "new", "call", "measure", "measured",
  "contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done",
];

interface Estimate {
  id: number;
  title: string;
  total_econom: number | null;
  total_standard: number | null;
  total_premium: number | null;
  created_at: string;
  crm_status: string | null;
  chat_id: number | null;
}

function StatusStepper({ status }: { status: string | null }) {
  if (!status || status === "cancelled") return null;
  const steps = ["new", "measure", "contract", "install_scheduled", "done"];
  const stepLabels = ["Заявка", "Замер", "Договор", "Монтаж", "Готово"];
  const curIdx = Math.max(0, STATUS_ORDER.indexOf(status));
  const stepIdx = (s: string) => {
    const si = STATUS_ORDER.indexOf(s);
    return si <= curIdx;
  };

  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((s, i) => {
        const active = stepIdx(s);
        return (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                style={{
                  background: active ? "#f97316" : "rgba(255,255,255,0.08)",
                  color: active ? "#fff" : "rgba(255,255,255,0.2)",
                }}>
                {active ? "✓" : i + 1}
              </div>
              <div className="text-[9px] mt-1 text-center leading-tight whitespace-nowrap"
                style={{ color: active ? "rgba(249,115,22,0.9)" : "rgba(255,255,255,0.2)" }}>
                {stepLabels[i]}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-[2px] mx-1 mt-[-10px] transition-all"
                style={{ background: stepIdx(steps[i + 1]) ? "#f97316" : "rgba(255,255,255,0.08)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyOrders() {
  const { user, token, logout } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${AUTH_URL}?action=my-estimates`, {
      headers: { "X-Authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setEstimates(d.estimates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  // Если не авторизован — редирект
  if (!token && !loading) {
    window.location.href = "/";
    return null;
  }

  // Если это бизнес-пользователь — редирект в CRM
  if (user && !CLIENT_ROLES.includes(user.role)) {
    window.location.href = "/admin-yura";
    return null;
  }

  const roleLabel = user?.role === "designer" ? "Дизайнер" : user?.role === "foreman" ? "Прораб" : "Клиент";

  return (
    <div className="min-h-screen" style={{ background: "#07070f" }}>

      {/* Шапка */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/[0.07]"
        style={{ background: "#0b0b15" }}>
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Icon name="Zap" size={14} style={{ color: "#f97316" }} />
            </div>
            <span className="font-black text-sm text-white">MOS<span className="text-orange-400">POTOLKI</span></span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          {user?.discount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: "#a78bfa20", color: "#a78bfa", border: "1px solid #a78bfa30" }}>
              <Icon name="Percent" size={12} />
              Скидка {user.discount}%
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="w-5 h-5 rounded-full bg-orange-500/30 flex items-center justify-center text-[10px] font-bold text-orange-300">
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-orange-300">{user?.name || user?.email}</span>
            <span className="text-[10px] text-orange-400/50">{roleLabel}</span>
          </div>
          <button onClick={() => logout().then(() => { window.location.href = "/"; })}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
            <Icon name="LogOut" size={13} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-white mb-1">Мои заявки</h1>
          <p className="text-sm text-white/35">Здесь вы можете следить за статусом ваших заказов</p>
        </div>

        {/* Список сметы/заявок */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : estimates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Icon name="FileSpreadsheet" size={28} style={{ color: "#f97316" }} />
            </div>
            <div>
              <div className="text-white font-bold text-base mb-1">Заявок пока нет</div>
              <div className="text-white/35 text-sm">Рассчитайте смету в нашем боте — она появится здесь</div>
            </div>
            <a href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "#f97316" }}>
              <Icon name="MessageCircle" size={15} />
              Рассчитать смету
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {estimates.map(e => {
              const st = e.crm_status ? (CRM_STATUS_LABELS[e.crm_status] ?? null) : null;
              return (
                <div key={e.id} className="rounded-2xl overflow-hidden"
                  style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>

                  {/* Цветная полоска статуса */}
                  <div className="h-1" style={{ background: st ? st.color : "#f97316" }} />

                  <div className="p-5">
                    {/* Шапка карточки */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-sm font-bold text-white">{e.title}</div>
                        <div className="text-xs text-white/30 mt-0.5">
                          {new Date(e.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                        </div>
                      </div>
                      {st && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
                          style={{ background: st.color + "20", color: st.color }}>
                          <Icon name={st.icon} size={12} />
                          {st.label}
                        </div>
                      )}
                    </div>

                    {/* Цены (без прибыли и расходов) */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: "Econom",   val: e.total_econom },
                        { label: "Standard", val: e.total_standard },
                        { label: "Premium",  val: e.total_premium },
                      ].map(p => p.val ? (
                        <div key={p.label} className="rounded-xl px-3 py-2 text-center"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="text-[10px] text-white/30 mb-0.5">{p.label}</div>
                          <div className="text-sm font-bold text-orange-400">
                            {Math.round(p.val).toLocaleString("ru-RU")} ₽
                          </div>
                        </div>
                      ) : null)}
                    </div>

                    {/* Прогресс-степпер */}
                    <StatusStepper status={e.crm_status} />

                    {e.crm_status === "cancelled" && (
                      <div className="mt-3 text-xs text-red-400/70 text-center">Заявка отменена</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA — рассчитать новую смету */}
        {estimates.length > 0 && (
          <div className="mt-6 text-center">
            <a href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition"
              style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
              <Icon name="Plus" size={14} />
              Рассчитать новую смету
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
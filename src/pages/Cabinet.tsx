import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import AuthModal from "@/components/AuthModal";
import ProfileModal from "@/components/ProfileModal";
import PaymentModal from "@/components/PaymentModal";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

const STATUS_LABELS: Record<string, string> = {
  new:               "Новая заявка",
  call:              "Звонок назначен",
  measure:           "Замер назначен",
  measured:          "Замер выполнен",
  contract:          "Договор подписан",
  prepaid:           "Предоплата получена",
  install_scheduled: "Монтаж назначен",
  install_done:      "Монтаж выполнен",
  extra_paid:        "Доплата получена",
  done:              "Завершён",
  cancelled:         "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  new:               "#3b82f6",
  call:              "#a78bfa",
  measure:           "#f59e0b",
  measured:          "#8b5cf6",
  contract:          "#06b6d4",
  prepaid:           "#0ea5e9",
  install_scheduled: "#f97316",
  install_done:      "#fb923c",
  extra_paid:        "#84cc16",
  done:              "#10b981",
  cancelled:         "#ef4444",
};

const STATUS_STEPS = [
  "new","call","measure","measured","contract",
  "prepaid","install_scheduled","install_done","extra_paid","done",
];

interface Estimate {
  id: number;
  title: string;
  total_econom: number | null;
  total_standard: number | null;
  total_premium: number | null;
  status: string;
  created_at: string;
  crm_status: string | null;
}

function fmt(n: number) { return Math.round(n).toLocaleString("ru-RU"); }

function ProgressBar({ status }: { status: string }) {
  const idx = STATUS_STEPS.indexOf(status);
  const pct  = idx < 0 ? 0 : Math.round(((idx + 1) / STATUS_STEPS.length) * 100);
  const color = STATUS_COLORS[status] || "#6b7280";
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Cabinet() {
  const { user, token, loading: authLoading } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAuth,     setShowAuth]     = useState(false);
  const [showProfile,  setShowProfile]  = useState(false);
  const [showPayment,  setShowPayment]  = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) { setLoading(false); return; }
    fetch(`${AUTH_URL}?action=my-estimates`, {
      headers: { "X-Authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setEstimates(d.estimates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, token, authLoading]);

  const initials = user ? (user.name || user.email || "?").slice(0, 2).toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-[#07070f] text-white">

      {/* Шапка */}
      <header className="border-b border-white/[0.06] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition">
          <img src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png"
            alt="" className="w-6 h-6 object-contain" style={{ mixBlendMode: "screen" }} />
          <span className="font-black text-sm tracking-wide">MOS<span className="text-orange-400">POTOLKI</span></span>
        </a>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition hover:bg-white/[0.06]"
                style={{ border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "#f97316", color: "#fff" }}>{initials}</div>
                {user.name || user.email}
              </button>
              <a href="/" className="px-3 py-1.5 rounded-xl text-xs font-medium transition"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                На сайт
              </a>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition"
              style={{ background: "#f97316" }}>
              <Icon name="User" size={12} /> Войти
            </button>
          )}
        </div>
      </header>

      {/* Контент */}
      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Не авторизован */}
        {!authLoading && !user && (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "#f9731615" }}>
              <Icon name="LogIn" size={28} style={{ color: "#f97316" }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Войдите в кабинет</h2>
              <p className="text-sm text-white/30">Чтобы видеть свои заявки и сметы</p>
            </div>
            <button onClick={() => setShowAuth(true)}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "#f97316" }}>
              Войти / Зарегистрироваться
            </button>
          </div>
        )}

        {/* Загрузка */}
        {(authLoading || (user && loading)) && (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Авторизован */}
        {!authLoading && user && !loading && (
          <>
            {/* Привет */}
            <div className="mb-8">
              <h1 className="text-2xl font-black text-white mb-1">
                Привет, {user.name?.split(" ")[0] || "👋"}
              </h1>
              <p className="text-sm text-white/30">Здесь ваши сметы и статусы заявок</p>
            </div>

            {/* Быстрые действия */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { icon: "FileSpreadsheet", label: "Новая смета",   color: "#f97316", href: "/" },
                { icon: "User",            label: "Профиль",       color: "#8b5cf6", action: () => setShowProfile(true) },
                { icon: "CreditCard",      label: "Оплата",        color: "#10b981", action: () => setShowPayment(true) },
              ].map(item => (
                item.href
                  ? <a key={item.label} href={item.href}
                      className="flex flex-col items-center gap-2 py-4 rounded-2xl text-center transition hover:scale-[1.02]"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: item.color + "18" }}>
                        <Icon name={item.icon} size={17} style={{ color: item.color }} />
                      </div>
                      <span className="text-xs font-semibold text-white/60">{item.label}</span>
                    </a>
                  : <button key={item.label} onClick={item.action}
                      className="flex flex-col items-center gap-2 py-4 rounded-2xl text-center transition hover:scale-[1.02]"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: item.color + "18" }}>
                        <Icon name={item.icon} size={17} style={{ color: item.color }} />
                      </div>
                      <span className="text-xs font-semibold text-white/60">{item.label}</span>
                    </button>
              ))}
            </div>

            {/* Список смет */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Мои заявки</h2>
                <span className="text-xs text-white/20">{estimates.length} {estimates.length === 1 ? "заявка" : estimates.length < 5 ? "заявки" : "заявок"}</span>
              </div>

              {estimates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-4 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(249,115,22,0.1)" }}>
                    <Icon name="FileSpreadsheet" size={22} style={{ color: "#f97316" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/50">Заявок пока нет</p>
                    <p className="text-xs text-white/20 mt-1">Рассчитайте смету и нажмите «Сохранить заявку»</p>
                  </div>
                  <a href="/"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                    style={{ background: "#f97316" }}>
                    Рассчитать смету
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {estimates.map(e => {
                    const status = e.crm_status || e.status;
                    const color  = STATUS_COLORS[status] || "#6b7280";
                    const label  = STATUS_LABELS[status]  || status;
                    return (
                      <div key={e.id} className="rounded-2xl p-5 transition"
                        style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.07)` }}>

                        {/* Шапка карточки */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: "#f9731618" }}>
                              <Icon name="FileSpreadsheet" size={16} style={{ color: "#f97316" }} />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{e.title}</div>
                              <div className="text-[11px] text-white/25 mt-0.5">
                                {new Date(e.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                            style={{ background: color + "18", color }}>
                            {label}
                          </span>
                        </div>

                        {/* Прогресс */}
                        {status !== "cancelled" && <ProgressBar status={status} />}

                        {/* Суммы */}
                        {(e.total_econom || e.total_standard || e.total_premium) && (
                          <div className="flex gap-3 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            {[
                              { l: "Econom",   v: e.total_econom,   c: "#10b981" },
                              { l: "Standard", v: e.total_standard, c: "#f97316", bold: true },
                              { l: "Premium",  v: e.total_premium,  c: "#8b5cf6" },
                            ].filter(x => x.v).map(x => (
                              <div key={x.l} className="flex-1 text-center">
                                <div className="text-[10px] text-white/25 mb-0.5">{x.l}</div>
                                <div className={`text-sm font-${x.bold ? "black" : "bold"}`} style={{ color: x.c }}>
                                  {fmt(x.v!)} ₽
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Связаться */}
                        <div className="mt-4">
                          <a href="https://t.me/JoniKras" target="_blank" rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                            style={{ background: "rgba(41,182,246,0.12)", color: "#29b6f6", border: "1px solid rgba(41,182,246,0.2)" }}>
                            <Icon name="MessageCircle" size={13} /> Связаться по этой заявке
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showAuth    && <AuthModal    onClose={() => setShowAuth(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}
    </div>
  );
}

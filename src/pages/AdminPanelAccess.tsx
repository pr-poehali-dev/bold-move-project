import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import AuthModal from "@/components/AuthModal";

interface Props {
  loading: boolean;
  hasAccess: boolean;
  user: { name?: string | null; email?: string | null; role?: string; approved?: boolean; is_master?: boolean; trial_expired?: boolean } | null;
  showLogin: boolean;
  setShowLogin: (v: boolean) => void;
  logout: () => void;
}

export function AdminPanelLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />
    </div>
  );
}

export function AdminPanelAccessScreen({ user, showLogin, setShowLogin, logout }: Omit<Props, "loading" | "hasAccess">) {
  const navigate = useNavigate();
  const ALLOWED_ROLES = ["installer", "company", "manager"];
  const isTrialExpired = !!user && !!user.trial_expired;
  const isWrongRole    = !!user && !user.is_master && !ALLOWED_ROLES.includes(user.role ?? "") && !isTrialExpired;
  const isPending      = !!user && !user.approved && !isTrialExpired;

  // ── Экран "Демо истекло" ─────────────────────────────────────────────────
  if (isTrialExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#07070f" }}>
        <div className="w-full max-w-md">

          {/* Иконка */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <Icon name="TimerOff" size={36} style={{ color: "#f87171" }} />
            </div>
          </div>

          {/* Заголовок */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-white mb-2">Демо-период завершён</h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Ваш бесплатный доступ на 10 дней истёк. Все проекты и сметы сохранены — продолжайте работу после подключения подписки.
            </p>
          </div>

          {/* Карточка */}
          <div className="rounded-2xl p-6 flex flex-col gap-4 mb-4"
            style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>

            {/* Что сохранено */}
            <div className="flex flex-col gap-2">
              {[
                { icon: "FolderOpen", text: "Все проекты и комнаты сохранены" },
                { icon: "FileText",   text: "Созданные сметы доступны" },
                { icon: "Users",      text: "База клиентов в CRM сохранена" },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-2.5 text-[12px]"
                  style={{ color: "rgba(255,255,255,0.55)" }}>
                  <Icon name={item.icon} size={13} style={{ color: "#10b981", flexShrink: 0 }} />
                  {item.text}
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Кнопка подписки */}
            <button
              onClick={() => navigate("/pricing")}
              className="w-full py-3.5 rounded-xl text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
            >
              <Icon name="Zap" size={15} />
              Купить подписку
            </button>

            <button
              onClick={logout}
              className="w-full py-2.5 rounded-xl text-xs font-medium transition hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              Выйти из аккаунта
            </button>
          </div>

          <p className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Есть вопросы?{" "}
            <a href="https://t.me/poehalidev" target="_blank" rel="noopener noreferrer"
              className="underline hover:opacity-80" style={{ color: "rgba(167,139,250,0.6)" }}>
              Написать в поддержку
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#0b0b11] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/20 flex items-center justify-center">
              <Icon name="ShieldCheck" size={24} className="text-violet-400" />
            </div>
            <div>
              <div className="text-white font-black text-xl tracking-tight">MOS<span className="text-violet-400">POTOLKI</span></div>
              <div className="text-white/30 text-xs">Панель администратора</div>
            </div>
          </div>

          <div className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>

            {!user && (
              <>
                <div className="text-sm font-semibold text-white/70 text-center">
                  Войдите в свой аккаунт
                </div>
                <div className="text-[11px] text-white/40 text-center -mt-2 leading-snug">
                  Доступ к панели открыт для монтажников, компаний и менеджеров
                </div>
                <button onClick={() => setShowLogin(true)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
                  style={{ background: "#7c3aed" }}>
                  Войти
                </button>
              </>
            )}

            {isPending && (
              <>
                <div className="rounded-xl px-3.5 py-3 text-xs text-amber-300/85 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                  <Icon name="Clock" size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold mb-0.5">Заявка на проверке</div>
                    <div className="text-amber-300/65">Доступ откроется после одобрения. Обычно 1–24 часа.</div>
                  </div>
                </div>
                <button onClick={logout}
                  className="w-full py-2.5 rounded-xl text-xs font-medium transition"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  Выйти
                </button>
              </>
            )}

            {isWrongRole && !isPending && (
              <>
                <div className="rounded-xl px-3.5 py-3 text-xs text-red-300/85 bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <Icon name="ShieldX" size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold mb-0.5">Нет доступа к панели</div>
                    <div className="text-red-300/65">Доступ открыт только для ролей: монтажник, компания, менеджер. Сменить роль можно в профиле.</div>
                  </div>
                </div>
                <button onClick={logout}
                  className="w-full py-2.5 rounded-xl text-xs font-medium transition"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showLogin && (
        <AuthModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
          onPending={() => setShowLogin(false)}
          defaultTab="login"
        />
      )}
    </>
  );
}
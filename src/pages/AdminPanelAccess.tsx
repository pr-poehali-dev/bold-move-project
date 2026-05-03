import Icon from "@/components/ui/icon";
import AuthModal from "@/components/AuthModal";

interface Props {
  loading: boolean;
  hasAccess: boolean;
  user: { name?: string | null; email?: string | null; role?: string; approved?: boolean; is_master?: boolean } | null;
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
  const ALLOWED_ROLES = ["installer", "company", "manager"];
  const isWrongRole = !!user && !user.is_master && !ALLOWED_ROLES.includes(user.role ?? "");
  const isPending   = !!user && !user.approved;

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

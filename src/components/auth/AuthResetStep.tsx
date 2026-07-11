import Icon from "@/components/ui/icon";

interface Props {
  resetEmail: string;
  setResetEmail: (v: string) => void;
  resetLoading: boolean;
  resetDone: boolean;
  resetPassword: string;
  resetError: string;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onUseNewPassword: () => void;
}

export default function AuthResetStep({
  resetEmail, setResetEmail, resetLoading, resetDone, resetPassword, resetError, onBack, onSubmit, onUseNewPassword,
}: Props) {
  return (
    <div className="px-6 py-5">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-4">
        <Icon name="ChevronLeft" size={13} /> Назад
      </button>

      {!resetDone ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-xs text-white/40 mb-3">Введите Email — мы пришлём новый пароль</p>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Email</label>
            <input
              type="email" value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              placeholder="email@example.com" autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition"
            />
          </div>
          {resetError && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{resetError}</div>
          )}
          <button type="submit" disabled={resetLoading || !resetEmail}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
            style={{ background: "#f97316" }}>
            {resetLoading
              ? <span className="flex items-center justify-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Отправляем...</span>
              : "Восстановить пароль"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-3.5 text-sm bg-green-500/10 border border-green-500/20 text-green-300">
            <div className="font-bold mb-1 flex items-center gap-2"><Icon name="CheckCircle2" size={15} /> Пароль сброшен</div>
            <div className="text-xs text-green-300/70 mb-2">Сохраните новый пароль и войдите</div>
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
              <span className="font-mono text-white font-bold tracking-wider flex-1">{resetPassword}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(resetPassword)}
                className="text-white/40 hover:text-white/70 transition">
                <Icon name="Copy" size={14} />
              </button>
            </div>
          </div>
          <button onClick={onUseNewPassword}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
            style={{ background: "#f97316" }}>
            Войти с новым паролем →
          </button>
        </div>
      )}
    </div>
  );
}

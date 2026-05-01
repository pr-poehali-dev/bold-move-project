import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useWLManager } from "./WLManagerContext";

export function WLLoginPage() {
  const { login } = useWLManager();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const err = await login(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      // Перезагружаем страницу чтобы WhiteLabel.tsx подхватил новый токен
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#06060c" }}>
      <div className="w-full max-w-sm">
        {/* Лого */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Icon name="Building2" size={22} style={{ color: "#a78bfa" }} />
          </div>
          <h1 className="text-xl font-black text-white mb-1">White-Label</h1>
          <p className="text-sm text-white/30">Вход для менеджеров</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="manager@company.com" autoFocus required
              className="w-full rounded-xl px-4 py-3 text-sm text-white/90 outline-none transition"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">Пароль</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="w-full rounded-xl px-4 py-3 text-sm text-white/90 outline-none transition"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 mt-2"
            style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}>
            {loading
              ? <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block mr-2" />Вход...</>
              : "Войти"}
          </button>
        </form>

        <p className="text-center text-[11px] text-white/20 mt-6">
          Доступ только по приглашению мастера
        </p>
      </div>
    </div>
  );
}
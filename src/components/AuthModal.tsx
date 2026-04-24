import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

interface Props {
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export default function AuthModal({ onClose, defaultTab = "login" }: Props) {
  const { login, register } = useAuth();
  const [tab,      setTab]      = useState<"login" | "register">(defaultTab);
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        if (!name.trim()) { setError("Введите имя"); setLoading(false); return; }
        await register(email, password, name);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Icon name="User" size={15} style={{ color: "#f97316" }} />
            </div>
            <span className="text-sm font-bold text-white">
              {tab === "login" ? "Вход в кабинет" : "Регистрация"}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Табы */}
        <div className="flex mx-6 mt-5 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["login", "register"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              className="flex-1 py-2 text-xs font-semibold transition"
              style={tab === t
                ? { background: "#f97316", color: "#fff" }
                : { background: "transparent", color: "rgba(255,255,255,0.4)" }}>
              {t === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          ))}
        </div>

        {/* Форма */}
        <form onSubmit={submit} className="px-6 py-5 space-y-3.5">
          {tab === "register" && (
            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Ваше имя</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Иван Петров" autoFocus
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
            </div>
          )}

          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" autoFocus={tab === "login"}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
          </div>

          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={tab === "register" ? "Минимум 6 символов" : "••••••••"}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
          </div>

          {error && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 mt-1"
            style={{ background: loading ? "#9a3412" : "#f97316" }}>
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {tab === "login" ? "Входим..." : "Регистрируем..."}
                </span>
              : tab === "login" ? "Войти" : "Зарегистрироваться"}
          </button>

          <p className="text-center text-[11px] text-white/25">
            {tab === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
            <button type="button" onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}
              className="text-orange-400 hover:text-orange-300 transition underline underline-offset-2">
              {tab === "login" ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

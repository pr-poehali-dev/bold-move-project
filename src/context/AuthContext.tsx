import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import func2url from "@/../backend/func2url.json";

const AUTH_URL  = (func2url as Record<string, string>)["auth"];
const TOKEN_KEY = "mp_user_token";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login:    (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout:   () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => {}, register: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Восстанавливаем сессию при загрузке
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setLoading(false); return; }
    fetch(`${AUTH_URL}?action=me`, { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.json())
      .then(d => {
        if (d.user) { setUser(d.user); setToken(saved); }
        else { localStorage.removeItem(TOKEN_KEY); }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const persist = (tok: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const res  = await fetch(`${AUTH_URL}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка входа");
    persist(data.token, data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res  = await fetch(`${AUTH_URL}?action=register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка регистрации");
    persist(data.token, data.user);
  };

  const logout = async () => {
    if (token) {
      await fetch(`${AUTH_URL}?action=logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

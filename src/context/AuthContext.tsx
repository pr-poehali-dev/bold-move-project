import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import func2url from "@/../backend/func2url.json";
import { setCrmToken } from "@/pages/admin/crm/crmApi";

const AUTH_URL  = (func2url as Record<string, string>)["auth"];
const TOKEN_KEY = "mp_user_token";

export type UserRole = "client" | "designer" | "foreman" | "installer" | "company" | "manager";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  approved: boolean;
  discount: number;
  is_master?: boolean;
  company_name?: string | null;
  company_inn?:  string | null;
  company_addr?: string | null;
  website?:      string | null;
  telegram?:     string | null;
}

// Бизнес-роли: требуют одобрения, получают доступ к CRM
export const BUSINESS_ROLES: UserRole[] = ["installer", "company", "manager"];
// Клиентские роли: сразу approved, личный кабинет /my-orders
export const CLIENT_ROLES: UserRole[] = ["client", "designer", "foreman"];

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login:    (email: string, password: string) => Promise<{ pending?: boolean; role?: string }>;
  register: (email: string, password: string, name: string, role: UserRole, phone?: string) => Promise<{ pending?: boolean; role?: string }>;
  logout:   () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => ({}), register: async () => ({}), logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setLoading(false); return; }
    fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${saved}` } })
      .then(r => r.json())
      .then(d => {
        if (d.user) { setUser(d.user); setToken(saved); setCrmToken(saved); }
        else { localStorage.removeItem(TOKEN_KEY); }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const persist = (tok: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setUser(u);
    setCrmToken(tok);
  };

  const login = async (email: string, password: string) => {
    const res  = await fetch(`${AUTH_URL}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка входа");
    if (data.pending) return { pending: true, role: data.role };
    persist(data.token, data.user);
    return {};
  };

  const register = async (email: string, password: string, name: string, role: UserRole, phone?: string) => {
    const res  = await fetch(`${AUTH_URL}?action=register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role, phone }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка регистрации");
    if (data.pending) return { pending: true, role: data.role };
    persist(data.token, data.user);
    return {};
  };

  const logout = async () => {
    if (token) {
      await fetch(`${AUTH_URL}?action=logout`, {
        method: "POST",
        headers: { "X-Authorization": `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setCrmToken(null);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
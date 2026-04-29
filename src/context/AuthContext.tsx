import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import func2url from "@/../backend/func2url.json";
import { setCrmToken } from "@/pages/admin/crm/crmApi";

const AUTH_URL  = (func2url as Record<string, string>)["auth"];
const TOKEN_KEY = "mp_user_token";

export type UserRole = "client" | "designer" | "foreman" | "installer" | "company" | "manager";

export interface Brand {
  bot_name?:           string | null;
  bot_greeting?:       string | null;
  bot_avatar_url?:     string | null;
  brand_logo_url?:     string | null;
  brand_color?:        string | null;
  support_phone?:      string | null;
  support_email?:      string | null;
  max_url?:            string | null;
  working_hours?:      string | null;
  pdf_footer_address?: string | null;
  telegram_url?:       string | null;
}

export interface Permissions {
  crm_view?:  boolean;
  crm_edit?:  boolean;
  finance?:   boolean;
  calendar?:  boolean;
  analytics?: boolean;
  kanban?:    boolean;
  files?:     boolean;
  settings?:  boolean;
}

/**
 * Проверка прав. Если permissions === null/undefined — это владелец/мастер
 * (полный доступ). Иначе — менеджер и смотрим конкретный ключ.
 */
export function hasPermission(user: AuthUser | null, key: keyof Permissions): boolean {
  if (!user) return false;
  if (user.is_master) return true;
  if (user.role === "company" || user.role === "installer") return true; // владельцы
  if (!user.permissions) return true; // на всякий случай — старые менеджеры без прав = полный
  return user.permissions[key] === true;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  approved: boolean;
  discount: number;
  estimates_balance: number;
  trial_until?: string | null;
  is_master?: boolean;
  company_id?: number | null;
  permissions?: Permissions | null;
  has_own_agent?: boolean;
  brand?: Brand | null;
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
  login:      (email: string, password: string) => Promise<{ pending?: boolean; role?: string }>;
  register:   (email: string, password: string, name: string, role: UserRole, phone?: string) => Promise<{ pending?: boolean; role?: string }>;
  logout:     () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => ({}), register: async () => ({}), logout: async () => {}, updateUser: () => {},
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

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
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
    <Ctx.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
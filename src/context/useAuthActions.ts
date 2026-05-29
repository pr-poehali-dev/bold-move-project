// ── Действия авторизации: login, register, logout, updateUser, loginWithToken ─
import func2url from "@/../backend/func2url.json";
import { setCrmToken } from "@/pages/admin/crm/crmApi";
import type { AuthUser, UserRole } from "./authTypes";
import { TOKEN_KEY } from "./useAuthInit";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

type Setters = {
  setUser:  (u: AuthUser | null) => void;
  setToken: (t: string | null) => void;
  token:    string | null;
};

export function makeAuthActions({ setUser, setToken, token }: Setters) {
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

  const register = async (email: string, password: string, name: string, role: UserRole, phone?: string, companyName?: string, companyAddr?: string) => {
    const res  = await fetch(`${AUTH_URL}?action=register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role, phone, company_name: companyName || undefined, company_addr: companyAddr || undefined }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка регистрации");
    if (data.pending) return { pending: true, role: data.role };
    persist(data.token, data.user);
    return {};
  };

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser((prev: AuthUser | null) => prev ? { ...prev, ...patch } : prev);
  };

  // Авторизация по уже известному токену (напр. при возврате из построителя в CRM)
  const loginWithToken = async (tok: string): Promise<boolean> => {
    try {
      const r = await fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${tok}` } });
      if (!r.ok) return false;
      const d = await r.json();
      if (d.user) { persist(tok, d.user); return true; }
    } catch { /* ignore */ }
    return false;
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

  return { login, register, logout, updateUser, loginWithToken };
}

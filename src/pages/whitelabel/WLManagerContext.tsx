import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export interface WLManager {
  id:      number;
  name:    string;
  email:   string;
  wl_role: "manager" | "master_manager";
}

interface WLManagerCtx {
  manager:    WLManager | null;
  loading:    boolean;
  login:      (email: string, password: string) => Promise<string | null>;
  logout:     () => void;
  isMaster:   boolean; // is_master из основного AuthContext
  setIsMaster:(v: boolean) => void;
}

const Ctx = createContext<WLManagerCtx>({
  manager: null, loading: true,
  login: async () => null, logout: () => {},
  isMaster: false, setIsMaster: () => {},
});

const TOKEN_KEY = "wl_manager_token";
export const getWLToken = () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem("mp_user_token") || "";

export function WLManagerProvider({ children, isMaster }: { children: ReactNode; isMaster: boolean }) {
  const [manager,    setManager]    = useState<WLManager | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [_isMaster,  setIsMaster]   = useState(isMaster);

  const loadMe = useCallback(async () => {
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) { setLoading(false); return; }
    try {
      const r = await fetch(`${AUTH_URL}?action=wl-me`, {
        headers: { "X-Authorization": tok },
      });
      const d = await r.json();
      if (d.manager) setManager(d.manager);
      else { localStorage.removeItem(TOKEN_KEY); setManager(null); }
    } catch { setManager(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Мастер-админ не нуждается в отдельном wl-токене
    if (isMaster) { setLoading(false); return; }
    loadMe();
  }, [isMaster, loadMe]);

  const login = async (email: string, password: string): Promise<string | null> => {
    const r = await fetch(`${AUTH_URL}?action=wl-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.error) return d.error;
    localStorage.setItem(TOKEN_KEY, d.token);
    setManager(d.manager);
    return null;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setManager(null);
  };

  return (
    <Ctx.Provider value={{ manager, loading, login, logout, isMaster: _isMaster, setIsMaster }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWLManager = () => useContext(Ctx);

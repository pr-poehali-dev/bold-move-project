// ── Контекст авторизации: создание, дефолт, хук ──────────────────────────────
import { createContext, useContext } from "react";
import type { AuthCtx } from "./authTypes";

export const Ctx = createContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => ({}), register: async () => ({}), logout: async () => {}, updateUser: () => {},
  loginWithToken: async () => false,
});

export const useAuth = () => useContext(Ctx);

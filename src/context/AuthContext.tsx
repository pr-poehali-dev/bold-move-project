// ── Точка входа: собирает провайдер из модулей ────────────────────────────────
import { useState, ReactNode } from "react";
import { Ctx } from "./authContext";
import { useAuthInitNormal, useAuthInitIframe } from "./useAuthInit";
import { makeAuthActions } from "./useAuthActions";
import type { AuthUser } from "./authTypes";

// ── Реэкспорт всего публичного API ───────────────────────────────────────────
export type {
  UserRole, Brand, ProductionItem, PortfolioItem,
  PageBlockType, PageBlockStyle, PageBlockBase,
  PageBlockHeading, PageBlockText, PageBlockGallery, PageBlockButtons,
  PageBlockDivider, PageBlockVideo, PageBlockCard, PageBlockPrice,
  PageBlockQuote, PageBlockAiImage, PageBlock,
  PageSettings, NavButtonContent, NavButton,
  Permissions, AuthUser, AuthCtx,
} from "./authTypes";
export { hasPermission, BUSINESS_ROLES, CLIENT_ROLES } from "./authTypes";
export { useAuth } from "./authContext";

// ── Провайдер ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useAuthInitNormal({ setUser, setToken, setLoading });
  useAuthInitIframe({ setUser, setToken, setLoading });

  const { login, register, logout, updateUser, loginWithToken } = makeAuthActions({ setUser, setToken, token });

  return (
    <Ctx.Provider value={{ user, token, loading, login, register, logout, updateUser, loginWithToken }}>
      {children}
    </Ctx.Provider>
  );
}

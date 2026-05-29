// ── Инициализация авторизации: обычный режим + iframe-режим ──────────────────
import { useEffect } from "react";
import func2url from "@/../backend/func2url.json";
import { setCrmToken } from "@/pages/admin/crm/crmApi";
import type { AuthUser } from "./authTypes";

const AUTH_URL  = (func2url as Record<string, string>)["auth"];
export const TOKEN_KEY = "mp_user_token";

type Setters = {
  setUser:    (u: AuthUser | null) => void;
  setToken:   (t: string | null) => void;
  setLoading: (v: boolean) => void;
};

// Обычный режим: читаем mp_user_token при монтировании (не в iframe)
export function useAuthInitNormal({ setUser, setToken, setLoading }: Setters) {
  useEffect(() => {
    if (window.parent !== window) { setLoading(false); return; }
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setLoading(false); return; }
    fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${saved}` } })
      .then(async r => {
        // Удаляем токен только при явном 401 (токен недействителен)
        // При сетевой ошибке или 5xx — оставляем токен, попробуем потом
        if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setLoading(false); return; }
        const d = await r.json();
        if (d.user) { setUser(d.user); setToken(saved); setCrmToken(saved); }
        // Если d.error но не 401 — не удаляем токен (возможно временная ошибка)
        setLoading(false);
      })
      .catch(() => {
        // Сетевая ошибка — НЕ удаляем токен, пользователь останется залогиненным
        setLoading(false);
      });
  }, []);
}

// iframe-режим: читаем wl_iframe_token и mp_user_token, слушаем storage-события
export function useAuthInitIframe({ setUser, setToken, setLoading }: Setters) {
  useEffect(() => {
    if (window.parent === window) return; // не в iframe — пропускаем

    const WL_TOKEN_KEY = "wl_iframe_token";

    const applyToken = async (tok: string) => {
      console.log("[iframe] applying token from localStorage:", tok.slice(0, 8) + "...");
      try {
        const r = await fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${tok}` } });
        const d = await r.json();
        console.log("[iframe] /me response:", d.user?.email || d.error);
        if (d.user) { setUser(d.user); setToken(tok); setCrmToken(tok); setLoading(false); }
      } catch (err) { console.log("[iframe] /me error:", err); }
    };

    // Сначала проверяем собственный токен приложения (mp_user_token).
    // Он может быть записан при возврате из построителя плана в CRM.
    const ownToken = localStorage.getItem(TOKEN_KEY);
    if (ownToken) {
      applyToken(ownToken);
    }

    // Затем читаем wl_iframe_token (токен платформы)
    const wlTok = localStorage.getItem(WL_TOKEN_KEY);
    if (wlTok && wlTok !== ownToken) {
      applyToken(wlTok);
    }

    // Слушаем storage-событие на случай если родитель запишет токен после загрузки
    const onStorage = (e: StorageEvent) => {
      if (e.key === WL_TOKEN_KEY && e.newValue) {
        applyToken(e.newValue);
      }
      if (e.key === TOKEN_KEY && e.newValue) {
        applyToken(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

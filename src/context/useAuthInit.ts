// ── Инициализация авторизации: обычный режим + iframe-режим ──────────────────
import { useEffect, type Dispatch, type SetStateAction } from "react";
import func2url from "@/../backend/func2url.json";
import { setCrmToken } from "@/pages/admin/crm/crmApi";
import type { AuthUser } from "./authTypes";

const AUTH_URL  = (func2url as Record<string, string>)["auth"];
export const TOKEN_KEY = "mp_user_token";

type Setters = {
  setUser:    Dispatch<SetStateAction<AuthUser | null>>;
  setToken:   Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

// Обычный режим: читаем mp_user_token при монтировании (не в iframe)
export function useAuthInitNormal({ setUser, setToken, setLoading }: Setters) {
  useEffect(() => {
    if (window.parent !== window) { setLoading(false); return; }
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setLoading(false); return; }

    // Мобильная сеть нестабильна: разовый обрыв не должен выкидывать из системы.
    // Пробуем проверить токен до 3 раз с нарастающей паузой. Токен удаляем ТОЛЬКО
    // при явном 401 (сервер сказал "токен недействителен"), не при сетевых сбоях/5xx.
    let cancelled = false;

    const attempt = async (tries: number): Promise<void> => {
      try {
        const r = await fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${saved}` } });
        if (cancelled) return;
        if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); setLoading(false); return; }
        if (r.status >= 500) throw new Error("server " + r.status); // временная ошибка сервера → повтор
        const d = await r.json();
        if (cancelled) return;
        if (d.user) { setUser(d.user); setToken(saved); setCrmToken(saved); }
        setLoading(false);
      } catch {
        if (cancelled) return;
        if (tries > 0) {
          // Пауза перед повтором: 600мс, затем 1500мс
          const delay = tries === 2 ? 600 : 1500;
          setTimeout(() => { if (!cancelled) attempt(tries - 1); }, delay);
        } else {
          // Все попытки исчерпаны — НЕ удаляем токен, пользователь останется залогиненным
          setLoading(false);
        }
      }
    };

    attempt(2);
    return () => { cancelled = true; };
  }, []);
}

// iframe-режим: читаем wl_iframe_token и mp_user_token, слушаем storage-события
export function useAuthInitIframe({ setUser, setToken, setLoading }: Setters) {
  useEffect(() => {
    if (window.parent === window) return; // не в iframe — пропускаем

    const WL_TOKEN_KEY = "wl_iframe_token";

    // Признак «рабочий ключ уже найден». Нужен, чтобы просроченный ключ,
    // ответ по которому пришёл позже, не затирал уже применённый рабочий —
    // именно из-за этой гонки список диалогов мог оказаться пустым.
    let authorized = false;
    let cancelled = false;

    // force=true — ключ пришёл от платформы уже после входа (свежий), его принимаем всегда
    const applyToken = async (tok: string, force = false): Promise<boolean> => {
      if (cancelled || (authorized && !force)) return false;
      try {
        const r = await fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${tok}` } });
        const d = await r.json();
        if (cancelled || (authorized && !force)) return false;
        if (d.user) {
          authorized = true;
          setUser(d.user); setToken(tok); setCrmToken(tok); setLoading(false);
          return true;
        }
      } catch { /* сеть моргнула — просто пробуем следующий ключ */ }
      return false;
    };

    // Проверяем ключи ПО ОЧЕРЕДИ и останавливаемся на первом действующем:
    // сначала свой (mp_user_token), затем ключ платформы (wl_iframe_token).
    (async () => {
      const ownToken = localStorage.getItem(TOKEN_KEY);
      if (ownToken && await applyToken(ownToken)) return;

      const wlTok = localStorage.getItem(WL_TOKEN_KEY);
      if (wlTok && wlTok !== ownToken) await applyToken(wlTok);
    })();

    // Слушаем storage-событие на случай если родитель запишет токен после загрузки
    const onStorage = (e: StorageEvent) => {
      if ((e.key === WL_TOKEN_KEY || e.key === TOKEN_KEY) && e.newValue) {
        applyToken(e.newValue, true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { cancelled = true; window.removeEventListener("storage", onStorage); };
  }, []);
}
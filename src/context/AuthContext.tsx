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
  pdf_text_color?:     string | null;
  brand_logo_url_dark?:    string | null;
  brand_logo_orientation?: "horizontal" | "vertical" | string | null;
  pdf_logo_bg?:            string | null;
}

export interface Permissions {
  // ── Уровень 1: Вкладки ───────────────────────────────────────────────────
  crm_view?:         boolean;  // видит вкладку CRM
  agent_view?:       boolean;  // видит вкладку Агент
  profile_view?:     boolean;  // видит раздел Профиль
  tariffs_view?:     boolean;  // видит раздел Тарифы и пакеты
  admin_panel_view?: boolean;  // видит раздел Панель управления

  // ── Уровень 2: Блоки внутри CRM ─────────────────────────────────────────
  clients_view?:   boolean;  // видит раздел Клиенты
  clients_edit?:   boolean;  // может добавлять/удалять клиентов
  orders_edit?:    boolean;  // может менять статус заявок
  kanban_view?:    boolean;  // видит Канбан
  kanban_edit?:    boolean;  // может перемещать карточки
  calendar_view?:  boolean;  // видит Календарь
  calendar_edit?:  boolean;  // может редактировать события
  analytics_view?: boolean;  // видит Аналитику
  finance_view?:   boolean;  // видит финансовые данные
  files_view?:     boolean;  // видит Файлы
  files_edit?:     boolean;  // может загружать/удалять файлы

  // ── Уровень 2: Подвкладки Агента ────────────────────────────────────────
  prices_view?:      boolean;  // видит Цены
  prices_edit?:      boolean;  // может редактировать цены
  rules_view?:       boolean;  // видит Правила расчёта
  rules_edit?:       boolean;  // может редактировать правила
  prompt_view?:      boolean;  // видит Промпт
  prompt_edit?:      boolean;  // может редактировать промпт
  faq_view?:         boolean;  // видит Базу знаний
  faq_edit?:         boolean;  // может редактировать базу знаний
  corrections_view?: boolean;  // видит Обучение
  corrections_edit?: boolean;  // может редактировать обучение

  // ── Уровень 3: Строки/поля в карточке клиента ───────────────────────────
  field_contacts?:  boolean;  // видит контакты (телефон, email)
  field_address?:   boolean;  // видит адрес объекта
  field_dates?:     boolean;  // видит даты замера/монтажа
  field_finance?:   boolean;  // видит суммы (договор, прибыль)
  field_notes?:     boolean;  // видит примечания
  field_files?:     boolean;  // видит блок файлов в карточке
  field_cancel?:    boolean;  // видит блок отмены заказа

  // ── Устаревшие (для обратной совместимости) ─────────────────────────────
  crm_edit?:   boolean;
  finance?:    boolean;
  calendar?:   boolean;
  analytics?:  boolean;
  kanban?:     boolean;
  files?:      boolean;
  settings?:   boolean;
}

// Маппинг старых ключей на новые (обратная совместимость)
const COMPAT: Partial<Record<keyof Permissions, keyof Permissions>> = {
  crm_edit:  "orders_edit",
  finance:   "finance_view",
  calendar:  "calendar_view",
  analytics: "analytics_view",
  kanban:    "kanban_view",
  files:     "files_view",
  settings:  "prices_edit",
};

/**
 * Проверка прав. Если permissions === null/undefined — это владелец/мастер
 * (полный доступ). Иначе — менеджер, смотрим конкретный ключ.
 * Поддерживает старые ключи через маппинг.
 */
export function hasPermission(user: AuthUser | null, key: keyof Permissions): boolean {
  if (!user) return false;
  if (user.is_master) return true;
  if (user.role === "company" || user.role === "installer") return true;
  if (!user.permissions) return true;
  // Проверяем новый ключ
  if (user.permissions[key] === true) return true;
  // Обратная совместимость: новый ключ → старый
  const compat = COMPAT[key];
  if (compat && user.permissions[compat] === true) return true;
  return false;
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
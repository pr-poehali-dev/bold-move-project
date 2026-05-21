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
  bot_avatar_bg?:          string | null;
  tg_bot_token?:           string | null;
  tg_notify_chat_id?:      string | null;
  nav_config?:             NavButton[] | null;
  production_items?:       ProductionItem[] | null;
  production_title?:       string | null;
  production_hidden?:      boolean | null;
  portfolio_items?:        PortfolioItem[] | null;
  portfolio_title?:        string | null;
  portfolio_hidden?:       boolean | null;
  booking_hidden?:         boolean | null;
  other_hidden?:           boolean | null;
  contacts_hidden?:        boolean | null;
  nav_hidden_ids?:         string[] | null;
}

export interface ProductionItem {
  img:   string;
  title: string;
  desc:  string;
}

export interface PortfolioItem {
  img:      string;
  room:     string;
  type:     string;
  district: string;
  area:     number;
}

// ── Конструктор страниц — блоки ──────────────────────────────────────────────
export type PageBlockType = "heading" | "text" | "gallery" | "buttons" | "divider" | "video" | "card" | "price" | "quote" | "ai-image";

// ── Стили блока (расширенная стилизация) ─────────────────────────────────────
export interface PageBlockStyle {
  // Фон
  bgType?:        "none" | "color" | "gradient";
  bgColor?:       string;           // CSS цвет
  bgGradFrom?:    string;           // цвет 1 градиента
  bgGradTo?:      string;           // цвет 2 градиента
  bgGradAngle?:   number;           // угол градиента (0-360)
  bgOpacity?:     number;           // прозрачность фона 0-100
  // Рамка
  borderWidth?:   number;           // px
  borderColor?:   string;
  borderStyle?:   "solid" | "dashed" | "dotted";
  borderRadius?:  number;           // px — радиус углов
  // Тень
  shadowX?:       number;
  shadowY?:       number;
  shadowBlur?:    number;
  shadowColor?:   string;
  // Отступы внутри
  padTop?:        number;
  padRight?:      number;
  padBottom?:     number;
  padLeft?:       number;
  // Прозрачность всего блока
  opacity?:       number;           // 0-100
}

// Общие поля позиционирования/стиля для каждого блока
export interface PageBlockBase {
  id:       string;
  // ── Flow-режим (старый блочный) ──
  width?:   25 | 33 | 50 | 67 | 75 | 100;
  paddingTop?:    number;
  paddingBottom?: number;
  bg?:      string;
  hidden?:  boolean;
  // ── Free-canvas режим ──
  x?:       number;
  y?:       number;
  w?:       number;
  h?:       number;
  zIndex?:  number;
  // ── Расширенные стили ──
  style_?:  PageBlockStyle;         // подчёркивание чтобы не конфликтовать с .style у divider/spacer
}

export interface PageBlockHeading extends PageBlockBase {
  type:    "heading";
  text:    string;
  size:    "xl" | "lg" | "md";
  align:   "left" | "center" | "right";
}

export interface PageBlockText extends PageBlockBase {
  type:    "text";
  text:    string;
  align:   "left" | "center" | "right";
}

export interface PageBlockGallery extends PageBlockBase {
  type:    "gallery";
  photos:  string[];
  cols:    1 | 2 | 3 | 4;
  ratio:   "square" | "4/3" | "16/9";
}

export interface PageBlockButtons extends PageBlockBase {
  type:    "buttons";
  items:   {
    label:   string;
    action:  "phone" | "whatsapp" | "telegram" | "url";
    value:   string;
    style:   "primary" | "outline";
  }[];
  align?:  "left" | "center" | "right";
}

export interface PageBlockDivider extends PageBlockBase {
  type:    "divider";
  style?:  "line" | "dots" | "space";
}

export interface PageBlockVideo extends PageBlockBase {
  type:    "video";
  url:     string;  // YouTube / Vimeo / прямой URL / S3 url
}

// Карточка: фото слева или справа, заголовок + текст
export interface PageBlockCard extends PageBlockBase {
  type:       "card";
  title:      string;
  text:       string;
  photoUrl?:  string;                          // URL фото
  photoSide?: "left" | "right" | "top" | "none"; // расположение фото
  align?:     "left" | "center" | "right";
}

// Таблица цен / прайс-лист
export interface PageBlockPrice extends PageBlockBase {
  type:   "price";
  title?: string;
  items:  {
    icon?:  string;   // emoji
    name:   string;   // название позиции
    price:  string;   // цена (строка: "от 1 200 ₽")
    desc?:  string;   // пояснение
  }[];
}

// Цитата / отзыв
export interface PageBlockQuote extends PageBlockBase {
  type:    "quote";
  text:    string;
  author?: string;   // имя автора
  role?:   string;   // должность/подпись
  avatar?: string;   // URL аватара
}

// AI-генерированное изображение / мокап
export interface PageBlockAiImage extends PageBlockBase {
  type:       "ai-image";
  imageUrl:   string;   // URL сгенерированного или загруженного изображения
  prompt:     string;   // промпт которым оно было сгенерировано
  alt?:       string;   // alt-текст
  fit?:       "cover" | "contain" | "fill";  // object-fit
}

export type PageBlock =
  | PageBlockHeading
  | PageBlockText
  | PageBlockGallery
  | PageBlockButtons
  | PageBlockDivider
  | PageBlockVideo
  | PageBlockCard
  | PageBlockPrice
  | PageBlockQuote
  | PageBlockAiImage;

// Настройки страницы целиком
export interface PageSettings {
  maxWidth?:    "sm" | "md" | "lg" | "xl" | "full";
  snap?:        boolean;   // примагничивание к сетке
  freeCanvas?:  boolean;   // true = свободное позиционирование, false = flow
  canvasHeight?: number;   // высота холста в free-режиме (px), по умолчанию 1200
  canvasWidth?:  number;   // ширина холста (px), по умолчанию 390 (мобильный)
  gridSize?:    number;    // размер ячейки сетки для snap (px), по умолчанию 8
}

export interface NavButtonContent {
  // legacy-поля (обратная совместимость)
  title?:        string | null;
  text?:         string | null;
  photo_url?:    string | null;
  btn_label?:    string | null;
  btn_action?:   "phone" | "whatsapp" | "telegram" | "url" | null;
  btn_value?:    string | null;
  // новые блоки конструктора
  blocks?:       PageBlock[] | null;
  // настройки страницы
  pageSettings?: PageSettings | null;
}

export interface NavButton {
  id:      string;
  label:   string;
  icon:    string;
  action:  "chat" | "panel" | "other" | "url" | "phone" | "whatsapp" | "telegram";
  value?:  string | null;
  content?: NavButtonContent | null;
}

export interface Permissions {
  // ── Уровень 1: Вкладки ───────────────────────────────────────────────────
  crm_view?:         boolean;  // видит вкладку CRM
  agent_view?:       boolean;  // видит вкладку Агент
  profile_view?:     boolean;  // видит раздел Профиль
  tariffs_view?:     boolean;  // видит раздел Тарифы и пакеты
  admin_panel_view?: boolean;  // видит раздел Панель управления
  support_view?:     boolean;  // видит раздел Поддержка

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
  // Владелец компании и установщик — полный доступ (у них нет матрицы прав)
  if (user.role === "company" || user.role === "installer") return true;
  // Менеджер без выданных прав — нет доступа ни к чему
  if (!user.permissions) return false;
  // Проверяем конкретный ключ
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
  trial_expired?: boolean;
  is_master?: boolean;
  company_id?: number | null;
  permissions?: Permissions | null;
  has_own_agent?: boolean;
  agent_purchased_at?: string | null;
  kanban_enabled?: boolean;
  brand?: Brand | null;
  company_name?: string | null;
  company_inn?:  string | null;
  company_addr?: string | null;
  website?:           string | null;
  telegram?:          string | null;
  tg_bot_token?:      string | null;
  tg_notify_chat_id?: string | null;
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
  register:   (email: string, password: string, name: string, role: UserRole, phone?: string, companyName?: string, companyAddr?: string) => Promise<{ pending?: boolean; role?: string }>;
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
        // Просто считаем loading=false
        setLoading(false);
      });
  }, []);

  // Принимаем токен от родительского окна (для iframe-режима /whitelabel)
  useEffect(() => {
    if (window.parent === window) return; // не в iframe — пропускаем

    let tokenApplied = false;

    const handler = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "set-token" && e.data?.token && !tokenApplied) {
        tokenApplied = true;
        const tok = e.data.token as string;
        // Не пишем в localStorage — он общий для всего домена и перезапишет мастер-токен родителя.
        // Держим токен только в памяти React-состояния.
        try {
          const r = await fetch(`${AUTH_URL}?action=me`, { headers: { "X-Authorization": `Bearer ${tok}` } });
          const d = await r.json();
          if (d.user) { setUser(d.user); setToken(tok); setCrmToken(tok); }
        } catch { /* ignore */ }
        // Сообщаем родителю что токен применён
        window.parent.postMessage("iframe-ready", window.location.origin);
      }
    };
    window.addEventListener("message", handler);

    // Сигналим родителю что iframe готов принять токен — повторяем каждые 200ms пока не получим токен
    const ping = () => {
      if (!tokenApplied) {
        window.parent.postMessage("iframe-ready", window.location.origin);
      }
    };
    ping();
    const interval = setInterval(() => { if (!tokenApplied) ping(); else clearInterval(interval); }, 300);

    return () => {
      window.removeEventListener("message", handler);
      clearInterval(interval);
    };
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
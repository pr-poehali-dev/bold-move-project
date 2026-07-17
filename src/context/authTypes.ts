// ── Все типы, интерфейсы, константы и утилиты авторизации ────────────────────

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
  max_bot_token?:          string | null;
  max_notify_chat_id?:     string | null;
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
  bgColor?:       string;
  bgGradFrom?:    string;
  bgGradTo?:      string;
  bgGradAngle?:   number;
  bgOpacity?:     number;
  // Рамка
  borderWidth?:   number;
  borderColor?:   string;
  borderStyle?:   "solid" | "dashed" | "dotted";
  borderRadius?:  number;
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
  opacity?:       number;
}

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
  style_?:  PageBlockStyle;
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
  url:     string;
}

export interface PageBlockCard extends PageBlockBase {
  type:       "card";
  title:      string;
  text:       string;
  photoUrl?:  string;
  photoSide?: "left" | "right" | "top" | "none";
  align?:     "left" | "center" | "right";
}

export interface PageBlockPrice extends PageBlockBase {
  type:   "price";
  title?: string;
  items:  {
    icon?:  string;
    name:   string;
    price:  string;
    desc?:  string;
  }[];
}

export interface PageBlockQuote extends PageBlockBase {
  type:    "quote";
  text:    string;
  author?: string;
  role?:   string;
  avatar?: string;
}

export interface PageBlockAiImage extends PageBlockBase {
  type:       "ai-image";
  imageUrl:   string;
  prompt:     string;
  alt?:       string;
  fit?:       "cover" | "contain" | "fill";
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

export interface PageSettings {
  maxWidth?:    "sm" | "md" | "lg" | "xl" | "full";
  snap?:        boolean;
  freeCanvas?:  boolean;
  canvasHeight?: number;
  canvasWidth?:  number;
  gridSize?:    number;
}

export interface NavButtonContent {
  title?:        string | null;
  text?:         string | null;
  photo_url?:    string | null;
  btn_label?:    string | null;
  btn_action?:   "phone" | "whatsapp" | "telegram" | "url" | null;
  btn_value?:    string | null;
  blocks?:       PageBlock[] | null;
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
  crm_view?:         boolean;
  agent_view?:       boolean;
  plan_view?:        boolean;
  profile_view?:     boolean;
  tariffs_view?:     boolean;
  admin_panel_view?: boolean;
  support_view?:     boolean;

  // ── Уровень 2: Блоки внутри CRM ─────────────────────────────────────────
  clients_view?:   boolean;
  clients_edit?:   boolean;
  orders_view?:    boolean;
  orders_edit?:    boolean;
  kanban_view?:    boolean;
  kanban_edit?:    boolean;
  calendar_view?:  boolean;
  calendar_edit?:  boolean;
  analytics_view?: boolean;
  finance_view?:   boolean;
  files_view?:     boolean;
  files_edit?:     boolean;

  // ── Уровень 2: Подвкладки Агента ────────────────────────────────────────
  prices_view?:      boolean;
  prices_edit?:      boolean;
  rules_view?:       boolean;
  rules_edit?:       boolean;
  prompt_view?:      boolean;
  prompt_edit?:      boolean;
  faq_view?:         boolean;
  faq_edit?:         boolean;
  corrections_view?: boolean;
  corrections_edit?: boolean;

  // ── Уровень 3: Строки/поля в карточке клиента ───────────────────────────
  field_contacts?:  boolean;
  field_address?:   boolean;
  field_dates?:     boolean;
  field_finance?:   boolean;
  field_notes?:     boolean;
  field_files?:     boolean;
  field_cancel?:    boolean;

  // ── Уровень 2: Этапы воронки — какие статусы заказа видит/меняет сотрудник ──
  // Пустой массив / отсутствие ключа = ограничений нет (видно все этапы)
  allowed_statuses?: string[];

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
  if (!user.permissions) return false;
  if (user.permissions[key] === true) return true;
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
  is_demo?: boolean;
  demo_expires_at?: string | null;
  brand?: Brand | null;
  company_name?: string | null;
  company_inn?:  string | null;
  company_addr?: string | null;
  website?:           string | null;
  telegram?:          string | null;
  tg_bot_token?:      string | null;
  tg_notify_chat_id?: string | null;
  /** false — пользователь вошёл через соцсеть впервые и ещё не выбрал роль (показываем модалку выбора роли) */
  role_selected?: boolean;
  /** false — у пользователя ещё нет пароля (вход только через Google/Яндекс и т.п.) */
  has_password?: boolean;
}

// Бизнес-роли: требуют одобрения, получают доступ к CRM
export const BUSINESS_ROLES: UserRole[] = ["installer", "company", "manager"];
// Клиентские роли: сразу approved, личный кабинет /my-orders
export const CLIENT_ROLES: UserRole[] = ["client", "designer", "foreman"];

export interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login:      (email: string, password: string) => Promise<{ pending?: boolean; role?: string; emailVerificationRequired?: boolean; email?: string }>;
  register:   (email: string, password: string, name: string, role: UserRole, phone?: string, companyName?: string, companyAddr?: string) => Promise<{ pending?: boolean; role?: string; emailVerificationRequired?: boolean; email?: string }>;
  logout:     () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  loginWithToken: (tok: string) => Promise<boolean>;
  verifyEmail: (email: string, code: string) => Promise<Record<string, never>>;
  resendVerification: (email: string) => Promise<Record<string, never>>;
}
export interface BusinessUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  rejected: boolean;
  discount: number;
  created_at: string;
  estimates_balance: number;
  has_own_agent: boolean;
  agent_purchased_at: string | null;
  trial_until: string | null;
  total_bought: number;
  telegram?: string | null;
  source?: "self" | "invited";   // "self" — сам зарегистрировался, "invited" — создан мастером (WL-демо)
  members_count?: number;         // сколько сотрудников привязано к компании
}

export interface UserTransaction {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
}

export interface ProUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  discount: number;
  created_at: string;
}

export interface AppUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  rejected: boolean;
  discount: number;
  created_at: string;
  estimates_count: number;
  estimates_balance: number;
  has_own_agent?: boolean;
  agent_purchased_at?: string | null;
  trial_until?: string | null;
  telegram?: string | null;
  source?: "self" | "invited";
  company_id?: number | null;
}

// Метка источника пользователя для UI
export const SOURCE_META: Record<"self" | "invited", { label: string; color: string; icon: string }> = {
  self:    { label: "Сам зашёл",     color: "#60a5fa", icon: "UserPlus" },
  invited: { label: "Приглашён вами", color: "#a78bfa", icon: "Send" },
};

export interface UserEstimate {
  id: number;
  title: string;
  total_standard: number | null;
  status: string;
  created_at: string;
  crm_status: string | null;
}

export interface ExpiringUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  subscription_end: string; // дата окончания пробного периода (trial_until)
  telegram: string | null;
}

export interface AdminStats {
  total_users: number;
  pending: number;
  active_subs: number;
  total_estimates: number;
  new_week: number;
  by_role: Record<string, number>;
  expiring_soon: ExpiringUser[];
}

export type MasterTab = "dashboard" | "users" | "whitelabel" | "settings";

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:    { label: "Клиент",    color: "#f97316" },
  designer:  { label: "Дизайнер",  color: "#a78bfa" },
  foreman:   { label: "Прораб",    color: "#34d399" },
  installer: { label: "Монтажник", color: "#60a5fa" },
  company:   { label: "Компания",  color: "#f59e0b" },
  manager:   { label: "Менеджер",  color: "#94a3b8" },
};

// Статус доступа компании/монтажника: пробный период идёт, пробный истёк но есть сметы (оплаченный доступ),
// пробный истёк и смет нет (доступ закрыт), либо вообще без пробного (не бизнес-роль).
export function accessStatus(user: { trial_until?: string | null; estimates_balance?: number }): "trial" | "trial_expiring" | "paid" | "blocked" | "none" {
  if (!user.trial_until) return "none";
  const end = new Date(user.trial_until);
  const now = new Date();
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const hasBalance = (user.estimates_balance || 0) > 0;
  if (diffDays < 0) return hasBalance ? "paid" : "blocked";
  if (diffDays <= 3) return "trial_expiring";
  return "trial";
}

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function daysLeft(s: string | null): number {
  if (!s) return 0;
  return Math.ceil((new Date(s).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
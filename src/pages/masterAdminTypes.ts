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
  subscription_start: string | null;
  subscription_end: string | null;
  estimates_balance: number;
  has_own_agent: boolean;
  agent_purchased_at: string | null;
  trial_until: string | null;
  total_bought: number;
  telegram?: string | null;
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
  subscription_start: string | null;
  subscription_end: string | null;
  estimates_balance: number;
  has_own_agent?: boolean;
  agent_purchased_at?: string | null;
  telegram?: string | null;
}

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
  subscription_end: string;
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

export type MasterTab = "dashboard" | "professionals" | "all" | "whitelabel" | "wl-staff" | "default-rules";

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:    { label: "Клиент",    color: "#f97316" },
  designer:  { label: "Дизайнер",  color: "#a78bfa" },
  foreman:   { label: "Прораб",    color: "#34d399" },
  installer: { label: "Монтажник", color: "#60a5fa" },
  company:   { label: "Компания",  color: "#f59e0b" },
  manager:   { label: "Менеджер",  color: "#94a3b8" },
};

export function subStatus(user: { subscription_end: string | null; approved: boolean }): "active" | "expiring" | "expired" | "none" {
  if (!user.subscription_end) return "none";
  const end = new Date(user.subscription_end);
  const now = new Date();
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff <= 7) return "expiring";
  return "active";
}

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function daysLeft(s: string | null): number {
  if (!s) return 0;
  return Math.ceil((new Date(s).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
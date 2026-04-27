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
}

export interface UserEstimate {
  id: number;
  title: string;
  total_standard: number | null;
  status: string;
  created_at: string;
  crm_status: string | null;
}

export type MasterTab = "business" | "pro" | "all";

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:    { label: "Клиент",    color: "#f97316" },
  designer:  { label: "Дизайнер",  color: "#a78bfa" },
  foreman:   { label: "Прораб",    color: "#34d399" },
  installer: { label: "Монтажник", color: "#60a5fa" },
  company:   { label: "Компания",  color: "#f59e0b" },
  manager:   { label: "Менеджер",  color: "#94a3b8" },
};

export function subStatus(user: { subscription_end: string | null; approved: boolean }): "active" | "expired" | "none" {
  if (!user.subscription_end) return "none";
  return new Date(user.subscription_end) > new Date() ? "active" : "expired";
}

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export interface PendingUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  discount: number;
  created_at: string;
}

export interface ProUser extends PendingUser {
  approved: boolean;
}

export interface AppUser {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  discount: number;
  created_at: string;
  estimates_count: number;
}

export interface UserEstimate {
  id: number;
  title: string;
  total_standard: number | null;
  status: string;
  created_at: string;
  crm_status: string | null;
}

export type MasterTab = "pending" | "pro" | "all";

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:    { label: "Клиент",    color: "#f97316" },
  designer:  { label: "Дизайнер",  color: "#a78bfa" },
  foreman:   { label: "Прораб",    color: "#34d399" },
  installer: { label: "Монтажник", color: "#60a5fa" },
  company:   { label: "Компания",  color: "#f59e0b" },
  manager:   { label: "Менеджер",  color: "#94a3b8" },
};

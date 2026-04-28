import func2url from "@/../backend/func2url.json";
import type { Permissions } from "@/context/AuthContext";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export interface TeamMember {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
  created_at: string;
  permissions?: Permissions | null;
  has_pending_password?: boolean;
}

function authHeaders(token: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-Authorization": `Bearer ${token}` } : {}),
  };
}

export async function fetchTeam(token: string | null): Promise<TeamMember[]> {
  const res = await fetch(`${AUTH_URL}?action=team-list`, { headers: authHeaders(token) });
  const d   = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Ошибка загрузки команды");
  return d.members ?? [];
}

export async function inviteMember(
  token: string | null,
  payload: { email: string; name?: string; phone?: string },
): Promise<{ member: TeamMember }> {
  const res = await fetch(`${AUTH_URL}?action=team-invite`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify(payload),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось пригласить");
  return { member: d.member };
}

export async function updatePermissions(
  token: string | null,
  memberId: number,
  permissions: Permissions,
): Promise<void> {
  const res = await fetch(`${AUTH_URL}?action=team-update-permissions`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ member_id: memberId, permissions }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось сохранить права");
}

export async function showMemberPassword(
  token: string | null,
  memberId: number,
): Promise<{ email: string; temp_password: string }> {
  const res = await fetch(`${AUTH_URL}?action=team-show-password`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ member_id: memberId }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось получить пароль");
  return { email: d.email, temp_password: d.temp_password };
}

export async function removeMember(token: string | null, memberId: number): Promise<void> {
  const res = await fetch(`${AUTH_URL}?action=team-remove`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ member_id: memberId }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось удалить");
}

export async function resetMemberPassword(token: string | null, memberId: number): Promise<string> {
  const res = await fetch(`${AUTH_URL}?action=team-reset-password`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ member_id: memberId }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось сбросить пароль");
  return d.temp_password as string;
}

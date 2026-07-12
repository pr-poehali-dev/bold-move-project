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
  team_role_id?: number | null;
}

export interface TeamRole {
  id: number;
  name: string;
  permissions: Permissions;
  created_at: string;
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
  payload: { email: string; name?: string; phone?: string; role_id?: number | null },
): Promise<{ member: TeamMember }> {
  const res = await fetch(`${AUTH_URL}?action=team-invite`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify(payload),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось пригласить");
  return { member: d.member };
}

// role_id: число — привязать к роли (её права подставятся); null — отвязать (оставить как ручные);
// undefined — не трогать привязку к роли, обновить только сами права
export async function updatePermissions(
  token: string | null,
  memberId: number,
  permissions: Permissions,
  roleId?: number | null,
): Promise<void> {
  const body: Record<string, unknown> = { member_id: memberId, permissions };
  if (roleId !== undefined) body.role_id = roleId;
  const res = await fetch(`${AUTH_URL}?action=team-update-permissions`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось сохранить права");
}

// ── Роли команды (шаблоны наборов прав) ──────────────────────────────────────

export async function fetchTeamRoles(token: string | null): Promise<TeamRole[]> {
  const res = await fetch(`${AUTH_URL}?action=team-roles-list`, { headers: authHeaders(token) });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Ошибка загрузки ролей");
  return d.roles ?? [];
}

export async function createTeamRole(
  token: string | null,
  payload: { name: string; permissions: Permissions },
): Promise<TeamRole> {
  const res = await fetch(`${AUTH_URL}?action=team-roles-create`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify(payload),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось создать роль");
  return d.role;
}

export async function updateTeamRole(
  token: string | null,
  roleId: number,
  payload: { name?: string; permissions?: Permissions },
): Promise<void> {
  const res = await fetch(`${AUTH_URL}?action=team-roles-update`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ role_id: roleId, ...payload }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось сохранить роль");
}

export async function deleteTeamRole(token: string | null, roleId: number): Promise<void> {
  const res = await fetch(`${AUTH_URL}?action=team-roles-delete`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ role_id: roleId }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось удалить роль");
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
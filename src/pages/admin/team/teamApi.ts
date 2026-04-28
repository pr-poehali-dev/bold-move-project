import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export interface TeamMember {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  approved: boolean;
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
  payload: { email: string; name?: string; phone?: string },
): Promise<{ member: TeamMember; temp_password: string }> {
  const res = await fetch(`${AUTH_URL}?action=team-invite`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify(payload),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Не удалось пригласить");
  return { member: d.member, temp_password: d.temp_password };
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

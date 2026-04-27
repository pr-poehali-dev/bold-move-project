import { ROLE_LABELS } from "./masterAdminTypes";

export default function RoleBadge({ role }: { role: string }) {
  const r = ROLE_LABELS[role] ?? { label: role, color: "#94a3b8" };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
      style={{ background: r.color + "20", color: r.color }}>
      {r.label}
    </span>
  );
}

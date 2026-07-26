import func2url from "@/../backend/func2url.json";
import { masterHeaders } from "./masterAuthFetch";

export const AUTH_URL = (func2url as Record<string, string>)["auth"];

export async function loginAsUser(userId: number) {
  const tok = localStorage.getItem("mp_user_token");
  const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
    method: "POST", headers: masterHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId }),
  });
  const d = await r.json();
  if (d.token) {
    if (tok) {
      localStorage.setItem("mp_master_token", tok);
      localStorage.setItem("mp_master_name", "Мастер");
    }
    localStorage.setItem("mp_user_token", d.token);
    window.location.href = "/company";
  } else {
    alert("Не удалось войти: " + (d.error || "?"));
  }
}

export type BizView   = "active" | "removed";
export type BizFilter = "all" | "approved" | "pending" | "rejected";

export const FILTERS: { id: BizFilter; label: string }[] = [
  { id: "all",      label: "Все"       },
  { id: "approved", label: "Одобрены"  },
  { id: "pending",  label: "Ожидают"   },
  { id: "rejected", label: "Отклонены" },
];

// Переиспользуемый компонент фильтр-таба
export function FilterTabs<T extends string>({
  tabs, active, counts, onSelect,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  counts: Record<T, number>;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition border"
            style={isActive
              ? { background: "rgba(255,255,255,0.09)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }
              : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
            {t.label}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", color: isActive ? "#fff" : "rgba(255,255,255,0.3)" }}>
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Вспомогательные функции ───────────────────────────────────────────────
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function trialDaysLeft(trial_until: string | null): number {
  if (!trial_until) return 0;
  return Math.ceil((new Date(trial_until).getTime() - Date.now()) / 86400000);
}

export const PACKAGES = [
  { id: "start",    label: "Старт",    estimates: 5,   price: 490 },
  { id: "standard", label: "Стандарт", estimates: 20,  price: 990 },
  { id: "pro",      label: "Про",      estimates: 60,  price: 1990 },
  { id: "business", label: "Бизнес",   estimates: 150, price: 3990 },
];

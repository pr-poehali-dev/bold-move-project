import Icon from "@/components/ui/icon";
import { ROLE_LABELS } from "./masterAdminTypes";

type SubFilter = "all" | "active" | "expiring" | "expired" | "none";

const SUB_FILTERS: { id: SubFilter; label: string; color: string }[] = [
  { id: "all",      label: "Все",           color: "#94a3b8" },
  { id: "active",   label: "Активна",       color: "#10b981" },
  { id: "expiring", label: "Скоро кончится", color: "#f59e0b" },
  { id: "expired",  label: "Истекла",       color: "#ef4444" },
  { id: "none",     label: "Нет подписки",  color: "#64748b" },
];

interface Props {
  search:      string;
  sortBy:      "created" | "sub_end";
  roleFilters: Set<string>;
  subFilter:   SubFilter;
  totalShown:  number;
  onSearch:    (v: string) => void;
  onSortBy:    (v: "created" | "sub_end") => void;
  onToggleRole: (role: string) => void;
  onClearRoles: () => void;
  onSubFilter:  (f: SubFilter) => void;
}

export type { SubFilter };

export default function AllUsersFilters({
  search, sortBy, roleFilters, subFilter, totalShown,
  onSearch, onSortBy, onToggleRole, onClearRoles, onSubFilter,
}: Props) {
  return (
    <div className="px-5 py-3 border-b border-white/[0.06] flex-shrink-0" style={{ background: "#07070f" }}>

      {/* Строка 1: поиск + сортировка */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
        </div>
        <button onClick={() => onSortBy(sortBy === "created" ? "sub_end" : "created")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold flex-shrink-0 transition"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Icon name="ArrowUpDown" size={11} />
          {sortBy === "created" ? "по дате" : "по подписке"}
        </button>
      </div>

      {/* Строка 2: фильтры ролей + подписка */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Кнопка «Все» */}
        <button onClick={onClearRoles}
          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
          style={roleFilters.size === 0
            ? { background: "#fff", color: "#07070f", borderColor: "#fff" }
            : { background: "transparent", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
          Все
        </button>

        <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

        {/* Группа «без подписки»: Клиент / Дизайнер / Прораб */}
        <span className="text-[9px] text-white/20 uppercase tracking-wider">без подписки</span>
        {(["client","designer","foreman"] as const).map(role => {
          const r = ROLE_LABELS[role];
          const active = roleFilters.has(role);
          return (
            <button key={role} onClick={() => onToggleRole(role)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
              style={active
                ? { background: r.color + "25", color: r.color, borderColor: r.color + "50" }
                : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
              {r.label}
            </button>
          );
        })}

        <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

        {/* Группа «с подпиской»: Монтажник / Компания */}
        <span className="text-[9px] text-white/20 uppercase tracking-wider">с подпиской</span>
        {(["installer","company"] as const).map(role => {
          const r = ROLE_LABELS[role];
          const active = roleFilters.has(role);
          return (
            <button key={role} onClick={() => onToggleRole(role)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
              style={active
                ? { background: r.color + "25", color: r.color, borderColor: r.color + "50" }
                : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
              {r.label}
            </button>
          );
        })}

        <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

        {/* Фильтр подписки */}
        {SUB_FILTERS.slice(1).map(f => (
          <button key={f.id} onClick={() => onSubFilter(subFilter === f.id ? "all" : f.id)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border"
            style={subFilter === f.id
              ? { background: f.color + "20", color: f.color, borderColor: f.color + "50" }
              : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
            {f.label}
          </button>
        ))}

        <span className="ml-auto text-[10px] text-white/25">{totalShown} польз.</span>
      </div>
    </div>
  );
}

import Icon from "@/components/ui/icon";
import { STATUSES, STATUS_COLORS } from "./PlanProjectsConstants";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
}

export default function PlanProjectsSearchBar({ search, setSearch, filterStatus, setFilterStatus }: Props) {
  return (
    <div className="flex flex-col gap-3 mb-5">
      {/* Поиск */}
      <div className="relative">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, адресу, телефону..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white focus:outline-none transition"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">
            <Icon name="X" size={13} />
          </button>
        )}
      </div>

      {/* Фильтр по статусу — ПК: на всю ширину в один ряд */}
      <div className="hidden sm:flex gap-1 w-full">
        {STATUSES.map(s => (
          <button
            key={s.id}
            onClick={() => setFilterStatus(s.id)}
            className={`py-1 rounded-full text-[10px] font-semibold transition text-center whitespace-nowrap ${"short" in s && s.short ? "px-3 shrink-0" : "flex-1 px-2"}`}
            style={{
              background: filterStatus === s.id
                ? (s.id === "all" ? "rgba(255,255,255,0.15)" : (STATUS_COLORS[s.id]?.bg ?? "rgba(255,255,255,0.1)"))
                : "rgba(255,255,255,0.05)",
              color: filterStatus === s.id
                ? (s.id === "all" ? "#fff" : (STATUS_COLORS[s.id]?.text ?? "#fff"))
                : "rgba(255,255,255,0.65)",
              border: `1px solid ${filterStatus === s.id ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Фильтр по статусу — мобиле: горизонтальный скролл */}
      <div className="flex sm:hidden gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {STATUSES.map(s => (
          <button
            key={s.id}
            onClick={() => setFilterStatus(s.id)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap shrink-0"
            style={{
              background: filterStatus === s.id
                ? (s.id === "all" ? "rgba(255,255,255,0.15)" : (STATUS_COLORS[s.id]?.bg ?? "rgba(255,255,255,0.1)"))
                : "rgba(255,255,255,0.05)",
              color: filterStatus === s.id
                ? (s.id === "all" ? "#fff" : (STATUS_COLORS[s.id]?.text ?? "#fff"))
                : "rgba(255,255,255,0.65)",
              border: `1px solid ${filterStatus === s.id ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

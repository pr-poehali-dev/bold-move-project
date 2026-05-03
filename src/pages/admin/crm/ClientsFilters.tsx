import { STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES, ClientStatus } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";

const ALL_STATUSES = [...LEAD_STATUSES, ...ORDER_STATUSES];

export interface FiltersState {
  search: string;
  statusFilter: string;
  sourceFilter: string;
  dateFrom: string;
  dateTo: string;
  clientStatusFilter: string;
}

export function ClientsFilters({
  filters, onChange, activeFilters, onClear, statuses = [],
}: {
  filters: FiltersState;
  onChange: (patch: Partial<FiltersState>) => void;
  activeFilters: number;
  onClear: () => void;
  statuses?: ClientStatus[];
}) {
  const t = useTheme();
  const { search, statusFilter, sourceFilter, dateFrom, dateTo, clientStatusFilter } = filters;
  const activeClientStatus = statuses.find(s => s.name === clientStatusFilter);

  return (
    <div className="rounded-2xl p-3 space-y-2"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Поиск */}
      <div className="relative w-full">
        <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
        <input value={search} onChange={e => onChange({ search: e.target.value })}
          placeholder="Поиск по имени, телефону..."
          className="w-full rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none transition"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">

        {/* Статус клиента (кастомный) */}
        {statuses.length > 0 && (
          <div className="relative flex-shrink-0">
            <select value={clientStatusFilter} onChange={e => onChange({ clientStatusFilter: e.target.value })}
              className="appearance-none pl-3 pr-7 py-2 rounded-xl text-xs font-semibold focus:outline-none transition cursor-pointer"
              style={activeClientStatus
                ? { background: activeClientStatus.color + "18", color: activeClientStatus.color, border: `1px solid ${activeClientStatus.color}40` }
                : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
              <option value="">Все клиенты</option>
              {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <Icon name="ChevronDown" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: activeClientStatus ? activeClientStatus.color : t.textMute }} />
          </div>
        )}

        {/* Статус воронки */}
        <div className="relative flex-shrink-0">
          <select value={statusFilter} onChange={e => onChange({ statusFilter: e.target.value })}
            className="appearance-none pl-3 pr-7 py-2 rounded-xl text-xs font-semibold focus:outline-none transition cursor-pointer"
            style={statusFilter
              ? { background: STATUS_COLORS[statusFilter] + "18", color: STATUS_COLORS[statusFilter], border: `1px solid ${STATUS_COLORS[statusFilter]}40` }
              : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            <option value="">Этап воронки</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <Icon name="ChevronDown" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: statusFilter ? STATUS_COLORS[statusFilter] : t.textMute }} />
        </div>

        {/* Источник */}
        <div className="relative flex-shrink-0">
          <select value={sourceFilter} onChange={e => onChange({ sourceFilter: e.target.value })}
            className="appearance-none pl-3 pr-7 py-2 rounded-xl text-xs font-semibold focus:outline-none transition cursor-pointer"
            style={sourceFilter
              ? { background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed40" }
              : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            <option value="">Все источники</option>
            <option value="chat">Чат</option>
            <option value="manual">Вручную</option>
            <option value="telegram">Telegram</option>
            <option value="site">Сайт</option>
          </select>
          <Icon name="ChevronDown" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: sourceFilter ? "#a78bfa" : t.textMute }} />
        </div>

        <div className="w-px h-6 flex-shrink-0" style={{ background: t.border }} />

        {/* Даты */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-medium" style={{ color: t.textMute }}>с</span>
          <input type="date" value={dateFrom} onChange={e => onChange({ dateFrom: e.target.value })}
            className="rounded-xl px-2 py-2 text-xs focus:outline-none transition"
            style={{ background: t.surface2, border: `1px solid ${dateFrom ? "#7c3aed60" : t.border}`, color: dateFrom ? t.text : t.textMute, width: 120 }} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-medium" style={{ color: t.textMute }}>по</span>
          <input type="date" value={dateTo} onChange={e => onChange({ dateTo: e.target.value })}
            className="rounded-xl px-2 py-2 text-xs focus:outline-none transition"
            style={{ background: t.surface2, border: `1px solid ${dateTo ? "#7c3aed60" : t.border}`, color: dateTo ? t.text : t.textMute, width: 120 }} />
        </div>

        {activeFilters > 0 && (
          <button onClick={onClear}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
            <Icon name="X" size={11} /> {activeFilters}
          </button>
        )}
      </div>
    </div>
  );
}

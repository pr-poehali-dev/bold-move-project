import { STATUS_LABELS, STATUS_COLORS, Client, DEFAULT_TAGS, ClientStatus, getClientOrders } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { Avatar, Checkbox } from "./ClientsTablePrimitives";
import { loadCustomTags } from "./clientFieldsStore";
import type { TouchBadge } from "./CrmClients";

const INTEREST_META: Record<string, { label: string; color: string }> = {
  high:   { label: "Высокий интерес", color: "#22c55e" },
  medium: { label: "Средний интерес", color: "#eab308" },
  low:    { label: "Низкий интерес",  color: "#ef4444" },
};

const ALL_TAG_COLORS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  DEFAULT_TAGS.forEach(t => { map[t.label] = t.color; });
  try { loadCustomTags().forEach(t => { map[t.label] = t.color; }); } catch { /**/ }
  return map;
})();
export { AddClientModal } from "./AddClientModal";

// ── Таблица клиентов ─────────────────────────────────────────────────────────
export function ClientsTable({
  loading, filteredClients, clients, checkedIds, allChecked, someChecked,
  activeFilters, onToggleAll, onToggleOne, onSelect, onClearFilters,
  statuses = [], getStatusByName, getTouchBadge,
}: {
  loading: boolean;
  filteredClients: Client[];
  clients: Client[];
  checkedIds: Set<number>;
  allChecked: boolean;
  someChecked: boolean;
  activeFilters: number;
  onToggleAll: () => void;
  onToggleOne: (id: number) => void;
  onSelect: (c: Client) => void;
  onClearFilters: () => void;
  statuses?: ClientStatus[];
  getStatusByName?: (name: string | null) => ClientStatus | null;
  getTouchBadge?: (phone: string | null | undefined) => TouchBadge | null;
}) {
  const t = useTheme();
  const isDark = t.theme === "dark";
  const rowHover   = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const rowChecked = isDark ? "rgba(124,58,237,0.1)"   : "rgba(124,58,237,0.05)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* ── Заголовок таблицы (только десктоп) ── */}
      <div className="hidden md:grid grid-cols-[40px_1fr_130px_150px_120px_120px_110px_32px] px-4 py-3"
        style={{ borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
        <div className="flex items-center justify-center">
          <Checkbox checked={allChecked} indeterminate={someChecked} onChange={onToggleAll} />
        </div>
        {["Клиент","Телефон","Адрес","Этап воронки","Дата замера","Статус клиента",""].map(h => (
          <div key={h} className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMute }}>{h}</div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: t.textMute }}>
          <Icon name="Users" size={32} className="opacity-30" />
          <span className="text-sm">{activeFilters > 0 ? "Ничего не найдено по фильтрам" : "Клиенты не найдены"}</span>
          {activeFilters > 0 && (
            <button onClick={onClearFilters} className="text-xs text-violet-400 hover:text-violet-300 transition mt-1">
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : filteredClients.map(c => {
        const isChecked = checkedIds.has(c.id);
        return (
          <div key={c.id}
            className="cursor-pointer transition"
            style={{
              borderBottom: `1px solid ${t.border2}`,
              background: isChecked ? rowChecked : "transparent",
            }}
            onClick={() => onSelect(c)}>

            {/* ── Десктоп: строка таблицы ── */}
            {(() => {
              const clientSt = getStatusByName ? getStatusByName(c.client_status) : null;
              const touchBadge = getTouchBadge ? getTouchBadge(c.phone) : null;
              return (
                <div className="hidden md:grid grid-cols-[40px_1fr_130px_150px_120px_120px_110px_32px] px-4 py-3 items-center"
                  onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLDivElement).style.background = rowHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>

                  <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={isChecked} onChange={() => onToggleOne(c.id)} />
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0">
                      <Avatar name={c.client_name} color={clientSt?.color} />
                      {touchBadge?.unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                          style={{ background: "#ef4444", borderColor: t.surface }} title="Есть непрочитанное касание" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "—"}</div>
                        {(() => {
                          const ordersCount = getClientOrders(c, clients).length;
                          return ordersCount > 1 && (
                            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                              style={{ background: "#7c3aed20", color: "#a78bfa" }}
                              title={`Всего заявок: ${ordersCount}`}>
                              <Icon name="Layers" size={9} /> {ordersCount}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {touchBadge?.interest && INTEREST_META[touchBadge.interest] && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: INTEREST_META[touchBadge.interest].color + "20", color: INTEREST_META[touchBadge.interest].color }}
                            title={touchBadge.next_action || undefined}>
                            {INTEREST_META[touchBadge.interest].label}
                          </span>
                        )}
                        {touchBadge?.stage && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                            {touchBadge.stage}
                          </span>
                        )}
                        {c.tags && c.tags.length > 0 && c.tags.slice(0, 2).map(tag => {
                          const color = ALL_TAG_COLORS[tag] || "#888";
                          return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: color + "20", color }}>{tag}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm truncate font-medium" style={{ color: t.textSub }}>{c.phone || "—"}</div>
                  <div className="text-sm truncate" style={{ color: t.textMute }}>{c.address || "—"}</div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-semibold"
                      style={{ background: STATUS_COLORS[c.status] + "18", color: STATUS_COLORS[c.status] }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </div>
                  <div className="text-xs font-medium" style={{ color: t.textMute }}>
                    {c.measure_date ? new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}
                  </div>
                  <div>
                    {clientSt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
                        style={{ background: clientSt.color + "20", color: clientSt.color }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: clientSt.color }} />
                        {clientSt.name}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: t.textMute }}>—</span>
                    )}
                  </div>
                  <div style={{ color: t.textMute }}><Icon name="ChevronRight" size={14} /></div>
                </div>
              );
            })()}

            {/* ── Мобиле: карточка ── */}
            {(() => {
              const clientSt = getStatusByName ? getStatusByName(c.client_status) : null;
              const touchBadge = getTouchBadge ? getTouchBadge(c.phone) : null;
              return (
                <div className="md:hidden flex items-center gap-3 px-3 py-3">
                  <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={isChecked} onChange={() => onToggleOne(c.id)} />
                  </div>
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.client_name} color={clientSt?.color} />
                    {touchBadge?.unread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                        style={{ background: "#ef4444", borderColor: t.surface }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "—"}</span>
                        {(() => {
                          const ordersCount = getClientOrders(c, clients).length;
                          return ordersCount > 1 && (
                            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                              style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                              <Icon name="Layers" size={9} /> {ordersCount}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {clientSt && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: clientSt.color + "20", color: clientSt.color }}>
                            {clientSt.name}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: STATUS_COLORS[c.status] + "20", color: STATUS_COLORS[c.status] }}>
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.phone && <span className="text-xs font-medium" style={{ color: t.textSub }}>{c.phone}</span>}
                      {c.contract_sum ? <span className="text-xs font-bold text-emerald-400">{Number(c.contract_sum).toLocaleString("ru-RU")} ₽</span> : null}
                    </div>
                    {c.address && <div className="text-xs truncate mt-0.5" style={{ color: t.textMute }}>{c.address}</div>}
                    {(touchBadge?.interest || touchBadge?.stage || (c.tags && c.tags.length > 0)) && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {touchBadge?.interest && INTEREST_META[touchBadge.interest] && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: INTEREST_META[touchBadge.interest].color + "20", color: INTEREST_META[touchBadge.interest].color }}>
                            {INTEREST_META[touchBadge.interest].label}
                          </span>
                        )}
                        {touchBadge?.stage && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: "#7c3aed20", color: "#a78bfa" }}>
                            {touchBadge.stage}
                          </span>
                        )}
                        {c.tags && c.tags.slice(0, 3).map(tag => {
                          const color = ALL_TAG_COLORS[tag] || "#888";
                          return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: color + "20", color }}>{tag}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <Icon name="ChevronRight" size={14} style={{ color: t.textMute, flexShrink: 0 }} />
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Футер */}
      {filteredClients.length > 0 && (
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderTop: `1px solid ${t.border}`, background: t.surface2 }}>
          <span className="text-xs" style={{ color: t.textMute }}>
            {checkedIds.size > 0
              ? `Выбрано ${checkedIds.size} из ${filteredClients.length}`
              : activeFilters > 0
              ? `Показано ${filteredClients.length} из ${clients.length}`
              : `Всего: ${clients.length}`}
          </span>
          <span className="text-xs font-semibold" style={{ color: t.textSub }}>
            {filteredClients.filter(c => c.contract_sum).length > 0 &&
              `Договоров: ${filteredClients.reduce((s,c) => s + (Number(c.contract_sum)||0), 0).toLocaleString("ru-RU")} ₽`}
          </span>
        </div>
      )}
    </div>
  );
}
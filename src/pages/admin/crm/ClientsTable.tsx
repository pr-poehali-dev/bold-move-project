import { STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES, Client, DEFAULT_TAGS } from "./crmApi";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { Avatar, Checkbox } from "./ClientsTablePrimitives";

const ALL_STATUSES = [...LEAD_STATUSES, ...ORDER_STATUSES];

// ── Таблица клиентов ─────────────────────────────────────────────────────────
export function ClientsTable({
  loading, filteredClients, clients, checkedIds, allChecked, someChecked,
  activeFilters, onToggleAll, onToggleOne, onSelect, onClearFilters,
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
}) {
  const t = useTheme();
  const isDark = t.theme === "dark";
  const rowHover   = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const rowChecked = isDark ? "rgba(124,58,237,0.1)"   : "rgba(124,58,237,0.05)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Заголовок */}
      <div className="grid grid-cols-[40px_1fr_150px_180px_140px_140px_40px] px-4 py-3"
        style={{ borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
        <div className="flex items-center justify-center">
          <Checkbox checked={allChecked} indeterminate={someChecked} onChange={onToggleAll} />
        </div>
        {["Клиент","Телефон","Адрес","Статус","Дата замера",""].map(h => (
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
            className="grid grid-cols-[40px_1fr_150px_180px_140px_140px_40px] px-4 py-3 cursor-pointer transition items-center group"
            style={{
              borderBottom: `1px solid ${t.border2}`,
              background: isChecked ? rowChecked : "transparent",
            }}
            onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLDivElement).style.background = rowHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isChecked ? rowChecked : "transparent"; }}
            onClick={() => onSelect(c)}>

            {/* Чекбокс */}
            <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <Checkbox checked={isChecked} onChange={() => onToggleOne(c.id)} />
            </div>

            {/* Имя + теги */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={c.client_name} />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: t.text }}>{c.client_name || "—"}</div>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {c.tags.slice(0, 2).map(tag => {
                      const tagDef = DEFAULT_TAGS.find(d => d.label === tag);
                      return (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: (tagDef?.color || "#666") + "20", color: tagDef?.color || "#888" }}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm truncate font-medium" style={{ color: t.textSub }}>{c.phone || "—"}</div>
            <div className="text-sm truncate" style={{ color: t.textMute }}>{c.address || "—"}</div>

            <div>
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: STATUS_COLORS[c.status] + "18", color: STATUS_COLORS[c.status] }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            </div>

            <div className="text-xs font-medium" style={{ color: t.textMute }}>
              {c.measure_date
                ? new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                : "—"}
            </div>

            <div style={{ color: t.textMute }}>
              <Icon name="ChevronRight" size={14} />
            </div>
          </div>
        );
      })}

      {/* Футер с итогами */}
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
              `Договоров: ${filteredClients.reduce((s,c) => s + (c.contract_sum||0), 0).toLocaleString("ru-RU")} ₽`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Модалка добавления клиента ───────────────────────────────────────────────
type NewClientForm = { client_name: string; phone: string; status: string; address: string; notes: string; measure_date: string };

export function AddClientModal({ form, onChange, onSave, onClose }: {
  form: NewClientForm;
  onChange: (patch: Partial<NewClientForm>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: t.text }}>Новый клиент</h3>
          <button onClick={onClose} style={{ color: t.textMute }}><Icon name="X" size={17} /></button>
        </div>
        <div className="space-y-3">
          {([["client_name","Имя *"],["phone","Телефон"],["address","Адрес"]] as [keyof NewClientForm, string][]).map(([f,l]) => (
            <div key={f}>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>{l}</label>
              <input value={form[f]} onChange={e => onChange({ [f]: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Статус</label>
              <select value={form.status} onChange={e => onChange({ status: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Дата замера</label>
              <input type="datetime-local" value={form.measure_date}
                onChange={e => onChange({ measure_date: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onSave} disabled={!form.client_name.trim()}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-xl font-semibold transition">
            Добавить
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

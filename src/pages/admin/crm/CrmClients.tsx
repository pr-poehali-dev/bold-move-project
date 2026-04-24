import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES, Client, DEFAULT_TAGS } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";

const ALL_STATUSES = [...LEAD_STATUSES, ...ORDER_STATUSES];

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#8b5cf6","#3b82f6","#f59e0b","#10b981","#f97316","#ec4899","#06b6d4"];
  const color = colors[(name || "?").charCodeAt(0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color + "22", border: `1.5px solid ${color}55`, color }}>
      {initials}
    </div>
  );
}

// ── Чекбокс ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }}
      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition"
      style={{
        border: checked || indeterminate ? "none" : "1.5px solid #9ca3af",
        background: checked || indeterminate ? "#7c3aed" : "transparent",
      }}>
      {indeterminate && !checked && <div className="w-2 h-0.5 bg-white rounded-full" />}
      {checked && <Icon name="Check" size={10} style={{ color: "#fff" }} />}
    </button>
  );
}

// ── Панель массовых действий ─────────────────────────────────────────────────
function BulkBar({ count, onChangeStatus, onDelete, onExport, onClear }: {
  count: number;
  onChangeStatus: (s: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl"
      style={{ background: "#1e1b4b", border: "1px solid #4c1d95", minWidth: 420 }}>
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#7c3aed" }}>{count}</div>
        <span className="text-sm text-white/80 font-medium">выбрано</span>
      </div>

      {/* Сменить статус */}
      <div className="relative">
        <button onClick={() => setStatusOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-white"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <Icon name="RefreshCw" size={12} /> Статус <Icon name="ChevronDown" size={11} />
        </button>
        {statusOpen && (
          <div className="absolute bottom-full mb-2 left-0 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[180px]"
            style={{ background: "#1e1b4b", border: "1px solid #4c1d95" }}>
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => { onChangeStatus(s); setStatusOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-white/10 transition">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s] }} />
                <span style={{ color: STATUS_COLORS[s] }}>{STATUS_LABELS[s]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Экспорт CSV */}
      <button onClick={onExport}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-white"
        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
        <Icon name="Download" size={12} /> CSV
      </button>

      {/* Удалить */}
      <button onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-red-400"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <Icon name="Trash2" size={12} /> Удалить
      </button>

      {/* Закрыть */}
      <button onClick={onClear} className="ml-auto text-white/40 hover:text-white/70 transition">
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}

// ── Диалог подтверждения удаления ────────────────────────────────────────────
function DeleteConfirm({ count, onConfirm, onCancel }: {
  count: number; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.12)" }}>
          <Icon name="Trash2" size={22} style={{ color: "#ef4444" }} />
        </div>
        <h3 className="text-base font-bold text-center mb-2" style={{ color: t.text }}>Удалить {count} клиент{count > 4 ? "ов" : count > 1 ? "а" : "а"}?</h3>
        <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>Это действие нельзя отменить</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
            style={{ background: "#ef4444" }}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Главный компонент ────────────────────────────────────────────────────────
export default function CrmClients() {
  const t = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" });

  // Выбор
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = {};
    if (search) extra.search = search;
    if (statusFilter) extra.status = statusFilter;
    crmFetch("clients", undefined, extra).then(d => {
      setClients((Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search, statusFilter]); // eslint-disable-line

  const addClient = async () => {
    if (!newClient.client_name.trim()) return;
    await crmFetch("clients", { method: "POST", body: JSON.stringify(newClient) });
    setShowAdd(false);
    setNewClient({ client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" });
    load();
  };

  // ── Чекбоксы ──
  const allChecked     = clients.length > 0 && checkedIds.size === clients.length;
  const someChecked    = checkedIds.size > 0 && checkedIds.size < clients.length;
  const toggleAll      = () => setCheckedIds(allChecked ? new Set() : new Set(clients.map(c => c.id)));
  const toggleOne      = (id: number) => setCheckedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });
  const clearSelection = () => setCheckedIds(new Set());

  // ── Массовые действия ──
  const bulkChangeStatus = async (status: string) => {
    await Promise.all([...checkedIds].map(id =>
      crmFetch("clients", { method: "PUT", body: JSON.stringify({ status }) }, { id: String(id) })
    ));
    clearSelection();
    load();
  };

  const bulkDelete = async () => {
    await Promise.all([...checkedIds].map(id =>
      crmFetch("clients", { method: "DELETE" }, { id: String(id) })
    ));
    setShowDeleteConfirm(false);
    clearSelection();
    load();
  };

  const bulkExportCSV = () => {
    const selected = clients.filter(c => checkedIds.has(c.id));
    const header = ["ID","Имя","Телефон","Адрес","Статус","Дата замера","Сумма договора"];
    const rows = selected.map(c => [
      c.id,
      c.client_name || "",
      c.phone || "",
      c.address || "",
      STATUS_LABELS[c.status] || c.status,
      c.measure_date ? new Date(c.measure_date).toLocaleDateString("ru-RU") : "",
      c.contract_sum || "",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "clients.csv"; a.click();
    URL.revokeObjectURL(url);
    clearSelection();
  };

  const isDark = t.theme === "dark";
  const rowHover = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const rowChecked = isDark ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.05)";

  return (
    <div className="space-y-4 pb-20">

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Все клиенты</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            {clients.length} клиент{clients.length === 1 ? "" : clients.length < 5 ? "а" : "ов"}
            {checkedIds.size > 0 && <span className="ml-2 text-violet-500 font-semibold">· {checkedIds.size} выбрано</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl font-semibold transition shadow-lg shadow-violet-500/20">
          <Icon name="UserPlus" size={14} /> Добавить клиента
        </button>
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <Icon name="Search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: t.textMute }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, адресу..."
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none transition"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStatusFilter("")}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition"
            style={!statusFilter
              ? { background: "#7c3aed20", color: "#7c3aed", border: "1px solid #7c3aed40" }
              : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            Все
          </button>
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition"
              style={statusFilter === s
                ? { background: STATUS_COLORS[s] + "22", color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}50` }
                : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>

        {/* Заголовок */}
        <div className="grid grid-cols-[40px_1fr_150px_180px_140px_140px_40px] px-4 py-3"
          style={{ borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
          <div className="flex items-center justify-center">
            <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
          </div>
          {["Клиент","Телефон","Адрес","Статус","Дата замера",""].map(h => (
            <div key={h} className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMute }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: t.textMute }}>
            <Icon name="Users" size={32} className="opacity-30" />
            <span className="text-sm">Клиенты не найдены</span>
          </div>
        ) : clients.map(c => {
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
              onClick={() => setSelected(c)}>

              {/* Чекбокс */}
              <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <Checkbox checked={isChecked} onChange={() => toggleOne(c.id)} />
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
        {clients.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: `1px solid ${t.border}`, background: t.surface2 }}>
            <span className="text-xs" style={{ color: t.textMute }}>
              {checkedIds.size > 0 ? `Выбрано ${checkedIds.size} из ${clients.length}` : `Всего: ${clients.length}`}
            </span>
            <span className="text-xs font-semibold" style={{ color: t.textSub }}>
              {clients.filter(c => c.contract_sum).length > 0 &&
                `Договоров: ${clients.reduce((s,c) => s + (c.contract_sum||0), 0).toLocaleString("ru-RU")} ₽`}
            </span>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <ClientDrawer client={selected} onClose={() => setSelected(null)}
          onUpdated={() => { load(); }}
          onDeleted={() => { setSelected(null); load(); }} />
      )}

      {/* Модалка добавления */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: t.text }}>Новый клиент</h3>
              <button onClick={() => setShowAdd(false)} style={{ color: t.textMute }}><Icon name="X" size={17} /></button>
            </div>
            <div className="space-y-3">
              {([["client_name","Имя *"],["phone","Телефон"],["address","Адрес"]] as [keyof typeof newClient, string][]).map(([f,l]) => (
                <div key={f}>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>{l}</label>
                  <input value={newClient[f]} onChange={e => setNewClient({ ...newClient, [f]: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Статус</label>
                  <select value={newClient.status} onChange={e => setNewClient({ ...newClient, status: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: t.textMute }}>Дата замера</label>
                  <input type="datetime-local" value={newClient.measure_date}
                    onChange={e => setNewClient({ ...newClient, measure_date: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
                    style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={addClient} disabled={!newClient.client_name.trim()}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm rounded-xl font-semibold transition">
                Добавить
              </button>
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Панель массовых действий */}
      {checkedIds.size > 0 && (
        <BulkBar
          count={checkedIds.size}
          onChangeStatus={bulkChangeStatus}
          onDelete={() => setShowDeleteConfirm(true)}
          onExport={bulkExportCSV}
          onClear={clearSelection}
        />
      )}

      {/* Подтверждение удаления */}
      {showDeleteConfirm && (
        <DeleteConfirm
          count={checkedIds.size}
          onConfirm={bulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
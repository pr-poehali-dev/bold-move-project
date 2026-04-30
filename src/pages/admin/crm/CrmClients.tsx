import { useEffect, useState } from "react";
import { crmFetch, STATUS_LABELS, Client, getClientOrders } from "./crmApi";
import Icon from "@/components/ui/icon";
import ClientDrawer from "./ClientDrawer";
import { useTheme } from "./themeContext";
import { ClientsFilters, FiltersState } from "./ClientsFilters";
import { ClientsTable, AddClientModal } from "./ClientsTable";
import { BulkBar, DeleteConfirm } from "./ClientsBulkActions";

const EMPTY_FORM = { client_name: "", phone: "", status: "new", address: "", notes: "", measure_date: "" };

export default function CrmClients({ canEdit = true }: { canEdit?: boolean }) {
  const t = useTheme();
  const [clients, setClients]   = useState<Client[]>([]);
  const [clientOrders, setClientOrders] = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [newClient, setNewClient] = useState(EMPTY_FORM);

  // Фильтры
  const [filters, setFilters] = useState<FiltersState>({
    search: "", statusFilter: "", sourceFilter: "", dateFrom: "", dateTo: "",
  });

  // Выбор строк
  const [checkedIds, setCheckedIds]           = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Загрузка ──
  const load = () => {
    setLoading(true);
    const extra: Record<string, string> = {};
    if (filters.search)       extra.search = filters.search;
    if (filters.statusFilter) extra.status = filters.statusFilter;
    crmFetch("clients", undefined, extra).then(d => {
      setClients((Array.isArray(d) ? d : []).filter((c: Client) => c.status !== "deleted"));
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [filters.search, filters.statusFilter]); // eslint-disable-line

  // ── Клиентская фильтрация (источник + диапазон дат) ──
  const filteredClients = (() => {
    // Дедупликация по телефону: один клиент = одна строка (берём самую свежую заявку)
    const phoneMap = new Map<string, Client>();
    const noPhoneList: Client[] = [];
    for (const c of clients) {
      const key = (c.phone || "").trim().replace(/\D/g, "");
      if (!key) {
        noPhoneList.push(c);
        continue;
      }
      const existing = phoneMap.get(key);
      if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
        phoneMap.set(key, c);
      }
    }
    const deduped = [...phoneMap.values(), ...noPhoneList];

    return deduped.filter(c => {
      if (filters.sourceFilter && (c.source || "chat") !== filters.sourceFilter) return false;
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0,0,0,0);
        if (new Date(c.created_at) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23,59,59,999);
        if (new Date(c.created_at) > to) return false;
      }
      return true;
    });
  })();

  const activeFilters = [filters.statusFilter, filters.sourceFilter, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const clearFilters  = () => setFilters(f => ({ ...f, statusFilter: "", sourceFilter: "", dateFrom: "", dateTo: "" }));
  const patchFilters  = (patch: Partial<FiltersState>) => setFilters(f => ({ ...f, ...patch }));

  // ── Добавление клиента ──
  const addClient = async () => {
    if (!newClient.client_name.trim()) return;
    await crmFetch("clients", { method: "POST", body: JSON.stringify(newClient) });
    setShowAdd(false);
    setNewClient(EMPTY_FORM);
    load();
  };

  // ── Чекбоксы ──
  const allChecked  = filteredClients.length > 0 && filteredClients.every(c => checkedIds.has(c.id));
  const someChecked = filteredClients.some(c => checkedIds.has(c.id)) && !allChecked;
  const toggleAll   = () => setCheckedIds(allChecked ? new Set() : new Set(filteredClients.map(c => c.id)));
  const toggleOne   = (id: number) => setCheckedIds(prev => {
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
    const sel = clients.filter(c => checkedIds.has(c.id));
    const header = ["ID","Имя","Телефон","Адрес","Статус","Дата замера","Сумма договора"];
    const rows = sel.map(c => [
      c.id, c.client_name || "", c.phone || "", c.address || "",
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

  return (
    <div className="space-y-4 pb-20">

      {/* Баннер: рекомендуем ПК */}
      <div className="sm:hidden rounded-2xl px-4 py-3 flex items-start gap-3"
        style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.25)" }}>
        <Icon name="Monitor" size={16} style={{ color: "#a78bfa", marginTop: 2, flexShrink: 0 }} />
        <p className="text-xs leading-snug" style={{ color: "#c4b5fd" }}>
          Таблица клиентов лучше работает на компьютере. На телефоне можно смотреть и открывать карточки.
        </p>
      </div>

      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Все клиенты</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            {filteredClients.length !== clients.length
              ? <><span style={{ color: t.textSub }}>{filteredClients.length}</span> из {clients.length}</>
              : <>{clients.length} клиент{clients.length === 1 ? "" : clients.length < 5 ? "а" : "ов"}</>}
            {checkedIds.size > 0 && <span className="ml-2 text-violet-500 font-semibold">· {checkedIds.size} выбрано</span>}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl font-semibold transition shadow-lg shadow-violet-500/20">
            <Icon name="UserPlus" size={14} /> Добавить клиента
          </button>
        )}
      </div>

      {/* Фильтры */}
      <ClientsFilters
        filters={filters}
        onChange={patchFilters}
        activeFilters={activeFilters}
        onClear={clearFilters}
      />

      {/* Таблица */}
      <ClientsTable
        loading={loading}
        filteredClients={filteredClients}
        clients={clients}
        checkedIds={checkedIds}
        allChecked={allChecked}
        someChecked={someChecked}
        activeFilters={activeFilters}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onSelect={c => {
          setClientOrders(getClientOrders(c, clients));
          setSelected(c);
        }}
        onClearFilters={clearFilters}
      />

      {/* Drawer */}
      {selected && (
        <ClientDrawer client={selected} allClientOrders={clientOrders} onClose={() => setSelected(null)}
          onUpdated={() => { load(); }}
          onDeleted={() => { setSelected(null); load(); }}
          canEdit={canEdit} canFinance={true} canFiles={true} />
      )}

      {/* Модалка добавления */}
      {showAdd && (
        <AddClientModal
          form={newClient}
          onChange={patch => setNewClient(f => ({ ...f, ...patch }))}
          onSave={addClient}
          onClose={() => setShowAdd(false)}
        />
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
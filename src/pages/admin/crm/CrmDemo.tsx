// Вкладка "Demo" — видна только мастер-аккаунту. Показывает заявки demo-компаний,
// которые вынесены из основных вкладок (Заказы/Клиенты/Аналитика), чтобы не путать
// тестовые данные с реальными. Использует те же таблицу и карточку клиента, что и CrmClients.
import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Client, getClientOrders } from "./crmApi";
import { useTheme } from "./themeContext";
import { ClientsTable } from "./ClientsTable";
import ClientDrawer from "./ClientDrawer";
import { useClientStatuses } from "@/hooks/useClientStatuses";

interface Props {
  clients: Client[];
  loading: boolean;
  onReload: () => void;
}

export default function CrmDemo({ clients, loading, onReload }: Props) {
  const t = useTheme();
  const [selected, setSelected] = useState<Client | null>(null);
  const { statuses, getByName } = useClientStatuses();

  return (
    <div className="space-y-4 pb-20">
      <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
        style={{ background: "rgba(6,182,212,0.10)", border: "1px solid rgba(6,182,212,0.25)" }}>
        <Icon name="Sparkles" size={16} style={{ color: "#22d3ee", marginTop: 2, flexShrink: 0 }} />
        <p className="text-xs leading-snug" style={{ color: "#67e8f9" }}>
          Здесь показаны заявки demo-компаний. Они скрыты из вкладок «Заказы», «Клиенты» и «Аналитика», чтобы не смешиваться с реальными данными.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: t.text }}>Demo-заявки</h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
            {clients.length} заяв{clients.length === 1 ? "ка" : clients.length < 5 ? "ки" : "ок"}
          </p>
        </div>
      </div>

      <ClientsTable
        loading={loading}
        filteredClients={clients}
        clients={clients}
        checkedIds={new Set()}
        allChecked={false}
        someChecked={false}
        activeFilters={0}
        onToggleAll={() => {}}
        onToggleOne={() => {}}
        onSelect={setSelected}
        onClearFilters={() => {}}
        statuses={statuses}
        getStatusByName={getByName}
      />

      {selected && (
        <ClientDrawer client={selected} allClientOrders={getClientOrders(selected, clients)} onClose={() => setSelected(null)}
          onUpdated={onReload}
          onDeleted={() => { setSelected(null); onReload(); }}
          canEdit canFinance canFiles
          canFieldContacts canFieldAddress canFieldDates canFieldFinance canFieldFiles canFieldCancel
          statuses={statuses}
        />
      )}
    </div>
  );
}

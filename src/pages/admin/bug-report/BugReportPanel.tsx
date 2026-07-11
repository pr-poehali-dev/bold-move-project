import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { crmFetch } from "@/pages/admin/crm/crmApi";
import { STATUS, type Report } from "./bugReportTypes";
import FilterChip from "./FilterChip";
import ReportCard from "./ReportCard";
import BugReportForm from "./BugReportForm";

export default function BugReportPanel() {
  const { user } = useAuth();
  const isMaster = !!user?.is_master;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = () => {
    setLoading(true);
    crmFetch("bug_reports")
      .then((d: any) => {
        setReports(Array.isArray(d?.reports) ? d.reports : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const changeStatus = (id: number, status: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    crmFetch("bug_reports", { method: "PUT", body: JSON.stringify({ id, status }) })
      .catch(() => load());
  };

  const removeReport = (id: number) => {
    if (!confirm("Удалить репорт?")) return;
    setReports(prev => prev.filter(r => r.id !== id));
    crmFetch("bug_reports", { method: "DELETE", body: JSON.stringify({ id }) }).catch(() => load());
  };

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  const counts = STATUS.reduce((acc, s) => {
    acc[s.id] = reports.filter(r => r.status === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name="Bug" size={22} /> Баг-репорт
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Расскажите, что улучшить или исправить — текстом, голосом или скриншотом
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95"
          style={{ background: "#f97316" }}
        >
          <Icon name="Plus" size={16} /> Новый репорт
        </button>
      </div>

      {/* Фильтры по статусам */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="Все" count={reports.length} active={filter === "all"} color="#8b5cf6" onClick={() => setFilter("all")} />
        {STATUS.map(s => (
          <FilterChip key={s.id} label={s.label} count={counts[s.id]} active={filter === s.id} color={s.color} onClick={() => setFilter(s.id)} />
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <div className="text-center py-16 text-white/40 text-sm">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Icon name="Inbox" size={40} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/40 text-sm">Пока нет репортов</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              isMaster={isMaster}
              onStatusChange={changeStatus}
              onRemove={removeReport}
            />
          ))}
        </div>
      )}

      {showForm && (
        <BugReportForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
          authorName={user?.name || user?.email || "Аноним"}
        />
      )}
    </div>
  );
}

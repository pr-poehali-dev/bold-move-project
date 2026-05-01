import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus, PanelView } from "./wlTypes";
import { WLPipelineKanban }        from "./WLPipelineKanban";
import { WLPipelineList }          from "./WLPipelineList";
import { WLPipelineDrawer }        from "./WLPipelineDrawer";
import { WLPipelineEvents }        from "./WLPipelineEvents";
import { WLReceiptModal }          from "./WLReceiptModal";
import { WLPresentationCalendar }  from "./WLPresentationCalendar";
import { WLPresentationModal }     from "./WLPresentationModal";

interface Props {
  refreshTrigger:  number;
  onOpenPanel:     (p: PanelView, token?: string) => void;
  onRunApiTests:   (cid: number) => void;
}

type ViewMode = "kanban" | "list";
type Tab = "companies" | "tasks" | "calendar";

const masterToken = () => localStorage.getItem("mp_user_token") || "";

export function WLPipeline({ refreshTrigger, onOpenPanel, onRunApiTests }: Props) {
  const [companies, setCompanies] = useState<DemoPipelineCompany[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [view,      setView]      = useState<ViewMode>("list");
  const [tab,       setTab]       = useState<Tab>("companies");
  const [filter,    setFilter]    = useState<DemoStatus | "all">("all");
  const [selected,        setSelected]        = useState<DemoPipelineCompany | null>(null);
  const [receiptFor,      setReceiptFor]      = useState<DemoPipelineCompany | null>(null);
  const [presentationFor, setPresentationFor] = useState<DemoPipelineCompany | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=admin-demo-companies`, {
        headers: { "X-Authorization": masterToken() },
      });
      const d = await r.json();
      setCompanies((d.companies || []).filter((c: DemoPipelineCompany) => !c.deleted));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleMove = async (demoId: number, status: DemoStatus) => {
    const company = companies.find(c => c.demo_id === demoId);
    // При переносе в "paid" — требуем чек
    if (status === "paid") {
      if (company) { setReceiptFor(company); return; }
    }
    setCompanies(prev => prev.map(c => c.demo_id === demoId ? { ...c, status } : c));
    await fetch(`${AUTH_URL}?action=admin-update-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: demoId, status }),
    });
  };

  const handleUpdate = (patch: Partial<DemoPipelineCompany>) => {
    if (!selected) return;
    const updated = { ...selected, ...patch };
    setCompanies(prev => prev.map(c => c.demo_id === selected.demo_id ? updated : c));
    setSelected(updated);
  };

  const handleDelete = () => {
    if (!selected) return;
    setCompanies(prev => prev.filter(c => c.demo_id !== selected.demo_id));
  };

  const handleBrand = async (companyId: number) => {
    const tok = await fetch(`${AUTH_URL}?action=admin-login-as`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ user_id: companyId }),
    }).then(r => r.json()).then(d => d.token || null);
    if (tok) onOpenPanel({ type: "agent", companyId }, tok);
  };

  // Считаем задачи для бейджа
  const now = new Date();
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const end7 = new Date(now); end7.setDate(now.getDate() + 6); end7.setHours(23, 59, 59, 999);
  const tasksCount = companies.filter(c => {
    if (c.status === "rejected") return false;
    if (!c.next_action_date) return true; // нет даты — нет действий
    const d = new Date(c.next_action_date);
    return d < sevenDaysAgo || (d >= today0 && d <= end7);
  }).length;

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center gap-2 text-white/30 text-xs py-4">
        <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />
        Загрузка...
      </div>
    );
  }

  return (
    <div>
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620" }}>
            <Icon name="Kanban" size={14} style={{ color: "#8b5cf6" }} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: "#8b5cf6" }}>
            Pipeline ({companies.length})
          </h2>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Переключатель вид — только для вкладки Компании */}
          {tab === "companies" && (
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {([["kanban", "Kanban"], ["list", "List"]] as [ViewMode, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setView(id)}
                  className="px-3 py-1.5 text-[10px] font-bold transition flex items-center gap-1"
                  style={{
                    background: view === id ? "rgba(139,92,246,0.2)" : "transparent",
                    color:      view === id ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  }}>
                  <Icon name={id === "kanban" ? "LayoutGrid" : "List"} size={11} />
                  {label}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Вкладки */}
      {(() => {
        const presCount = companies.filter(c => c.status === "presentation").length;
        return (
          <div className="flex items-center gap-1 mb-4 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => setTab("companies")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition"
              style={{
                background: tab === "companies" ? "rgba(139,92,246,0.2)" : "transparent",
                color:      tab === "companies" ? "#a78bfa" : "rgba(255,255,255,0.3)",
              }}>
              <Icon name="Building2" size={12} /> Компании
            </button>
            <button onClick={() => setTab("tasks")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition"
              style={{
                background: tab === "tasks" ? "rgba(245,158,11,0.15)" : "transparent",
                color:      tab === "tasks" ? "#f59e0b" : "rgba(255,255,255,0.3)",
              }}>
              <Icon name="Target" size={12} /> Задачи
              {tasksCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: tab === "tasks" ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                  {tasksCount}
                </span>
              )}
            </button>
            <button onClick={() => setTab("calendar")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition"
              style={{
                background: tab === "calendar" ? "rgba(249,115,22,0.15)" : "transparent",
                color:      tab === "calendar" ? "#f97316" : "rgba(255,255,255,0.3)",
              }}>
              <Icon name="CalendarDays" size={12} /> Показы
              {presCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: tab === "calendar" ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.15)", color: "#f97316" }}>
                  {presCount}
                </span>
              )}
            </button>
          </div>
        );
      })()}

      {/* Контент вкладки Компании */}
      {tab === "companies" && (
        companies.length === 0 && !loading ? (
          <div className="text-center py-10 text-white/20 text-sm">
            Нет спарсенных компаний — запусти парсер выше
          </div>
        ) : view === "kanban" ? (
          <WLPipelineKanban
            companies={companies}
            onSelect={setSelected}
            onMove={handleMove}
            onUpdate={(demoId, patch) => setCompanies(prev => prev.map(c => c.demo_id === demoId ? { ...c, ...patch } : c))}
          />
        ) : (
          <WLPipelineList
            companies={companies}
            filterStatus={filter}
            onFilterChange={setFilter}
            onSelect={setSelected}
            onMove={(demoId, status) => handleMove(demoId, status)}
            onUpdate={(demoId, patch) => setCompanies(prev => prev.map(c => c.demo_id === demoId ? { ...c, ...patch } : c))}
            onBrand={handleBrand}
          />
        )
      )}

      {/* Контент вкладки Задачи */}
      {tab === "tasks" && (
        <WLPipelineEvents companies={companies} onSelect={setSelected} />
      )}

      {/* Контент вкладки Показы */}
      {tab === "calendar" && (
        <WLPresentationCalendar
          onMarkDone={(demoId, nextActionDate) => {
            setCompanies(prev => prev.map(c => c.demo_id === demoId ? {
              ...c,
              status: "presented",
              next_action: "Связаться с клиентом после презентации",
              next_action_date: nextActionDate || c.next_action_date,
            } : c));
          }}
          onReschedule={p => {
            const company = companies.find(c => c.demo_id === p.demo_id);
            if (company) setPresentationFor(company);
          }}
        />
      )}

      {/* Drawer */}
      {selected && (
        <WLPipelineDrawer
          company={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onOpenPanel={(p, tok) => { setSelected(null); onOpenPanel(p, tok); }}
          onRunApiTests={(cid) => { setSelected(null); onRunApiTests(cid); }}
          onRequestReceipt={() => { setReceiptFor(selected); setSelected(null); }}
        />
      )}

      {/* Модалка загрузки чека */}
      {receiptFor && (
        <WLReceiptModal
          company={receiptFor}
          onSuccess={(demoId) => {
            setCompanies(prev => prev.map(c => c.demo_id === demoId ? { ...c, status: "paid" } : c));
            setReceiptFor(null);
          }}
          onCancel={() => setReceiptFor(null)}
        />
      )}

      {/* Модалка планирования показа */}
      {presentationFor && (
        <WLPresentationModal
          company={presentationFor}
          onSuccess={() => {
            setCompanies(prev => prev.map(c =>
              c.demo_id === presentationFor.demo_id ? { ...c, status: "presentation" } : c
            ));
            setPresentationFor(null);
            setTab("calendar");
          }}
          onCancel={() => setPresentationFor(null)}
        />
      )}
    </div>
  );
}
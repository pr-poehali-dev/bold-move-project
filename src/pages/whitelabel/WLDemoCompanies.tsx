import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { PanelView } from "./wlTypes";
import { WLDemoCompanyItem } from "./WLDemoCompanyItem";
import type { DemoCompany } from "./WLDemoCompanyItem";

interface Props {
  onOpenPanel: (panel: PanelView, token?: string) => void;
  onRunApiTests?: (companyId: number) => void;
  onLoginAs?: (companyId: number) => Promise<string | null>;
  refreshTrigger?: number;
}

function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />;
}

export function WLDemoCompanies({ onOpenPanel, onRunApiTests, refreshTrigger }: Props) {
  const [companies, setCompanies] = useState<DemoCompany[]>([]);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [buying, setBuying]       = useState<number | null>(null);

  const masterToken = () => localStorage.getItem("mp_user_token") || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=admin-demo-companies`, {
        headers: { "X-Authorization": masterToken() },
      });
      const d = await r.json();
      setCompanies((d.companies || []).filter((c: DemoCompany) => !c.removed_at));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const loginAs = async (companyId: number): Promise<string | null> => {
    const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ user_id: companyId }),
    });
    const d = await r.json();
    return d.token || null;
  };

  const openSite = async (c: DemoCompany) => {
    const tok = await loginAs(c.company_id);
    if (tok) onOpenPanel({ type: "site-authed", url: `/?c=${c.company_id}`, token: tok });
    else onOpenPanel({ type: "site", url: `/?c=${c.company_id}` });
  };

  const openPanel = async (c: DemoCompany) => {
    const tok = await loginAs(c.company_id);
    if (tok) onOpenPanel({ type: "admin", companyId: c.company_id }, tok);
  };

  const openBrand = async (c: DemoCompany) => {
    const tok = await loginAs(c.company_id);
    if (tok) onOpenPanel({ type: "agent", companyId: c.company_id }, tok);
  };

  const deleteCompany = async (c: DemoCompany) => {
    if (!window.confirm(`Удалить «${c.company_name || c.site_url}»?`)) return;
    setDeleting(c.id);
    await fetch(`${AUTH_URL}?action=admin-delete-demo-company`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: c.id }),
    });
    setDeleting(null);
    load();
  };

  const buyAgent = async (c: DemoCompany) => {
    setBuying(c.company_id);
    await fetch(`${AUTH_URL}?action=admin-activate-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ company_id: c.company_id }),
    });
    setBuying(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/30 text-xs py-2">
        <Spin /> Загрузка...
      </div>
    );
  }

  if (companies.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#8b5cf620" }}>
            <Icon name="Building2" size={14} style={{ color: "#8b5cf6" }} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: "#8b5cf6" }}>
            Спарсенные компании ({companies.length})
          </h2>
        </div>
        <button onClick={load} className="text-[10px] text-white/30 hover:text-white/60 transition flex items-center gap-1">
          <Icon name="RefreshCw" size={10} /> Обновить
        </button>
      </div>

      {companies.map(c => (
        <WLDemoCompanyItem
          key={c.id}
          c={c}
          isOpen={expanded.has(c.id)}
          isDeleting={deleting === c.id}
          isBuying={buying === c.company_id}
          onToggle={() => toggle(c.id)}
          onOpenSite={() => openSite(c)}
          onOpenPanel={() => openPanel(c)}
          onEditBrand={() => openBrand(c)}
          onRunApiTests={() => onRunApiTests?.(c.company_id)}
          onBuyAgent={() => buyAgent(c)}
          onDelete={() => deleteCompany(c)}
        />
      ))}
    </div>
  );
}
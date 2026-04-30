import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { PanelView } from "./wlTypes";

interface DemoCompany {
  id: number;
  site_url: string;
  created_at: string;
  company_id: number;
  company_name: string;
  bot_name: string;
  brand_color: string;
  support_phone: string;
  estimates_balance: number;
  has_own_agent: boolean;
  company_email: string;
  brand_logo_url: string | null;
  removed_at: string | null;
}

interface Props {
  onOpenPanel: (panel: PanelView, token?: string) => void;
  refreshTrigger?: number;
}

function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />;
}

export function WLDemoCompanies({ onOpenPanel, refreshTrigger }: Props) {
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
      next.has(id) ? next.delete(id) : next.add(id);
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
    await fetch(`${AUTH_URL}?action=admin-delete-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: c.id }),
    });
    setDeleting(null);
    load();
  };

  const buyAgent = async (c: DemoCompany) => {
    setBuying(c.company_id);
    await fetch(`${AUTH_URL}?action=admin-demo-bought-agent`, {
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

      {companies.map(c => {
        const isOpen = expanded.has(c.id);
        const color  = c.brand_color || "#8b5cf6";
        const name   = c.company_name || c.site_url;
        const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];

        return (
          <div key={c.id} className="rounded-2xl overflow-hidden transition"
            style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isOpen ? color + "40" : "rgba(255,255,255,0.06)"}` }}>

            {/* Шапка — всегда видна */}
            <button className="w-full flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
              onClick={() => toggle(c.id)}>
              {/* Аватар */}
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black overflow-hidden"
                style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
                {c.brand_logo_url
                  ? <img src={c.brand_logo_url} className="w-full h-full object-contain" />
                  : name[0]?.toUpperCase()
                }
              </div>
              {/* Инфо */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/90 truncate">{name}</span>
                  {c.has_own_agent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ background: "#10b98120", color: "#10b981" }}>WL</span>
                  )}
                </div>
                <div className="text-[10px] text-white/35 truncate">{domain} · ID #{c.company_id}</div>
              </div>
              {/* Баланс */}
              <span className="text-[10px] font-bold flex-shrink-0"
                style={{ color: c.estimates_balance > 0 ? "#10b981" : "#ef4444" }}>
                {c.estimates_balance} смет
              </span>
              {/* Стрелка */}
              <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            </button>

            {/* Раскрытое содержимое */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
                {/* Детали */}
                <div className="grid grid-cols-2 gap-1.5 mb-3 text-[10px]">
                  <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-white/30 mb-0.5">Сайт</div>
                    <div className="text-white/70 truncate">{domain}</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-white/30 mb-0.5">Email входа</div>
                    <div className="text-white/70 truncate">{c.company_email}</div>
                  </div>
                  {c.support_phone && (
                    <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-white/30 mb-0.5">Телефон</div>
                      <div className="text-white/70">{c.support_phone}</div>
                    </div>
                  )}
                  <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-white/30 mb-0.5">Создан</div>
                    <div className="text-white/70">{new Date(c.created_at).toLocaleDateString("ru-RU")}</div>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => openSite(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}>
                    <Icon name="Globe" size={10} /> Открыть сайт
                  </button>
                  <button onClick={() => openPanel(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
                    <Icon name="LayoutDashboard" size={10} /> Панель
                  </button>
                  <button onClick={() => openBrand(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80"
                    style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <Icon name="Pencil" size={10} /> Бренд
                  </button>

                  {/* Купили агента */}
                  {!c.has_own_agent ? (
                    <button onClick={() => buyAgent(c)} disabled={buying === c.company_id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50"
                      style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                      {buying === c.company_id
                        ? <Spin />
                        : <Icon name="Sparkles" size={10} />
                      } Купили агента
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.18)" }}>
                      <Icon name="CheckCircle2" size={10} /> Агент активен
                    </span>
                  )}

                  {/* Удалить */}
                  <button onClick={() => deleteCompany(c)} disabled={deleting === c.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50 ml-auto"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.20)" }}>
                    {deleting === c.id ? <Spin /> : <Icon name="Trash2" size={10} />}
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

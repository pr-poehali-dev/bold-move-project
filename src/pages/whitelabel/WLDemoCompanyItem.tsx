import Icon from "@/components/ui/icon";
import { WLDemoActions } from "./WLDemoActions";

export interface DemoCompany {
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
  c: DemoCompany;
  isOpen: boolean;
  isDeleting: boolean;
  isBuying: boolean;
  onToggle: () => void;
  onOpenSite: () => void;
  onOpenPanel: () => void;
  onEditBrand: () => void;
  onRunApiTests: () => void;
  onBuyAgent: () => void;
  onDelete: () => void;
}

export function WLDemoCompanyItem({
  c, isOpen, isDeleting, isBuying,
  onToggle, onOpenSite, onOpenPanel, onEditBrand, onRunApiTests, onBuyAgent, onDelete,
}: Props) {
  const color  = c.brand_color || "#8b5cf6";
  const name   = c.company_name || c.site_url;
  const domain = c.site_url.replace(/https?:\/\//, "").split("/")[0];

  return (
    <div className="rounded-2xl overflow-hidden transition"
      style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isOpen ? color + "40" : "rgba(255,255,255,0.06)"}` }}>

      {/* Шапка — всегда видна */}
      <button className="w-full flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
        onClick={onToggle}>
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black overflow-hidden"
          style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
          {c.brand_logo_url
            ? <img src={c.brand_logo_url} className="w-full h-full object-contain" alt="" />
            : name[0]?.toUpperCase()
          }
        </div>
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
        <span className="text-[10px] font-bold flex-shrink-0"
          style={{ color: c.estimates_balance > 0 ? "#10b981" : "#ef4444" }}>
          {c.estimates_balance} смет
        </span>
        <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
      </button>

      {/* Раскрытое содержимое */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
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

          <WLDemoActions
            onOpenSite={onOpenSite}
            onOpenPanel={onOpenPanel}
            onEditBrand={onEditBrand}
            onRunApiTests={onRunApiTests}
            onBuyAgent={onBuyAgent}
            onDelete={onDelete}
            hasOwnAgent={c.has_own_agent}
            isBuying={isBuying}
            isDeleting={isDeleting}
          />
        </div>
      )}
    </div>
  );
}
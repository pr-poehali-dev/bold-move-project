import Icon from "@/components/ui/icon";
import { IframeAdmin } from "./WLHelpers";
import type { PanelView } from "./wlTypes";

interface Props {
  panel: PanelView;
  iframeToken: string | null;
  onClose: () => void;
}

export function WLPanelView({ panel, iframeToken, onClose }: Props) {
  if (!panel) return null;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#06060c", zIndex: 9999 }}>
      {/* Топбар */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.07] flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.025)" }}>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="ArrowLeft" size={12} /> Назад
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono flex-1 min-w-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
          <Icon name={panel.type === "site" ? "Globe" : panel.type === "agent" ? "Pencil" : "LayoutDashboard"} size={11} />
          <span className="truncate">
            {panel.type === "site"
              ? panel.url
              : panel.type === "agent"
              ? `/company?tab=own-agent (ID: ${panel.companyId})`
              : `/company (ID: ${panel.companyId})`}
          </span>
        </div>
        <button
          onClick={() => {
            const url = panel.type === "site" ? panel.url : panel.type === "agent" ? "/company?tab=own-agent" : "/company";
            window.open(url, "_blank");
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80 flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}>
          <Icon name="ExternalLink" size={11} /> Открыть отдельно
        </button>
      </div>

      {/* Контент */}
      {panel.type === "site" ? (
        <iframe
          src={panel.url}
          className="flex-1 w-full border-0"
          title="Сайт компании"
        />
      ) : (
        <IframeAdmin token={iframeToken} tab={panel.type === "agent" ? "own-agent" : undefined} />
      )}
    </div>
  );
}
import type { NavButton } from "@/context/AuthContext";
import { PanelHeader } from "./PanelHeader";
import { RenderBlocks } from "./PanelBlockHelpers";

export { PanelProduction } from "./PanelProduction";
export { PanelPortfolio }  from "./PanelPortfolio";
export { RenderBlocks, BlockContent, blockStyleToCss, blockWidthClass, getYouTubeEmbed } from "./PanelBlockHelpers";

export function PanelCustom({ btn, onClose, onEdit }: { btn: NavButton; onClose: () => void; onEdit?: () => void }) {
  const c = btn.content || {};
  const hasBlocks = !!(c.blocks?.length);

  const handleBtnClick = () => {
    if (!c.btn_action || !c.btn_value) return;
    if (c.btn_action === "phone") { window.location.href = `tel:${c.btn_value.replace(/\D/g, "").replace(/^8/, "+7")}`; return; }
    if (c.btn_action === "whatsapp") { window.open(`https://wa.me/${c.btn_value.replace(/\D/g, "")}`, "_blank"); return; }
    if (c.btn_action === "telegram") { window.open(c.btn_value.startsWith("http") ? c.btn_value : `https://t.me/${c.btn_value.replace("@", "")}`, "_blank"); return; }
    if (c.btn_action === "url") { window.open(c.btn_value, "_blank"); return; }
  };

  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon={btn.icon} title={c.title || btn.label} onClose={onClose} onEdit={onEdit} />
      <div className="flex-1 overflow-y-auto">
        {hasBlocks ? (
          <RenderBlocks blocks={c.blocks!} pageSettings={c.pageSettings} />
        ) : (
          <>
            {c.photo_url && (
              <div className="w-full" style={{ aspectRatio: "16/7" }}>
                <img src={c.photo_url} className="w-full h-full object-cover" alt={btn.label} />
              </div>
            )}
            <div className="p-4 space-y-4">
              {c.text && <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{c.text}</p>}
              {!c.text && !c.photo_url && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-white/20 text-sm mb-2">Страница пустая</p>
                  {onEdit && <p className="text-white/15 text-xs">Нажмите ✏️ чтобы добавить контент</p>}
                </div>
              )}
              {c.btn_label && c.btn_action && c.btn_value && (
                <button onClick={handleBtnClick}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition active:scale-95"
                  style={{ background: "linear-gradient(135deg, #f97316, #e11d48)" }}>
                  {c.btn_label}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

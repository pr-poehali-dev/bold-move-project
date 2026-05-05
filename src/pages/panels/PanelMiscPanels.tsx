import Icon from "@/components/ui/icon";
import { SharedPanelReviews, SharedPanelFaq } from "../sharedPanels";
import { TIPS } from "../chatConfig";
import type { Panel } from "../chatConfig";
import { PanelHeader } from "./PanelHeader";

export function PanelTips({ onAsk, onClose }: { onAsk: (q: string) => void; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Sparkles" title="Спросите Женю" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIPS.map((t, i) => (
            <button key={i} onClick={() => onAsk(t.q)}
              className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-orange-500/20 rounded-xl px-4 py-3 text-left transition-all group">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-orange-500/10 flex items-center justify-center shrink-0 transition-colors">
                <Icon name={t.icon} size={14} className="text-white/30 group-hover:text-orange-400 transition-colors" />
              </div>
              <span className="text-white/50 group-hover:text-white/80 text-xs transition-colors">{t.q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PanelReviews({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="Heart" title="Отзывы клиентов" onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <SharedPanelReviews />
      </div>
    </div>
  );
}

export function PanelFaq({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="HelpCircle" title="Частые вопросы" onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <SharedPanelFaq />
      </div>
    </div>
  );
}

export function PanelOther({ onClose, onPanel }: { onClose: () => void; onPanel: (p: Panel) => void }) {
  const ITEMS = [
    { id: "contacts" as Panel, icon: "Phone",      label: "Контакты",  desc: "Телефон, WhatsApp, Telegram, адрес" },
    { id: "reviews"  as Panel, icon: "Heart",      label: "Отзывы",    desc: "2800+ отзывов, рейтинг 4.9★"       },
    { id: "tips"     as Panel, icon: "Sparkles",   label: "AI-советы", desc: "Умные подсказки для расчёта"       },
    { id: "faq"      as Panel, icon: "HelpCircle", label: "FAQ",       desc: "Частые вопросы о потолках"         },
  ];
  return (
    <div className="h-full flex flex-col">
      <PanelHeader icon="LayoutGrid" title="Другое" onClose={onClose} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-5">
        {ITEMS.map((item) => (
          <button key={item.id} onClick={() => onPanel(item.id)}
            className="flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-orange-500/25 rounded-2xl px-4 py-4 transition-all group text-left w-full">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center shrink-0">
              <Icon name={item.icon} size={20} className="text-orange-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm group-hover:text-orange-300 transition-colors">{item.label}</div>
              <div className="text-white/40 text-xs mt-0.5">{item.desc}</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-white/20 ml-auto group-hover:text-orange-400 transition-colors" />
          </button>
        ))}
        <div className="mt-auto pt-4 flex justify-center">
          <a href="/company" target="_blank" rel="noopener noreferrer"
            className="text-white/10 hover:text-white/30 transition-colors p-2 rounded-lg">
            <Icon name="Settings" size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

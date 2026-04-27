import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

const FUNNEL_STAGES = [
  { statuses: ["new"],                                                                    label: "Заявка",   color: "#8b5cf6", icon: "Inbox" },
  { statuses: ["call"],                                                                   label: "В работе", color: "#a78bfa", icon: "Zap" },
  { statuses: ["measure", "measured"],                                                    label: "Замер",    color: "#f59e0b", icon: "Ruler" },
  { statuses: ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"], label: "Монтаж",  color: "#f97316", icon: "Wrench" },
  { statuses: ["done"],                                                                   label: "Готово",   color: "#10b981", icon: "CheckCircle2" },
  { statuses: ["cancelled"],                                                              label: "Отказ",    color: "#ef4444", icon: "XCircle" },
] as const;

const STAGE_DETAIL: Record<string, string[]> = {
  "В работе": ["call"],
  "Замер":    ["measure", "measured"],
  "Монтаж":   ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"],
};

export function StatusSelector({ status, onSave }: { status: string; onSave: (s: string) => void }) {
  const t = useTheme();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const currentStage = FUNNEL_STAGES.find(g => g.statuses.includes(status as never));

  return (
    <div className="pt-2 pb-2 space-y-2">
      <div className="flex items-center gap-0.5">
        {FUNNEL_STAGES.filter(g => g.label !== "Отказ").map((g, i, arr) => {
          const isActive = g.statuses.includes(status as never);
          const isPast   = FUNNEL_STAGES.findIndex(x => x.statuses.includes(status as never)) > i;
          return (
            <div key={g.label} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => {
                  if (STAGE_DETAIL[g.label]) {
                    setExpandedStage(expandedStage === g.label ? null : g.label);
                  } else {
                    onSave(g.statuses[0]);
                    setExpandedStage(null);
                  }
                }}
                className="flex flex-col items-center gap-1 flex-1 min-w-0 py-1.5 px-0.5 rounded-xl transition"
                style={{
                  background: isActive ? g.color + "20" : isPast ? g.color + "10" : "transparent",
                  border: `1.5px solid ${isActive ? g.color + "60" : isPast ? g.color + "30" : t.border2}`,
                }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: isActive ? g.color : isPast ? g.color + "40" : t.surface }}>
                  <Icon name={g.icon} size={11} style={{ color: isActive ? "#fff" : isPast ? g.color : t.textMute }} />
                </div>
                <span className="text-[9px] font-semibold text-center leading-tight w-full break-words hyphens-auto"
                  style={{ color: isActive ? g.color : isPast ? g.color + "cc" : t.textMute, wordBreak: "break-word" }}>
                  {g.label}
                </span>
              </button>
              {i < arr.length - 1 && (
                <div className="w-2 flex-shrink-0 h-px mx-0.5" style={{ background: isPast ? currentStage?.color + "50" : t.border2 }} />
              )}
            </div>
          );
        })}
        <div className="w-2 flex-shrink-0" />
        <button
          onClick={() => { onSave("cancelled"); setExpandedStage(null); }}
          className="flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition flex-shrink-0"
          style={{
            background: status === "cancelled" ? "#ef444420" : "transparent",
            border: `1.5px solid ${status === "cancelled" ? "#ef444460" : t.border2}`,
          }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: status === "cancelled" ? "#ef4444" : t.surface }}>
            <Icon name="XCircle" size={11} style={{ color: status === "cancelled" ? "#fff" : t.textMute }} />
          </div>
          <span className="text-[9px] font-semibold" style={{ color: status === "cancelled" ? "#ef4444" : t.textMute }}>Отказ</span>
        </button>
      </div>

      {expandedStage && STAGE_DETAIL[expandedStage] && (
        <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
          {STAGE_DETAIL[expandedStage].map(s => (
            <button key={s} onClick={() => { onSave(s); setExpandedStage(null); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition border"
              style={status === s
                ? { background: STATUS_COLORS[s] + "25", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "50" }
                : { borderColor: t.border2, background: t.surface, color: t.textMute }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
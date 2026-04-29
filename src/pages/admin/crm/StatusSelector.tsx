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
  const currentStageIdx = FUNNEL_STAGES.findIndex(g => g.statuses.includes(status as never));
  const currentStage = FUNNEL_STAGES[currentStageIdx];

  const mainStages = FUNNEL_STAGES.filter(g => g.label !== "Отказ");

  return (
    <div className="pt-2 pb-2 space-y-2">

      {/* ── Этапы воронки ── */}
      <div className="flex items-stretch gap-0.5">
        {mainStages.map((g, i, arr) => {
          const isActive = g.statuses.includes(status as never);
          const isPast   = currentStageIdx > i;
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
                className="flex flex-col items-center gap-1 flex-1 min-w-0 rounded-xl transition active:scale-95"
                style={{
                  padding: "clamp(6px, 2vw, 10px) 2px",
                  background: isActive ? g.color + "20" : isPast ? g.color + "10" : "transparent",
                  border: `1.5px solid ${isActive ? g.color + "60" : isPast ? g.color + "30" : t.border2}`,
                  minHeight: 56,
                }}>
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "clamp(22px, 6vw, 28px)",
                    height: "clamp(22px, 6vw, 28px)",
                    background: isActive ? g.color : isPast ? g.color + "40" : t.surface,
                  }}>
                  <Icon
                    name={g.icon}
                    style={{
                      color: isActive ? "#fff" : isPast ? g.color : t.textMute,
                      width: "clamp(10px, 3vw, 13px)",
                      height: "clamp(10px, 3vw, 13px)",
                    }}
                  />
                </div>
                <span
                  className="font-semibold text-center leading-tight w-full hyphens-auto"
                  style={{
                    fontSize: "clamp(8px, 2.2vw, 10px)",
                    color: isActive ? g.color : isPast ? g.color + "cc" : t.textMute,
                    wordBreak: "break-word",
                  }}>
                  {g.label}
                </span>
              </button>
              {i < arr.length - 1 && (
                <div className="w-1.5 flex-shrink-0 h-px mx-0.5" style={{ background: isPast ? currentStage?.color + "50" : t.border2 }} />
              )}
            </div>
          );
        })}

        {/* Разделитель */}
        <div className="w-1.5 flex-shrink-0" />

        {/* Кнопка Отказ */}
        <button
          onClick={() => { onSave("cancelled"); setExpandedStage(null); }}
          className="flex flex-col items-center gap-1 rounded-xl transition flex-shrink-0 active:scale-95"
          style={{
            padding: "clamp(6px, 2vw, 10px) clamp(4px, 2vw, 8px)",
            background: status === "cancelled" ? "#ef444420" : "transparent",
            border: `1.5px solid ${status === "cancelled" ? "#ef444460" : t.border2}`,
            minHeight: 56,
          }}>
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              width: "clamp(22px, 6vw, 28px)",
              height: "clamp(22px, 6vw, 28px)",
              background: status === "cancelled" ? "#ef4444" : t.surface,
            }}>
            <Icon
              name="XCircle"
              style={{
                color: status === "cancelled" ? "#fff" : t.textMute,
                width: "clamp(10px, 3vw, 13px)",
                height: "clamp(10px, 3vw, 13px)",
              }}
            />
          </div>
          <span
            className="font-semibold"
            style={{
              fontSize: "clamp(8px, 2.2vw, 10px)",
              color: status === "cancelled" ? "#ef4444" : t.textMute,
            }}>
            Отказ
          </span>
        </button>
      </div>

      {/* ── Детальные подстатусы ── */}
      {expandedStage && STAGE_DETAIL[expandedStage] && (
        <div className="flex flex-wrap gap-2 pt-1 pl-1">
          {STAGE_DETAIL[expandedStage].map(s => (
            <button key={s} onClick={() => { onSave(s); setExpandedStage(null); }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition border active:scale-95"
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

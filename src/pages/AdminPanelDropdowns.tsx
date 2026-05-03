import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { AgentSubTab } from "./admin/types";

export type MainTab = "crm" | "agent" | "team" | "own-agent";

export const AGENT_TABS: { id: AgentSubTab; label: string; icon: string }[] = [
  { id: "prices",      label: "Цены",            icon: "Tag" },
  { id: "rules",       label: "Правила расчёта", icon: "SlidersHorizontal" },
  { id: "prompt",      label: "Промпт",          icon: "BrainCircuit" },
  { id: "faq",         label: "База знаний",     icon: "Database" },
  { id: "corrections", label: "Обучение",        icon: "GraduationCap" },
];

export interface TabConfig { id: MainTab; icon: string; label: string; }

export const buildMainTabs = (canCrm: boolean, canAgent: boolean, hasTeam: boolean): TabConfig[] => [
  ...(canCrm   ? [{ id: "crm"       as MainTab, icon: "LayoutDashboard", label: "CRM"        }] : []),
  ...(canAgent ? [{ id: "agent"     as MainTab, icon: "BrainCircuit",    label: "Агент"      }] : []),
  ...(hasTeam  ? [{ id: "team"      as MainTab, icon: "Users",           label: "Команда"    }] : []),
  ...(hasTeam  ? [{ id: "own-agent" as MainTab, icon: "Bot",             label: "Свой агент" }] : []),
];

export function AgentTabDropdown({ tabs, active, isDark, onChange, activeLabel, activeIcon }: {
  tabs: { id: AgentSubTab; label: string; icon: string }[];
  active: AgentSubTab;
  isDark: boolean;
  onChange: (t: AgentSubTab) => void;
  activeLabel: string;
  activeIcon: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition"
        style={{
          background: isDark ? "#1a1a2e" : "#f5f3ff",
          border: `1px solid ${isDark ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.3)"}`,
          color: isDark ? "#c4b5fd" : "#7c3aed",
        }}>
        <div className="flex items-center gap-2">
          <Icon name={activeIcon} size={15} style={{ color: isDark ? "#a78bfa" : "#7c3aed" }} />
          {activeLabel}
        </div>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={15}
          style={{ color: isDark ? "#a78bfa" : "#7c3aed", flexShrink: 0 }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-[91] mt-1 rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: isDark ? "#13131f" : "#fff",
              border: `1px solid ${isDark ? "rgba(139,92,246,0.35)" : "rgba(139,92,246,0.2)"}`,
            }}>
            {tabs.map((t, i) => (
              <button key={t.id}
                onClick={() => { onChange(t.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition text-left"
                style={{
                  background: active === t.id ? (isDark ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.1)") : "transparent",
                  color: active === t.id ? (isDark ? "#c4b5fd" : "#7c3aed") : isDark ? "rgba(255,255,255,0.65)" : "#374151",
                  borderTop: i > 0 ? `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"}` : "none",
                }}>
                <Icon name={t.icon} size={14}
                  style={{ color: active === t.id ? (isDark ? "#a78bfa" : "#7c3aed") : isDark ? "rgba(255,255,255,0.3)" : "#9ca3af", flexShrink: 0 }} />
                {t.label}
                {active === t.id && <Icon name="Check" size={12} style={{ color: "#a78bfa", marginLeft: "auto" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MobileTabMenu({ mainTab, isDark, tabs, onSelect }: {
  mainTab: MainTab; isDark: boolean; tabs: TabConfig[];
  onSelect: (t: MainTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = tabs.find(t => t.id === mainTab) ?? tabs[0];

  if (!active) return <div className="flex-1" />;

  return (
    <div className="flex sm:hidden flex-1 relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition"
        style={{ background: "#7c3aed22", color: "#a78bfa", border: "1px solid #7c3aed40" }}>
        <Icon name={active.icon} size={13} />
        {active.label}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-[91] rounded-xl overflow-hidden min-w-[160px]"
            style={{
              background: isDark ? "#0e0e1c" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid #e5e7eb",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
            {tabs.map((tb, i) => (
              <button key={tb.id}
                onClick={() => { onSelect(tb.id); setOpen(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] font-semibold transition text-left"
                style={{
                  background: tb.id === mainTab ? "#7c3aed22" : "transparent",
                  color: tb.id === mainTab ? "#a78bfa" : isDark ? "rgba(255,255,255,0.6)" : "#374151",
                  borderTop: i > 0 ? (isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f3f4f6") : "none",
                }}>
                <Icon name={tb.icon} size={14} />
                {tb.label}
                {tb.id === mainTab && <Icon name="Check" size={11} className="ml-auto" style={{ color: "#a78bfa" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

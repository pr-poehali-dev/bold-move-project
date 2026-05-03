import Icon from "@/components/ui/icon";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabCorrections from "./admin/TabCorrections";
import TabDefaultAutoRules from "./admin/TabDefaultAutoRules";
import CrmPanel from "./admin/crm/CrmPanel";
import TeamPanel from "./admin/team/TeamPanel";
import OwnAgentTeaser from "./admin/own-agent/OwnAgentTeaser";
import OwnAgentEditor from "./admin/own-agent/OwnAgentEditor";
import { AgentTabDropdown, AGENT_TABS, MainTab } from "./AdminPanelDropdowns";
import type { AgentSubTab } from "./admin/types";
import type { Theme } from "./admin/crm/themeContext";

interface AgentPerms {
  prices:      { view: boolean; edit: boolean };
  rules:       { view: boolean; edit: boolean };
  prompt:      { view: boolean; edit: boolean };
  faq:         { view: boolean; edit: boolean };
  corrections: { view: boolean; edit: boolean };
}

interface User {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string;
  is_master?: boolean;
  has_own_agent?: boolean;
  company_id?: number | null;
}

interface Props {
  mainTab: MainTab;
  canCrm: boolean;
  canAgent: boolean;
  hasTeam: boolean;
  crmReady: boolean;
  isDark: boolean;
  theme: Theme;
  agentTab: AgentSubTab;
  setAgentTab: (t: AgentSubTab) => void;
  agentPerms: AgentPerms;
  authToken: string;
  newItemHint: string | null;
  handleItemAdded: (name: string) => void;
  user: User | null;
  initialOrderId: number | null;
  mainTabsLength: number;
}

export function AdminPanelContent({
  mainTab, canCrm, canAgent, hasTeam,
  crmReady, isDark, theme,
  agentTab, setAgentTab, agentPerms,
  authToken, newItemHint, handleItemAdded,
  user, initialOrderId, mainTabsLength,
}: Props) {
  return (
    <>
      {/* ── CRM ── */}
      {mainTab === "crm" && canCrm && (
        <div className="flex-1 overflow-hidden">
          {crmReady
            ? <CrmPanel theme={theme} initialOrderId={initialOrderId} />
            : <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          }
        </div>
      )}

      {/* ── Команда ── */}
      {mainTab === "team" && hasTeam && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TeamPanel isDark={isDark} />
        </div>
      )}

      {/* ── Свой агент ── */}
      {mainTab === "own-agent" && hasTeam && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {user?.has_own_agent
            ? <OwnAgentEditor isDark={isDark} />
            : <OwnAgentTeaser isDark={isDark} />}
        </div>
      )}

      {/* ── Управление агентом ── */}
      {mainTab === "agent" && canAgent && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {(() => {
            const visibleTabs = [
              ...AGENT_TABS.filter(t => agentPerms[t.id as keyof typeof agentPerms]?.view ?? true),
            ];
            const activeAgentTab = visibleTabs.find(t => t.id === agentTab) ?? visibleTabs[0];
            return (
              <>
                {/* Мобиле: кастомный dropdown */}
                <div className="sm:hidden px-4 pt-3 pb-2 flex-shrink-0 relative" style={{ zIndex: 20 }}>
                  <AgentTabDropdown
                    tabs={visibleTabs}
                    active={agentTab}
                    isDark={isDark}
                    onChange={setAgentTab}
                    activeLabel={activeAgentTab?.label ?? ""}
                    activeIcon={activeAgentTab?.icon ?? "Tag"}
                  />
                </div>
                {/* Десктоп: обычные табы */}
                <div className="hidden sm:flex px-4 gap-0.5 pt-2 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb"}` }}>
                  {visibleTabs.map(t => (
                    <button key={t.id} onClick={() => setAgentTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
                        agentTab === t.id
                          ? isDark ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500" : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600"
                          : isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800"
                      }`}>
                      <Icon name={t.icon} size={13} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            );
          })()}

          <div className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full">
            {agentTab === "prices"        && agentPerms.prices.view      && <TabPrices      token={authToken} onItemAdded={handleItemAdded} isDark={isDark} readOnly={!agentPerms.prices.edit} />}
            {agentTab === "rules"         && agentPerms.rules.view       && <TabRules       token={authToken} hint={newItemHint} isDark={isDark} readOnly={!agentPerms.rules.edit} />}
            {agentTab === "prompt"        && agentPerms.prompt.view      && <TabPrompt      token={authToken} isDark={isDark} readOnly={!agentPerms.prompt.edit} />}
            {agentTab === "faq"           && agentPerms.faq.view         && <TabFaq         token={authToken} isDark={isDark} readOnly={!agentPerms.faq.edit} />}
            {agentTab === "corrections"   && agentPerms.corrections.view && <TabCorrections token={authToken} isDark={isDark} readOnly={!agentPerms.corrections.edit} />}
            {agentTab === "default-rules" && user?.is_master             && <TabDefaultAutoRules isDark={isDark} />}
          </div>
        </div>
      )}

      {/* ── Нет доступа ни к одной вкладке ── */}
      {mainTabsLength === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
            <Icon name="ShieldOff" size={22} className="text-red-400" />
          </div>
          <p className={`text-sm font-semibold ${isDark ? "text-white/60" : "text-gray-500"}`}>Нет доступа ни к одному разделу</p>
          <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>Обратитесь к администратору компании для получения прав</p>
        </div>
      )}
    </>
  );
}

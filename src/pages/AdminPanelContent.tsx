import Icon from "@/components/ui/icon";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabCorrections from "./admin/TabCorrections";
import TabDefaultAutoRules from "./admin/TabDefaultAutoRules";
import TeamPanel from "./admin/team/TeamPanel";
import OwnAgentTeaser from "./admin/own-agent/OwnAgentTeaser";
import OwnAgentEditor from "./admin/own-agent/OwnAgentEditor";
import { AgentTabDropdown, AGENT_TABS, MainTab } from "./AdminPanelDropdowns";
import type { AgentSubTab } from "./admin/types";

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
  company_name?: string | null;
  company_addr?: string | null;
  website?: string | null;
  brand?: {
    support_phone?: string | null;
    support_email?: string | null;
    working_hours?: string | null;
    telegram_url?:  string | null;
    bot_name?:      string | null;
  } | null;
}

interface Props {
  mainTab: MainTab;
  canAgent: boolean;
  hasTeam: boolean;
  isDark: boolean;
  agentTab: AgentSubTab;
  setAgentTab: (t: AgentSubTab) => void;
  agentPerms: AgentPerms;
  authToken: string;
  newItemHint: string | null;
  handleItemAdded: (name: string) => void;
  user: User | null;
  mainTabsLength: number;
}

export function AdminPanelContent({
  mainTab, canAgent, hasTeam,
  isDark,
  agentTab, setAgentTab, agentPerms,
  authToken, newItemHint, handleItemAdded,
  user, mainTabsLength,
}: Props) {
  return (
    <>
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
            const visibleTabs = AGENT_TABS.filter(t => agentPerms[t.id as keyof typeof agentPerms]?.view ?? true);
            const activeAgentTab = visibleTabs.find(t => t.id === agentTab) ?? visibleTabs[0];
            return (
              <>
                {/* Мобиле: кастомный dropdown */}
                <div className="sm:hidden px-4 pt-3 pb-2 flex-shrink-0 relative" style={{ zIndex: 20 }}>
                  <AgentTabDropdown
                    tabs={visibleTabs}
                    active={activeAgentTab?.id ?? agentTab}
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
                        activeAgentTab?.id === t.id
                          ? isDark ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500" : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600"
                          : isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800"
                      }`}>
                      <Icon name={t.icon} size={13} />
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full">
                  {activeAgentTab?.id === "prices"        && agentPerms.prices.view      && <TabPrices      token={authToken} onItemAdded={handleItemAdded} isDark={isDark} readOnly={!agentPerms.prices.edit} />}
                  {activeAgentTab?.id === "rules"         && agentPerms.rules.view       && <TabRules       token={authToken} hint={newItemHint} isDark={isDark} readOnly={!agentPerms.rules.edit} />}
                  {activeAgentTab?.id === "prompt"        && agentPerms.prompt.view      && <TabPrompt      token={authToken} isDark={isDark} readOnly={!agentPerms.prompt.edit} user={user} />}
                  {activeAgentTab?.id === "faq"           && agentPerms.faq.view         && <TabFaq         token={authToken} isDark={isDark} readOnly={!agentPerms.faq.edit} />}
                  {activeAgentTab?.id === "corrections"   && agentPerms.corrections.view && <TabCorrections token={authToken} isDark={isDark} readOnly={!agentPerms.corrections.edit} />}
                  {activeAgentTab?.id === "default-rules" && user?.is_master             && <TabDefaultAutoRules isDark={isDark} />}
                </div>
              </>
            );
          })()}
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
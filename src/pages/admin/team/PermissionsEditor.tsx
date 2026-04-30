import Icon from "@/components/ui/icon";
import type { Permissions } from "@/context/AuthContext";

// ── Группы по уровням ──────────────────────────────────────────────────────

type PermGroup = { key: keyof Permissions; icon: string; color: string; label: string; desc: string; };

export const LEVEL1_TABS: PermGroup[] = [
  { key: "crm_view",   icon: "LayoutDashboard", color: "#a78bfa", label: "Вкладка CRM",   desc: "Видит раздел CRM (клиенты, заявки)" },
  { key: "agent_view", icon: "BrainCircuit",    color: "#60a5fa", label: "Вкладка Агент", desc: "Видит настройки агента (цены, правила, промпт)" },
];

export const LEVEL2_CRM: PermGroup[] = [
  { key: "crm_edit",  icon: "Pencil",      color: "#34d399", label: "Редактирование",    desc: "Может менять данные клиентов и статусы" },
  { key: "kanban",    icon: "LayoutGrid",  color: "#818cf8", label: "Канбан-доска",      desc: "Доступ к канбану и переносу заявок" },
  { key: "calendar",  icon: "Calendar",   color: "#f59e0b", label: "Календарь замеров", desc: "Видит и редактирует график" },
  { key: "finance",   icon: "Wallet",     color: "#10b981", label: "Финансы",           desc: "Видит суммы договоров, прибыль" },
  { key: "analytics", icon: "TrendingUp", color: "#fbbf24", label: "Аналитика",         desc: "Доступ к отчётам и статистике" },
  { key: "files",     icon: "Paperclip",  color: "#94a3b8", label: "Файлы клиентов",   desc: "Может загружать и удалять файлы" },
];

export const LEVEL2_AGENT: PermGroup[] = [
  { key: "settings", icon: "Settings", color: "#ef4444", label: "Полный доступ к агенту", desc: "Цены, правила, промпт, база знаний" },
];

// Все группы для обратной совместимости
export const PERM_GROUPS: PermGroup[] = [...LEVEL1_TABS, ...LEVEL2_CRM, ...LEVEL2_AGENT];

// ── Компонент ──────────────────────────────────────────────────────────────

interface Props {
  isDark: boolean;
  permissions: Permissions;
  onChange: (p: Permissions) => void;
}

function SectionHeader({ title, isDark, allChecked, onToggle }: {
  title: string; isDark: boolean; allChecked: boolean; onToggle: () => void;
}) {
  const muted = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  return (
    <div className="flex items-center justify-between mt-4 mb-2 px-1">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>{title}</span>
      <button onClick={onToggle}
        className="text-[10px] font-semibold transition"
        style={{ color: "#a78bfa" }}>
        {allChecked ? "Снять" : "Выдать"}
      </button>
    </div>
  );
}

function PermRow({ g, checked, isDark, onChange }: {
  g: PermGroup; checked: boolean; isDark: boolean; onChange: () => void;
}) {
  const muted  = isDark ? "rgba(255,255,255,0.40)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const text   = isDark ? "#fff" : "#0f1623";
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
      style={{
        background: checked ? `${g.color}14` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
        border: `1.5px solid ${checked ? `${g.color}50` : border}`,
        color: text,
      }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${g.color}1f` }}>
        <Icon name={g.icon} size={14} style={{ color: g.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">{g.label}</div>
        <div className="text-[10px]" style={{ color: muted }}>{g.desc}</div>
      </div>
      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          background: checked ? g.color : "transparent",
          border: `1.5px solid ${checked ? g.color : (isDark ? "rgba(255,255,255,0.2)" : "#d1d5db")}`,
        }}>
        {checked && <Icon name="Check" size={11} style={{ color: "#0a0a14" }} />}
      </div>
    </button>
  );
}

export default function PermissionsEditor({ isDark, permissions, onChange }: Props) {
  const muted  = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";

  const toggle = (key: keyof Permissions) =>
    onChange({ ...permissions, [key]: !permissions[key] });

  const setGroup = (group: PermGroup[], val: boolean) => {
    const patch: Permissions = { ...permissions };
    group.forEach(g => { patch[g.key] = val; });
    onChange(patch);
  };

  const allChecked = (group: PermGroup[]) => group.every(g => permissions[g.key] === true);

  const allAll = PERM_GROUPS.every(g => permissions[g.key] === true);

  const toggleAll = () => {
    const patch: Permissions = {};
    PERM_GROUPS.forEach(g => { patch[g.key] = !allAll; });
    onChange(patch);
  };

  return (
    <div>
      {/* Шапка */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
          Настройка доступа
        </div>
        <button onClick={toggleAll}
          className="text-[10px] font-bold transition flex items-center gap-1"
          style={{ color: "#a78bfa" }}>
          <Icon name={allAll ? "Square" : "CheckSquare"} size={11} />
          {allAll ? "Снять все" : "Выдать все"}
        </button>
      </div>

      {/* Уровень 1 — вкладки */}
      <SectionHeader
        title="Уровень 1 — Вкладки"
        isDark={isDark}
        allChecked={allChecked(LEVEL1_TABS)}
        onToggle={() => setGroup(LEVEL1_TABS, !allChecked(LEVEL1_TABS))}
      />
      <div className="space-y-1.5">
        {LEVEL1_TABS.map(g => (
          <PermRow key={g.key} g={g} checked={!!permissions[g.key]} isDark={isDark} onChange={() => toggle(g.key)} />
        ))}
      </div>

      {/* Уровень 2 — блоки CRM */}
      <SectionHeader
        title="Уровень 2 — Блоки в CRM"
        isDark={isDark}
        allChecked={allChecked(LEVEL2_CRM)}
        onToggle={() => setGroup(LEVEL2_CRM, !allChecked(LEVEL2_CRM))}
      />
      <div className="space-y-1.5">
        {LEVEL2_CRM.map(g => (
          <PermRow key={g.key} g={g} checked={!!permissions[g.key]} isDark={isDark} onChange={() => toggle(g.key)} />
        ))}
      </div>

      {/* Уровень 2 — блоки Агента */}
      <SectionHeader
        title="Уровень 2 — Настройки агента"
        isDark={isDark}
        allChecked={allChecked(LEVEL2_AGENT)}
        onToggle={() => setGroup(LEVEL2_AGENT, !allChecked(LEVEL2_AGENT))}
      />
      <div className="space-y-1.5">
        {LEVEL2_AGENT.map(g => (
          <PermRow key={g.key} g={g} checked={!!permissions[g.key]} isDark={isDark} onChange={() => toggle(g.key)} />
        ))}
      </div>
    </div>
  );
}

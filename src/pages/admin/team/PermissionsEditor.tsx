import Icon from "@/components/ui/icon";
import type { Permissions } from "@/context/AuthContext";

export const PERM_GROUPS: {
  key: keyof Permissions; icon: string; color: string; label: string; desc: string;
}[] = [
  { key: "crm_view",  icon: "Eye",          color: "#a78bfa", label: "Просмотр CRM",
    desc: "Видит список клиентов и заявок" },
  { key: "crm_edit",  icon: "Pencil",       color: "#34d399", label: "Редактирование CRM",
    desc: "Может менять данные клиентов и статусы" },
  { key: "kanban",    icon: "LayoutGrid",   color: "#60a5fa", label: "Канбан-доска",
    desc: "Доступ к канбану и быстрому переносу заявок" },
  { key: "calendar",  icon: "Calendar",     color: "#f59e0b", label: "Календарь замеров",
    desc: "Видит и редактирует график замеров и монтажей" },
  { key: "finance",   icon: "Wallet",       color: "#10b981", label: "Финансы",
    desc: "Видит суммы договоров, прибыль, расходы" },
  { key: "analytics", icon: "TrendingUp",   color: "#fbbf24", label: "Аналитика",
    desc: "Доступ к отчётам и статистике" },
  { key: "files",     icon: "Paperclip",    color: "#94a3b8", label: "Файлы клиентов",
    desc: "Может загружать и удалять файлы" },
  { key: "settings",  icon: "Settings",     color: "#ef4444", label: "Настройки агента",
    desc: "Цены, правила, промпт, база знаний" },
];

interface Props {
  isDark: boolean;
  permissions: Permissions;
  onChange: (p: Permissions) => void;
}

export default function PermissionsEditor({ isDark, permissions, onChange }: Props) {
  const muted  = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const text   = isDark ? "#fff" : "#0f1623";

  const allChecked = PERM_GROUPS.every(g => permissions[g.key] === true);
  const noneChecked = PERM_GROUPS.every(g => !permissions[g.key]);

  const toggleAll = () => {
    const next: Permissions = {};
    PERM_GROUPS.forEach(g => { next[g.key] = !allChecked; });
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
          Доступ к разделам
        </div>
        <button onClick={toggleAll}
          className="text-[10px] font-bold transition flex items-center gap-1"
          style={{ color: "#a78bfa" }}>
          <Icon name={allChecked ? "Square" : "CheckSquare"} size={11} />
          {allChecked ? "Снять все" : noneChecked ? "Выдать все" : "Выдать все"}
        </button>
      </div>

      <div className="space-y-1.5">
        {PERM_GROUPS.map(g => {
          const checked = permissions[g.key] === true;
          return (
            <button key={g.key}
              onClick={() => onChange({ ...permissions, [g.key]: !checked })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
              style={{
                background: checked
                  ? `${g.color}14`
                  : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
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
        })}
      </div>
    </div>
  );
}

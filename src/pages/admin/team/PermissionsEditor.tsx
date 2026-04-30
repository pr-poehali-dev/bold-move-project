import Icon from "@/components/ui/icon";
import type { Permissions } from "@/context/AuthContext";

// ── Типы ──────────────────────────────────────────────────────────────────

type PermRow = {
  label: string;
  icon: string;
  color: string;
  view?: keyof Permissions;   // ключ "видимость"
  edit?: keyof Permissions;   // ключ "редактирование"
  desc?: string;
};

type PermSection = {
  title: string;
  rows: PermRow[];
};

// ── Дерево прав ───────────────────────────────────────────────────────────

export const PERM_TREE: PermSection[] = [
  {
    title: "Уровень 1 — Вкладки",
    rows: [
      { label: "CRM",   icon: "LayoutDashboard", color: "#a78bfa", view: "crm_view",   desc: "Доступ к разделу CRM" },
      { label: "Агент", icon: "BrainCircuit",    color: "#60a5fa", view: "agent_view", desc: "Доступ к настройкам агента" },
    ],
  },
  {
    title: "Уровень 2 — Блоки в CRM",
    rows: [
      { label: "Клиенты",          icon: "Users",        color: "#a78bfa", view: "clients_view",  edit: "clients_edit",  desc: "Список клиентов" },
      { label: "Статус заявок",    icon: "GitBranch",    color: "#34d399", view: "crm_view",      edit: "orders_edit",   desc: "Смена статусов в воронке" },
      { label: "Канбан",           icon: "LayoutGrid",   color: "#818cf8", view: "kanban_view",   edit: "kanban_edit",   desc: "Доска канбан" },
      { label: "Календарь",        icon: "Calendar",     color: "#f59e0b", view: "calendar_view", edit: "calendar_edit", desc: "График замеров и монтажей" },
      { label: "Аналитика",        icon: "TrendingUp",   color: "#fbbf24", view: "analytics_view",                       desc: "Отчёты и статистика" },
      { label: "Финансы",          icon: "Wallet",       color: "#10b981", view: "finance_view",                         desc: "Суммы договоров, прибыль" },
      { label: "Файлы клиентов",   icon: "Paperclip",    color: "#94a3b8", view: "files_view",    edit: "files_edit",    desc: "Загрузка и просмотр файлов" },
    ],
  },
  {
    title: "Уровень 2 — Подвкладки Агента",
    rows: [
      { label: "Цены",          icon: "Tag",               color: "#a78bfa", view: "prices_view",      edit: "prices_edit",      desc: "Прайс-лист" },
      { label: "Правила",       icon: "SlidersHorizontal", color: "#60a5fa", view: "rules_view",       edit: "rules_edit",       desc: "Правила расчёта" },
      { label: "Промпт",        icon: "BrainCircuit",      color: "#818cf8", view: "prompt_view",      edit: "prompt_edit",      desc: "Системный промпт" },
      { label: "База знаний",   icon: "Database",          color: "#34d399", view: "faq_view",         edit: "faq_edit",         desc: "Вопросы и ответы" },
      { label: "Обучение",      icon: "GraduationCap",     color: "#fbbf24", view: "corrections_view", edit: "corrections_edit", desc: "Корректировки бота" },
    ],
  },
  {
    title: "Уровень 3 — Поля в карточке клиента",
    rows: [
      { label: "Контакты",     icon: "Phone",     color: "#a78bfa", view: "field_contacts", desc: "Телефон, email клиента" },
      { label: "Адрес объекта",icon: "MapPin",    color: "#60a5fa", view: "field_address",  desc: "Адрес замера/монтажа" },
      { label: "Даты",         icon: "Calendar",  color: "#f59e0b", view: "field_dates",    desc: "Дата замера и монтажа" },
      { label: "Финансы",      icon: "Wallet",    color: "#10b981", view: "field_finance",  desc: "Суммы и прибыль в карточке" },
      { label: "Примечания",   icon: "FileText",  color: "#94a3b8", view: "field_notes",    desc: "Комментарии и заметки" },
      { label: "Файлы",        icon: "Paperclip", color: "#6366f1", view: "field_files",    desc: "Блок файлов в карточке" },
      { label: "Отмена",       icon: "XCircle",   color: "#ef4444", view: "field_cancel",   desc: "Блок отмены заказа" },
    ],
  },
];

// Все ключи для "выдать/снять все"
export const ALL_PERM_KEYS: (keyof Permissions)[] = PERM_TREE.flatMap(s =>
  s.rows.flatMap(r => [r.view, r.edit].filter(Boolean) as (keyof Permissions)[])
);

// ── Компонент ──────────────────────────────────────────────────────────────

interface Props {
  isDark: boolean;
  permissions: Permissions;
  onChange: (p: Permissions) => void;
}

function Toggle({ checked, color, isDark, onChange, title }: {
  checked: boolean; color: string; isDark: boolean;
  onChange: () => void; title: string;
}) {
  return (
    <button
      onClick={onChange}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition flex-shrink-0"
      style={{
        background: checked ? `${color}25` : (isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"),
        border: `1.5px solid ${checked ? `${color}60` : (isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb")}`,
      }}>
      {checked
        ? <Icon name="Check" size={12} style={{ color }} />
        : <Icon name="Minus" size={12} style={{ color: isDark ? "rgba(255,255,255,0.2)" : "#d1d5db" }} />
      }
    </button>
  );
}

export default function PermissionsEditor({ isDark, permissions, onChange }: Props) {
  const muted   = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const border  = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const text    = isDark ? "#fff" : "#0f1623";
  const textSub = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";

  const toggle = (key: keyof Permissions) =>
    onChange({ ...permissions, [key]: !permissions[key] });

  const allChecked = ALL_PERM_KEYS.every(k => permissions[k] === true);

  const toggleAll = () => {
    const patch: Permissions = {};
    ALL_PERM_KEYS.forEach(k => { patch[k] = !allChecked; });
    onChange({ ...permissions, ...patch });
  };

  const sectionAllChecked = (section: PermSection) =>
    section.rows.every(r =>
      (!r.view || permissions[r.view]) && (!r.edit || permissions[r.edit])
    );

  const toggleSection = (section: PermSection) => {
    const val = !sectionAllChecked(section);
    const patch: Permissions = { ...permissions };
    section.rows.forEach(r => {
      if (r.view) patch[r.view] = val;
      if (r.edit) patch[r.edit] = val;
    });
    onChange(patch);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
          Настройка доступа
        </span>
        <button onClick={toggleAll}
          className="text-[10px] font-bold flex items-center gap-1 transition"
          style={{ color: "#a78bfa" }}>
          <Icon name={allChecked ? "Square" : "CheckSquare"} size={11} />
          {allChecked ? "Снять все" : "Выдать все"}
        </button>
      </div>

      {PERM_TREE.map(section => (
        <div key={section.title}>
          {/* Заголовок секции */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              {section.title}
            </span>
            <button
              onClick={() => toggleSection(section)}
              className="text-[10px] font-semibold transition"
              style={{ color: "#a78bfa" }}>
              {sectionAllChecked(section) ? "Снять" : "Выдать"}
            </button>
          </div>

          {/* Шапка колонок — только если есть edit */}
          {section.rows.some(r => r.edit) && (
            <div className="flex items-center gap-2 px-3 mb-1">
              <div className="flex-1" />
              <span className="text-[9px] font-bold uppercase tracking-widest w-8 text-center" style={{ color: muted }}>👁</span>
              <span className="text-[9px] font-bold uppercase tracking-widest w-8 text-center" style={{ color: muted }}>✏</span>
            </div>
          )}

          {/* Строки */}
          <div className="flex flex-col gap-1">
            {section.rows.map(row => {
              const vChecked = row.view ? !!permissions[row.view] : undefined;
              const eChecked = row.edit ? !!permissions[row.edit] : undefined;
              return (
                <div key={row.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: (vChecked || eChecked)
                      ? `${row.color}0e`
                      : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
                    border: `1px solid ${(vChecked || eChecked) ? `${row.color}30` : border}`,
                  }}>
                  {/* Иконка */}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${row.color}18` }}>
                    <Icon name={row.icon} size={13} style={{ color: row.color }} />
                  </div>
                  {/* Текст */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: text }}>{row.label}</div>
                    {row.desc && (
                      <div className="text-[10px] truncate" style={{ color: textSub }}>{row.desc}</div>
                    )}
                  </div>
                  {/* Переключатели */}
                  {row.view ? (
                    <Toggle
                      checked={vChecked!}
                      color={row.color}
                      isDark={isDark}
                      onChange={() => toggle(row.view!)}
                      title="Видимость"
                    />
                  ) : <div className="w-8" />}
                  {row.edit ? (
                    <Toggle
                      checked={eChecked!}
                      color={row.color}
                      isDark={isDark}
                      onChange={() => toggle(row.edit!)}
                      title="Редактирование"
                    />
                  ) : (
                    section.rows.some(r => r.edit) ? <div className="w-8" /> : null
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

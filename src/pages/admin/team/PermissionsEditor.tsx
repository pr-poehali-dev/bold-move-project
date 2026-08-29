import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { Permissions } from "@/context/AuthContext";
import { useSubstatuses } from "@/pages/admin/crm/useSubstatuses";

// ── Типы ──────────────────────────────────────────────────────────────────

// Ключи прав с булевым значением. Исключаем поля-списки и поле-выбор
// (allowed_tabs, allowed_statuses, allowed_substatuses, calendar_event_types — массивы;
// orders_scope — выбор из вариантов): они настраиваются отдельными вкладками, а не галочкой.
type BoolPermKey = Exclude<keyof Permissions,
  "allowed_tabs" | "allowed_statuses" | "allowed_substatuses" | "calendar_event_types" | "orders_scope">;

// Типы событий календаря — совпадают с event_type в базе.
// Чтобы добавить новый тип, достаточно дописать строку сюда.
export const CALENDAR_EVENT_TYPES = [
  { id: "next_call", label: "Следующий звонок", icon: "PhoneCall",  color: "#38bdf8" },
  { id: "last_call", label: "Последний звонок", icon: "PhoneOutgoing", color: "#818cf8" },
  { id: "measure",   label: "Замер",             icon: "Ruler",      color: "#f59e0b" },
  { id: "install",   label: "Монтаж",            icon: "Hammer",     color: "#34d399" },
];

// Варианты видимости заявок по ответственному
export const ORDERS_SCOPES = [
  { id: "all",      label: "Все заявки компании", icon: "Users",     color: "#a78bfa",
    desc: "Видит всё, как руководитель" },
  { id: "own",      label: "Только свои",          icon: "User",      color: "#f59e0b",
    desc: "Только закреплённые за ним заявки" },
  { id: "own_free", label: "Свои + неназначенные", icon: "UserPlus",  color: "#34d399",
    desc: "Свои плюс НОВЫЕ обращения без ответственного (этап «Заявки»)" },
];

type PermRow = {
  label: string;
  icon: string;
  color: string;
  view?: BoolPermKey;   // ключ "видимость"
  edit?: BoolPermKey;   // ключ "редактирование"
  desc?: string;
  children?: PermRow[]; // вложенные подпункты — сворачиваются под родителем
};

type PermSection = {
  title: string;
  rows: PermRow[];
};

// ── Дерево прав ───────────────────────────────────────────────────────────

export const PERM_TREE: PermSection[] = [
  {
    title: "Доступ к разделам",
    rows: [
      { label: "CRM",               icon: "LayoutDashboard", color: "#a78bfa", view: "crm_view",         desc: "Доступ к разделу CRM" },
      { label: "Агент",             icon: "BrainCircuit",    color: "#60a5fa", view: "agent_view",       desc: "Доступ к настройкам агента" },
      { label: "Построитель",       icon: "PenTool",         color: "#f472b6", view: "plan_view",        desc: "Доступ к конструктору планировок" },
      { label: "Профиль",           icon: "User",            color: "#818cf8", view: "profile_view",     desc: "Просмотр и редактирование профиля" },
      { label: "Тарифы и пакеты",   icon: "Sparkles",        color: "#fbbf24", view: "tariffs_view",     desc: "Раздел тарифов и пакетов" },
      { label: "Настройки компании", icon: "Settings",       color: "#34d399", view: "admin_panel_view", desc: "Кнопка-шестерёнка «Настройки» в верхней панели",
        children: [
          { label: "Команда",          icon: "Users",  color: "#34d399", view: "team_view",         desc: "Вкладка «Команда» внутри настроек" },
          { label: "Свой агент",       icon: "Bot",    color: "#34d399", view: "own_agent_view",    desc: "Вкладка «Свой агент» внутри настроек" },
          { label: "Интеграции",       icon: "Plug",   color: "#34d399", view: "integrations_view", desc: "Вкладка «Интеграции» внутри настроек" },
        ] },
      { label: "Поддержка",         icon: "MessageCircle",   color: "#29b6f6", view: "support_view",     desc: "Раздел поддержки" },
      { label: "Журнал обращений",  icon: "Inbox",           color: "#38bdf8", view: "leads_log_view",   desc: "Лента входящих обращений в верхней панели (не путать с этапом «Заявки» в Заказах)" },
      { label: "Баг-репорт",        icon: "Bug",             color: "#fb7185", view: "bug_report_view",  desc: "Кнопка отправки баг-репорта в верхней панели" },
    ],
  },
  {
    title: "Что видит в CRM",
    rows: [
      { label: "Клиенты",          icon: "Users",        color: "#a78bfa", view: "clients_view",  edit: "clients_edit",  desc: "Список клиентов" },
      { label: "Сообщения",        icon: "MessagesSquare", color: "#38bdf8", view: "messages_view", desc: "Вкладка «Сообщения» — переписка с клиентами" },
      { label: "Заказы",           icon: "GitBranch",    color: "#34d399", view: "orders_view",   edit: "orders_edit",   desc: "Раздел «Заказы» со всеми вкладками воронки (Заявки, Замеры, Монтажи…)" },
      { label: "Канбан",           icon: "LayoutGrid",   color: "#818cf8", view: "kanban_view",   edit: "kanban_edit",   desc: "Отдельная доска-канбан, которую включают кнопкой в шапке CRM" },
      { label: "Календарь",        icon: "Calendar",     color: "#f59e0b", view: "calendar_view", edit: "calendar_edit", desc: "График замеров и монтажей" },
      { label: "Аналитика",        icon: "TrendingUp",   color: "#fbbf24", view: "analytics_view",                       desc: "Отчёты и статистика" },
      { label: "Финансы",          icon: "Wallet",       color: "#10b981", view: "finance_view",                         desc: "Суммы договоров, прибыль" },
      { label: "Файлы клиентов",   icon: "Paperclip",    color: "#94a3b8", view: "files_view",    edit: "files_edit",    desc: "Просмотр файлов и загрузка новых" },
    ],
  },
  {
    title: "Настройки агента",
    rows: [
      { label: "Цены",          icon: "Tag",               color: "#a78bfa", view: "prices_view",      edit: "prices_edit",      desc: "Прайс-лист" },
      { label: "Правила",       icon: "SlidersHorizontal", color: "#60a5fa", view: "rules_view",       edit: "rules_edit",       desc: "Правила расчёта" },
      { label: "Промпт",        icon: "BrainCircuit",      color: "#818cf8", view: "prompt_view",      edit: "prompt_edit",      desc: "Системный промпт" },
      { label: "База знаний",   icon: "Database",          color: "#34d399", view: "faq_view",         edit: "faq_edit",         desc: "Вопросы и ответы" },
      { label: "Обучение",      icon: "GraduationCap",     color: "#fbbf24", view: "corrections_view", edit: "corrections_edit", desc: "Корректировки бота" },
    ],
  },
  {
    title: "Карточка клиента",
    rows: [
      { label: "Контакты",     icon: "Phone",     color: "#a78bfa", view: "field_contacts", desc: "Телефон, email клиента" },
      { label: "Адрес объекта",icon: "MapPin",    color: "#60a5fa", view: "field_address",  desc: "Адрес замера/монтажа" },
      { label: "Даты",         icon: "Calendar",  color: "#f59e0b", view: "field_dates",    desc: "Показывать блок «Даты» в карточке вообще",
        children: [
          { label: "Желаемый замер",   icon: "Ruler",  color: "#38bdf8", view: "dates_view_desired_measure", edit: "dates_edit_desired_measure_date", desc: "Ставит 1 линия со слов клиента" },
          { label: "Желаемый монтаж",  icon: "Wrench", color: "#a78bfa", view: "dates_view_desired_install", edit: "dates_edit_desired_install_date", desc: "Ставит 1 линия со слов клиента" },
          { label: "Факт. замер",      icon: "Ruler",  color: "#f59e0b", view: "dates_view_measure",  edit: "dates_edit_measure_date",  desc: "Ставит 2 линия после согласования" },
          { label: "Факт. монтаж",     icon: "Wrench", color: "#f97316", view: "dates_view_install",  edit: "dates_edit_install_date",  desc: "Ставит 2 линия после согласования" },
        ] },
      { label: "Финансы",      icon: "Wallet",    color: "#10b981", view: "field_finance",  desc: "Суммы и прибыль в карточке" },
      { label: "Примечания",   icon: "FileText",  color: "#94a3b8", view: "field_notes",    desc: "Комментарии и заметки" },
      { label: "Файлы",        icon: "Paperclip", color: "#6366f1", view: "field_files",    desc: "Блок файлов в карточке" },
      { label: "Отмена",       icon: "XCircle",   color: "#ef4444", view: "field_cancel",   desc: "Блок отмены заказа" },
    ],
  },
];

// Разворачивает строку и все её вложенные подпункты в плоский список (рекурсивно)
const flattenRows = (rows: PermRow[]): PermRow[] =>
  rows.flatMap(r => [r, ...(r.children ? flattenRows(r.children) : [])]);

// Все ключи для "выдать/снять все"
export const ALL_PERM_KEYS: BoolPermKey[] = PERM_TREE.flatMap(s =>
  flattenRows(s.rows).flatMap(r => [r.view, r.edit].filter(Boolean) as BoolPermKey[])
);

// ── Этапы воронки заказов (жёсткий список — совпадает с LEAD_STATUSES/ORDER_STATUSES) ──
// Плоский список нужен для "выдать/снять все" и для проверки/переключения
// отдельных статусов внутри группы (см. PIPELINE_GROUPS ниже).
export const PIPELINE_STATUSES: { id: string; label: string; color: string }[] = [
  { id: "new",               label: "Новая заявка",      color: "#3b82f6" },
  { id: "call",               label: "В работе",          color: "#a78bfa" },
  { id: "measure",            label: "Замер назначен",    color: "#f59e0b" },
  { id: "measured",           label: "Замер выполнен",    color: "#8b5cf6" },
  { id: "contract",           label: "Договор подписан",  color: "#06b6d4" },
  { id: "prepaid",            label: "Предоплата получена", color: "#0ea5e9" },
  { id: "install_scheduled",  label: "Монтаж назначен",   color: "#f97316" },
  { id: "install_done",       label: "Монтаж выполнен",   color: "#fb923c" },
  { id: "extra_paid",         label: "Доплата получена",  color: "#84cc16" },
  { id: "done",                label: "Завершён",          color: "#10b981" },
  { id: "cancelled",          label: "Отменён",           color: "#ef4444" },
];

// ── Группы вкладок воронки заказов — доступ выдаётся ЦЕЛОЙ вкладкой, а не
// отдельным статусом внутри неё. tabId совпадает с id вкладки в ORDERS_TABS и
// с order_substatuses.parent_status — это позволяет корректно подтянуть кастомные
// подэтапы компании (например «Дата замера не назначена» внутри «Замеры»).
// «Замер назначен» и «Замер выполнен» — не два отдельных этапа, а два статуса
// ОДНОЙ вкладки «Замеры»: именно поэтому раньше их можно было включить порознь,
// хотя по факту в интерфейсе (вкладка «Заказы» → «Замеры») сотрудник либо видит
// весь этот раздел, либо не видит вовсе.
export const PIPELINE_GROUPS: { tabId: string; label: string; icon: string; color: string; statuses: string[] }[] = [
  { tabId: "leads",    label: "Заявки",    icon: "Inbox",        color: "#8b5cf6", statuses: ["new"] },
  { tabId: "working",  label: "В работе",  icon: "Zap",          color: "#a78bfa", statuses: ["call"] },
  { tabId: "measures", label: "Замеры",    icon: "Ruler",        color: "#f59e0b", statuses: ["measure", "measured"] },
  { tabId: "installs", label: "Монтажи",   icon: "Wrench",       color: "#f97316", statuses: ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"] },
  { tabId: "done",     label: "Финальный", icon: "CheckCircle2", color: "#10b981", statuses: ["done", "cancelled"] },
];

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

// Короткие названия для табов. Две последние вкладки — особые, не входят в PERM_TREE:
// "Этапы" (статусы воронки) и "Мои" (видимость по ответственному + календарь).
const TAB_LABELS = ["Разделы", "CRM", "Агент", "Карточка", "Этапы", "Мои"];
const PIPELINE_TAB_INDEX = TAB_LABELS.length - 2;
const SCOPE_TAB_INDEX = TAB_LABELS.length - 1;

export default function PermissionsEditor({ isDark, permissions, onChange }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const { substatuses } = useSubstatuses(); // кастомные подэтапы компании (для группировки во вкладке "Этапы")
  const [openStatusGroups, setOpenStatusGroups] = useState<Set<string>>(new Set());
  const toggleStatusGroup = (id: string) =>
    setOpenStatusGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const muted   = isDark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const border  = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const text    = isDark ? "#fff" : "#0f1623";
  const textSub = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";

  const toggle = (key: keyof Permissions) =>
    onChange({ ...permissions, [key]: !permissions[key] });

  // Для dates_view_*/dates_edit_* переключаем ОТОБРАЖАЕМОЕ состояние (см. renderRow):
  // отсутствие ключа трактуется как "включено", поэтому обычный !permissions[key]
  // тут не сработает — нужно оттолкнуться от того же "эффективного" значения.
  const toggleDateKey = (key: keyof Permissions) =>
    onChange({ ...permissions, [key]: permissions[key] === false });

  const allChecked = ALL_PERM_KEYS.every(k => permissions[k] === true);

  const toggleAll = () => {
    const patch: Permissions = {};
    ALL_PERM_KEYS.forEach(k => { patch[k] = !allChecked; });
    onChange({ ...permissions, ...patch });
  };

  // Эффективное состояние права с учётом особой семантики dates_view_*/dates_edit_*
  // (см. renderRow) — отсутствие ключа там означает "включено", а не "выключено".
  const isEffectiveChecked = (key: keyof Permissions) =>
    key.startsWith("dates_view_") || key.startsWith("dates_edit_")
      ? permissions[key] !== false
      : !!permissions[key];

  const sectionAllChecked = (section: PermSection) =>
    flattenRows(section.rows).every(r =>
      (!r.view || isEffectiveChecked(r.view)) && (!r.edit || isEffectiveChecked(r.edit))
    );

  const toggleSection = (section: PermSection) => {
    const val = !sectionAllChecked(section);
    const patch: Permissions = { ...permissions };
    flattenRows(section.rows).forEach(r => {
      if (r.view) patch[r.view] = val;
      if (r.edit) patch[r.edit] = val;
    });
    onChange(patch);
  };

  // Подсчёт активных прав в секции для бейджа (считает и вложенные подпункты)
  const sectionActiveCount = (section: PermSection) =>
    flattenRows(section.rows).reduce((n, r) => {
      if (r.view && isEffectiveChecked(r.view)) n++;
      if (r.edit && isEffectiveChecked(r.edit)) n++;
      return n;
    }, 0);

  // Раскрытые родительские строки (по label) — сворачиваемые группы подпунктов
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (label: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // Включение/выключение родителя тянет за собой всех детей (выключение — гасит,
  // включение — включает всех). Ключ самого родителя (view/edit) переключается отдельно.
  const toggleParentCascade = (row: PermRow, key: "view" | "edit") => {
    const permKey = row[key];
    if (!permKey) return;
    const nextVal = !permissions[permKey];
    const patch: Permissions = { ...permissions, [permKey]: nextVal };
    if (row.children && !nextVal) {
      flattenRows(row.children).forEach(child => {
        if (child.view) patch[child.view] = false;
        if (child.edit) patch[child.edit] = false;
      });
    }
    onChange(patch);
  };

  // ── Логика вкладки "Этапы" ────────────────────────────────────────────────
  // Три НЕЗАВИСИМЫХ уровня, каждый — свой массив в permissions:
  //  1) allowed_tabs        — видна ли сама вкладка воронки (leads/working/measures/...)
  //  2) allowed_statuses    — какие статусы внутри разрешены (даже если вкладка не видна)
  //  3) allowed_substatuses — какие кастомные подэтапы разрешены
  // Уровни НЕ тянут друг друга: можно открыть вкладку «Замеры», но не дать ни одного
  // статуса/подэтапа внутри — сотрудник увидит вкладку пустой (0 заявок), и наоборот.
  const allowedTabs = permissions.allowed_tabs ?? [];
  const noTabRestriction = allowedTabs.length === 0;
  const isTabChecked = (tabId: string) => noTabRestriction || allowedTabs.includes(tabId);
  const toggleTab = (tabId: string) => {
    const base = noTabRestriction ? PIPELINE_GROUPS.map(g => g.tabId) : allowedTabs;
    const next = base.includes(tabId) ? base.filter(t => t !== tabId) : [...base, tabId];
    onChange({ ...permissions, allowed_tabs: next });
  };

  const allowedStatuses = permissions.allowed_statuses ?? [];
  const noStatusRestriction = allowedStatuses.length === 0;
  const isStatusChecked = (id: string) => noStatusRestriction || allowedStatuses.includes(id);
  const toggleStatus = (id: string) => {
    const base = noStatusRestriction ? PIPELINE_STATUSES.map(s => s.id) : allowedStatuses;
    const next = base.includes(id) ? base.filter(s => s !== id) : [...base, id];
    onChange({ ...permissions, allowed_statuses: next });
  };

  // Полный список ID всех кастомных подэтапов компании (для перехода из
  // состояния "ограничений нет" в явный список — как и с allowed_statuses выше).
  const allSubstatusIds = substatuses.map(s => String(s.id));
  const allowedSubstatuses = permissions.allowed_substatuses ?? [];
  const noSubRestriction = allowedSubstatuses.length === 0;
  const isSubChecked = (id: number) => noSubRestriction || allowedSubstatuses.includes(String(id));
  const toggleSub = (id: number) => {
    const base = noSubRestriction ? allSubstatusIds : allowedSubstatuses;
    const key = String(id);
    const next = base.includes(key) ? base.filter(s => s !== key) : [...base, key];
    onChange({ ...permissions, allowed_substatuses: next });
  };

  // "Выдать все / Снять все" по всем трём уровням разом (быстрое действие сверху вкладки).
  const allStatusesChecked = noTabRestriction && noStatusRestriction && noSubRestriction;
  const toggleAllStatuses = () => {
    onChange({
      ...permissions,
      allowed_tabs: allStatusesChecked ? PIPELINE_GROUPS.map(g => g.tabId) : [],
      allowed_statuses: allStatusesChecked ? PIPELINE_STATUSES.map(s => s.id) : [],
      allowed_substatuses: allStatusesChecked ? allSubstatusIds : [],
    });
  };

  // ── Логика вкладки "Мои" (видимость по ответственному + календарь) ────────
  const ordersScope = permissions.orders_scope ?? "all";
  const calTypes = permissions.calendar_event_types ?? [];
  const noCalRestriction = calTypes.length === 0;
  const isCalTypeChecked = (id: string) => noCalRestriction || calTypes.includes(id);

  const toggleCalType = (id: string) => {
    // "Ограничений нет" — стартуем с полного списка и убираем нажатый
    const base = noCalRestriction ? CALENDAR_EVENT_TYPES.map(t => t.id) : calTypes;
    const next = base.includes(id) ? base.filter(t => t !== id) : [...base, id];
    onChange({ ...permissions, calendar_event_types: next });
  };

  // Счётчик для бейджа вкладки: считаем только реально включённые ограничения
  const scopeActiveCount =
    (ordersScope !== "all" ? 1 : 0) +
    (permissions.orders_edit_own_only ? 1 : 0) +
    (permissions.orders_reassign ? 1 : 0) +
    (noCalRestriction ? 0 : 1) +
    (permissions.calendar_own_only ? 1 : 0);

  const section = (activeTab === PIPELINE_TAB_INDEX || activeTab === SCOPE_TAB_INDEX)
    ? null : PERM_TREE[activeTab];

  return (
    <div className="flex flex-col gap-3">
      {/* Шапка: "выдать все" */}
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

      {/* Табы-вкладки */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6" }}>
        {TAB_LABELS.map((label, i) => {
          const active = activeTab === i;
          const count  = i === PIPELINE_TAB_INDEX
            ? (noStatusRestriction ? 0 : allowedStatuses.length)
            : i === SCOPE_TAB_INDEX
            ? scopeActiveCount
            : sectionActiveCount(PERM_TREE[i]);
          return (
            <button key={i} onClick={() => setActiveTab(i)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition relative whitespace-nowrap"
              style={{
                background: active ? (isDark ? "#1e1b4b" : "#ffffff") : "transparent",
                color: active ? "#a78bfa" : muted,
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
              }}>
              {label}
              {count > 0 && (
                <span className="text-[9px] font-bold px-1 rounded-full"
                  style={{ background: "#7c3aed40", color: "#a78bfa" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === SCOPE_TAB_INDEX ? (
        <>
          {/* ── Видимость заявок по ответственному ── */}
          <div className="px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              Какие заявки видит
            </span>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-[11px]"
            style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: isDark ? "#c4b5fd" : "#6d28d9" }}>
            Ответственный назначается сам: кто первым взял заявку в работу, за тем она и закрепляется.
          </div>
          <div className="flex flex-col gap-1">
            {ORDERS_SCOPES.map(sc => {
              const checked = ordersScope === sc.id;
              return (
                <button key={sc.id}
                  onClick={() => onChange({ ...permissions, orders_scope: sc.id as Permissions["orders_scope"] })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition"
                  style={{
                    background: checked ? `${sc.color}0e` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
                    border: `1px solid ${checked ? `${sc.color}30` : border}`,
                  }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${sc.color}18` }}>
                    <Icon name={sc.icon} size={13} style={{ color: sc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: text }}>{sc.label}</div>
                    <div className="text-[10px] truncate" style={{ color: textSub }}>{sc.desc}</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: checked ? `${sc.color}25` : (isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"),
                      border: `1.5px solid ${checked ? `${sc.color}60` : border}`,
                    }}>
                    {checked && <Icon name="Check" size={12} style={{ color: sc.color }} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Редактирование только своих */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: permissions.orders_edit_own_only ? "#f59e0b0e" : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
              border: `1px solid ${permissions.orders_edit_own_only ? "#f59e0b30" : border}`,
            }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#f59e0b18" }}>
              <Icon name="Lock" size={13} style={{ color: "#f59e0b" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: text }}>Редактировать только свои</div>
              <div className="text-[10px] truncate" style={{ color: textSub }}>Чужие заявки — только просмотр</div>
            </div>
            <Toggle checked={!!permissions.orders_edit_own_only} color="#f59e0b" isDark={isDark}
              onChange={() => toggle("orders_edit_own_only")} title="Редактировать только свои заявки" />
          </div>

          {/* Может вручную менять ответственного */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: permissions.orders_reassign ? "#818cf80e" : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
              border: `1px solid ${permissions.orders_reassign ? "#818cf830" : border}`,
            }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#818cf818" }}>
              <Icon name="UserCog" size={13} style={{ color: "#818cf8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: text }}>Может менять ответственного</div>
              <div className="text-[10px] truncate" style={{ color: textSub }}>Без этого права ответственный назначается только автоматически</div>
            </div>
            <Toggle checked={!!permissions.orders_reassign} color="#818cf8" isDark={isDark}
              onChange={() => toggle("orders_reassign")} title="Может вручную назначить ответственного" />
          </div>

          {/* ── Календарь ── */}
          <div className="flex items-center justify-between px-1 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              Что видит в календаре
            </span>
            {!noCalRestriction && (
              <button onClick={() => onChange({ ...permissions, calendar_event_types: [] })}
                className="text-[10px] font-semibold transition" style={{ color: "#a78bfa" }}>
                Показать все
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {CALENDAR_EVENT_TYPES.map(t => {
              const checked = isCalTypeChecked(t.id);
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: checked ? `${t.color}0e` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
                    border: `1px solid ${checked ? `${t.color}30` : border}`,
                  }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}18` }}>
                    <Icon name={t.icon} size={13} style={{ color: t.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: text }}>{t.label}</div>
                  </div>
                  <Toggle checked={checked} color={t.color} isDark={isDark}
                    onChange={() => toggleCalType(t.id)} title="Виден сотруднику" />
                </div>
              );
            })}
          </div>

          {/* Только события по своим заявкам */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: permissions.calendar_own_only ? "#38bdf80e" : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
              border: `1px solid ${permissions.calendar_own_only ? "#38bdf830" : border}`,
            }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#38bdf818" }}>
              <Icon name="CalendarCheck" size={13} style={{ color: "#38bdf8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: text }}>Только по своим заявкам</div>
              <div className="text-[10px] truncate" style={{ color: textSub }}>Скрыть события чужих клиентов</div>
            </div>
            <Toggle checked={!!permissions.calendar_own_only} color="#38bdf8" isDark={isDark}
              onChange={() => toggle("calendar_own_only")} title="Только события по своим заявкам" />
          </div>
        </>
      ) : activeTab === PIPELINE_TAB_INDEX ? (
        <>
          {/* Заголовок вкладки "Этапы" */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              Этапы воронки
            </span>
            <button onClick={toggleAllStatuses}
              className="text-[10px] font-semibold transition"
              style={{ color: "#a78bfa" }}>
              {allStatusesChecked ? "Снять все" : "Выдать все"}
            </button>
          </div>

          <div className="rounded-xl px-3 py-2.5 text-[11px]"
            style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: isDark ? "#c4b5fd" : "#6d28d9" }}>
            Переключатель у названия вкладки («Замеры», «Монтажи» и т.д.) управляет ТОЛЬКО тем,
            видна ли эта вкладка сотруднику вообще — не трогает то, что внутри.
            <br /><br />
            Статусы и свои подэтапы внутри вкладки включаются отдельно, каждый сам по себе. Можно
            открыть вкладку, но не дать ни одного статуса внутри — сотрудник увидит вкладку пустой.
            И наоборот — статус можно разрешить, даже если сама вкладка скрыта.
          </div>

          <div className="flex flex-col gap-1">
            {PIPELINE_GROUPS.map(grp => {
              // Статусы группы — если их больше одного (например "Замер назначен" /
              // "Замер выполнен"), каждый переключается отдельно и всегда своей строкой —
              // даже если статус один ("Новая заявка", "В работе"), чтобы не путать с
              // переключателем заголовка: тот управляет ТОЛЬКО видимостью вкладки.
              const innerStatuses = grp.statuses
                .map(id => PIPELINE_STATUSES.find(s => s.id === id))
                .filter((s): s is typeof PIPELINE_STATUSES[number] => !!s);
              const subs = substatuses.filter(s => s.parent_status === grp.tabId);
              // Заголовок группы = ВИДИМОСТЬ вкладки (allowed_tabs), независимо от того,
              // что разрешено внутри. Можно включить вкладку и не дать ни одного статуса —
              // сотрудник увидит вкладку пустой, а не пропавшей.
              const tabChecked = isTabChecked(grp.tabId);
              const hasInner = innerStatuses.length > 0 || subs.length > 0;
              const isOpen = openStatusGroups.has(grp.tabId);
              return (
                <div key={grp.tabId} className="flex flex-col gap-1">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: tabChecked ? `${grp.color}0e` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
                      border: `1px solid ${tabChecked ? `${grp.color}30` : border}`,
                    }}>
                    {hasInner ? (
                      <button onClick={() => toggleStatusGroup(grp.tabId)}
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition"
                        style={{ color: muted }}
                        title={isOpen ? "Свернуть" : "Развернуть"}>
                        <Icon name={isOpen ? "ChevronDown" : "ChevronRight"} size={13} />
                      </button>
                    ) : null}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${grp.color}18` }}>
                      <Icon name={grp.icon} size={13} style={{ color: grp.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: text }}>{grp.label}</div>
                      {hasInner && (
                        <div className="text-[10px] truncate" style={{ color: textSub }}>
                          {innerStatuses.length + subs.length} подэтап{innerStatuses.length + subs.length === 1 ? "" : innerStatuses.length + subs.length < 5 ? "а" : "ов"} внутри
                        </div>
                      )}
                    </div>
                    <Toggle checked={tabChecked} color={grp.color} isDark={isDark}
                      onChange={() => toggleTab(grp.tabId)}
                      title="Вкладка видна сотруднику (статусы внутри настраиваются отдельно)" />
                  </div>
                  {hasInner && isOpen && (
                    <div className="flex flex-col gap-1">
                      {innerStatuses.map(st => {
                        const stChecked = isStatusChecked(st.id);
                        return (
                          <div key={st.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                              marginLeft: 18,
                              background: stChecked ? `${st.color}0e` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
                              border: `1px solid ${stChecked ? `${st.color}30` : border}`,
                            }}>
                            <div className="w-5 flex-shrink-0" />
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${st.color}18` }}>
                              <Icon name="GitBranch" size={13} style={{ color: st.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate" style={{ color: text }}>{st.label}</div>
                              <div className="text-[10px] truncate" style={{ color: textSub }}>Статус этапа «{grp.label}»</div>
                            </div>
                            <Toggle checked={stChecked} color={st.color} isDark={isDark} onChange={() => toggleStatus(st.id)} title="Доступен сотруднику" />
                          </div>
                        );
                      })}
                      {subs.map(sub => {
                        const subChecked = isSubChecked(sub.id);
                        return (
                          <div key={sub.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                              marginLeft: 18,
                              background: subChecked ? `${sub.color}0e` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
                              border: `1px solid ${subChecked ? `${sub.color}30` : border}`,
                            }}>
                            <div className="w-5 flex-shrink-0" />
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${sub.color}18` }}>
                              <Icon name="GitBranch" size={13} style={{ color: sub.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate" style={{ color: text }}>{sub.label}</div>
                              <div className="text-[10px] truncate" style={{ color: textSub }}>Свой подэтап этапа «{grp.label}»</div>
                            </div>
                            <Toggle checked={subChecked} color={sub.color} isDark={isDark} onChange={() => toggleSub(sub.id)} title="Доступен сотруднику" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
      <>
      {/* Заголовок активной секции + кнопка выдать/снять */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
          {section!.title}
        </span>
        <button onClick={() => toggleSection(section!)}
          className="text-[10px] font-semibold transition"
          style={{ color: "#a78bfa" }}>
          {sectionAllChecked(section!) ? "Снять все" : "Выдать все"}
        </button>
      </div>

      {/* Шапка колонок 👁 ✏ — только если есть edit */}
      {section!.rows.some(r => r.edit) && (
        <div className="flex items-center gap-2 px-3">
          <div className="flex-1" />
          <span className="text-[9px] font-bold w-8 text-center" style={{ color: muted }}>👁</span>
          <span className="text-[9px] font-bold w-8 text-center" style={{ color: muted }}>✏</span>
        </div>
      )}

      {/* Строки активной секции (рекурсивно, с вложенными подпунктами) */}
      <div className="flex flex-col gap-1">
        {section!.rows.map(row => renderRow(row, section!, 0))}
      </div>
      </>
      )}
    </div>
  );

  // ── Рендер одной строки прав + её вложенных подпунктов (рекурсивно) ──────
  function renderRow(row: PermRow, section: PermSection, depth: number) {
    // 4 вложенных права дат (dates_view_*/dates_edit_*) имеют особую семантику
    // на бэкенде и в карточке клиента: ОТСУТСТВИЕ ключа = разрешено (обратная
    // совместимость для уже заведённых сотрудников), и только явное false — запрет.
    // Обычные права по умолчанию запрещены (отсутствие ключа = false). Переключатель
    // должен показывать РЕАЛЬНОЕ состояние доступа, иначе владелец видит "выключено",
    // хотя поле по факту показывается в карточке.
    const isDateSubRow = row.view?.startsWith("dates_view_") || row.view?.startsWith("dates_edit_");
    const vChecked = row.view ? (isDateSubRow ? permissions[row.view] !== false : !!permissions[row.view]) : undefined;
    const eChecked = row.edit ? (row.edit.startsWith("dates_edit_") ? permissions[row.edit] !== false : !!permissions[row.edit]) : undefined;
    const active   = vChecked || eChecked;
    const hasChildren = !!row.children?.length;
    const isOpen = openGroups.has(row.label);
    const showEditCol = section.rows.some(r => r.edit);

    return (
      <div key={row.label} className="flex flex-col gap-1">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            marginLeft: depth * 18,
            background: active ? `${row.color}0e` : (isDark ? "rgba(255,255,255,0.025)" : "#f9fafb"),
            border: `1px solid ${active ? `${row.color}30` : border}`,
          }}>
          {hasChildren ? (
            <button onClick={() => toggleGroup(row.label)}
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition"
              style={{ color: muted }}
              title={isOpen ? "Свернуть" : "Развернуть"}>
              <Icon name={isOpen ? "ChevronDown" : "ChevronRight"} size={13} />
            </button>
          ) : depth > 0 ? (
            <div className="w-5 flex-shrink-0" />
          ) : null}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${row.color}18` }}>
            <Icon name={row.icon} size={13} style={{ color: row.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: text }}>{row.label}</div>
            {row.desc && (
              <div className="text-[10px] truncate" style={{ color: textSub }}>{row.desc}</div>
            )}
          </div>
          {row.view
            ? <Toggle checked={vChecked!} color={row.color} isDark={isDark}
                onChange={() => hasChildren ? toggleParentCascade(row, "view") : (isDateSubRow ? toggleDateKey(row.view!) : toggle(row.view!))}
                title="Видимость" />
            : <div className="w-8" />}
          {row.edit
            ? <Toggle checked={eChecked!} color={row.color} isDark={isDark}
                onChange={() => hasChildren ? toggleParentCascade(row, "edit") : (row.edit!.startsWith("dates_edit_") ? toggleDateKey(row.edit!) : toggle(row.edit!))}
                title="Редактирование" />
            : showEditCol ? <div className="w-8" /> : null}
        </div>
        {hasChildren && isOpen && (
          <div className="flex flex-col gap-1">
            {row.children!.map(child => renderRow(child, section, depth + 1))}
          </div>
        )}
      </div>
    );
  }
}
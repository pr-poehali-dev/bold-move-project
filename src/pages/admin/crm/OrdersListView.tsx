import { useState, useEffect } from "react";
import { Client, STATUS_LABELS, DEFAULT_TAGS, crmFetch } from "./crmApi";
import { filterOrdersBySearch } from "./ordersSearch";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, ALL_TAB_ID, SERVICE_TAB_ID, SERVICE_STATUSES, isDuplicateRepeat } from "./ordersTypes";
import { OrdersClientCard } from "./OrdersClientCard";
import { OrdersClientRow } from "./OrdersClientRow";
import { OrdersTabs, Substatus } from "./OrdersTabs";
import { SyncedCol } from "./syncedCols";
import { useOrderSourcesCtx } from "./orderSourcesContext";
import OrdersAssigneeFilter, { AssigneeFilterValue, EMPTY_ASSIGNEE, applyAssigneeFilter } from "./OrdersAssigneeFilter";
import OrdersPeriodFilter, { PeriodFilterValue, applyPeriodFilter } from "./OrdersPeriodFilter";
import MergeDuplicatesModal from "./MergeDuplicatesModal";
import { groupKeyOf } from "./mergeFields";

interface TabDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  statuses: readonly string[];
  emptyText: string;
}

// Подгруппы внутри таба "Финальный" — переключатель показывает только одну группу за раз
const DONE_GROUPS = [
  { key: "done" as const,      label: "Выполнено", statuses: ["done"],      color: "#10b981", icon: "CheckCircle2" },
  { key: "cancelled" as const, label: "Отказ",      statuses: ["cancelled"],color: "#ef4444", icon: "XCircle" },
];

// Подгруппы внутри таба «Другие сделки» — те же переключатели, что и на «Финальном».
// «Сервис» — по флагу is_service, «Дубли» — повторные заявки с тем же телефоном.
const OTHER_GROUPS = [
  { key: "service" as const, label: "Сервис", color: "#14b8a6", icon: "Hammer" },
  { key: "dupes"   as const, label: "Дубли",  color: "#ef4444", icon: "Copy"   },
];

interface Props {
  allClients: Client[];
  loading: boolean;
  viewMode: "grid" | "list";
  search: string;
  activeTab: string;
  onSelect: (c: Client) => void;
  onNextStep: (id: number, nextStatus: string) => void;
  onSaveSubStatus?: (id: number, subStatusId: number) => void;
  onSaveVerified?: (id: number, verified: boolean) => void;
  onSaveConfirmed?: (id: number, confirmed: boolean) => void;
  onSetActiveTab: (tab: string) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
  // tabs config
  tabLabels: Record<string, string>;
  tabColors: Record<string, string>;
  hiddenTabs: Set<string>;
  customTabs: SyncedCol[];
  onSaveLabel: (id: string, val: string) => void;
  onSaveColor: (id: string, color: string) => void;
  onDeleteTab: (id: string) => void;
  onAddTab: () => void;
  substatuses: Substatus[];
  onSubstatusesChange: (list: Substatus[]) => void;
  // персонализация названий/цветов реальных этапов (status) внутри вкладки
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  onSaveStatusLabel: (status: string, val: string) => void;
  onSaveStatusColor: (status: string, color: string) => void;
  // Ограничение сотрудника по этапам воронки (allowed_statuses из настроек доступа).
  // null = ограничений нет. Заявки с недоступным статусом убираются из списка ПОЛНОСТЬЮ —
  // раньше вкладка целиком скрывалась (см. OrdersTabs), только если ни один её статус не
  // разрешён, но внутри разрешённой вкладки (например «Финальный» = done+cancelled) заявки
  // с отдельно запрещённым статусом (например cancelled) всё равно оставались видны.
  allowedStatuses?: string[] | null;
  /** Перезагрузить список после объединения дублей */
  onMerged?: () => void;
}

export function OrdersListView({
  allClients, loading, viewMode, search, activeTab, onSelect, onNextStep, onSaveSubStatus, onSaveVerified, onSaveConfirmed, onSetActiveTab,
  onSwipeBuilder, onSwipeAgent,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
  substatuses, onSubstatusesChange,
  statusLabels, statusColors, onSaveStatusLabel, onSaveStatusColor,
  allowedStatuses = null, onMerged,
}: Props) {
  const t = useTheme();
  const orderSources = useOrderSourcesCtx();
  const [doneSubFilter, setDoneSubFilter] = useState<typeof DONE_GROUPS[number]["key"]>("done");
  // Активная подгруппа вкладки «Другие сделки»: Сервис / Дубли
  const [otherSubFilter, setOtherSubFilter] = useState<typeof OTHER_GROUPS[number]["key"]>("service");
  // Группа дублей, открытая в модалке объединения (null — модалка закрыта)
  const [mergeGroup, setMergeGroup] = useState<Client[] | null>(null);

  // Группы, помеченные как «не дубль» (клиент реально заказал несколько раз).
  // Их заявки остаются в обычных вкладках воронки и не попадают в «Дубли».
  const [notDupKeys, setNotDupKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    crmFetch("not-duplicates")
      .then(d => setNotDupKeys(new Set(((d as { groups?: string[] })?.groups) || [])))
      .catch(() => {});
  }, []);

  const markNotDuplicate = async (ids: number[]) => {
    const res = await crmFetch("not-duplicates", {
      method: "POST", body: JSON.stringify({ ids }),
    }) as { error?: string; group_key?: string };
    if (res?.error) throw new Error(res.error);
    if (res?.group_key) setNotDupKeys(p => new Set([...p, res.group_key!]));
  };

  const unmarkNotDuplicate = async (key: string) => {
    const ids = key.split(",").map(Number);
    const res = await crmFetch("not-duplicates", {
      method: "DELETE", body: JSON.stringify({ ids }),
    }) as { error?: string };
    if (res?.error) return;
    setNotDupKeys(p => { const n = new Set(p); n.delete(key); return n; });
  };

  // Активный статус-фильтр (кликабельная бирка под шапкой). Сбрасывается при смене
  // вкладки, а на «Других сделках» — и при переключении Сервис/Дубли: у этих
  // подгрупп разные наборы этапов, старый выбор дал бы пустой список.
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  useEffect(() => { setActiveStatusFilter(null); }, [activeTab, otherSubFilter]);

  // Активный фильтр по своему этапу (substatus). Тоже сбрасывается при смене вкладки.
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  useEffect(() => { setActiveSubFilter(null); }, [activeTab]);

  // Активный фильтр по источнику (Авито/Квиз/Директ/...). Тоже сбрасывается при смене вкладки.
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>(null);
  useEffect(() => { setActiveSourceFilter(null); }, [activeTab]);

  // Активный фильтр по метке (Недозвон/Перезвонить/...). Тоже сбрасывается при смене вкладки.
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  useEffect(() => { setActiveTagFilter(null); }, [activeTab]);

  // Фильтр «Проверено/Не проверено» — только на вкладке «Финальный», в группе «Выполнено».
  // Тоже сбрасывается при смене вкладки.
  const [activeVerifiedFilter, setActiveVerifiedFilter] = useState<"verified" | "unverified" | null>(null);
  useEffect(() => { setActiveVerifiedFilter(null); }, [activeTab]);

  // Фильтр «Подтверждено/Не подтверждено» — второй тумблер рядом с «Проверено», та же логика.
  const [activeConfirmedFilter, setActiveConfirmedFilter] = useState<"confirmed" | "unconfirmed" | null>(null);
  useEffect(() => { setActiveConfirmedFilter(null); }, [activeTab]);

  // Фильтр по ответственному (роль + сотрудник) и по периоду — показываются на
  // вкладках «В работе», «Замеры», «Монтажи» (там, где важно быстро увидеть свои
  // заявки / что запланировано сегодня-на неделе-в месяце). Оба сбрасываются при
  // смене вкладки, как и остальные фильтры выше.
  const [activeAssignee, setActiveAssignee] = useState<AssigneeFilterValue>(EMPTY_ASSIGNEE);
  useEffect(() => { setActiveAssignee(EMPTY_ASSIGNEE); }, [activeTab]);
  const [activePeriod, setActivePeriod] = useState<PeriodFilterValue>("all");
  useEffect(() => { setActivePeriod("all"); }, [activeTab]);

  // Блок «Ответственный + Период» показываем на ВСЕХ вкладках — единообразно.
  // По какому полю даты фильтровать период — своё для каждой вкладки: на «Замерах»
  // ориентируемся на дату замера, на «Монтажах» — на дату монтажа, на «Финальном» —
  // на дату закрытия сделки, везде остальном (Заявки/В работе/Сервис) — на дату
  // создания заявки.
  const showAssigneePeriodFilters = true;
  const periodDateField = activeTab === "measures" ? "measure_date"
    : activeTab === "installs" ? "install_date"
    : activeTab === "done" ? "closed_at"
    : "created_at";

  const allTabDefs: TabDef[] = [
    ...ORDERS_TABS.filter(tab => !hiddenTabs.has(tab.id)).map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: tab.icon,
      color: tabColors[tab.id] || tab.color, statuses: tab.statuses as readonly string[], emptyText: tab.emptyText,
    })),
    ...customTabs.map(tab => ({
      id: tab.id, label: tabLabels[tab.id] || tab.label, icon: (tab as SyncedCol & { icon?: string }).icon || "Layers",
      color: tabColors[tab.id] || tab.color,
      statuses: Array.isArray((tab as { statuses?: string[] }).statuses) ? (tab as { statuses?: string[] }).statuses as readonly string[] : [] as readonly string[],
      emptyText: (tab as { emptyText?: string }).emptyText || "Нет данных",
    })),
  ] satisfies TabDef[];

  const allTabDef: TabDef = { id: ALL_TAB_ID, label: "Все", icon: "LayoutGrid", color: "#64748b", statuses: [], emptyText: "Заявок нет" };
  const currentTab = activeTab === ALL_TAB_ID ? allTabDef : allTabDefs.find(tab => tab.id === activeTab) ?? allTabDefs[0];
  // Вкладка «Другие сделки» фильтрует по признакам заявки, а не по статусу:
  // подгруппа «Сервис» — флаг is_service, подгруппа «Дубли» — повторная заявка с
  // тем же телефоном. Из остальных вкладок и те и другие исключаем, чтобы они не
  // мешались с полноценными объектами (особенно в «Монтажах»).
  // Повтором считается НЕ самая ранняя заявка клиента: оригинал остаётся в воронке,
  // иначе из этапов пропали бы обе заявки вместе с их суммами.
  const isStatusAllowed = (status: string | null | undefined) =>
    !allowedStatuses || allowedStatuses.includes(status ?? "");
  // Помеченная группа «не дубль» перестаёт считаться повтором — её заявки
  // возвращаются в обычные вкладки воронки и уходят из счётчика дублей.
  const isRepeat = (c: Client) =>
    isDuplicateRepeat(c) && !notDupKeys.has(groupKeyOf(c.duplicate_ids ?? []));
  const clientsByStatus = activeTab === SERVICE_TAB_ID
    ? (otherSubFilter === "dupes"
        ? allClients.filter(c => isRepeat(c) && isStatusAllowed(c.status))
        : allClients.filter(c => c.is_service && !isRepeat(c)))
    : activeTab === ALL_TAB_ID
      ? allClients.filter(c => isStatusAllowed(c.status))
      : allClients.filter(c => !c.is_service && !isRepeat(c) && currentTab.statuses.includes(c.status ?? "") && isStatusAllowed(c.status));

  // Реальные этапы (статусы) текущей вкладки — бирки показываются только когда
  // на вкладке больше одного статуса (иначе делить нечего: leads/working — по одному).
  // Вкладка "done" уже имеет свой переключатель Выполнено/Отказ — бирки там не дублируем.
  // «Сервис» — особый случай: у таба в конфиге statuses пустой (фильтруется по is_service),
  // свои 3 этапа воронки берём отдельно из SERVICE_STATUSES.
  // На «Дублях» заявки могут быть на любом этапе воронки, поэтому бирки берём из
  // всех статусов, реально встречающихся в подборке, — иначе фильтровать нечем.
  const dupeStatusesPresent = Array.from(new Set(
    allClients.filter(c => isRepeat(c)).map(c => c.status ?? "").filter(Boolean)
  ));
  const tabStatuses = activeTab === SERVICE_TAB_ID
    ? (otherSubFilter === "dupes" ? dupeStatusesPresent : SERVICE_STATUSES)
    : activeTab !== "done" && currentTab.statuses.length > 1 ? currentTab.statuses : [];
  // Свои этапы (кастомные substatus), привязанные к текущей вкладке
  const mySubstatuses = substatuses.filter(s => s.parent_status === activeTab);
  const clientsByStatusAndFilter = activeStatusFilter != null
    ? clientsByStatus.filter(c => c.status === activeStatusFilter)
    : clientsByStatus;
  const clientsByStatusSubFilter = activeSubFilter != null
    ? clientsByStatusAndFilter.filter(c => c.sub_status === activeSubFilter)
    : clientsByStatusAndFilter;

  // На вкладке «Финальный» источники и их счётчики должны считаться только по
  // выбранной сейчас группе (Выполнено / Отказ), а не по обеим сразу — иначе
  // цифра на кнопке источника не совпадает с тем, что реально показано в списке.
  const doneGroupStatuses = activeTab === "done"
    ? (DONE_GROUPS.find(g => g.key === doneSubFilter) ?? DONE_GROUPS[0]).statuses
    : null;
  const sourceScopePool = doneGroupStatuses
    ? clientsByStatusSubFilter.filter(c => doneGroupStatuses.includes(c.status ?? ""))
    : clientsByStatusSubFilter;

  // Источники (Авито/Квиз/Директ/...), реально встречающиеся среди текущих заявок
  const sourcesPresent = Array.from(new Set(
    sourceScopePool.map(c => c.source).filter((s): s is string => !!s)
  ));
  const clientsBySourceFilter = activeSourceFilter != null
    ? clientsByStatusSubFilter.filter(c => (c.source || null) === activeSourceFilter)
    : clientsByStatusSubFilter;

  // Метки (Недозвон/Перезвонить/...), реально встречающиеся среди текущих заявок
  const tagsPresent = Array.from(new Set(
    clientsBySourceFilter.flatMap(c => c.tags || []).filter((s): s is string => !!s)
  ));
  const clientsByTagFilter = activeTagFilter != null
    ? clientsBySourceFilter.filter(c => (c.tags || []).includes(activeTagFilter))
    : clientsBySourceFilter;

  // Ответственный и период — применяются последними, только на вкладках, где
  // показана соответствующая кнопка. Пул для счётчика на кнопке ответственного —
  // ДО применения самого фильтра по ответственному (иначе счётчики выбора схлопнутся
  // в один), а пул для периода — уже ПОСЛЕ фильтра по ответственному, чтобы цифры
  // на кнопке периода совпадали с тем, что реально покажется в списке.
  const assigneePool = clientsByTagFilter;
  const clientsByAssignee = showAssigneePeriodFilters
    ? applyAssigneeFilter(clientsByTagFilter, activeAssignee)
    : clientsByTagFilter;
  const periodPool = clientsByAssignee;
  const currentClients = showAssigneePeriodFilters
    ? applyPeriodFilter(clientsByAssignee, activePeriod, periodDateField)
    : clientsByAssignee;

  // Два визуально разделённых блока фильтров: «Этапы» (нейтральная палитра, акцент
  // фиолетовый у выбранного) и «Источники» (у каждого источника свой цвет).
  // Чипы с нулевым счётчиком не показываем (кроме выбранного — чтобы можно было снять фильтр).
  const stageChips = tabStatuses
    .map(s => ({ key: s, label: statusLabels[s] || STATUS_LABELS[s] || s, color: t.accent,
                 cnt: clientsByStatus.filter(c => c.status === s).length, isSel: activeStatusFilter === s,
                 onClick: () => setActiveStatusFilter(activeStatusFilter === s ? null : s) }))
    .filter(x => x.cnt > 0 || x.isSel);
  const subChips = mySubstatuses
    .map(s => ({ key: `sub-${s.id}`, label: s.label, color: s.color,
                 cnt: clientsByStatusAndFilter.filter(c => c.sub_status === String(s.id)).length,
                 isSel: activeSubFilter === String(s.id),
                 onClick: () => setActiveSubFilter(activeSubFilter === String(s.id) ? null : String(s.id)) }))
    .filter(x => x.cnt > 0 || x.isSel);
  const sourceChips = sourcesPresent
    .map(sourceName => {
      const src = orderSources.find(s => s.name === sourceName);
      return { key: `src-${sourceName}`, label: src?.name || sourceName, color: src?.color || "#64748b",
               cnt: sourceScopePool.filter(c => c.source === sourceName).length,
               isSel: activeSourceFilter === sourceName,
               onClick: () => setActiveSourceFilter(activeSourceFilter === sourceName ? null : sourceName) };
    })
    .filter(x => x.cnt > 0 || x.isSel);
  const tagChips = tagsPresent
    .map(tagName => {
      const def = DEFAULT_TAGS.find(d => d.label === tagName);
      return { key: `tag-${tagName}`, label: tagName, color: def?.color || "#8b5cf6",
               cnt: clientsBySourceFilter.filter(c => (c.tags || []).includes(tagName)).length,
               isSel: activeTagFilter === tagName,
               onClick: () => setActiveTagFilter(activeTagFilter === tagName ? null : tagName) };
    })
    .filter(x => x.cnt > 0 || x.isSel);

  const hasStageFilters  = stageChips.length > 0 || subChips.length > 0;
  const hasSourceFilters = sourceChips.length > 0;
  const hasTagFilters    = tagChips.length > 0;
  const renderFilterRow = () =>
    (hasStageFilters || hasSourceFilters || hasTagFilters || showAssigneePeriodFilters) && (
      <div className="flex items-start gap-3 flex-wrap mb-4">
        {/* Подгруппы вкладки «Другие сделки»: Сервис / Дубли. Идут первыми — они
            задают, что вообще показано в списке, остальные фильтры уточняют выборку. */}
        {activeTab === SERVICE_TAB_ID && (
          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
            <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Раздел</span>
            {OTHER_GROUPS.map(group => {
              const isSel = otherSubFilter === group.key;
              const cnt = group.key === "dupes"
                ? allClients.filter(c => isRepeat(c) && isStatusAllowed(c.status)).length
                : allClients.filter(c => c.is_service && !isRepeat(c)).length;
              return (
                <button key={group.key} onClick={() => setOtherSubFilter(group.key)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition"
                  style={{
                    background: isSel ? group.color : t.surface,
                    borderColor: isSel ? group.color : t.border,
                    color: isSel ? "#fff" : t.textSub,
                  }}>
                  <Icon name={group.icon} size={12} />
                  {group.label}
                  {/* У дублей счётчик — красный кружок: это то, что требует разбора */}
                  {group.key === "dupes" ? (
                    cnt > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black"
                        style={{ background: isSel ? "#fff" : "#ef4444", color: isSel ? "#ef4444" : "#fff" }}>
                        {cnt}
                      </span>
                    )
                  ) : (
                    <span className="font-bold">{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {showAssigneePeriodFilters && (
          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
            <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Фильтр</span>
            <OrdersAssigneeFilter pool={assigneePool} value={activeAssignee} onChange={setActiveAssignee} />
            <OrdersPeriodFilter pool={periodPool} dateField={periodDateField} value={activePeriod} onChange={setActivePeriod} />
          </div>
        )}
        {hasStageFilters && (
          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
            <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Этап</span>
            {[...subChips, ...stageChips].map(x => (
              <button key={x.key} onClick={x.onClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
                style={{
                  background: x.isSel ? x.color : t.surface,
                  borderColor: x.isSel ? x.color : t.border,
                  color: x.isSel ? "#fff" : t.textSub,
                }}>
                {x.label} <span className="font-bold">{x.cnt}</span>
              </button>
            ))}
          </div>
        )}
        {hasSourceFilters && (
          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
            <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Источник</span>
            {sourceChips.map(x => (
              <button key={x.key} onClick={x.onClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
                style={{
                  background: x.isSel ? x.color : t.surface,
                  borderColor: x.isSel ? x.color : t.border,
                  color: x.isSel ? "#fff" : t.textSub,
                }}>
                {x.label} <span className="font-bold">{x.cnt}</span>
              </button>
            ))}
          </div>
        )}
        {hasTagFilters && (
          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
            <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Метка</span>
            {tagChips.map(x => (
              <button key={x.key} onClick={x.onClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
                style={{
                  background: x.isSel ? x.color : t.surface,
                  borderColor: x.isSel ? x.color : t.border,
                  color: x.isSel ? "#fff" : t.textSub,
                }}>
                {x.label} <span className="font-bold">{x.cnt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );

  const filterSearch = (list: Client[]) => filterOrdersBySearch(list, search);

  // Свежие заявки — первыми (по дате создания).
  const sortByCreated = (list: Client[]) =>
    [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // На вкладке "Замеры" сортируем по дате замера, на "Монтажи" — по дате монтажа
  // (ближайшие по времени — первыми, заявки без даты — в конце), это осознанное
  // исключение, чтобы видеть ближайшие выезды сверху. Везде остальное — по дате
  // создания заявки, сначала свежие.
  const sortByDate = (list: Client[]) => {
    const field = activeTab === "measures" ? "measure_date" : activeTab === "installs" ? "install_date" : null;
    if (!field) return sortByCreated(list);
    return [...list].sort((a, b) => {
      const da = a[field] ? new Date(a[field] as string).getTime() : Infinity;
      const db = b[field] ? new Date(b[field] as string).getTime() : Infinity;
      return da - db;
    });
  };

  const renderCard = (c: Client) => (
    <OrdersClientCard key={c.id} c={c} allClients={allClients} onClick={() => onSelect(c)} onNextStep={onNextStep}
      onSaveSubStatus={onSaveSubStatus} onSaveVerified={onSaveVerified} onSaveConfirmed={onSaveConfirmed}
      onSwipeBuilder={onSwipeBuilder} onSwipeAgent={onSwipeAgent} />
  );
  const renderRow = (c: Client) => (
    <OrdersClientRow key={c.id} c={c} allClients={allClients} onClick={() => onSelect(c)} onNextStep={onNextStep}
      onSaveSubStatus={onSaveSubStatus} onSaveVerified={onSaveVerified} onSaveConfirmed={onSaveConfirmed}
      onSwipeBuilder={onSwipeBuilder} onSwipeAgent={onSwipeAgent} />
  );

  // Группы дублей (одна группа = один телефон) для панели объединения на вкладке
  // «Дубли». Считаем по показанным сейчас повторам, но в группу подтягиваем и
  // оригинал: объединять нужно вместе с ним, иначе главная заявка окажется вне выбора.
  const dupeGroups: Client[][] = (() => {
    if (activeTab !== SERVICE_TAB_ID || otherSubFilter !== "dupes") return [];
    const seen = new Set<string>();
    const groups: Client[][] = [];
    for (const c of sortByDate(filterSearch(currentClients))) {
      const ids = c.duplicate_ids ?? [];
      const key = ids.join(",");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const members = allClients.filter(x => ids.includes(x.id));
      if (members.length > 1) groups.push(members);
    }
    return groups;
  })();

  const renderMergePanel = () => activeTab === SERVICE_TAB_ID && otherSubFilter === "dupes"
    && (dupeGroups.length > 0 || notDupKeys.size > 0) && (
    <div className="mb-4 rounded-xl px-3 py-2.5" style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon name="Copy" size={13} style={{ color: "#ef4444" }} />
        <span className="text-xs font-bold" style={{ color: "#ef4444" }}>
          Групп дублей: {dupeGroups.length}
        </span>
        {dupeGroups.length > 0 && (
          <span className="text-[11px]" style={{ color: t.textMute }}>
            — нажмите на группу, чтобы сравнить поля и объединить
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {dupeGroups.map(group => (
          <button key={group.map(c => c.id).join("-")}
            onClick={() => setMergeGroup(group)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textSub }}>
            <Icon name="Merge" size={11} style={{ color: "#10b981" }} />
            №{group.map(c => c.id).join(", №")}
            <span className="text-[10px] font-bold" style={{ color: t.textMute }}>
              {group[0].client_name || group[0].phone || ""}
            </span>
          </button>
        ))}
      </div>

      {/* Группы, отмеченные как «не дубль» — видно, что было исключено, и можно вернуть */}
      {notDupKeys.size > 0 && (
        <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="CircleSlash" size={11} style={{ color: "#38bdf8" }} />
            <span className="text-[11px] font-bold" style={{ color: "#38bdf8" }}>
              Отмечено «не дубль»: {notDupKeys.size}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[...notDupKeys].map(key => (
              <button key={key} onClick={() => unmarkNotDuplicate(key)}
                title="Вернуть группу в список дублей"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition"
                style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textMute }}>
                №{key.split(",").join(", №")}
                <Icon name="RotateCcw" size={10} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {mergeGroup && (
        <MergeDuplicatesModal
          group={mergeGroup}
          onClose={() => setMergeGroup(null)}
          onMerged={() => { setMergeGroup(null); onMerged?.(); }}
          onNotDuplicate={markNotDuplicate}
        />
      )}
      <OrdersTabs
        allClients={allClients}
        activeTab={activeTab}
        onSelect={onSetActiveTab}
        tabLabels={tabLabels}
        tabColors={tabColors}
        hiddenTabs={hiddenTabs}
        customTabs={customTabs}
        onSaveLabel={onSaveLabel}
        onSaveColor={onSaveColor}
        onDeleteTab={onDeleteTab}
        onAddTab={onAddTab}
        substatuses={substatuses}
        onSubstatusesChange={onSubstatusesChange}
        statusLabels={statusLabels}
        statusColors={statusColors}
        onSaveStatusLabel={onSaveStatusLabel}
        onSaveStatusColor={onSaveStatusColor}
        notDupKeys={notDupKeys}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "installs" ? (
        <div>
          {renderFilterRow()}
          {viewMode === "list" ? (
            <div className="space-y-2">
              {sortByDate(filterSearch(currentClients)).map(renderRow)}
              {currentClients.length === 0 && <div className="py-12 text-sm text-center" style={{ color: t.textMute }}>Нет активных монтажей</div>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {sortByDate(filterSearch(currentClients)).map(renderCard)}
              {currentClients.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                  <Icon name="Wrench" size={28} className="mb-2 opacity-30" />
                  <span className="text-sm">Нет активных монтажей</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === "done" ? (
        <div>
          {/* Переключатель Выполнено/Отказ + источники — в одном ряду, как на других вкладках */}
          <div className="flex items-start gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
              <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Фильтр</span>
              <OrdersAssigneeFilter pool={assigneePool} value={activeAssignee} onChange={setActiveAssignee} />
              <OrdersPeriodFilter pool={periodPool} dateField={periodDateField} value={activePeriod} onChange={setActivePeriod} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
              <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Этап</span>
              {DONE_GROUPS.filter(group => group.statuses.some(isStatusAllowed)).map(group => {
                const isSel = doneSubFilter === group.key;
                const cnt = currentClients.filter(c => group.statuses.includes(c.status ?? "")).length;
                return (
                  <button key={group.key} onClick={() => setDoneSubFilter(group.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition"
                    style={{
                      background: isSel ? group.color : t.surface,
                      borderColor: isSel ? group.color : t.border,
                      color: isSel ? "#fff" : t.textSub,
                    }}>
                    <Icon name={group.icon} size={12} />
                    {group.label} <span className="font-bold">{cnt}</span>
                  </button>
                );
              })}
            </div>
            {sourceChips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
                <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Источник</span>
                {sourceChips.map(x => (
                  <button key={x.key} onClick={x.onClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
                    style={{
                      background: x.isSel ? x.color : t.surface,
                      borderColor: x.isSel ? x.color : t.border,
                      color: x.isSel ? "#fff" : t.textSub,
                    }}>
                    {x.label} <span className="font-bold">{x.cnt}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Фильтр «Проверено» — только в группе «Выполнено» (для «Отказ» не имеет смысла) */}
            {doneSubFilter === "done" && (() => {
              const donePool = currentClients.filter(c => c.status === "done");
              const verifiedCnt = donePool.filter(c => c.is_verified).length;
              const unverifiedCnt = donePool.length - verifiedCnt;
              const verifiedChips: { key: string; label: string; cnt: number; isSel: boolean; color: string; onClick: () => void }[] = [
                { key: "all",        label: "Все",           cnt: donePool.length, isSel: activeVerifiedFilter === null,           color: "#64748b", onClick: () => setActiveVerifiedFilter(null) },
                { key: "verified",   label: "Проверено",     cnt: verifiedCnt,     isSel: activeVerifiedFilter === "verified",     color: "#10b981", onClick: () => setActiveVerifiedFilter(activeVerifiedFilter === "verified" ? null : "verified") },
                { key: "unverified", label: "Не проверено",  cnt: unverifiedCnt,   isSel: activeVerifiedFilter === "unverified",   color: "#f59e0b", onClick: () => setActiveVerifiedFilter(activeVerifiedFilter === "unverified" ? null : "unverified") },
              ];
              return (
                <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
                  <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Проверка</span>
                  {verifiedChips.map(x => (
                    <button key={x.key} onClick={x.onClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
                      style={{
                        background: x.isSel ? x.color : t.surface,
                        borderColor: x.isSel ? x.color : t.border,
                        color: x.isSel ? "#fff" : t.textSub,
                      }}>
                      {x.label} <span className="font-bold">{x.cnt}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            {/* Фильтр «Подтверждено» — второй тумблер рядом с «Проверено», та же логика */}
            {doneSubFilter === "done" && (() => {
              const donePool = currentClients.filter(c => c.status === "done");
              const confirmedCnt = donePool.filter(c => c.is_confirmed).length;
              const unconfirmedCnt = donePool.length - confirmedCnt;
              const confirmedChips: { key: string; label: string; cnt: number; isSel: boolean; color: string; onClick: () => void }[] = [
                { key: "all",          label: "Все",              cnt: donePool.length, isSel: activeConfirmedFilter === null,           color: "#64748b", onClick: () => setActiveConfirmedFilter(null) },
                { key: "confirmed",    label: "Подтверждено",     cnt: confirmedCnt,    isSel: activeConfirmedFilter === "confirmed",     color: "#06b6d4", onClick: () => setActiveConfirmedFilter(activeConfirmedFilter === "confirmed" ? null : "confirmed") },
                { key: "unconfirmed",  label: "Не подтверждено",  cnt: unconfirmedCnt,  isSel: activeConfirmedFilter === "unconfirmed",   color: "#f59e0b", onClick: () => setActiveConfirmedFilter(activeConfirmedFilter === "unconfirmed" ? null : "unconfirmed") },
              ];
              return (
                <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-xl" style={{ background: t.surface2 + "80" }}>
                  <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: t.textMute }}>Подтверждение</span>
                  {confirmedChips.map(x => (
                    <button key={x.key} onClick={x.onClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
                      style={{
                        background: x.isSel ? x.color : t.surface,
                        borderColor: x.isSel ? x.color : t.border,
                        color: x.isSel ? "#fff" : t.textSub,
                      }}>
                      {x.label} <span className="font-bold">{x.cnt}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {(() => {
            const group = DONE_GROUPS.find(g => g.key === doneSubFilter) ?? DONE_GROUPS[0];
            const groupClients = currentClients.filter(c => group.statuses.includes(c.status ?? ""));
            const verifiedFiltered = doneSubFilter === "done" && activeVerifiedFilter != null
              ? groupClients.filter(c => activeVerifiedFilter === "verified" ? !!c.is_verified : !c.is_verified)
              : groupClients;
            const confirmedFiltered = doneSubFilter === "done" && activeConfirmedFilter != null
              ? verifiedFiltered.filter(c => activeConfirmedFilter === "confirmed" ? !!c.is_confirmed : !c.is_confirmed)
              : verifiedFiltered;
            const items = sortByCreated(filterSearch(confirmedFiltered));
            return viewMode === "list" ? (
              <div className="space-y-2">
                {items.length === 0
                  ? <div className="py-12 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                  : items.map(renderRow)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {items.length === 0
                  ? <div className="col-span-3 py-12 text-sm text-center" style={{ color: t.textMute }}>Нет записей</div>
                  : items.map(renderCard)}
              </div>
            );
          })()}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {renderFilterRow()}
          {renderMergePanel()}
          <div className="space-y-2">
            {sortByDate(filterSearch(currentClients)).map(renderRow)}
            {currentClients.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
                <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {renderFilterRow()}
          {renderMergePanel()}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {sortByDate(filterSearch(currentClients)).map(renderCard)}
            {currentClients.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-12" style={{ color: t.textMute }}>
                <Icon name={currentTab?.icon || "Inbox"} size={28} className="mb-2 opacity-30" />
                <span className="text-sm">{currentTab?.emptyText || "Нет данных"}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
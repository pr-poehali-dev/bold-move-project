import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, allowedTabsOf, allowedStatusesOf } from "@/context/AuthContext";
import { useTheme } from "./themeContext";
import { ORDERS_TABS, ALL_TAB_ID, SERVICE_TAB_ID, isDuplicateRepeat } from "./ordersTypes";
import { groupKeyOf } from "./mergeFields";
import type { Client } from "./crmApi";
import { TabDef, Props } from "./ordersTabsShared";
import { TabSettingsPopup } from "./OrdersTabSettingsPopup";
import { ChannelsSelfTestButton } from "./ChannelsSelfTestButton";

// Реэкспорт для обратной совместимости с существующими импортами из "./OrdersTabs"
export type { Substatus } from "./ordersTabsShared";
export { useSubstatuses } from "./useSubstatuses";

export function OrdersTabs({
  allClients, activeTab, onSelect,
  tabLabels, tabColors, hiddenTabs, customTabs,
  onSaveLabel, onSaveColor, onDeleteTab, onAddTab,
  statusLabels, statusColors, onSaveStatusLabel, onSaveStatusColor,
  substatuses, onSubstatusesChange,
  notDupKeys,
}: Props) {
  const t = useTheme();
  const { user } = useAuth();
  const [openPopup, setOpenPopup] = useState<string | null>(null);

  // Видимость СТАНДАРТНОЙ вкладки — НЕЗАВИСИМЫЙ уровень прав (allowed_tabs), не связан
  // с тем, какие статусы/подэтапы внутри разрешены (см. PermissionsEditor.tsx). Владелец
  // может скрыть вкладку целиком, даже если статусы внутри разрешены, и наоборот —
  // показать пустую вкладку без единого доступного статуса.
  const allowedTabs = allowedTabsOf(user);
  const isTabAllowed = (tabId: string) => !allowedTabs || allowedTabs.includes(tabId);

  // Кастомные вкладки (созданные владельцем вручную) не настраиваются в PermissionsEditor
  // (там только 5 стандартных), поэтому для них видимость по-прежнему определяется
  // разрешёнными статусами внутри — иначе такую вкладку нельзя было бы открыть вообще.
  const allowedStatusesForCustom = allowedStatusesOf(user);
  const isCustomTabAllowed = (statuses: readonly string[]) =>
    !allowedStatusesForCustom || statuses.length === 0 || statuses.some(s => allowedStatusesForCustom.includes(s));

  const defaultTabs: TabDef[] = ORDERS_TABS
    .filter(tab => !hiddenTabs.has(tab.id) && isTabAllowed(tab.id))
    .map(tab => ({
      id: tab.id,
      label: tabLabels[tab.id] || tab.label,
      icon: tab.icon,
      color: tabColors[tab.id] || tab.color,
      statuses: tab.statuses,
      emptyText: tab.emptyText,
    }));

  const customTabsMapped: TabDef[] = customTabs
    .filter(tab => isCustomTabAllowed(Array.isArray(tab.statuses) ? tab.statuses : []))
    .map(tab => ({
      id: tab.id,
      label: tabLabels[tab.id] || tab.label,
      icon: tab.icon ?? "Layers",
      color: tabColors[tab.id] || tab.color,
      statuses: Array.isArray(tab.statuses) ? tab.statuses : [],
      emptyText: tab.emptyText ?? "Нет данных",
    }));

  const allTabs = [...defaultTabs, ...customTabsMapped];

  // Таб "Финальный" (done) объединяет и выполненные, и отказники для списка,
  // но счётчик/сумма на самой кнопке должны отражать только реально выполненные заказы.
  const statusesForStats = (tab: TabDef) => tab.id === "done" ? ["done"] : tab.statuses;

  // Вкладка «Другие сделки» считается по признакам заявки (сервис + дубли), а не по
  // статусу. Из остальных вкладок и сервисные, и повторные заявки исключаем — иначе
  // они задвоятся в счётчиках и подмешают свои суммы к монтажам.
  // Группа, помеченная как «не дубль» (клиент реально заказал несколько раз),
  // повтором не считается — иначе счётчик здесь расходился бы с реальным списком
  // на вкладке «Дубли», где эта пометка уже учтена.
  const isRepeat = (c: Client) =>
    isDuplicateRepeat(c) && !(notDupKeys?.has(groupKeyOf(c.duplicate_ids ?? [])) ?? false);
  const clientsForTab = (tab: TabDef) =>
    tab.id === SERVICE_TAB_ID
      ? allClients.filter(c => (c.is_service && !isRepeat(c)) || isRepeat(c))
      : allClients.filter(c => !c.is_service && !isRepeat(c) && statusesForStats(tab).includes(c.status));

  const getRevenue = (tab: TabDef) =>
    clientsForTab(tab).reduce((s, c) => s + (Number(c.contract_sum) || 0), 0);

  const getCount = (tab: TabDef) => clientsForTab(tab).length;

  // Сколько заявок-повторов ждёт разбора — красный кружок на вкладке «Другие сделки»
  const getDupesCount = () => allClients.filter(isRepeat).length;

  const gearRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  const openTab = (tabId: string) => {
    const btn = gearRefs.current[tabId];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popupW = 260; // примерная ширина попапа (minWidth: 240)
    const screenW = window.innerWidth;
    // Если не влезает справа — открываем вправо-выровненным (right edge = rect.right)
    const left = rect.left + popupW > screenW - 8
      ? Math.max(8, rect.right - popupW)
      : rect.left;
    setPopupPos({ top: rect.bottom + 6, left });
    setOpenPopup(tabId);
  };

  const isAllActive = activeTab === ALL_TAB_ID;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {/* Таб "Все" — узкая полоска с вертикальным текстом, показывает все заявки без фильтра */}
        <button
          onClick={() => onSelect(ALL_TAB_ID)}
          title="Все заявки"
          className="flex-shrink-0 flex items-center justify-center rounded-xl transition px-1.5 py-2.5"
          style={{
            width: 28,
            background: isAllActive ? "#64748b15" : t.surface,
            border: `1px solid ${isAllActive ? "#64748b45" : t.border}`,
          }}>
          <span
            className="text-[10px] font-bold tracking-wider"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              color: isAllActive ? "#94a3b8" : t.textMute,
            }}>
            ВСЕ
          </span>
        </button>

        {allTabs.map(tab => {
          const count    = getCount(tab);
          const revenue  = getRevenue(tab);
          const dupesCount = getDupesCount();
          const isActive = activeTab === tab.id;
          const isOpen   = openPopup === tab.id;

          return (
            <div key={tab.id} className="relative group/tab flex-shrink-0" style={{ minWidth: 130 }}>
              <button
                onClick={() => onSelect(tab.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition"
                style={{
                  background: isActive ? tab.color + "15" : t.surface,
                  border: `1px solid ${isActive ? tab.color + "45" : t.border}`,
                }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: tab.color + "20" }}>
                  <Icon name={tab.icon} size={13} style={{ color: tab.color }} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate" style={{ color: isActive ? tab.color : t.text }}>{tab.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: tab.color + "20", color: tab.color }}>{count}</span>
                    {/* Красный кружок с числом дублей — заявки, которые ждут разбора */}
                    {tab.id === SERVICE_TAB_ID && dupesCount > 0 && (
                      <span title={`Дублей: ${dupesCount}`}
                        className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex-shrink-0"
                        style={{ background: "#ef4444", color: "#fff" }}>
                        {dupesCount}
                      </span>
                    )}
                  </div>
                  {revenue > 0 && (
                    <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: isActive ? tab.color : t.textSub }}>
                      {revenue.toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                </div>
              </button>

              {/* Шестерёнка */}
              <button
                ref={(el: HTMLButtonElement | null) => { gearRefs.current[tab.id] = el; }}
                onClick={e => { e.stopPropagation(); if (isOpen) { setOpenPopup(null); } else { openTab(tab.id); } }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover/tab:opacity-100 transition"
                style={{ color: t.textMute }}
                onMouseEnter={e => (e.currentTarget.style.background = t.surface2)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <Icon name="Settings2" size={11} />
              </button>

              {/* Попап */}
              {isOpen && popupPos && (
                <TabSettingsPopup
                  tab={tab}
                  tabLabels={tabLabels}
                  tabColors={tabColors}
                  onSaveLabel={onSaveLabel}
                  onSaveColor={onSaveColor}
                  popupPos={popupPos}
                  onDelete={() => { onDeleteTab(tab.id); setOpenPopup(null); if (activeTab === tab.id) onSelect(allTabs[0]?.id || "leads"); }}
                  onClose={() => setOpenPopup(null)}
                  statusLabels={statusLabels}
                  statusColors={statusColors}
                  onSaveStatusLabel={onSaveStatusLabel}
                  onSaveStatusColor={onSaveStatusColor}
                  substatuses={substatuses}
                  onSubstatusesChange={onSubstatusesChange}
                />
              )}
            </div>
          );
        })}

        {/* Кнопка добавить таб — скрыта у сотрудников с ограничением по вкладкам:
            настройка воронки это дело владельца, а не ограниченного сотрудника */}
        {!allowedTabs && (
          <button onClick={onAddTab}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition flex-shrink-0 hover:bg-violet-500/10"
            style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#a78bfa" }}>
            <Icon name="Plus" size={13} />
          </button>
        )}

        {/* Живая проверка каналов — доступна всем сотрудникам, не только владельцу
            в настройках интеграций. Прижата вправо через ml-auto. */}
        <div className="ml-auto flex-shrink-0">
          <ChannelsSelfTestButton />
        </div>
      </div>
    </div>
  );
}
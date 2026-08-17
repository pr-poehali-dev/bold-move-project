import { useState, useRef, useEffect } from "react";
import func2url from "@/../backend/func2url.json";
import { Client, STATUS_LABELS, crmFetch } from "./crmApi";
import { useTheme } from "./themeContext";
import { Section } from "./drawerComponents";
import { Switch } from "@/components/ui/switch";
import { StatusSelector } from "./StatusSelector";
import { DrawerPLBlock } from "./DrawerPLBlock";
import { DrawerDiscountBlock } from "./DrawerDiscountBlock";
import { ActivityFeed, ActivityEvent } from "./ActivityFeed";
import { useAuth } from "@/context/AuthContext";
import { useDiscountHistory } from "@/hooks/useDiscountHistory";
import { useCustomFinValues } from "@/hooks/useCustomFinValues";
import { AddBlockModal } from "./DrawerBlockEditor";
import { DrawerColumns } from "./DrawerColumns";
import { DrawerFooterInfo } from "./DrawerInfoBlocks";
import {
  BlockId, BlockDef, CustomBlockData, CustomFinRow,
  DEFAULT_BLOCKS, LS_BLOCKS, LS_HIDDEN,
  loadBlocks, loadHidden, loadCustomBlocks, saveCustomBlocks,
  loadRowVisibility, saveRowVisibility,
  loadCustomFinRows, saveCustomFinRows,
} from "./drawerTypes";

const AUTH_URL_DIT = (func2url as Record<string, string>)["auth"];

interface Props {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  hideHidden?: boolean;
  canEdit?:          boolean;
  canOrdersEdit?:    boolean;
  canFinance?:       boolean;
  canFiles?:         boolean;
  canFieldContacts?: boolean;
  canFieldAddress?:  boolean;
  canFieldDates?:    boolean;
  canFieldFinance?:  boolean;
  canFieldFiles?:    boolean;
  canFieldCancel?:   boolean;
  onReload?: () => void;
  /** Перейти на вкладку «Касания» и поставить курсор в поле ввода (иконка «написать» у телефона) */
  onGoToTouches?: () => void;
}

export default function DrawerInfoTab({ data, client, setData, save, hideHidden, canEdit = true, canOrdersEdit = true, canFinance = true, canFiles = true, canFieldContacts = true, canFieldAddress = true, canFieldDates = true, canFieldFinance = true, canFieldFiles = true, canFieldCancel = true, onReload, onGoToTouches }: Props) {
  const t = useTheme();
  const { user } = useAuth();

  // ── state ────────────────────────────────────────────────────────────────────
  const [blocks, setBlocks]               = useState<BlockDef[]>(loadBlocks);
  const [hiddenBlocks, setHiddenBlocks]   = useState<Set<BlockId>>(loadHidden);
  const [editingBlock, setEditingBlock]   = useState<BlockId | null>(null);
  const [activityLog, setActivityLog]     = useState<ActivityEvent[]>([]);
  const [activityReload, setActivityReload] = useState(0);
  const [customBlocks, setCustomBlocks]   = useState<CustomBlockData[]>(loadCustomBlocks);
  const [showAddBlock, setShowAddBlock]   = useState<0 | 1 | "wide" | null>(null);
  const [rowVisibility, setRowVisibility] = useState<Record<string, boolean>>(loadRowVisibility);
  const [customFinRows, setCustomFinRows] = useState<CustomFinRow[]>(loadCustomFinRows);

  // Настройки Доходов/Затрат — общие на компанию (БД), localStorage — быстрый локальный кэш.
  // При первом заходе после обновления: если в БД пусто, а локально что-то настроено —
  // переносим локальное в БД один раз, чтобы ничего не потерять.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await crmFetch("fin-settings") as { row_visibility?: Record<string, boolean>; custom_fin_rows?: CustomFinRow[] };
        if (!alive) return;
        const dbVis  = d?.row_visibility;
        const dbRows = d?.custom_fin_rows;
        const dbEmpty = (!dbVis || Object.keys(dbVis).length === 0) && (!dbRows || dbRows.length === 0);
        if (dbEmpty) {
          // Ничего в БД — переносим то, что уже есть локально (первый заход после обновления)
          const localVis  = loadRowVisibility();
          const localRows = loadCustomFinRows();
          setRowVisibility(localVis);
          setCustomFinRows(localRows);
          crmFetch("fin-settings", { method: "POST", body: JSON.stringify({ row_visibility: localVis, custom_fin_rows: localRows }) }).catch(() => {});
        } else {
          const mergedVis = { ...loadRowVisibility(), ...(dbVis || {}) };
          setRowVisibility(mergedVis);
          setCustomFinRows(dbRows || []);
          saveRowVisibility(mergedVis);
          saveCustomFinRows(dbRows || []);
        }
      } catch { /* нет сети — работаем на localStorage, ничего не ломаем */ }
    })();
    return () => { alive = false; };
  }, []);

  // Единый источник истории скидок — шарится между P&L и блоком скидки
  const discountHistoryHook = useDiscountHistory(data.id);

  // Единый источник кастомных статей затрат (Технолог, Логистика и т.п.) — шарится
  // между блоком "Затраты" и блоком "P&L", чтобы новая трата сразу была видна в P&L
  // без переоткрытия карточки (раньше у каждого блока была своя отдельная загрузка).
  const customFinValuesHook = useCustomFinValues(data.id);

  // Согласованный тир сметы (для блокировки скидок при Econom)
  const [chosenTier, setChosenTier] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${AUTH_URL_DIT}?action=estimate-by-chat&chat_id=${data.id}`)
      .then(r => r.json())
      .then(d => { if (d.estimate?.chosen_tier) setChosenTier(d.estimate.chosen_tier); })
      .catch(() => {});
  }, [data.id]);

  // Синхронизация видимости строк в БД (общая настройка компании) + localStorage-кэш
  const syncRowVisibility = (next: Record<string, boolean>) => {
    saveRowVisibility(next);
    crmFetch("fin-settings", { method: "POST", body: JSON.stringify({ row_visibility: next }) }).catch(() => {});
  };
  const syncCustomFinRows = (next: CustomFinRow[]) => {
    saveCustomFinRows(next);
    crmFetch("fin-settings", { method: "POST", body: JSON.stringify({ custom_fin_rows: next }) }).catch(() => {});
  };

  const toggleRowVisibility = (key: string) => {
    setRowVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      syncRowVisibility(next);
      return next;
    });
  };

  const addCustomFinRow = (label: string, block: "income" | "costs") => {
    const key = `custom_row_${Date.now()}`;
    const newRow: CustomFinRow = { key, label, block };
    const updated = [...customFinRows, newRow];
    setCustomFinRows(updated);
    syncCustomFinRows(updated);
    setRowVisibility(prev => {
      const next = { ...prev, [key]: true };
      syncRowVisibility(next);
      return next;
    });
  };

  const deleteCustomFinRow = (key: string) => {
    const updated = customFinRows.filter(r => r.key !== key);
    setCustomFinRows(updated);
    syncCustomFinRows(updated);
  };

  const updateCustomFinRow = (key: string, label: string) => {
    const updated = customFinRows.map(r => r.key === key ? { ...r, label } : r);
    setCustomFinRows(updated);
    syncCustomFinRows(updated);
  };
  const [customRowVals, setCustomRowVals] = useState<Record<string, Record<number, string>>>(() => {
    try { return JSON.parse(localStorage.getItem(`custom_block_vals_${data.id}`) || "{}"); } catch { return {}; }
  });
  const dragId = useRef<BlockId | null>(null);

  // (финансовые расчёты перенесены в DrawerPLBlock)

  // ── логирование ──────────────────────────────────────────────────────────────
  const now = () => new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // Пишем действие в общий журнал БД (виден всем сотрудникам, автор проставляется
  // на сервере). Оптимистично показываем событие сразу, автор — текущий пользователь.
  const logAction = (icon: string, color: string, text: string) => {
    const event: ActivityEvent = { icon, color, text, date: now(), author: user?.name || undefined };
    setActivityLog(prev => [...prev, event]);
    crmFetch("activity-log", {
      method: "POST",
      body: JSON.stringify({ client_id: data.id, icon, color, text }),
    }).then(() => setActivityReload(k => k + 1)).catch(() => {});
  };

  const saveWithLog = (patch: Partial<Client>, logText: string, icon = "Edit3", color = "#8b5cf6") => {
    save(patch);
    logAction(icon, color, logText);
  };

  // ── видимость блоков ─────────────────────────────────────────────────────────
  const toggleHidden = (id: BlockId) => {
    setHiddenBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(LS_HIDDEN, JSON.stringify([...next]));
      return next;
    });
  };

  // ── кастомные блоки ──────────────────────────────────────────────────────────
  const addCustomBlock = (block: CustomBlockData, target: 0 | 1 | "wide") => {
    const isWide = target === "wide" || block.wide;
    const col: 0 | 1 = target === "wide" ? 0 : target;
    const updated = [...customBlocks, { ...block, wide: isWide }];
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
    const newBlocks = [...blocks, { id: block.id, col, order: 999, wide: isWide }];
    setBlocks(newBlocks);
    localStorage.setItem(LS_BLOCKS, JSON.stringify(newBlocks));
    logAction("Plus", "#8b5cf6", `Блок создан: ${block.title}`);
    setShowAddBlock(null);
  };

  const deleteCustomBlock = (id: string) => {
    const updated = customBlocks.filter(b => b.id !== id);
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    localStorage.setItem(LS_BLOCKS, JSON.stringify(newBlocks));
  };

  const updateCustomBlock = (id: string, updatedBlock: CustomBlockData) => {
    const updated = customBlocks.map(b => b.id === id ? updatedBlock : b);
    setCustomBlocks(updated);
    saveCustomBlocks(updated);
  };

  // ── drag & drop (в т.ч. на пустое место — drop zone внизу колонки) ──────────
  const onDragStart = (id: BlockId) => { dragId.current = id; };
  const onDragOver  = (_e: React.DragEvent, _id: BlockId) => {};

  const onDrop = (targetId: BlockId) => {
    const from = dragId.current; dragId.current = null;
    if (!from || from === targetId) return;
    setBlocks(prev => {
      const toBlock = prev.find(b => b.id === targetId)!;
      const updated = prev.map(b => b.id === from ? { ...b, col: toBlock.col, order: toBlock.order - 0.5 } : b);
      const result: BlockDef[] = [];
      for (const col of [0, 1] as const) {
        updated.filter(b => b.col === col).sort((a, b) => a.order - b.order).forEach((b, i) => result.push({ ...b, order: i }));
      }
      localStorage.setItem(LS_BLOCKS, JSON.stringify(result));
      return result;
    });
  };

  // Drop на пустую зону внизу колонки
  const onDropToCol = (col: 0 | 1) => {
    const from = dragId.current; dragId.current = null;
    if (!from) return;
    setBlocks(prev => {
      const colBlocks = prev.filter(b => b.col === col).sort((a, b) => a.order - b.order);
      const maxOrder = colBlocks.length > 0 ? colBlocks[colBlocks.length - 1].order + 1 : 0;
      const updated = prev.map(b => b.id === from ? { ...b, col, order: maxOrder } : b);
      const result: BlockDef[] = [];
      for (const c of [0, 1] as const) {
        updated.filter(b => b.col === c).sort((a, b) => a.order - b.order).forEach((b, i) => result.push({ ...b, order: i }));
      }
      localStorage.setItem(LS_BLOCKS, JSON.stringify(result));
      return result;
    });
  };

  const handleReset = () => {
    setBlocks(DEFAULT_BLOCKS);
    setHiddenBlocks(new Set());
    localStorage.removeItem(LS_BLOCKS);
    localStorage.removeItem(LS_HIDDEN);
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="px-3 sm:px-6 py-4 space-y-3">

      {/* Статус воронки — на всю ширину */}
      {(!hideHidden || !hiddenBlocks.has("status")) && (
        <Section icon="GitBranch" title="Статус воронки" color="#8b5cf6"
          onToggleHidden={canEdit ? () => toggleHidden("status") : undefined}
          hidden={hiddenBlocks.has("status")}
          headerExtra={
            data.status === "done" ? (
              /* На этапе «Выполнено» вместо «Сервис» — отметка «Проверено» (качество
                 и оплата сверены). «Сервис» тут не имеет смысла: заявка уже завершена. */
              <label className="flex items-center gap-2 cursor-pointer select-none"
                title="Заявка проверена — качество и оплата сверены"
                style={{ opacity: canOrdersEdit ? 1 : 0.5 }}>
                <span className="text-[11px] font-semibold" style={{ color: data.is_verified ? "#10b981" : t.textMute }}>
                  Проверено
                </span>
                <Switch
                  checked={!!data.is_verified}
                  disabled={!canOrdersEdit}
                  onCheckedChange={v => saveWithLog(
                    { is_verified: v },
                    v ? "Заявка отмечена как проверенная" : "Снята отметка «Проверено»",
                    "CheckCheck", "#10b981",
                  )}
                  className="h-5 w-9 data-[state=unchecked]:bg-white/10 data-[state=checked]:bg-emerald-500"
                />
              </label>
            ) : (
              /* Тип заявки: обычный объект или сервис (доделка/переделка).
                 Сервисные заявки уходят в отдельную вкладку «Сервис» и не мешаются в «Монтажах». */
              <label className="flex items-center gap-2 cursor-pointer select-none"
                title="Сервис — мелкая доделка или переделка по уже сданному объекту, а не новый монтаж"
                style={{ opacity: canOrdersEdit ? 1 : 0.5 }}>
                <span className="text-[11px] font-semibold" style={{ color: data.is_service ? "#14b8a6" : t.textMute }}>
                  Сервис
                </span>
                <Switch
                  checked={!!data.is_service}
                  disabled={!canOrdersEdit}
                  onCheckedChange={v => saveWithLog(
                    { is_service: v },
                    v ? "Отмечено как сервис" : "Снята отметка «Сервис»",
                    "Hammer", "#14b8a6",
                  )}
                  className="h-5 w-9 data-[state=unchecked]:bg-white/10 data-[state=checked]:bg-teal-500"
                />
              </label>
            )
          }>
          <StatusSelector
            status={data.status}
            subStatus={data.sub_status ?? null}
            readOnly={!canOrdersEdit}
            onSave={s => {
              saveWithLog({ status: s }, `Статус → ${STATUS_LABELS[s] || s}`, "GitBranch", "#8b5cf6");
            }}
            onSaveSubStatus={v => save({ sub_status: v })}
          />
        </Section>
      )}

      {/* P&L — на всю ширину под воронкой (только с правом finance) */}
      {canFinance && (!hideHidden || !hiddenBlocks.has("pl")) && (
        <DrawerPLBlock
          data={data}
          isHidden={hiddenBlocks.has("pl")}
          toggleHidden={toggleHidden}
          customFinRows={customFinRows}
          discountHistoryHook={discountHistoryHook}
          customFinValuesHook={customFinValuesHook}
          save={save}
          onReload={onReload}
        />
      )}

      {/* Оценка риска скидки — только если есть финансовые данные */}
      {canFinance && !hiddenBlocks.has("pl") && (
        <DrawerDiscountBlock
          data={data}
          customFinRows={customFinRows}
          discountHistoryHook={discountHistoryHook}
          chosenTier={chosenTier}
          onContractSumUpdated={(newSum, discountPct) => {
            save({ contract_sum: newSum, discount_pct: discountPct ?? undefined });
            onReload?.();
          }}
        />
      )}

      {/* Основной контент — всегда на всю ширину */}
      <DrawerColumns
        data={data}
        client={client}
        setData={setData}
        save={save}
        blocks={blocks}
        hiddenBlocks={hiddenBlocks}
        hideHidden={hideHidden}
        editingBlock={editingBlock}
        customBlocks={customBlocks}
        customRowVals={customRowVals}
        toggleHidden={toggleHidden}
        setEditingBlock={setEditingBlock}
        saveWithLog={saveWithLog}
        logAction={logAction}
        setCustomRowVals={setCustomRowVals}
        deleteCustomBlock={deleteCustomBlock}
        updateCustomBlock={updateCustomBlock}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDropToCol={onDropToCol}
        onAddBlock={(col) => setShowAddBlock(col)}
        onReset={handleReset}
        rowVisibility={rowVisibility}
        toggleRowVisibility={toggleRowVisibility}
        customFinRows={customFinRows}
        addCustomFinRow={addCustomFinRow}
        deleteCustomFinRow={deleteCustomFinRow}
        updateCustomFinRow={updateCustomFinRow}
        canFinance={canFinance}
        canFiles={canFiles}
        canFieldContacts={canFieldContacts}
        canFieldAddress={canFieldAddress}
        canFieldDates={canFieldDates}
        canFieldFinance={canFieldFinance}
        canFieldFiles={canFieldFiles}
        canFieldCancel={canFieldCancel}
        onReload={onReload}
        onGoToTouches={onGoToTouches}
        customFinValuesHook={customFinValuesHook}
      />

      {/* Кнопка добавить блок — только на мобиле, над активностью */}
      <div
        className="md:hidden rounded-xl flex items-center justify-center cursor-pointer transition-all"
        style={{
          minHeight: 44,
          border: "2px dashed #ffffff18",
          background: "transparent",
        }}
        onClick={() => setShowAddBlock(0)}
      >
        <span className="text-[11px]" style={{ color: "#ffffff30" }}>+ Добавить блок</span>
      </div>

      {/* Активность — под блоками, всегда видна. Полностью автоматическая лента,
          ручной ввод комментариев убран (см. ActivityFeed.tsx) */}
      <ActivityFeed
        client={data}
        extraEvents={activityLog}
        reloadKey={activityReload}
      />

      {/* Модалка добавления блока */}
      {showAddBlock !== null && (
        <AddBlockModal
          onSave={block => addCustomBlock(block, showAddBlock)}
          onClose={() => setShowAddBlock(null)}
        />
      )}

      {/* Подвал — техническая строка «Создано через», вынесена из блока «Контакты» */}
      <DrawerFooterInfo createdVia={data.created_via} createdAt={data.created_at} source={data.source} />
    </div>
  );
}
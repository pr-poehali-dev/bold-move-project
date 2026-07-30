import { useState, useEffect } from "react";
import { crmFetch } from "./crmApi";
import { ORDERS_TABS } from "./ordersTypes";
import {
  loadSyncedCustomCols, loadSyncedHidden, loadSyncedLabels, loadSyncedColors,
  saveSyncedLabels, saveSyncedColors,
  addSyncedCol, deleteSyncedCol, SyncedCol,
} from "./syncedCols";

// Управление вкладками/колонками воронки (labels, colors, hidden, custom tabs)
// + персонализация названий/цветов реальных этапов (status), хранится в БД.
export function useOrdersTabsConfig() {
  const [tabLabels,  setTabLabels]  = useState<Record<string, string>>(loadSyncedLabels);
  const [tabColors,  setTabColors]  = useState<Record<string, string>>(loadSyncedColors);
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(loadSyncedHidden);
  const [customTabs, setCustomTabs] = useState<SyncedCol[]>(loadSyncedCustomCols);

  const handleSaveLabel = (id: string, val: string) => {
    setTabLabels(prev => { const next = { ...prev, [id]: val }; saveSyncedLabels(next); return next; });
  };
  const handleSaveColor = (id: string, color: string) => {
    setTabColors(prev => { const next = { ...prev, [id]: color }; saveSyncedColors(next); return next; });
  };
  const handleDeleteTab = (id: string) => {
    const isBuiltin = ORDERS_TABS.some(t => t.id === id);
    const msg = isBuiltin
      ? `Скрыть этап «${tabLabels[id] || id}»? Он исчезнет из воронки и из канбан-доски.`
      : `Удалить этап «${tabLabels[id] || id}»? Он удалится из воронки и из канбан-доски.`;
    if (!window.confirm(msg)) return;
    deleteSyncedCol(id, isBuiltin);
    if (isBuiltin) {
      setHiddenTabs(prev => { const next = new Set(prev); next.add(id); return next; });
    } else {
      setCustomTabs(prev => prev.filter(c => c.id !== id));
    }
  };
  const handleAddTab = () => {
    const col = addSyncedCol("Новый этап", "#8b5cf6", "Layers");
    setCustomTabs(prev => [...prev, col]);
  };

  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [statusColors, setStatusColors] = useState<Record<string, string>>({});
  useEffect(() => {
    crmFetch("status-labels").then(data => {
      if (!Array.isArray(data)) return;
      const labels: Record<string, string> = {};
      const colors: Record<string, string> = {};
      for (const row of data as { status: string; label: string | null; color: string | null }[]) {
        if (row.label) labels[row.status] = row.label;
        if (row.color) colors[row.status] = row.color;
      }
      setStatusLabels(labels);
      setStatusColors(colors);
    });
  }, []);
  const handleSaveStatusLabel = (status: string, val: string) => {
    setStatusLabels(prev => ({ ...prev, [status]: val }));
    crmFetch("status-labels", { method: "PUT", body: JSON.stringify({ status, label: val }) });
  };
  const handleSaveStatusColor = (status: string, color: string) => {
    setStatusColors(prev => ({ ...prev, [status]: color }));
    crmFetch("status-labels", { method: "PUT", body: JSON.stringify({ status, color }) });
  };

  return {
    tabLabels, tabColors, hiddenTabs, customTabs,
    handleSaveLabel, handleSaveColor, handleDeleteTab, handleAddTab,
    statusLabels, statusColors, handleSaveStatusLabel, handleSaveStatusColor,
  };
}

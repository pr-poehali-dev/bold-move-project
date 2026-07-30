import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import { AUTH_URL, PRICES_URL, PriceItem, EstimateBlock, SavedEstimate, PlanRoomForEstimate } from "./estimateTypes";
import { buildBlocksFromRooms, recalcTotals } from "./estimateUtils";
import type { EstimateData } from "./useEstimateData";

// Загрузка данных сметы (или синхронизация с уже загруженными initialData)
// + автосборка блоков из комнат проекта, если сметы ещё нет.
export function useEstimateEditorState(chatId: number, initialData?: EstimateData) {
  const [estimate, setEstimate] = useState<SavedEstimate | null>(initialData?.estimate ?? null);
  const [loading,  setLoading]  = useState(initialData ? initialData.loading : true);
  const [blocks,    setBlocks]    = useState<EstimateBlock[]>(initialData?.blocks ?? []);
  const [totals,    setTotals]    = useState<string[]>(initialData?.totals ?? []);
  const [prices,    setPrices]    = useState<PriceItem[]>(initialData?.prices ?? []);
  const [planRooms, setPlanRooms] = useState<PlanRoomForEstimate[]>(initialData?.planRooms ?? []);

  // Синхронизируем если initialData обновился (reload после сохранения)
  useEffect(() => {
    if (!initialData) return;
    setEstimate(initialData.estimate);
    setBlocks(initialData.blocks);
    setTotals(initialData.totals);
    setPrices(initialData.prices);
    setPlanRooms(initialData.planRooms);
    setLoading(initialData.loading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.estimate, initialData?.loading, initialData?.blocks.length]);

  const loadData = useCallback(() => {
    if (initialData) { initialData.reload(); return; }
    setLoading(true);
    Promise.all([
      fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${chatId}`).then(r => r.json()),
      fetch(PRICES_URL).then(r => r.json()).catch(() => ({ prices: [] })),
      crmFetch("plan-rooms-by-chat", undefined, { chat_id: String(chatId) }).catch(() => []),
    ]).then(([d, p, rooms]) => {
      const priceList: PriceItem[] = p.prices ?? [];
      const roomList: PlanRoomForEstimate[] = Array.isArray(rooms) ? rooms : [];
      setPrices(priceList);
      setPlanRooms(roomList);
      if (d.estimate) {
        setEstimate(d.estimate);
        setBlocks(d.estimate.blocks || []);
        setTotals(d.estimate.totals || []);
      } else if (roomList.length > 0) {
        const autoBlocks = buildBlocksFromRooms(roomList, priceList);
        setBlocks(autoBlocks);
        setTotals(recalcTotals(autoBlocks));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [chatId, initialData]);

  useEffect(() => {
    if (!initialData) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, initialData]);

  return {
    estimate, setEstimate, loading,
    blocks, setBlocks, totals, setTotals,
    prices, planRooms, loadData,
  };
}

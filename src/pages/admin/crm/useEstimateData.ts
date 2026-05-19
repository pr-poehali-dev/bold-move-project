import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import { AUTH_URL, PRICES_URL, PriceItem, EstimateBlock, SavedEstimate, PlanRoomForEstimate } from "./estimateTypes";
import { buildBlocksFromRooms, recalcTotals, calcStandardTotal, generatePrintHtml } from "./estimateUtils";

export interface EstimateData {
  estimate: SavedEstimate | null;
  blocks: EstimateBlock[];
  totals: string[];
  prices: PriceItem[];
  planRooms: PlanRoomForEstimate[];
  loading: boolean;
  reload: () => void;
  setBlocks: React.Dispatch<React.SetStateAction<EstimateBlock[]>>;
  setTotals: React.Dispatch<React.SetStateAction<string[]>>;
  setEstimate: React.Dispatch<React.SetStateAction<SavedEstimate | null>>;
  doPrint: (opts: { perRoom: boolean; includeDrawings: boolean }) => void;
}

export function useEstimateData(
  chatId: number,
  clientName?: string | null,
  clientPhone?: string | null,
): EstimateData {
  const [estimate, setEstimate] = useState<SavedEstimate | null>(null);
  const [blocks, setBlocks]     = useState<EstimateBlock[]>([]);
  const [totals, setTotals]     = useState<string[]>([]);
  const [prices, setPrices]     = useState<PriceItem[]>([]);
  const [planRooms, setPlanRooms] = useState<PlanRoomForEstimate[]>([]);
  const [loading, setLoading]   = useState(true);

  const loadData = useCallback(() => {
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
  }, [chatId]);

  useEffect(() => { loadData(); }, [loadData]);

  const doPrint = useCallback(({ perRoom, includeDrawings }: { perRoom: boolean; includeDrawings: boolean }) => {
    const standardTotal = calcStandardTotal(blocks);
    const html = generatePrintHtml(blocks, standardTotal, clientName, clientPhone, {
      perRoom,
      includeDrawings,
      planRooms,
    });
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }, [blocks, clientName, clientPhone, planRooms]);

  return { estimate, blocks, totals, prices, planRooms, loading, reload: loadData, setBlocks, setTotals, setEstimate, doPrint };
}

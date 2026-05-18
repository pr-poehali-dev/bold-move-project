import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import { AUTH_URL, PRICES_URL, PriceItem, EstimateBlock, SavedEstimate, PlanRoomForEstimate } from "./estimateTypes";
import { buildBlocksFromRooms, recalcTotals, calcStandardTotal, generateCopyText, generatePrintHtml } from "./estimateUtils";
import { EstimateFromPlanPreview, EstimateEmpty } from "./EstimatePreview";
import EstimateToolbar from "./EstimateToolbar";
import EstimateTable from "./EstimateTable";
import PdfOptionsModal from "./PdfOptionsModal";

export default function EstimateEditor({ chatId, clientName, clientPhone, onEstimateSaved }: {
  chatId: number;
  clientName?: string | null;
  clientPhone?: string | null;
  onEstimateSaved?: () => void;
}) {
  const [estimate, setEstimate] = useState<SavedEstimate | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [blocks,    setBlocks]    = useState<EstimateBlock[]>([]);
  const [totals,    setTotals]    = useState<string[]>([]);
  const [prices,    setPrices]    = useState<PriceItem[]>([]);
  const [planRooms, setPlanRooms] = useState<PlanRoomForEstimate[]>([]);
  const [editMode,  setEditMode]  = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

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

  const updateItem = (bi: number, ii: number, name: string, qty: number, price: number, unit: string) => {
    const total = Math.round(qty * price);
    const newValue = `${qty} ${unit} × ${price} ₽ = ${total.toLocaleString("ru-RU")} ₽`;
    const newBlocks = blocks.map((block, bIdx) =>
      bIdx !== bi ? block : {
        ...block,
        items: block.items.map((item, iIdx) =>
          iIdx !== ii ? item : { ...item, name, value: newValue }
        ),
      }
    );
    setBlocks(newBlocks);
    setTotals(recalcTotals(newBlocks));
  };

  const deleteItem = (bi: number, ii: number) => {
    const newBlocks = blocks.map((block, bIdx) =>
      bIdx !== bi ? block : { ...block, items: block.items.filter((_, iIdx) => iIdx !== ii) }
    );
    setBlocks(newBlocks);
    setTotals(recalcTotals(newBlocks));
  };

  const addItem = (bi: number) => {
    const newBlocks = blocks.map((block, bIdx) =>
      bIdx !== bi ? block : {
        ...block,
        items: [...block.items, { name: "Новая позиция", value: "1 шт × 0 ₽ = 0 ₽" }],
      }
    );
    setBlocks(newBlocks);
  };

  const saveEstimate = async () => {
    if (!estimate) return;
    setSaving(true); setSaved(false);
    try {
      await fetch(`${AUTH_URL}?action=update-estimate&id=${estimate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, totals }),
      });
      const standardLine = totals.find(t => t.toLowerCase().startsWith("standard"));
      if (standardLine) {
        const nums = standardLine.match(/[\d\s]+/g);
        if (nums) {
          const val = parseInt(nums.map(n => n.replace(/\s/g, "")).join("").slice(0, 8), 10);
          if (!isNaN(val)) {
            await crmFetch("clients", { method: "PUT", body: JSON.stringify({ contract_sum: val }) }, { id: String(chatId) });
          }
        }
      }
      setSaved(true);
      onEstimateSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const createEstimateFromPlan = async () => {
    if (blocks.length === 0) return;
    setSaving(true);
    try {
      const data = await crmFetch("create-estimate-for-chat", {
        method: "POST",
        body: JSON.stringify({ chat_id: chatId, blocks, totals }),
      }) as { ok?: boolean; estimate_id?: number };
      if (data.ok || data.estimate_id) {
        await loadData();
        onEstimateSaved?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const standardTotal = calcStandardTotal(blocks);

  const copyEstimateText = () => {
    const text = generateCopyText(blocks, standardTotal, clientName, clientPhone);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const printEstimate = () => {
    setShowPdfModal(true);
  };

  const doPrint = ({ perRoom, includeDrawings }: { perRoom: boolean; includeDrawings: boolean }) => {
    setShowPdfModal(false);
    const html = generatePrintHtml(blocks, standardTotal, clientName, clientPhone, {
      perRoom,
      includeDrawings,
      planRooms,
    });
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!estimate) {
    if (blocks.length > 0) {
      return (
        <EstimateFromPlanPreview
          blocks={blocks}
          totals={totals}
          saving={saving}
          onSave={createEstimateFromPlan}
        />
      );
    }
    return <EstimateEmpty />;
  }

  return (
    <>
    <div className="space-y-4">
      <EstimateToolbar
        estimate={estimate}
        clientName={clientName}
        clientPhone={clientPhone}
        editMode={editMode}
        saving={saving}
        saved={saved}
        copied={copied}
        onCopy={copyEstimateText}
        onPrint={printEstimate}
        onToggleEdit={() => setEditMode(m => !m)}
        onSave={saveEstimate}
      />
      <EstimateTable
        blocks={blocks}
        prices={prices}
        planRooms={planRooms}
        estimate={estimate}
        standardTotal={standardTotal}
        editMode={editMode}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
        onAddItem={addItem}
      />
    </div>

    {showPdfModal && (
      <PdfOptionsModal
        onConfirm={doPrint}
        onClose={() => setShowPdfModal(false)}
      />
    )}
    </>
  );
}
import { useState, useEffect, useCallback } from "react";
import { crmFetch } from "./crmApi";
import { AUTH_URL, PRICES_URL, PriceItem, EstimateBlock, SavedEstimate, PlanRoomForEstimate, parseValue } from "./estimateTypes";
import { buildBlocksFromRooms, recalcTotals, calcStandardTotal, generateCopyText, generatePrintHtml } from "./estimateUtils";
import { EstimateFromPlanPreview, EstimateEmpty } from "./EstimatePreview";
import EstimateToolbar from "./EstimateToolbar";
import EstimateTable from "./EstimateTable";
import PdfOptionsModal from "./PdfOptionsModal";
import type { EstimateData } from "./useEstimateData";

export default function EstimateEditor({ chatId, clientName, clientPhone, onEstimateSaved, onContractSumChanged, initialData }: {
  chatId: number;
  clientName?: string | null;
  clientPhone?: string | null;
  onEstimateSaved?: () => void;
  onContractSumChanged?: (sum: number) => void;
  initialData?: EstimateData;
}) {
  const [estimate, setEstimate] = useState<SavedEstimate | null>(initialData?.estimate ?? null);
  const [loading,  setLoading]  = useState(initialData ? initialData.loading : true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [blocks,    setBlocks]    = useState<EstimateBlock[]>(initialData?.blocks ?? []);
  const [totals,    setTotals]    = useState<string[]>(initialData?.totals ?? []);
  const [prices,    setPrices]    = useState<PriceItem[]>(initialData?.prices ?? []);
  const [planRooms, setPlanRooms] = useState<PlanRoomForEstimate[]>(initialData?.planRooms ?? []);
  const [editMode,  setEditMode]  = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Синхронизируем если initialData обновился (reload после сохранения)
  useEffect(() => {
    if (!initialData) return;
    setEstimate(initialData.estimate);
    setBlocks(initialData.blocks);
    setTotals(initialData.totals);
    setPrices(initialData.prices);
    setPlanRooms(initialData.planRooms);
    setLoading(initialData.loading);
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
  }, [loadData, initialData]);

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
            onContractSumChanged?.(val);
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
        const std = calcStandardTotal(blocks);
        if (std > 0) onContractSumChanged?.(std);
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

  const chooseTier = async (tier: "econom" | "standard" | "premium" | null) => {
    if (!estimate) return;

    // Если уже выбран другой тир — спрашиваем подтверждение
    if (estimate.chosen_tier && estimate.chosen_tier !== tier && tier !== null) {
      const ok = window.confirm(`Сменить согласованную цену на ${tier}?`);
      if (!ok) return;
    }

    // Вычисляем новую сумму договора
    const tierSums: Record<string, number | null> = {
      econom:   estimate.total_econom,
      standard: estimate.total_standard,
      premium:  estimate.total_premium,
    };
    const newSum = tier ? (tierSums[tier] ?? null) : null;

    // Обновляем локально сразу
    setEstimate(prev => prev ? { ...prev, chosen_tier: tier } : prev);
    if (newSum !== null) onContractSumChanged?.(newSum);

    await fetch(`${AUTH_URL}?action=choose-estimate-tier&id=${estimate.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chosen_tier: tier }),
    });
    onEstimateSaved?.();
  };

  const applyMarkupToEstimate = (pct: number, exactAmt: number) => {
    const markupAmt = exactAmt > 0 ? exactAmt : Math.round(standardTotal * pct / 100);
    if (markupAmt <= 0 || standardTotal <= 0) return;
    const ratio = (standardTotal + markupAmt) / standardTotal;
    const newBlocks = blocks.map(block => ({
      ...block,
      items: block.items.map(item => {
        const p = parseValue(item.value);
        if (!p) return item;
        const newPrice = Math.round(p.price * ratio);
        const newTotal = Math.round(p.qty * newPrice);
        return { ...item, value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${newTotal.toLocaleString("ru-RU")} ₽` };
      }),
    }));
    setBlocks(newBlocks);
    setTotals(recalcTotals(newBlocks));
  };

  const applyDiscountToEstimate = async (pct: number, exactAmt: number) => {
    const discountAmt = exactAmt > 0 ? exactAmt : Math.round(standardTotal * pct / 100);
    if (discountAmt <= 0 || standardTotal <= 0) return;
    const contractBefore = standardTotal;
    const ratio = (standardTotal - discountAmt) / standardTotal;
    const newBlocks = blocks.map(block => ({
      ...block,
      items: block.items.map(item => {
        const p = parseValue(item.value);
        if (!p) return item;
        const newPrice = Math.round(p.price * ratio);
        const newTotal = Math.round(p.qty * newPrice);
        return { ...item, value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${newTotal.toLocaleString("ru-RU")} ₽` };
      }),
    }));
    const newTotals = recalcTotals(newBlocks);
    setBlocks(newBlocks);
    setTotals(newTotals);

    // Считаем новый standard из пересчитанных блоков
    let newStandard = 0;
    for (const block of newBlocks)
      for (const item of block.items) { const p = parseValue(item.value); if (p) newStandard += p.total; }

    // Сохраняем смету в БД
    if (estimate) {
      await fetch(`${AUTH_URL}?action=update-estimate&id=${estimate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: newBlocks, totals: newTotals }),
      });
    }

    // Обновляем contract_sum и discount в клиенте
    await crmFetch("clients", { method: "PUT", body: JSON.stringify({
      contract_sum: newStandard,
      discount_pct: pct,
      discount_amount: discountAmt,
    }) }, { id: String(chatId) });

    // Записываем в discount_history
    await crmFetch("discount-history", {
      method: "POST",
      body: JSON.stringify({
        discount_pct: pct,
        discount_amount: discountAmt,
        contract_sum_before: contractBefore,
        contract_sum_after: newStandard,
      }),
    }, { client_id: String(chatId) });

    onContractSumChanged?.(newStandard);
    onEstimateSaved?.();
  };

  const doPrint = useCallback(({ perRoom, includeDrawings }: { perRoom: boolean; includeDrawings: boolean }) => {
    setShowPdfModal(false);
    const html = generatePrintHtml(blocks, standardTotal, clientName, clientPhone, {
      perRoom,
      includeDrawings,
      planRooms,
    });
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }, [blocks, standardTotal, clientName, clientPhone, planRooms]);

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
        onChooseTier={chooseTier}
        onApplyDiscount={applyDiscountToEstimate}
        onApplyMarkup={applyMarkupToEstimate}
      />
    </div>

    {showPdfModal && (
      <PdfOptionsModal
        onConfirm={opts => { doPrint(opts); }}
        onClose={() => setShowPdfModal(false)}
      />
    )}
    </>
  );
}
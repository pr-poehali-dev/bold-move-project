import { useState } from "react";
import { EstimateFromPlanPreview, EstimateEmpty } from "./EstimatePreview";
import EstimateToolbar from "./EstimateToolbar";
import EstimateTable from "./EstimateTable";
import PdfOptionsModal from "./PdfOptionsModal";
import type { EstimateData } from "./useEstimateData";
import { useEstimateEditorState } from "./useEstimateEditorState";
import { useEstimateEditorActions } from "./useEstimateEditorActions";

export default function EstimateEditor({ chatId, clientName, clientPhone, onEstimateSaved, onContractSumChanged, initialData }: {
  chatId: number;
  clientName?: string | null;
  clientPhone?: string | null;
  onEstimateSaved?: () => void;
  onContractSumChanged?: (sum: number) => void;
  initialData?: EstimateData;
}) {
  const [editMode, setEditMode] = useState(false);

  const {
    estimate, setEstimate, loading,
    blocks, setBlocks, totals, setTotals,
    prices, planRooms, loadData,
  } = useEstimateEditorState(chatId, initialData);

  const {
    saving, saved, copied, showPdfModal, setShowPdfModal, standardTotal,
    updateItem, deleteItem, addItem, saveEstimate, createEstimateFromPlan,
    copyEstimateText, printEstimate, chooseTier, applyMarkupToEstimate, applyDiscountToEstimate, doPrint,
  } = useEstimateEditorActions({
    chatId, clientName, clientPhone, estimate, setEstimate, blocks, setBlocks, totals, setTotals,
    planRooms, loadData, onEstimateSaved, onContractSumChanged,
  });

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

import RuleMobileList from "./RuleMobileList";
import RuleDesktopTable from "./RuleDesktopTable";
import type { RuleItem, RuleType, DraftMap } from "./RuleTypes";
import type { PriceItem } from "./types";

interface Props {
  isDark?: boolean;
  readOnly?: boolean;
  category: string;
  items: RuleItem[];
  prices: PriceItem[];
  activeRuleTypes: RuleType[];
  ruleValues: Record<number, Record<number, string>>;
  expandedId: number | null;
  drafts: DraftMap;
  saving: number | null;
  confirmDeleteItemId: number | null;
  confirmDeleteId: number | null;
  editingLabelId: number | null;
  editingLabelVal: string;
  onOpenRow: (item: RuleItem) => void;
  onSaveRow: (item: RuleItem) => void;
  onCloseRow: () => void;
  onPatchDraft: (id: number, patch: Partial<DraftMap[number]>) => void;
  onDeleteItem: (id: number) => void;
  onSetConfirmDeleteItemId: (id: number | null) => void;
  onDeleteRuleType: (id: number) => void;
  onSetConfirmDeleteId: (id: number | null) => void;
  onStartEditLabel: (rt: RuleType) => void;
  onEditLabelChange: (val: string) => void;
  onSaveLabel: (rt: RuleType) => void;
  onCancelEditLabel: () => void;
  onOpenBundleModal: (item: RuleItem, e: { stopPropagation: () => void }) => void;
  onSaveField: (item: PriceItem, field: string, val: string) => void;
  onSaveCustomValue: (priceId: number, ruleTypeId: number, value: string) => void;
  onPasteBundle?: (item: RuleItem, bundleJson: string) => void;
  onAutoBundle?: (item: RuleItem) => void;
  autoBundleLoadingId?: number | null;
}

export default function RuleCategoryTable({
  isDark = true, readOnly = false, category, items, prices, activeRuleTypes, ruleValues,
  expandedId, drafts, saving, confirmDeleteItemId, confirmDeleteId,
  editingLabelId, editingLabelVal,
  onOpenRow, onSaveRow, onCloseRow, onPatchDraft,
  onDeleteItem, onSetConfirmDeleteItemId,
  onDeleteRuleType, onSetConfirmDeleteId,
  onStartEditLabel, onEditLabelChange, onSaveLabel, onCancelEditLabel,
  onOpenBundleModal, onSaveField, onSaveCustomValue, onPasteBundle,
  onAutoBundle, autoBundleLoadingId,
}: Props) {
  const colTemplate = `1.2fr 1fr 1fr 1fr repeat(${activeRuleTypes.length}, 1fr) 32px`;
  const catHead = isDark ? "text-violet-300" : "text-violet-600";
  const bg      = isDark ? "bg-white/[0.03]" : "bg-white";
  const border  = isDark ? "border-white/10"  : "border-gray-200";
  const muted   = isDark ? "text-white/30"    : "text-gray-400";

  return (
    <div>
      <h3 className={`${catHead} text-xs font-semibold uppercase tracking-wider mb-2 px-1`}>{category}</h3>
      <div className={`${bg} border ${border} rounded-xl overflow-hidden`}>

        <RuleMobileList
          items={items}
          prices={prices}
          activeRuleTypes={activeRuleTypes}
          expandedId={expandedId}
          drafts={drafts}
          saving={saving}
          confirmDeleteItemId={confirmDeleteItemId}
          isDark={isDark}
          readOnly={readOnly}
          muted={muted}
          onOpenRow={onOpenRow}
          onSaveRow={onSaveRow}
          onCloseRow={onCloseRow}
          onPatchDraft={onPatchDraft}
          onDeleteItem={onDeleteItem}
          onSetConfirmDeleteItemId={onSetConfirmDeleteItemId}
          onAutoBundle={onAutoBundle}
          autoBundleLoadingId={autoBundleLoadingId}
        />

        <RuleDesktopTable
          items={items}
          prices={prices}
          activeRuleTypes={activeRuleTypes}
          ruleValues={ruleValues}
          expandedId={expandedId}
          drafts={drafts}
          saving={saving}
          confirmDeleteItemId={confirmDeleteItemId}
          confirmDeleteId={confirmDeleteId}
          editingLabelId={editingLabelId}
          editingLabelVal={editingLabelVal}
          isDark={isDark}
          readOnly={readOnly}
          muted={muted}
          border={border}
          colTemplate={colTemplate}
          onOpenRow={onOpenRow}
          onSaveRow={onSaveRow}
          onCloseRow={onCloseRow}
          onPatchDraft={onPatchDraft}
          onDeleteItem={onDeleteItem}
          onSetConfirmDeleteItemId={onSetConfirmDeleteItemId}
          onDeleteRuleType={onDeleteRuleType}
          onSetConfirmDeleteId={onSetConfirmDeleteId}
          onStartEditLabel={onStartEditLabel}
          onEditLabelChange={onEditLabelChange}
          onSaveLabel={onSaveLabel}
          onCancelEditLabel={onCancelEditLabel}
          onOpenBundleModal={onOpenBundleModal}
          onSaveField={onSaveField}
          onSaveCustomValue={onSaveCustomValue}
          onPasteBundle={onPasteBundle}
          onAutoBundle={onAutoBundle}
          autoBundleLoadingId={autoBundleLoadingId}
        />

      </div>
    </div>
  );
}

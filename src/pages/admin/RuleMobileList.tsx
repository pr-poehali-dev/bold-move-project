import Icon from "@/components/ui/icon";
import RuleItemEditor from "./RuleItemEditor";
import type { RuleItem, RuleType, DraftMap } from "./RuleTypes";
import type { PriceItem } from "./types";

interface Props {
  items: RuleItem[];
  prices: PriceItem[];
  activeRuleTypes: RuleType[];
  expandedId: number | null;
  drafts: DraftMap;
  saving: number | null;
  confirmDeleteItemId: number | null;
  isDark: boolean;
  readOnly: boolean;
  muted: string;
  onOpenRow: (item: RuleItem) => void;
  onSaveRow: (item: RuleItem) => void;
  onCloseRow: () => void;
  onPatchDraft: (id: number, patch: Partial<DraftMap[number]>) => void;
  onDeleteItem: (id: number) => void;
  onSetConfirmDeleteItemId: (id: number | null) => void;
  onAutoBundle?: (item: RuleItem) => void;
  autoBundleLoadingId?: number | null;
}

export default function RuleMobileList({
  items, prices, activeRuleTypes, expandedId, drafts, saving,
  confirmDeleteItemId, isDark, readOnly, muted,
  onOpenRow, onSaveRow, onCloseRow, onPatchDraft,
  onDeleteItem, onSetConfirmDeleteItemId,
  onAutoBundle, autoBundleLoadingId,
}: Props) {
  return (
    <div className="sm:hidden flex flex-col divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6" }}>
      {items.map(item => {
        const isExpanded = expandedId === item.id;
        const d = drafts[item.id];
        const isSaving = saving === item.id;
        return (
          <div key={item.id} className={!item.active ? "opacity-40" : ""}>
            <div
              onClick={() => onOpenRow(item)}
              className={`w-full flex items-center gap-2 px-3 py-3 text-left transition cursor-pointer ${isExpanded ? "bg-violet-500/10" : ""}`}>
              <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={13} className={muted} />
              <span className={`flex-1 text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>{item.name}</span>
              {(item.when_condition || item.when_not_condition || item.calc_rule) && (
                <span className="text-[10px] bg-violet-500/20 text-violet-400 rounded-full px-2 py-0.5">правила</span>
              )}
              {!readOnly && (
                <div onClick={e => e.stopPropagation()}>
                  {confirmDeleteItemId === item.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { onDeleteItem(item.id); onSetConfirmDeleteItemId(null); }}
                        className="text-red-400 text-[10px] px-1.5 py-0.5 bg-red-500/20 rounded">Да</button>
                      <button onClick={() => onSetConfirmDeleteItemId(null)}
                        className="text-white/40 text-[10px] px-1.5 py-0.5 bg-white/5 rounded">Нет</button>
                    </div>
                  ) : (
                    <button onClick={() => onSetConfirmDeleteItemId(item.id)}
                      className="text-white/20 hover:text-red-400 transition p-1">
                      <Icon name="X" size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {isExpanded && d && (
              <RuleItemEditor
                item={item}
                d={d}
                isSaving={isSaving}
                isDark={isDark}
                activeRuleTypes={activeRuleTypes}
                prices={prices}
                onAutoBundle={onAutoBundle}
                autoBundleLoadingId={autoBundleLoadingId}
                onPatchDraft={onPatchDraft}
                onSaveRow={onSaveRow}
                onCloseRow={onCloseRow}
                desktop={false}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

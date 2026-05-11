import Icon from "@/components/ui/icon";
import InlineEditCell from "./InlineEditCell";
import RuleItemEditor from "./RuleItemEditor";
import type { RuleItem, RuleType, DraftMap } from "./RuleTypes";
import { parseBundleIds } from "./RuleTypes";
import type { PriceItem } from "./types";

interface Props {
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
  isDark: boolean;
  readOnly: boolean;
  muted: string;
  border: string;
  colTemplate: string;
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

export default function RuleDesktopTable({
  items, prices, activeRuleTypes, ruleValues,
  expandedId, drafts, saving, confirmDeleteItemId, confirmDeleteId,
  editingLabelId, editingLabelVal,
  isDark, readOnly, muted, border, colTemplate,
  onOpenRow, onSaveRow, onCloseRow, onPatchDraft,
  onDeleteItem, onSetConfirmDeleteItemId,
  onDeleteRuleType, onSetConfirmDeleteId,
  onStartEditLabel, onEditLabelChange, onSaveLabel, onCancelEditLabel,
  onOpenBundleModal, onSaveField, onSaveCustomValue, onPasteBundle,
  onAutoBundle, autoBundleLoadingId,
}: Props) {
  return (
    <div className="hidden sm:block">
      {/* Заголовок */}
      <div className={`grid border-b ${border} px-4 py-2.5`} style={{ gridTemplateColumns: colTemplate }}>
        <span className={`${muted} text-xs`}>Позиция</span>
        <span className={`${muted} text-xs`}>Добавляется если...</span>
        <span className={`${muted} text-xs`}>НЕ добавляется если...</span>
        <span className={`${muted} text-xs text-amber-400/60`}>Изменения клиента</span>
        {activeRuleTypes.map(rt => (
          <div key={rt.id} className="flex items-center gap-1.5 group/col min-w-0">
            {editingLabelId === rt.id ? (
              <input
                autoFocus
                value={editingLabelVal}
                onChange={e => onEditLabelChange(e.target.value)}
                onBlur={() => onSaveLabel(rt)}
                onKeyDown={e => {
                  if (e.key === "Enter") onSaveLabel(rt);
                  if (e.key === "Escape") onCancelEditLabel();
                }}
                className={`${isDark ? "text-white" : "text-gray-900"} text-xs bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 outline-none w-full`}
              />
            ) : (
              <>
                <span className={`${muted} text-xs truncate`} title={rt.description}>{rt.label}</span>
                {!readOnly && rt.name !== "calc_rule" && rt.name !== "bundle" && (
                  <>
                    <button
                      onClick={() => onStartEditLabel(rt)}
                      className="opacity-0 group-hover/col:opacity-60 hover:!opacity-100 transition text-white/40 hover:text-violet-400 flex-shrink-0">
                      <Icon name="Pencil" size={10} />
                    </button>
                    {confirmDeleteId === rt.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-red-400 text-[10px]">Удалить?</span>
                        <button onClick={() => onDeleteRuleType(rt.id)}
                          className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 bg-red-500/20 rounded transition">Да</button>
                        <button onClick={() => onSetConfirmDeleteId(null)}
                          className="text-white/40 hover:text-white/70 text-[10px] px-1.5 py-0.5 bg-white/5 rounded transition">Нет</button>
                      </div>
                    ) : (
                      <button onClick={() => onSetConfirmDeleteId(rt.id)}
                        className="opacity-0 group-hover/col:opacity-100 transition text-white/25 hover:text-red-400 flex-shrink-0">
                        <Icon name="X" size={11} />
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ))}
        <span />
      </div>

      {/* Строки */}
      {items.map((item, idx) => {
        const isExpanded = expandedId === item.id;
        const d = drafts[item.id];
        const isSaving = saving === item.id;

        return (
          <div key={item.id} className={`border-b ${isDark ? "border-white/5" : "border-gray-100"} last:border-0 ${!item.active ? "opacity-40" : ""}`}>

            {/* Строка-превью */}
            <div
              className={`grid px-4 py-2.5 transition items-start gap-2
                ${idx % 2 ? (isDark ? "bg-white/[0.01]" : "bg-gray-50/50") : ""}
                ${isExpanded ? "bg-violet-500/10 border-b border-violet-500/20" : (isDark ? "hover:bg-white/[0.02]" : "hover:bg-gray-50")}
              `}
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div className="flex items-center gap-1.5 min-w-0 cursor-pointer py-0.5" onClick={() => onOpenRow(item)}>
                <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={12} className={`${isDark ? "text-white/20" : "text-gray-300"} flex-shrink-0`} />
                <span className={`${isDark ? "text-white/80" : "text-gray-700"} text-xs font-medium truncate`}>{item.name}</span>
              </div>

              <div className="min-w-0 overflow-hidden">
                <InlineEditCell
                  value={item.when_condition || ""}
                  onSave={v => onSaveField(item, "when_condition", v)}
                  placeholder="не задано"
                />
              </div>

              <div className="min-w-0 overflow-hidden">
                <InlineEditCell
                  value={item.when_not_condition || ""}
                  onSave={v => onSaveField(item, "when_not_condition", v)}
                  placeholder="не задано"
                  colorClass="text-red-400/60"
                />
              </div>

              <div className="min-w-0 overflow-hidden">
                <InlineEditCell
                  value={item.client_changes || ""}
                  onSave={v => onSaveField(item, "client_changes", v)}
                  placeholder="не задано"
                  colorClass="text-amber-400/70"
                />
              </div>

              {activeRuleTypes.map(rt => {
                if (rt.name === "bundle") {
                  const ids = parseBundleIds(item.bundle || "");
                  const idToName = Object.fromEntries(prices.map(p => [p.id, p.name]));
                  return (
                    <div key={rt.id} className="min-w-0 overflow-hidden group/bundlecell relative pr-4">
                      <div
                        onClick={e => onOpenBundleModal(item, e)}
                        className={`text-xs truncate cursor-pointer rounded transition hover:bg-white/5
                          ${ids.length > 0 ? "text-white/50" : "text-white/15 italic"}`}>
                        {ids.length > 0 ? ids.map(id => idToName[id]).filter(Boolean).join(", ") : "не задано"}
                      </div>
                      {ids.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(item.bundle); }}
                          title="Скопировать комплект"
                          className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/bundlecell:opacity-100 transition text-white/25 hover:text-violet-400"
                        >
                          <Icon name="Copy" size={10} />
                        </button>
                      )}
                      {ids.length === 0 && onPasteBundle && (
                        <button
                          onClick={async e => { e.stopPropagation(); const text = await navigator.clipboard.readText(); onPasteBundle(item, text); }}
                          title="Вставить скопированный комплект"
                          className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/bundlecell:opacity-100 transition text-white/25 hover:text-green-400"
                        >
                          <Icon name="ClipboardPaste" size={10} />
                        </button>
                      )}
                    </div>
                  );
                }
                if (rt.name === "calc_rule") {
                  return (
                    <div key={rt.id} className="min-w-0 overflow-hidden">
                      <InlineEditCell
                        value={item.calc_rule || ""}
                        onSave={v => onSaveField(item, "calc_rule", v)}
                        placeholder={rt.placeholder || "не задано"}
                      />
                    </div>
                  );
                }
                return (
                  <div key={rt.id} className="min-w-0 overflow-hidden">
                    <InlineEditCell
                      value={ruleValues[item.id]?.[rt.id] ?? ""}
                      onSave={v => onSaveCustomValue(item.id, rt.id, v)}
                      placeholder={rt.placeholder || "—"}
                    />
                  </div>
                );
              })}

              {!readOnly && (
                <div className="flex items-center gap-1 justify-self-end pt-0.5" onClick={e => e.stopPropagation()}>
                  {confirmDeleteItemId === item.id ? (
                    <>
                      <button onClick={() => { onDeleteItem(item.id); onSetConfirmDeleteItemId(null); }}
                        className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 bg-red-500/20 rounded transition">Да</button>
                      <button onClick={() => onSetConfirmDeleteItemId(null)}
                        className="text-white/40 hover:text-white/70 text-[10px] px-1.5 py-0.5 bg-white/5 rounded transition">Нет</button>
                    </>
                  ) : (
                    <button onClick={() => onSetConfirmDeleteItemId(item.id)}
                      className="text-white/15 hover:text-red-400 transition p-1">
                      <Icon name="X" size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Раскрытый редактор */}
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
                desktop={true}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

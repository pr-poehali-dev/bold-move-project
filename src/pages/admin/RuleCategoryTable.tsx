import Icon from "@/components/ui/icon";
import BundleSelector from "./BundleSelector";
import InlineEditCell from "./InlineEditCell";
import type { RuleItem, RuleType, DraftMap } from "./RuleTypes";
import { parseBundleIds } from "./RuleTypes";
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
}

export default function RuleCategoryTable({
  isDark = true, readOnly = false, category, items, prices, activeRuleTypes, ruleValues,
  expandedId, drafts, saving, confirmDeleteItemId, confirmDeleteId,
  editingLabelId, editingLabelVal,
  onOpenRow, onSaveRow, onCloseRow, onPatchDraft,
  onDeleteItem, onSetConfirmDeleteItemId,
  onDeleteRuleType, onSetConfirmDeleteId,
  onStartEditLabel, onEditLabelChange, onSaveLabel, onCancelEditLabel,
  onOpenBundleModal, onSaveField, onSaveCustomValue,
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

        {/* ── Мобиле: аккордеон-карточки ── */}
        <div className="sm:hidden flex flex-col divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6" }}>
          {items.map(item => {
            const isExpanded = expandedId === item.id;
            const d = drafts[item.id];
            const isSaving = saving === item.id;
            return (
              <div key={item.id} className={!item.active ? "opacity-40" : ""}>
                {/* Строка-заголовок карточки */}
                <button
                  onClick={() => onOpenRow(item)}
                  className={`w-full flex items-center gap-2 px-3 py-3 text-left transition ${isExpanded ? "bg-violet-500/10" : ""}`}>
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
                </button>

                {/* Раскрытый редактор (мобиле) */}
                {isExpanded && d && (
                  <div className={`px-4 pb-4 flex flex-col gap-3 ${isDark ? "bg-white/[0.02]" : "bg-gray-50/50"}`}>
                    <p className={`${muted} text-xs pt-2`}>Правила для <span className={isDark ? "text-violet-300 font-medium" : "text-violet-600 font-medium"}>{item.name}</span></p>

                    <div className="flex flex-col gap-1.5">
                      <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
                        <Icon name="CircleCheck" size={11} className="text-green-400" />
                        Добавляется если...
                      </label>
                      <textarea value={d.when_condition}
                        onChange={e => onPatchDraft(item.id, { when_condition: e.target.value })}
                        placeholder={"• клиент выбрал ПВХ полотно\n• всегда добавлять"}
                        rows={3}
                        className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-green-500/60" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-green-500"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
                        <Icon name="CircleX" size={11} className="text-red-400" />
                        НЕ добавляется если...
                      </label>
                      <textarea value={d.when_not_condition}
                        onChange={e => onPatchDraft(item.id, { when_not_condition: e.target.value })}
                        placeholder={"• клиент выбрал тканевое полотно"}
                        rows={3}
                        className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-red-500/60" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-red-500"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
                        <Icon name="Calculator" size={11} className="text-violet-400" />
                        Логика расчёта
                      </label>
                      <textarea value={d.calc_rule}
                        onChange={e => onPatchDraft(item.id, { calc_rule: e.target.value })}
                        placeholder={"• площадь комнаты\n• периметр × 1.3"}
                        rows={3}
                        className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-violet-500" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-violet-500"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
                        <Icon name="PenLine" size={11} className="text-amber-400" />
                        Изменения клиента
                      </label>
                      <textarea value={d.client_changes}
                        onChange={e => onPatchDraft(item.id, { client_changes: e.target.value })}
                        placeholder={"что может изменить клиент..."}
                        rows={2}
                        className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
                      />
                    </div>

                    {activeRuleTypes.filter(rt => rt.name !== "calc_rule" && rt.name !== "bundle").map(rt => (
                      <div key={rt.id} className="flex flex-col gap-1.5">
                        <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium`}>{rt.label}</label>
                        <textarea
                          value={d.custom[rt.id] ?? ""}
                          onChange={e => onPatchDraft(item.id, { custom: { ...d.custom, [rt.id]: e.target.value } })}
                          placeholder={rt.placeholder || "—"}
                          rows={2}
                          className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
                        />
                      </div>
                    ))}

                    <div className="flex gap-2 pt-2 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}>
                      <button onClick={() => onSaveRow(item)} disabled={isSaving}
                        className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs px-4 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5">
                        {isSaving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                        Сохранить
                      </button>
                      <button onClick={onCloseRow}
                        className={`px-4 py-2.5 text-xs rounded-lg transition ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-700"}`}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Десктоп: таблица (скрыта на мобиле) ── */}
        {/* Заголовок */}
        <div className={`hidden sm:grid border-b ${border} px-4 py-2.5`} style={{ gridTemplateColumns: colTemplate }}>
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

        {/* Строки (только десктоп) */}
        <div className="hidden sm:block">
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
                <div className="bg-white/[0.02] border-b border-white/5 px-5 py-4 flex flex-col gap-4">
                  <p className="text-white/40 text-xs">Правила для <span className="text-violet-300 font-medium">{item.name}</span></p>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                        <Icon name="CircleCheck" size={11} className="text-green-400" />
                        1. Добавляется если...
                      </label>
                      <textarea
                        value={d.when_condition}
                        onChange={e => onPatchDraft(item.id, { when_condition: e.target.value })}
                        placeholder={"Например:\n• клиент выбрал ПВХ полотно\n• в смете есть точечные светильники\n• клиент упомянул люстру\n• всегда добавлять"}
                        rows={5}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-green-500/60 resize-none transition placeholder-white/20"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                        <Icon name="CircleX" size={11} className="text-red-400" />
                        2. НЕ добавляется если...
                      </label>
                      <textarea
                        value={d.when_not_condition}
                        onChange={e => onPatchDraft(item.id, { when_not_condition: e.target.value })}
                        placeholder={"Например:\n• клиент выбрал тканевое полотно\n• в смете уже есть теневой профиль\n• клиент написал «без монтажа»"}
                        rows={5}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-red-500/60 resize-none transition placeholder-white/20"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                        <Icon name="Calculator" size={11} className="text-violet-400" />
                        3. Логика расчёта
                      </label>
                      <textarea
                        value={d.calc_rule}
                        onChange={e => onPatchDraft(item.id, { calc_rule: e.target.value })}
                        placeholder={"Сколько добавлять и при каких условиях:\n• площадь комнаты\n• периметр × 1.3\n• 1 шт на каждый светильник\n• длина ниши (спросить у клиента)\n• площадь + 30% если высота > 3м"}
                        rows={5}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-violet-500 resize-none transition placeholder-white/20"
                      />
                    </div>
                  </div>

                  {activeRuleTypes.filter(rt => rt.name !== "calc_rule" && rt.name !== "bundle").map(rt => (
                    <div key={rt.id} className="flex flex-col gap-1.5">
                      <label className="text-white/60 text-xs font-medium">{rt.label}</label>
                      <textarea
                        value={d.custom[rt.id] ?? ""}
                        onChange={e => onPatchDraft(item.id, { custom: { ...d.custom, [rt.id]: e.target.value } })}
                        placeholder={rt.placeholder || "—"}
                        rows={2}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-violet-500 resize-none transition"
                      />
                    </div>
                  ))}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                      <Icon name="Package" size={11} className="text-green-400" />
                      Вместе добавить позиции
                    </label>
                    <BundleSelector
                      prices={prices}
                      selectedPriceId={item.id}
                      excludeId={item.id}
                      bundleIds={d.bundleIds}
                      bundleSearch={d.bundleSearch}
                      bundleOpen={d.bundleOpen}
                      onToggleOpen={() => onPatchDraft(item.id, { bundleOpen: !d.bundleOpen })}
                      onBundleSearchChange={v => onPatchDraft(item.id, { bundleSearch: v })}
                      onToggleItem={id => onPatchDraft(item.id, {
                        bundleIds: d.bundleIds.includes(id) ? d.bundleIds.filter(x => x !== id) : [...d.bundleIds, id]
                      })}
                      onRemoveItem={id => onPatchDraft(item.id, { bundleIds: d.bundleIds.filter(x => x !== id) })}
                    />
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-white/5">
                    <button onClick={() => onSaveRow(item)} disabled={isSaving}
                      className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5">
                      {isSaving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                      Сохранить
                    </button>
                    <button onClick={onCloseRow} className="text-white/40 hover:text-white/70 text-xs transition px-3 py-2">Отмена</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>{/* end hidden sm:block */}
      </div>
    </div>
  );
}
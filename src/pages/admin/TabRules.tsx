import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import { usePriceList } from "./usePriceList";
import RuleAddForm from "./RuleAddForm";
import RuleCategoryTable from "./RuleCategoryTable";
import BundleModal from "./BundleModal";
import TabPricingRules from "./TabPricingRules";
import TabAutoRules from "./TabAutoRules";
import TabDiscountRisk from "./TabDiscountRisk";
import { parseBundleIds } from "./RuleTypes";
import type { RuleItem, RuleType, DraftMap } from "./RuleTypes";
import type { PriceItem } from "./types";

type RulesSub = "price_rules" | "pricing_3" | "auto_rules" | "discount_risk";

interface Props { token: string; hint?: string | null; isDark?: boolean; readOnly?: boolean; }

export default function TabRules({ token, hint, isDark = true, readOnly = false }: Props) {
  const [sub, setSub] = useState<RulesSub>("price_rules");

  const SUB_TABS: { id: RulesSub; label: string; icon: string }[] = [
    { id: "price_rules",   label: "Правила к прайсу",     icon: "SlidersHorizontal" },
    { id: "pricing_3",     label: "Правила 3 цен",        icon: "Layers3" },
    { id: "auto_rules",    label: "Правила авто-расчёта", icon: "GraduationCap" },
    { id: "discount_risk", label: "Управление риском",    icon: "ShieldAlert" },
  ];

  const activeCls = isDark
    ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
    : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600";
  const inactiveCls = isDark
    ? "text-white/40 hover:text-white/70"
    : "text-gray-500 hover:text-gray-800";

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Подвкладки */}
      <div className="flex gap-0.5 mb-5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              sub === t.id ? activeCls : inactiveCls
            }`}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {sub === "pricing_3"     && <TabPricingRules token={token} readOnly={readOnly} />}
      {sub === "auto_rules"    && <TabAutoRules isDark={isDark} readOnly={readOnly} />}
      {sub === "price_rules"   && <PriceRulesContent token={token} hint={hint} isDark={isDark} readOnly={readOnly} />}
      {sub === "discount_risk" && <TabDiscountRisk isDark={isDark} readOnly={readOnly} />}
    </div>
  );
}

// ── Бывший TabRules (контент правил к прайсу) ─────────────────────────────────
function PriceRulesContent({ token, hint, isDark = true, readOnly = false }: Props) {
  const { prices, loading, byCategory, saveField, deleteItem } = usePriceList(token);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([]);
  const [ruleValues, setRuleValues] = useState<Record<number, Record<number, string>>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [saving, setSaving] = useState<number | null>(null);

  const [addingRule, setAddingRule] = useState(false);
  const [newRule, setNewRule] = useState({ label: "", description: "", placeholder: "" });
  const [addingRuleSaving, setAddingRuleSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editingLabelVal, setEditingLabelVal] = useState("");
  const [bundleModal, setBundleModal] = useState<{ item: RuleItem } | null>(null);
  const [bundleModalState, setBundleModalState] = useState<{ ids: number[]; search: string; open: boolean }>({ ids: [], search: "", open: true });

  const openBundleModal = (item: RuleItem, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const ids = parseBundleIds(item.bundle || "");
    setBundleModal({ item });
    setBundleModalState({ ids, search: "", open: true });
  };

  const saveBundleModal = async () => {
    if (!bundleModal) return;
    const val = JSON.stringify(bundleModalState.ids);
    await saveField(bundleModal.item, "bundle", val);
    setBundleModal(null);
  };

  const saveLabel = async (rt: RuleType) => {
    const val = editingLabelVal.trim();
    if (!val || val === rt.label) { setEditingLabelId(null); return; }
    await apiFetch("rule-types", { method: "PUT", body: JSON.stringify({ label: val, description: rt.description, placeholder: rt.placeholder, active: rt.active }) }, token, rt.id);
    setRuleTypes(prev => prev.map(r => r.id === rt.id ? { ...r, label: val } : r));
    setEditingLabelId(null);
  };

  const loadRuleTypes = useCallback(async () => {
    const r = await apiFetch("rule-types");
    if (r.ok) { const d = await r.json(); setRuleTypes(d.items); }
  }, []);

  useEffect(() => { loadRuleTypes(); }, [loadRuleTypes]);

  const loadValuesForPrice = async (priceId: number) => {
    if (ruleValues[priceId] !== undefined) return;
    const r = await apiFetch("rule-values", {}, token, priceId);
    if (r.ok) {
      const d = await r.json();
      setRuleValues(prev => ({ ...prev, [priceId]: d.values }));
    }
  };

  const openRow = async (item: RuleItem) => {
    if (expandedId === item.id) { setExpandedId(null); return; }
    await loadValuesForPrice(item.id);
    setExpandedId(item.id);
    setDrafts(prev => ({
      ...prev,
      [item.id]: {
        calc_rule: item.calc_rule || "",
        when_condition: item.when_condition || "",
        when_not_condition: item.when_not_condition || "",
        bundle: item.bundle || "",
        client_changes: item.client_changes || "",
        bundleIds: parseBundleIds(item.bundle || ""),
        bundleSearch: "",
        bundleOpen: false,
        custom: ruleValues[item.id] ? { ...ruleValues[item.id] } : {},
      },
    }));
  };

  const patchDraft = (id: number, patch: Partial<DraftMap[number]>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveRow = async (item: RuleItem) => {
    const d = drafts[item.id];
    if (!d) return;
    setSaving(item.id);
    const bundleVal = JSON.stringify(d.bundleIds);
    const updated = { ...item, calc_rule: d.calc_rule, when_condition: d.when_condition || "", when_not_condition: d.when_not_condition || "", client_changes: d.client_changes || "" };
    await saveField(item, "calc_rule", d.calc_rule);
    await saveField(updated, "when_condition", d.when_condition || "");
    await saveField(updated, "when_not_condition", d.when_not_condition || "");
    await saveField(updated, "bundle", bundleVal);
    await saveField(updated, "client_changes", d.client_changes || "");
    for (const [rtIdStr, value] of Object.entries(d.custom)) {
      await apiFetch("rule-values", {
        method: "POST",
        body: JSON.stringify({ price_id: item.id, rule_type_id: parseInt(rtIdStr), value }),
      }, token);
    }
    setRuleValues(prev => ({
      ...prev,
      [item.id]: { ...(prev[item.id] ?? {}), ...Object.fromEntries(Object.entries(d.custom).map(([k, v]) => [k, v])) },
    }));
    setSaving(null);
    setExpandedId(null);
  };

  const pasteBundle = async (item: RuleItem, bundleJson: string) => {
    try {
      const parsed = JSON.parse(bundleJson);
      if (!Array.isArray(parsed)) return;
      await saveField(item, "bundle", bundleJson);
    } catch { /* ignore invalid json */ }
  };

  const saveCustomValue = async (priceId: number, ruleTypeId: number, value: string) => {
    await apiFetch("rule-values", {
      method: "POST",
      body: JSON.stringify({ price_id: priceId, rule_type_id: ruleTypeId, value }),
    }, token);
    setRuleValues(prev => ({
      ...prev,
      [priceId]: { ...(prev[priceId] ?? {}), [ruleTypeId]: value },
    }));
  };

  const addRuleType = async () => {
    if (!newRule.label.trim()) return;
    setAddingRuleSaving(true);
    const r = await apiFetch("rule-types", { method: "POST", body: JSON.stringify(newRule) }, token);
    if (r.ok) { await loadRuleTypes(); setAddingRule(false); setNewRule({ label: "", description: "", placeholder: "" }); }
    setAddingRuleSaving(false);
  };

  const deleteRuleType = async (id: number) => {
    await apiFetch("rule-types", { method: "DELETE" }, token, id);
    setConfirmDeleteId(null);
    await loadRuleTypes();
  };

  const rulesByCategory = Object.fromEntries(
    Object.entries(byCategory).map(([cat, items]) => [cat, items as RuleItem[]])
  );
  const activeRuleTypes = ruleTypes.filter(rt => rt.active);

  if (loading) return <p className={`${isDark ? "text-white/30" : "text-gray-400"} text-sm`}>Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <p className={`${isDark ? "text-white/50" : "text-gray-500"} text-sm`}>Нажмите на строку — откроется редактор правил для этой позиции.</p>
        {!readOnly && (
          <button onClick={() => setAddingRule(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs rounded-lg transition flex-shrink-0">
            <Icon name="Plus" size={13} />
            Добавить правило
          </button>
        )}
      </div>

      {!readOnly && addingRule && (
        <RuleAddForm
          newRule={newRule}
          saving={addingRuleSaving}
          onChange={patch => setNewRule(p => ({ ...p, ...patch }))}
          onSave={addRuleType}
          onCancel={() => setAddingRule(false)}
        />
      )}

      {hint && (
        <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3">
          <Icon name="ArrowDown" size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className={`${isDark ? "text-violet-300" : "text-violet-600"} font-medium`}>Позиция «{hint}» добавлена.</span>
            <span className={`${isDark ? "text-white/50" : "text-gray-500"} ml-1`}>Найдите её ниже и заполните правила расчёта если нужно.</span>
          </div>
        </div>
      )}

      {Object.entries(rulesByCategory).map(([category, catItems]) => (
        <RuleCategoryTable
          key={category}
          isDark={isDark}
          readOnly={readOnly}
          category={category}
          items={catItems}
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
          onOpenRow={openRow}
          onSaveRow={saveRow}
          onCloseRow={() => setExpandedId(null)}
          onPatchDraft={patchDraft}
          onDeleteItem={id => deleteItem(id)}
          onSetConfirmDeleteItemId={setConfirmDeleteItemId}
          onDeleteRuleType={deleteRuleType}
          onSetConfirmDeleteId={setConfirmDeleteId}
          onStartEditLabel={rt => { setEditingLabelId(rt.id); setEditingLabelVal(rt.label); }}
          onEditLabelChange={setEditingLabelVal}
          onSaveLabel={saveLabel}
          onCancelEditLabel={() => setEditingLabelId(null)}
          onOpenBundleModal={openBundleModal}
          onSaveField={(item, field, val) => saveField(item as PriceItem, field as keyof PriceItem, val)}
          onSaveCustomValue={saveCustomValue}
          onPasteBundle={pasteBundle}
        />
      ))}

      {bundleModal && (
        <BundleModal
          item={bundleModal.item}
          prices={prices}
          state={bundleModalState}
          onChange={patch => setBundleModalState(s => ({ ...s, ...patch }))}
          onSave={saveBundleModal}
          onClose={() => setBundleModal(null)}
        />
      )}
    </div>
  );
}
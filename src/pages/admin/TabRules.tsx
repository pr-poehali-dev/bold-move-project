import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import BundleSelector from "./BundleSelector";
import { apiFetch } from "./api";
import { usePriceList } from "./usePriceList";
import type { PriceItem } from "./types";

interface RuleItem extends PriceItem {
  calc_rule: string;
  bundle: string;
}

interface RuleType {
  id: number;
  name: string;
  label: string;
  description: string;
  placeholder: string;
  sort_order: number;
  active: boolean;
}

interface Props { token: string; hint?: string | null; }

function parseBundleIds(bundle: string): number[] {
  try {
    const parsed = JSON.parse(bundle);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === "number")) return parsed;
  } catch { /* */ }
  return [];
}

export default function TabRules({ token, hint }: Props) {
  const { prices, loading, byCategory, saveField, deleteItem } = usePriceList(token);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([]);
  const [ruleValues, setRuleValues] = useState<Record<number, Record<number, string>>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { calc_rule: string; when_condition: string; when_not_condition: string; bundle: string; custom: Record<string, string>; bundleIds: number[]; bundleSearch: string; bundleOpen: boolean }>>({});
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
        bundleIds: parseBundleIds(item.bundle || ""),
        bundleSearch: "",
        bundleOpen: false,
        custom: ruleValues[item.id] ? { ...ruleValues[item.id] } : {},
      },
    }));
  };

  const getDraft = (id: number) => drafts[id];

  const patchDraft = (id: number, patch: Partial<typeof drafts[number]>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveRow = async (item: RuleItem) => {
    const d = getDraft(item.id);
    if (!d) return;
    setSaving(item.id);

    const bundleVal = d.bundleIds.length > 0 ? JSON.stringify(d.bundleIds) : d.bundle;
    const updated = { ...item, calc_rule: d.calc_rule, when_condition: d.when_condition || "", when_not_condition: d.when_not_condition || "" };
    await saveField(item, "calc_rule", d.calc_rule);
    await saveField(updated, "when_condition", d.when_condition || "");
    await saveField(updated, "when_not_condition", d.when_not_condition || "");
    await saveField(updated, "bundle", bundleVal);

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

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-white/50 text-sm">Нажмите на строку — откроется редактор правил для этой позиции.</p>
        <button onClick={() => setAddingRule(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs rounded-lg transition flex-shrink-0">
          <Icon name="Plus" size={13} />
          Добавить правило
        </button>
      </div>

      {addingRule && (
        <div className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-violet-300 text-sm font-semibold flex items-center gap-2">
            <Icon name="Plus" size={14} /> Новое правило расчёта
          </h3>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <span className="text-white/40 text-xs">Название колонки</span>
              <input autoFocus value={newRule.label} onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addRuleType()}
                placeholder="Например: Минимальная площадь"
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[200px]">
              <span className="text-white/40 text-xs">Как AI использует это правило</span>
              <input value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addRuleType()}
                placeholder="Например: если площадь меньше указанной — применять минимальную стоимость"
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRuleType} disabled={addingRuleSaving || !newRule.label.trim()}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
              {addingRuleSaving ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
              Создать правило
            </button>
            <button onClick={() => setAddingRule(false)} className="text-white/40 hover:text-white/70 text-sm transition px-3 py-1.5">Отмена</button>
          </div>
        </div>
      )}

      {hint && (
        <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3">
          <Icon name="ArrowDown" size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-violet-300 font-medium">Позиция «{hint}» добавлена.</span>
            <span className="text-white/50 ml-1">Найдите её ниже и заполните правила расчёта если нужно.</span>
          </div>
        </div>
      )}

      {Object.entries(rulesByCategory).map(([category, catItems]) => (
        <div key={category}>
          <h3 className="text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{category}</h3>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            {/* Заголовок таблицы */}
            <div className="grid border-b border-white/10 px-4 py-2.5"
              style={{ gridTemplateColumns: `1.2fr 1fr 1fr repeat(${activeRuleTypes.length}, 1fr) 32px` }}>
              <span className="text-white/30 text-xs">Позиция</span>
              <span className="text-white/30 text-xs">Добавляется если...</span>
              <span className="text-white/30 text-xs">НЕ добавляется если...</span>
              {activeRuleTypes.map(rt => (
                <div key={rt.id} className="flex items-center gap-1.5 group/col min-w-0">
                  {editingLabelId === rt.id ? (
                    <input
                      autoFocus
                      value={editingLabelVal}
                      onChange={e => setEditingLabelVal(e.target.value)}
                      onBlur={() => saveLabel(rt)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveLabel(rt);
                        if (e.key === "Escape") setEditingLabelId(null);
                      }}
                      className="text-white text-xs bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 outline-none w-full"
                    />
                  ) : (
                    <>
                      <span className="text-white/30 text-xs truncate" title={rt.description}>{rt.label}</span>
                      {rt.name !== "calc_rule" && rt.name !== "bundle" && (
                        <>
                          <button
                            onClick={() => { setEditingLabelId(rt.id); setEditingLabelVal(rt.label); }}
                            className="opacity-0 group-hover/col:opacity-60 hover:!opacity-100 transition text-white/40 hover:text-violet-400 flex-shrink-0">
                            <Icon name="Pencil" size={10} />
                          </button>
                          {confirmDeleteId === rt.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-red-400 text-[10px]">Удалить?</span>
                              <button onClick={() => deleteRuleType(rt.id)}
                                className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 bg-red-500/20 rounded transition">Да</button>
                              <button onClick={() => setConfirmDeleteId(null)}
                                className="text-white/40 hover:text-white/70 text-[10px] px-1.5 py-0.5 bg-white/5 rounded transition">Нет</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(rt.id)}
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
            {catItems.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              const d = getDraft(item.id);
              const isSaving = saving === item.id;

              return (
                <div key={item.id} className={`border-b border-white/5 last:border-0 ${!item.active ? "opacity-40" : ""}`}>
                  {/* Строка-превью */}
                  <div
                    onClick={() => openRow(item)}
                    className={`grid px-4 py-3 cursor-pointer transition items-center gap-2
                      ${idx % 2 ? "bg-white/[0.01]" : ""}
                      ${isExpanded ? "bg-violet-500/10 border-b border-violet-500/20" : "hover:bg-white/[0.04]"}
                    `}
                    style={{ gridTemplateColumns: `1.2fr 1fr 1fr repeat(${activeRuleTypes.length}, 1fr) 32px` }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={12} className="text-white/20 flex-shrink-0" />
                      <span className="text-white/80 text-xs font-medium truncate">{item.name}</span>
                    </div>
                    <span className={`text-xs truncate ${item.when_condition ? "text-white/50" : "text-white/15 italic"}`}>
                      {item.when_condition || "—"}
                    </span>
                    <span className={`text-xs truncate ${item.when_not_condition ? "text-red-400/60" : "text-white/15 italic"}`}>
                      {item.when_not_condition || "—"}
                    </span>
                    {activeRuleTypes.map(rt => {
                      if (rt.name === "bundle") {
                        const ids = parseBundleIds(item.bundle || "");
                        const idToName = Object.fromEntries(prices.map(p => [p.id, p.name]));
                        return (
                          <div
                            key={rt.id}
                            onClick={e => openBundleModal(item, e)}
                            className={`text-xs truncate cursor-pointer rounded px-1.5 py-1 -mx-1.5 transition hover:bg-white/5
                              ${ids.length > 0 ? "text-white/50" : "text-white/15 italic"}`}
                          >
                            {ids.length > 0
                              ? ids.map(id => idToName[id]).filter(Boolean).join(", ")
                              : "не задано"}
                          </div>
                        );
                      }
                      let val = "";
                      if (rt.name === "calc_rule") val = item.calc_rule || "";
                      else val = ruleValues[item.id]?.[rt.id] ?? "";
                      return (
                        <span key={rt.id} className={`text-xs truncate ${val ? "text-white/50" : "text-white/15 italic"}`}>
                          {val || (rt.placeholder || "—")}
                        </span>
                      );
                    })}
                    <div className="flex items-center gap-1 justify-self-end" onClick={e => e.stopPropagation()}>
                      {confirmDeleteItemId === item.id ? (
                        <>
                          <button onClick={() => { deleteItem(item.id); setConfirmDeleteItemId(null); }}
                            className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 bg-red-500/20 rounded transition">Да</button>
                          <button onClick={() => setConfirmDeleteItemId(null)}
                            className="text-white/40 hover:text-white/70 text-[10px] px-1.5 py-0.5 bg-white/5 rounded transition">Нет</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteItemId(item.id)}
                          className="text-white/15 hover:text-red-400 transition p-1">
                          <Icon name="X" size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Раскрытый редактор */}
                  {isExpanded && d && (
                    <div className="bg-white/[0.02] border-b border-white/5 px-5 py-4 flex flex-col gap-4">
                      <p className="text-white/40 text-xs">Правила для <span className="text-violet-300 font-medium">{item.name}</span></p>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                        {/* 1. Добавляется если */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                            <Icon name="CircleCheck" size={11} className="text-green-400" />
                            1. Добавляется если...
                          </label>
                          <textarea
                            value={d.when_condition}
                            onChange={e => patchDraft(item.id, { when_condition: e.target.value })}
                            placeholder={"Например:\n• клиент выбрал ПВХ полотно\n• в смете есть точечные светильники\n• клиент упомянул люстру\n• всегда добавлять"}
                            rows={5}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-green-500/60 resize-none transition placeholder-white/20"
                          />
                        </div>

                        {/* 2. НЕ добавляется если */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                            <Icon name="CircleX" size={11} className="text-red-400" />
                            2. НЕ добавляется если...
                          </label>
                          <textarea
                            value={d.when_not_condition}
                            onChange={e => patchDraft(item.id, { when_not_condition: e.target.value })}
                            placeholder={"Например:\n• клиент выбрал тканевое полотно\n• в смете уже есть теневой профиль\n• клиент написал «без монтажа»"}
                            rows={5}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-red-500/60 resize-none transition placeholder-white/20"
                          />
                        </div>

                        {/* 3. Логика расчёта */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
                            <Icon name="Calculator" size={11} className="text-violet-400" />
                            3. Логика расчёта
                          </label>
                          <textarea
                            value={d.calc_rule}
                            onChange={e => patchDraft(item.id, { calc_rule: e.target.value })}
                            placeholder={"Сколько добавлять и при каких условиях:\n• площадь комнаты\n• периметр × 1.3\n• 1 шт на каждый светильник\n• длина ниши (спросить у клиента)\n• площадь + 30% если высота > 3м"}
                            rows={5}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-violet-500 resize-none transition placeholder-white/20"
                          />
                        </div>
                      </div>

                      {/* Кастомные rule types */}
                      {activeRuleTypes.filter(rt => rt.name !== "calc_rule" && rt.name !== "bundle").map(rt => (
                        <div key={rt.id} className="flex flex-col gap-1.5">
                          <label className="text-white/60 text-xs font-medium">{rt.label}</label>
                          <textarea
                            value={d.custom[rt.id] ?? ""}
                            onChange={e => patchDraft(item.id, { custom: { ...d.custom, [rt.id]: e.target.value } })}
                            placeholder={rt.placeholder || "—"}
                            rows={2}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-violet-500 resize-none transition"
                          />
                        </div>
                      ))}

                      {/* Комплект */}
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
                          onToggleOpen={() => patchDraft(item.id, { bundleOpen: !d.bundleOpen })}
                          onBundleSearchChange={v => patchDraft(item.id, { bundleSearch: v })}
                          onToggleItem={id => patchDraft(item.id, {
                            bundleIds: d.bundleIds.includes(id) ? d.bundleIds.filter(x => x !== id) : [...d.bundleIds, id]
                          })}
                          onRemoveItem={id => patchDraft(item.id, { bundleIds: d.bundleIds.filter(x => x !== id) })}
                        />
                      </div>

                      <div className="flex gap-2 pt-1 border-t border-white/5">
                        <button onClick={() => saveRow(item)} disabled={isSaving}
                          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5">
                          {isSaving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                          Сохранить
                        </button>
                        <button onClick={() => setExpandedId(null)} className="text-white/40 hover:text-white/70 text-xs transition px-3 py-2">Отмена</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Модальное окно выбора комплекта */}
      {bundleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-[#13131f] border border-violet-500/30 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-white text-sm font-semibold">Логика привязки комплектов</h3>
                <p className="text-white/40 text-xs mt-0.5">Позиции которые добавятся вместе с <span className="text-violet-300">{bundleModal.item.name}</span></p>
              </div>
              <button onClick={() => setBundleModal(null)} className="text-white/30 hover:text-white/70 transition flex-shrink-0">
                <Icon name="X" size={16} />
              </button>
            </div>

            <BundleSelector
              prices={prices}
              selectedPriceId={bundleModal.item.id}
              excludeId={bundleModal.item.id}
              bundleIds={bundleModalState.ids}
              bundleSearch={bundleModalState.search}
              bundleOpen={bundleModalState.open}
              onToggleOpen={() => setBundleModalState(s => ({ ...s, open: !s.open }))}
              onBundleSearchChange={v => setBundleModalState(s => ({ ...s, search: v }))}
              onToggleItem={id => setBundleModalState(s => ({
                ...s, ids: s.ids.includes(id) ? s.ids.filter(x => x !== id) : [...s.ids, id]
              }))}
              onRemoveItem={id => setBundleModalState(s => ({ ...s, ids: s.ids.filter(x => x !== id) }))}
            />

            <div className="flex gap-2 pt-2 border-t border-white/5">
              <button onClick={saveBundleModal}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                <Icon name="Check" size={14} /> Сохранить
              </button>
              <button onClick={() => setBundleModal(null)}
                className="text-white/40 hover:text-white/70 text-sm transition px-4 py-2.5">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
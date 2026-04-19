import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import EditableCell from "./EditableCell";
import { apiFetch } from "./api";
import { usePriceList } from "./usePriceList";
import { EMPTY_BUNDLE } from "./constants";
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

const BUILTIN = new Set(["calc_rule", "bundle"]);

function parseBundleIds(bundle: string): number[] {
  try {
    const parsed = JSON.parse(bundle);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === "number")) return parsed;
  } catch { /* */ }
  return [];
}

function BundleCell({ item, prices, onSave }: { item: RuleItem; prices: PriceItem[]; onSave: (v: string) => void }) {
  const ids = parseBundleIds(item.bundle);
  if (ids.length > 0) {
    const idToName = Object.fromEntries(prices.map(p => [p.id, p.name]));
    const names = ids.map(id => idToName[id]).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1">
        {names.map(n => (
          <span key={n} className="inline-flex items-center gap-1 text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
            <Icon name="Package" size={9} />{n}
          </span>
        ))}
      </div>
    );
  }
  return <EditableCell value={item.bundle === EMPTY_BUNDLE ? "" : (item.bundle || "")} onSave={onSave} placeholder="Например: добавить Лампа GX53" />;
}

export default function TabRules({ token, hint }: Props) {
  const { prices, loading, byCategory } = usePriceList(token);
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([]);
  const [ruleValues, setRuleValues] = useState<Record<number, Record<number, string>>>({});
  const [addingRule, setAddingRule] = useState(false);
  const [newRule, setNewRule] = useState({ label: "", description: "", placeholder: "" });
  const [saving, setSaving] = useState(false);

  const loadRuleTypes = useCallback(async () => {
    const r = await apiFetch("rule-types");
    if (r.ok) { const d = await r.json(); setRuleTypes(d.items); }
  }, []);

  useEffect(() => { loadRuleTypes(); }, [loadRuleTypes]);

  const loadValuesForPrice = async (priceId: number) => {
    if (ruleValues[priceId]) return;
    const r = await apiFetch("rule-values", {}, token, priceId);
    if (r.ok) {
      const d = await r.json();
      setRuleValues(prev => ({ ...prev, [priceId]: d.values }));
    }
  };

  const saveBuiltin = async (item: RuleItem, field: "calc_rule" | "bundle", val: string) => {
    await apiFetch("prices", { method: "PUT", body: JSON.stringify({ ...item, [field]: val }) }, token, item.id);
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
    setSaving(true);
    const r = await apiFetch("rule-types", { method: "POST", body: JSON.stringify(newRule) }, token);
    if (r.ok) { await loadRuleTypes(); setAddingRule(false); setNewRule({ label: "", description: "", placeholder: "" }); }
    setSaving(false);
  };

  const customRules = ruleTypes.filter(rt => !BUILTIN.has(rt.name) && rt.active);
  const rulesByCategory = Object.fromEntries(
    Object.entries(byCategory).map(([cat, items]) => [cat, items as RuleItem[]])
  );

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-white/50 text-sm">Нажмите на ячейку — редактируется мгновенно. Пишите инструкцию для AI в свободной форме.</p>
        <button onClick={() => setAddingRule(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs rounded-lg transition flex-shrink-0">
          <Icon name="Plus" size={13} />
          Добавить правило
        </button>
      </div>

      {/* Форма добавления нового правила */}
      {addingRule && (
        <div className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-violet-300 text-sm font-semibold flex items-center gap-2">
            <Icon name="Plus" size={14} /> Новое правило расчёта
          </h3>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <span className="text-white/40 text-xs">Название колонки</span>
              <input autoFocus value={newRule.label} onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))}
                placeholder="Например: Минимальная площадь"
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[200px]">
              <span className="text-white/40 text-xs">Подсказка для заполнения</span>
              <input value={newRule.placeholder} onChange={e => setNewRule(p => ({ ...p, placeholder: e.target.value }))}
                placeholder="Например: Мин. 3 м²"
                className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-white/40 text-xs">Описание (как AI использует это правило)</span>
            <input value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
              placeholder="Например: Если площадь меньше указанной — применять минимальную стоимость"
              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-violet-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={addRuleType} disabled={saving || !newRule.label.trim()}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
              {saving ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[20%]">Позиция</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[35%]">Если не указано количество — считать как</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[25%]">Логика привязки комплектов</th>
                  {customRules.map(rt => (
                    <th key={rt.id} className="text-left text-white/30 font-normal px-4 py-2.5">
                      <span title={rt.description}>{rt.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catItems.map((item, idx) => (
                  <tr key={item.id}
                    onMouseEnter={() => loadValuesForPrice(item.id)}
                    className={`border-b border-white/5 last:border-0 ${!item.active ? "opacity-40" : ""} ${idx % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-4 py-2.5 text-white/70 text-xs">{item.name}</td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">
                      <EditableCell value={item.calc_rule || ""} onSave={v => saveBuiltin(item, "calc_rule", v)}
                        placeholder="Например: area * 1.0" />
                    </td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">
                      <BundleCell item={item} prices={prices} onSave={v => saveBuiltin(item, "bundle", v)} />
                    </td>
                    {customRules.map(rt => (
                      <td key={rt.id} className="px-4 py-2.5 text-white/50 text-xs">
                        <EditableCell
                          value={ruleValues[item.id]?.[rt.id] ?? ""}
                          onSave={v => saveCustomValue(item.id, rt.id, v)}
                          placeholder={rt.placeholder || "—"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

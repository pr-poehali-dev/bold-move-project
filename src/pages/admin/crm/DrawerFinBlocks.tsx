import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

// ── Правила авто-расчёта ────────────────────────────────────────────────────
const LS_AUTO_RULES = "crm_costs_auto_rules";

interface AutoRule {
  id: string;
  label: string;
  pct: number | null;
  enabled: boolean;
  color: string;
  icon: string;
}

interface AutoRules {
  measure_pct: number | null;
  install_pct: number | null;
  measure_enabled?: boolean;
  install_enabled?: boolean;
  custom?: AutoRule[];
}

function loadAutoRules(): AutoRules {
  try { return { measure_pct: null, install_pct: null, measure_enabled: true, install_enabled: true, custom: [], ...JSON.parse(localStorage.getItem(LS_AUTO_RULES) || "{}") }; }
  catch { return { measure_pct: null, install_pct: null, measure_enabled: true, install_enabled: true, custom: [] }; }
}
function saveAutoRules(r: AutoRules) {
  localStorage.setItem(LS_AUTO_RULES, JSON.stringify(r));
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: enabled ? "#ef4444" : "rgba(255,255,255,0.12)" }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: enabled ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

interface BuiltinRule {
  label: string; pct: number | null; enabled: boolean; color: string; icon: string;
  setPct: (v: number | null) => void; setEnabled: (v: boolean) => void;
}

// ── Модальное окно настройки правил ────────────────────────────────────────
function AutoRulesModal({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [rules, setRules] = useState<AutoRules>(loadAutoRules);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPct, setNewPct] = useState<string>("");

  const save = () => { saveAutoRules(rules); onClose(); };

  const addCustomRule = () => {
    if (!newLabel.trim()) return;
    const newRule: AutoRule = {
      id: `rule_${Date.now()}`,
      label: newLabel.trim(),
      pct: newPct === "" ? null : +newPct,
      enabled: true,
      color: "#8b5cf6",
      icon: "Hash",
    };
    setRules(r => ({ ...r, custom: [...(r.custom || []), newRule] }));
    setNewLabel(""); setNewPct(""); setAddingNew(false);
  };

  const updateCustom = (id: string, patch: Partial<AutoRule>) =>
    setRules(r => ({ ...r, custom: (r.custom || []).map(c => c.id === id ? { ...c, ...patch } : c) }));

  const deleteCustom = (id: string) =>
    setRules(r => ({ ...r, custom: (r.custom || []).filter(c => c.id !== id) }));

  const allRules: BuiltinRule[] = [
    { label: "Замер", pct: rules.measure_pct, enabled: rules.measure_enabled ?? true, color: "#f59e0b", icon: "Ruler",
      setPct: (v: number | null) => setRules(r => ({ ...r, measure_pct: v })),
      setEnabled: (v: boolean) => setRules(r => ({ ...r, measure_enabled: v })) },
    { label: "Монтаж", pct: rules.install_pct, enabled: rules.install_enabled ?? true, color: "#ef4444", icon: "Wrench",
      setPct: (v: number | null) => setRules(r => ({ ...r, install_pct: v })),
      setEnabled: (v: boolean) => setRules(r => ({ ...r, install_enabled: v })) },
  ];

  const exampleSum = 100000;
  const hasAny = allRules.some(r => r.enabled && r.pct) || (rules.custom || []).some(c => c.enabled && c.pct);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#ef444420" }}>
              <Icon name="Percent" size={14} style={{ color: "#ef4444" }} />
            </div>
            <span className="text-sm font-bold" style={{ color: t.text }}>Правила авто-расчёта</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Тело */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-xs leading-relaxed" style={{ color: t.textMute }}>
            Укажите процент от суммы договора. Слайдер включает или выключает правило для всех карточек.
          </p>

          <div className="space-y-2">
            {/* Встроенные правила */}
            {allRules.map(rule => (
              <div key={rule.label} className="rounded-xl p-3" style={{ background: t.surface2, border: `1px solid ${rule.enabled ? rule.color + "40" : t.border}`, opacity: rule.enabled ? 1 : 0.5 }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: rule.color }}>
                    <Icon name={rule.icon} size={12} /> {rule.label}
                  </label>
                  <Toggle enabled={rule.enabled} onChange={rule.setEnabled} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100}
                    value={rule.pct ?? ""}
                    onChange={e => rule.setPct(e.target.value === "" ? null : +e.target.value)}
                    disabled={!rule.enabled}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                    placeholder="0"
                  />
                  <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                  <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
                </div>
              </div>
            ))}

            {/* Кастомные правила */}
            {(rules.custom || []).map(rule => (
              <div key={rule.id} className="rounded-xl p-3" style={{ background: t.surface2, border: `1px solid ${rule.enabled ? rule.color + "40" : t.border}`, opacity: rule.enabled ? 1 : 0.5 }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: rule.color }}>
                    <Icon name={rule.icon} size={12} /> {rule.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <Toggle enabled={rule.enabled} onChange={v => updateCustom(rule.id, { enabled: v })} />
                    <button onClick={() => deleteCustom(rule.id)} className="opacity-40 hover:opacity-80 transition" style={{ color: t.textMute }}>
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100}
                    value={rule.pct ?? ""}
                    onChange={e => updateCustom(rule.id, { pct: e.target.value === "" ? null : +e.target.value })}
                    disabled={!rule.enabled}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                    placeholder="0"
                  />
                  <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                  <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
                </div>
              </div>
            ))}

            {/* Форма добавления нового */}
            {addingNew ? (
              <div className="rounded-xl p-3 space-y-2" style={{ background: t.surface2, border: "1px solid #8b5cf640" }}>
                <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="Название (напр. Материалы)"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={100} value={newPct}
                    onChange={e => setNewPct(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addCustomRule(); if (e.key === "Escape") setAddingNew(false); }}
                    placeholder="0"
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }} />
                  <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                  <button onClick={addCustomRule} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "#8b5cf6" }}>ОК</button>
                  <button onClick={() => { setAddingNew(false); setNewLabel(""); setNewPct(""); }} className="text-xs opacity-40 hover:opacity-70" style={{ color: t.textMute }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingNew(true)}
                className="flex items-center gap-1.5 text-xs opacity-50 hover:opacity-90 transition mt-1"
                style={{ color: "#8b5cf6" }}>
                <Icon name="Plus" size={13} /> Добавить правило
              </button>
            )}
          </div>

          {/* Пример */}
          {hasAny && (
            <div className="rounded-xl px-3 py-2.5 text-xs space-y-1" style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
              <div className="font-medium mb-1" style={{ color: "#ef4444" }}>Пример при договоре 100 000 ₽:</div>
              {allRules.filter(r => r.enabled && r.pct).map(r => (
                <div key={r.label} style={{ color: t.textMute }}>{r.label} = {(exampleSum * (r.pct!) / 100).toLocaleString("ru-RU")} ₽</div>
              ))}
              {(rules.custom || []).filter(c => c.enabled && c.pct).map(c => (
                <div key={c.id} style={{ color: t.textMute }}>{c.label} = {(exampleSum * (c.pct!) / 100).toLocaleString("ru-RU")} ₽</div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 pb-5 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={save}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "#ef4444" }}>
            Сохранить
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm transition"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const LS_FIN_LABELS = "crm_fin_row_labels";

function loadFinLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_FIN_LABELS) || "{}"); } catch { return {}; }
}
function saveFinLabel(key: string, label: string) {
  const curr = loadFinLabels();
  curr[key] = label;
  localStorage.setItem(LS_FIN_LABELS, JSON.stringify(curr));
}

interface FinBlockProps {
  data: Client;
  editingBlock: BlockId | null;
  hiddenBlocks: Set<BlockId>;
  rowVisibility: Record<string, boolean>;
  customFinRows: CustomFinRow[];
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  saveWithLog: (patch: Partial<Client>, logText: string, icon?: string, color?: string) => void;
  logAction: (icon: string, color: string, text: string) => void;
  toggleRowVisibility: (key: string) => void;
  addCustomFinRow: (label: string, block: "income" | "costs") => void;
  deleteCustomFinRow: (key: string) => void;
  updateCustomFinRow: (key: string, label: string) => void;
}

export function DrawerIncomeBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
}: FinBlockProps) {
  const id: BlockId = "income";
  const isHidden = hiddenBlocks.has(id);
  const incomeEdit = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadFinLabels);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  return (
    <Section icon="Banknote" title="Доходы" color="#10b981"
      hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(incomeEdit ? null : id) : undefined}>

      {(["contract_sum", "prepayment", "extra_payment"] as const).filter(key => rowVisibility[key] !== false).map(key => {
        const defs: Record<string, { def: string; save: (v: string) => void }> = {
          contract_sum:  { def: "Сумма договора", save: v => saveWithLog({ contract_sum:  +v || null } as Partial<Client>, `Договор: ${(+v).toLocaleString("ru-RU")} ₽`,   "FileText", "#10b981") },
          prepayment:    { def: "Предоплата",     save: v => saveWithLog({ prepayment:    +v || null } as Partial<Client>, `Предоплата: +${(+v).toLocaleString("ru-RU")} ₽`, "Wallet",   "#10b981") },
          extra_payment: { def: "Доплата",        save: v => saveWithLog({ extra_payment: +v || null } as Partial<Client>, `Доплата: +${(+v).toLocaleString("ru-RU")} ₽`,   "Wallet",   "#10b981") },
        };
        return (
          <RowWithToggle key={key} rowKey={key} visible onToggle={() => {}} editMode={incomeEdit}
            editableLabel={getLabel(key, defs[key].def)} onLabelChange={l => renameLabel(key, l)}
            onDelete={() => toggleRowVisibility(key)}>
            <InlineField label={getLabel(key, defs[key].def)} value={data[key]} onSave={defs[key].save} type="number" placeholder="—" />
          </RowWithToggle>
        );
      })}

      {customFinRows.filter(r => r.block === "income" && rowVisibility[r.key] !== false).map(r => {
        const lsKey = `fin_row_${data.id}_${r.key}`;
        const val = localStorage.getItem(lsKey) || "";
        return (
          <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={incomeEdit}
            editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}
            onDelete={() => { deleteCustomFinRow(r.key); }}>
            <InlineField label={r.label} value={val} type="number" placeholder="—"
              onSave={v => { localStorage.setItem(lsKey, v); logAction("Plus", "#10b981", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
          </RowWithToggle>
        );
      })}

      <AddFinRowInline block="income" onAdd={addCustomFinRow}
        forceOpen={incomeEdit}
        onClose={() => setEditingBlock(null)} />
    </Section>
  );
}

export function DrawerCostsBlock({
  data, editingBlock, hiddenBlocks, rowVisibility, customFinRows,
  toggleHidden, setEditingBlock, saveWithLog, logAction,
  toggleRowVisibility, addCustomFinRow, deleteCustomFinRow, updateCustomFinRow,
}: FinBlockProps) {
  const t = useTheme();
  const id: BlockId = "costs";
  const isHidden = hiddenBlocks.has(id);
  const costsEdit = editingBlock === id;
  const [labels, setLabels] = useState<Record<string, string>>(loadFinLabels);
  const [showRules, setShowRules] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const getLabel = (key: string, def: string) => labels[key] || def;
  const renameLabel = (key: string, label: string) => {
    setLabels(prev => ({ ...prev, [key]: label }));
    saveFinLabel(key, label);
  };

  const contractSum = Number(data.contract_sum) || 0;
  const rules = loadAutoRules();
  const hasRules = (rules.measure_enabled !== false && rules.measure_pct != null)
    || (rules.install_enabled !== false && rules.install_pct != null)
    || (rules.custom || []).some(c => c.enabled && c.pct != null);

  const applyAutoWithSum = (sum: number) => {
    if (!sum) return;
    const r = loadAutoRules();
    const patch: Partial<Client> = {};
    if (r.measure_enabled !== false && r.measure_pct != null)
      (patch as Record<string, unknown>).measure_cost = Math.round(sum * r.measure_pct / 100);
    if (r.install_enabled !== false && r.install_pct != null)
      (patch as Record<string, unknown>).install_cost = Math.round(sum * r.install_pct / 100);
    if (Object.keys(patch).length > 0) {
      saveWithLog(patch, "Авто-расчёт затрат по правилу", "Zap", "#ef4444");
      setAutoFilled(true);
    }
  };

  const applyAuto = () => applyAutoWithSum(contractSum);

  // Автоматически применять правила при первом появлении суммы договора
  const autoAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${data.id}_${contractSum}`;
    if (contractSum > 0 && autoAppliedRef.current !== key && hasRules
      && !data.measure_cost && !data.install_cost) {
      autoAppliedRef.current = key;
      applyAutoWithSum(contractSum);
    }
  }, [data.id, contractSum]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showRules && <AutoRulesModal onClose={() => setShowRules(false)} />}

      <Section icon="Receipt" title="Затраты" color="#ef4444"
        hidden={isHidden}
        onToggleHidden={() => toggleHidden(id)}
        onEdit={!isHidden ? () => setEditingBlock(costsEdit ? null : id) : undefined}>

        {/* Кнопки авто-расчёта */}
        {!isHidden && (
          <div className="flex items-center gap-1.5 pt-2 pb-1">
            <button
              onClick={applyAuto}
              disabled={!hasRules || !contractSum}
              title={!contractSum ? "Сначала укажите сумму договора" : !hasRules ? "Настройте правило (шестерёнка)" : "Авто-расчёт по правилу"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-30"
              style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
              <Icon name="Zap" size={11} />
              Авто
            </button>
            <button
              onClick={() => setShowRules(true)}
              title="Настроить правила авто-расчёта"
              className="p-1 rounded-lg transition hover:bg-white/5"
              style={{ color: "#6b7280" }}>
              <Icon name="Settings2" size={13} />
            </button>
            {!hasRules && (
              <span className="text-[10px]" style={{ color: "#6b7280" }}>Настройте правило →</span>
            )}
          </div>
        )}

        {/* Предупреждение об авто-заполнении */}
        {autoFilled && !isHidden && (
          <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 mb-1"
            style={{ background: "#ef444412", border: "1px solid #ef444430" }}>
            <Icon name="Zap" size={12} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1">
              <span className="text-[11px] leading-relaxed" style={{ color: "#fca5a5" }}>
                Замер и Монтаж заполнены автоматически по правилу ({rules.measure_pct ?? 0}% / {rules.install_pct ?? 0}%).
                Вы можете изменить значения вручную.
              </span>
            </div>
            <button onClick={() => setAutoFilled(false)} style={{ color: "#ef444460" }}>
              <Icon name="X" size={11} />
            </button>
          </div>
        )}

        {(["material_cost", "measure_cost", "install_cost"] as const).map(key => {
          const defs: Record<string, { def: string; save: (v: string) => void }> = {
            material_cost: { def: "Материалы", save: v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`,   "Package", "#ef4444") },
            measure_cost:  { def: "Замер",     save: v => { saveWithLog({ measure_cost:  +v || null } as Partial<Client>, `Замер стоит: ${(+v).toLocaleString("ru-RU")} ₽`, "Ruler",   "#ef4444"); setAutoFilled(false); } },
            install_cost:  { def: "Монтаж",    save: v => { saveWithLog({ install_cost:  +v || null } as Partial<Client>, `Монтаж стоит: ${(+v).toLocaleString("ru-RU")} ₽`,"Wrench",  "#ef4444"); setAutoFilled(false); } },
          };
          return rowVisibility[key] === false ? null : (
            <RowWithToggle key={key} rowKey={key} visible onToggle={() => {}} editMode={costsEdit}
              editableLabel={getLabel(key, defs[key].def)} onLabelChange={l => renameLabel(key, l)}
              onDelete={() => toggleRowVisibility(key)}>
              <InlineField label={getLabel(key, defs[key].def)} value={data[key]} onSave={defs[key].save} type="number" placeholder="—" />
            </RowWithToggle>
          );
        })}

        {customFinRows.filter(r => r.block === "costs" && rowVisibility[r.key] !== false).map(r => {
          const lsKey = `fin_row_${data.id}_${r.key}`;
          const val = localStorage.getItem(lsKey) || "";
          return (
            <RowWithToggle key={r.key} rowKey={r.key} visible onToggle={() => {}} editMode={costsEdit}
              editableLabel={r.label} onLabelChange={label => updateCustomFinRow(r.key, label)}
              onDelete={() => { deleteCustomFinRow(r.key); }}>
              <InlineField label={r.label} value={val} type="number" placeholder="—"
                onSave={v => { localStorage.setItem(lsKey, v); logAction("Minus", "#ef4444", `${r.label}: ${(+v).toLocaleString("ru-RU")} ₽`); }} />
            </RowWithToggle>
          );
        })}

        <AddFinRowInline block="costs" onAdd={addCustomFinRow}
          forceOpen={costsEdit}
          onClose={() => setEditingBlock(null)} />
      </Section>
    </>
  );
}
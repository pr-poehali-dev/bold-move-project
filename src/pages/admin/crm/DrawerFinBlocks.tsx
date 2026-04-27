import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

// ── Правила авто-расчёта ────────────────────────────────────────────────────
// Структура: { [rowKey]: { pct: number|null, enabled: boolean } }
const LS_AUTO_RULES = "crm_costs_auto_rules_v2";
const LS_AUTO_MODE  = "crm_costs_auto_mode"; // глобальный авто-режим

interface RuleEntry { pct: number | null; enabled: boolean; }
type AutoRulesMap = Record<string, RuleEntry>;

function loadAutoRules(): AutoRulesMap {
  try {
    const v = JSON.parse(localStorage.getItem(LS_AUTO_RULES) || "{}");
    return typeof v === "object" && v !== null ? v : {};
  } catch { return {}; }
}
function saveAutoRules(r: AutoRulesMap) {
  localStorage.setItem(LS_AUTO_RULES, JSON.stringify(r));
}
function loadAutoMode(): boolean {
  return localStorage.getItem(LS_AUTO_MODE) === "true";
}
function saveAutoMode(v: boolean) {
  localStorage.setItem(LS_AUTO_MODE, String(v));
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

// Строка затраты для отображения в модалке
interface CostRowDef { key: string; label: string; }

// ── Модальное окно настройки правил ────────────────────────────────────────
function AutoRulesModal({ onClose, costRows }: { onClose: () => void; costRows: CostRowDef[] }) {
  const t = useTheme();
  const [rules, setRules] = useState<AutoRulesMap>(loadAutoRules);
  const [autoMode, setAutoMode] = useState<boolean>(loadAutoMode);

  const save = () => { saveAutoRules(rules); saveAutoMode(autoMode); onClose(); };

  const getEntry = (key: string): RuleEntry =>
    rules[key] ?? { pct: null, enabled: true };

  const setEntry = (key: string, patch: Partial<RuleEntry>) =>
    setRules(r => ({ ...r, [key]: { ...getEntry(key), ...patch } }));

  const deleteEntry = (key: string) =>
    setRules(r => { const next = { ...r }; delete next[key]; return next; });

  const exampleSum = 100000;
  const hasAny = costRows.some(row => {
    const e = getEntry(row.key);
    return e.enabled && e.pct != null && e.pct > 0;
  });

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
          <div className="flex items-center gap-2">
            {/* Глобальный авто-режим */}
            <Toggle enabled={autoMode} onChange={setAutoMode} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        {/* Авто-режим подсказка */}
        <div className="px-5 pt-3 pb-0">
          <div className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: autoMode ? "#ef444415" : "rgba(255,255,255,0.04)", border: `1px solid ${autoMode ? "#ef444430" : t.border}` }}>
            <Icon name="Zap" size={13} style={{ color: autoMode ? "#ef4444" : t.textMute, flexShrink: 0 }} />
            <span className="text-xs leading-relaxed" style={{ color: autoMode ? "#fca5a5" : t.textMute }}>
              {autoMode
                ? "Авто-режим включён — правила применяются сразу при изменении суммы договора"
                : "Авто-режим выключен — нажмите «Авто» вручную в блоке затрат"}
            </span>
          </div>
        </div>

        {/* Тело */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-xs leading-relaxed" style={{ color: t.textMute }}>
            Укажите % от суммы договора для каждой затраты. Слайдер включает или выключает правило для всех карточек.
          </p>

          {costRows.length === 0 && (
            <div className="text-xs text-center py-4 opacity-40" style={{ color: t.textMute }}>
              Добавьте строки затрат в карточку — они появятся здесь
            </div>
          )}

          <div className="space-y-2">
            {costRows.map(row => {
              const entry = getEntry(row.key);
              return (
                <div key={row.key} className="rounded-xl p-3"
                  style={{ background: t.surface2, border: `1px solid ${entry.enabled ? "#ef444440" : t.border}`, opacity: entry.enabled ? 1 : 0.55 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: "#ef4444" }}>{row.label}</span>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={entry.enabled} onChange={v => setEntry(row.key, { enabled: v })} />
                      <button onClick={() => deleteEntry(row.key)}
                        title="Удалить правило"
                        className="opacity-30 hover:opacity-70 transition" style={{ color: t.textMute }}>
                        <Icon name="Trash2" size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={100}
                      value={entry.pct ?? ""}
                      onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                      disabled={!entry.enabled}
                      className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                      placeholder="0"
                    />
                    <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                    <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Пример */}
          {hasAny && (
            <div className="rounded-xl px-3 py-2.5 text-xs space-y-1" style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
              <div className="font-medium mb-1" style={{ color: "#ef4444" }}>Пример при договоре 100 000 ₽:</div>
              {costRows.map(row => {
                const e = getEntry(row.key);
                if (!e.enabled || !e.pct) return null;
                return <div key={row.key} style={{ color: t.textMute }}>{row.label} = {(exampleSum * e.pct / 100).toLocaleString("ru-RU")} ₽</div>;
              })}
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

  // Метки встроенных строк затрат
  const BUILTIN_COST_DEFS: Record<string, string> = {
    material_cost: "Материалы",
    measure_cost:  "Замер",
    install_cost:  "Монтаж",
  };

  // Список всех видимых строк затрат для модалки правил
  const costRows: CostRowDef[] = [
    ...(["material_cost", "measure_cost", "install_cost"] as const)
      .filter(key => rowVisibility[key] !== false)
      .map(key => ({ key, label: getLabel(key, BUILTIN_COST_DEFS[key]) })),
    ...customFinRows
      .filter(r => r.block === "costs" && rowVisibility[r.key] !== false)
      .map(r => ({ key: r.key, label: r.label })),
  ];

  const contractSum = Number(data.contract_sum) || 0;
  const rulesMap = loadAutoRules();

  // Есть ли хоть одно включённое правило с процентом для видимых строк
  const hasRules = costRows.some(row => {
    const e = rulesMap[row.key];
    return e && e.enabled && e.pct != null && e.pct > 0;
  });

  // Применить авто-расчёт: встроенные строки — через saveWithLog, кастомные — в localStorage
  const applyAutoWithSum = (sum: number) => {
    if (!sum) return;
    const r = loadAutoRules();
    const patch: Partial<Client> = {};
    let hasCustom = false;

    costRows.forEach(row => {
      const e = r[row.key];
      if (!e || !e.enabled || !e.pct) return;
      const val = Math.round(sum * e.pct / 100);
      if (row.key === "material_cost" || row.key === "measure_cost" || row.key === "install_cost") {
        (patch as Record<string, unknown>)[row.key] = val;
      } else {
        localStorage.setItem(`fin_row_${data.id}_${row.key}`, String(val));
        hasCustom = true;
      }
    });

    if (Object.keys(patch).length > 0) {
      saveWithLog(patch, "Авто-расчёт затрат по правилу", "Zap", "#ef4444");
    } else if (hasCustom) {
      logAction("Zap", "#ef4444", "Авто-расчёт затрат по правилу");
    }
    if (Object.keys(patch).length > 0 || hasCustom) setAutoFilled(true);
  };

  const applyAuto = () => applyAutoWithSum(contractSum);

  // Авто-применение при изменении суммы договора (если авто-режим включён)
  const prevContractSumRef = useRef<number>(contractSum);
  useEffect(() => {
    if (!contractSum || !hasRules) { prevContractSumRef.current = contractSum; return; }
    const autoMode = loadAutoMode();
    if (autoMode && contractSum !== prevContractSumRef.current) {
      applyAutoWithSum(contractSum);
    }
    prevContractSumRef.current = contractSum;
  }, [data.id, contractSum]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showRules && <AutoRulesModal onClose={() => setShowRules(false)} costRows={costRows} />}

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
                Затраты заполнены автоматически по правилу. Можно изменить вручную.
              </span>
            </div>
            <button onClick={() => setAutoFilled(false)} style={{ color: "#ef444460" }}>
              <Icon name="X" size={11} />
            </button>
          </div>
        )}

        {(["material_cost", "measure_cost", "install_cost"] as const).map(key => {
          const defs: Record<string, { def: string; save: (v: string) => void }> = {
            material_cost: { def: "Материалы", save: v => saveWithLog({ material_cost: +v || null } as Partial<Client>, `Материалы: ${(+v).toLocaleString("ru-RU")} ₽`,    "Package", "#ef4444") },
            measure_cost:  { def: "Замер",     save: v => { saveWithLog({ measure_cost:  +v || null } as Partial<Client>, `Замер: ${(+v).toLocaleString("ru-RU")} ₽`,  "Ruler",   "#ef4444"); setAutoFilled(false); } },
            install_cost:  { def: "Монтаж",    save: v => { saveWithLog({ install_cost:  +v || null } as Partial<Client>, `Монтаж: ${(+v).toLocaleString("ru-RU")} ₽`, "Wrench",  "#ef4444"); setAutoFilled(false); } },
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
import { useState } from "react";
import { Client } from "./crmApi";
import { InlineField, Section } from "./drawerComponents";
import { BlockId, CustomFinRow } from "./drawerTypes";
import { AddFinRowInline, RowWithToggle } from "./DrawerFinRowHelpers";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

// ── Правила авто-расчёта ────────────────────────────────────────────────────
const LS_AUTO_RULES = "crm_costs_auto_rules";

interface AutoRules {
  measure_pct: number | null;   // % от суммы договора
  install_pct: number | null;
}

function loadAutoRules(): AutoRules {
  try { return { measure_pct: null, install_pct: null, ...JSON.parse(localStorage.getItem(LS_AUTO_RULES) || "{}") }; }
  catch { return { measure_pct: null, install_pct: null }; }
}
function saveAutoRules(r: AutoRules) {
  localStorage.setItem(LS_AUTO_RULES, JSON.stringify(r));
}

// ── Модальное окно настройки правил ────────────────────────────────────────
function AutoRulesModal({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [rules, setRules] = useState<AutoRules>(loadAutoRules);

  const save = () => { saveAutoRules(rules); onClose(); };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4"
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
            <span className="text-sm font-bold text-white">Правила авто-расчёта</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Тело */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs leading-relaxed" style={{ color: t.textMute }}>
            Укажите процент от суммы договора. При нажатии кнопки <strong style={{ color: "#ef4444" }}>«Авто»</strong> в блоке Затрат значения Замера и Монтажа заполнятся автоматически.
          </p>

          <div className="space-y-3">
            {/* Замер */}
            <div className="rounded-xl p-3" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              <label className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
                <Icon name="Ruler" size={12} /> Замер
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100}
                  value={rules.measure_pct ?? ""}
                  onChange={e => setRules(r => ({ ...r, measure_pct: e.target.value === "" ? null : +e.target.value }))}
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                  placeholder="0"
                />
                <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
              </div>
            </div>

            {/* Монтаж */}
            <div className="rounded-xl p-3" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              <label className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#ef4444" }}>
                <Icon name="Wrench" size={12} /> Монтаж
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100}
                  value={rules.install_pct ?? ""}
                  onChange={e => setRules(r => ({ ...r, install_pct: e.target.value === "" ? null : +e.target.value }))}
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                  placeholder="0"
                />
                <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
              </div>
            </div>
          </div>

          {/* Пример */}
          {(rules.measure_pct || rules.install_pct) && (
            <div className="rounded-xl px-3 py-2.5 text-xs space-y-1" style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
              <div className="font-medium mb-1" style={{ color: "#ef4444" }}>Пример при договоре 100 000 ₽:</div>
              {rules.measure_pct != null && <div style={{ color: t.textMute }}>Замер = {(100000 * rules.measure_pct / 100).toLocaleString("ru-RU")} ₽</div>}
              {rules.install_pct != null && <div style={{ color: t.textMute }}>Монтаж = {(100000 * rules.install_pct / 100).toLocaleString("ru-RU")} ₽</div>}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 pb-5 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={save}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "#ef4444" }}>
            Сохранить правило
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm transition"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
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
  const hasRules = rules.measure_pct != null || rules.install_pct != null;

  const applyAuto = () => {
    if (!contractSum) return;
    const patch: Partial<Client> = {};
    if (rules.measure_pct != null) (patch as Record<string, unknown>).measure_cost = Math.round(contractSum * rules.measure_pct / 100);
    if (rules.install_pct != null) (patch as Record<string, unknown>).install_cost = Math.round(contractSum * rules.install_pct / 100);
    saveWithLog(patch, "Авто-расчёт затрат по правилу", "Zap", "#ef4444");
    setAutoFilled(true);
  };

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
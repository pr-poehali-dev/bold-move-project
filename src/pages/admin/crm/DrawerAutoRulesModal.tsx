import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

export const LS_AUTO_RULES   = "crm_costs_auto_rules_v2";
export const LS_INCOME_RULES = "crm_income_auto_rules_v1";
export const LS_AUTO_MODE    = "crm_costs_auto_mode";
export const LS_CUSTOM_COST_ROWS_MODAL   = "crm_auto_custom_cost_rows";
export const LS_CUSTOM_INCOME_ROWS_MODAL = "crm_auto_custom_income_rows";

export interface RuleEntry {
  pct: number | null;
  enabled: boolean;  // применять в расчёте
  visible: boolean;  // показывать в карточке / P&L
}
export type AutoRulesMap = Record<string, RuleEntry>;

export interface CostRowDef { key: string; label: string; }

// ── Загрузка / сохранение ─────────────────────────────────────────────────
export function loadAutoRules(): AutoRulesMap {
  try {
    const v = JSON.parse(localStorage.getItem(LS_AUTO_RULES) || "{}");
    return typeof v === "object" && v !== null ? v : {};
  } catch { return {}; }
}
export function saveAutoRules(r: AutoRulesMap) {
  localStorage.setItem(LS_AUTO_RULES, JSON.stringify(r));
}
export function loadIncomeRules(): AutoRulesMap {
  try {
    const v = JSON.parse(localStorage.getItem(LS_INCOME_RULES) || "{}");
    return typeof v === "object" && v !== null ? v : {};
  } catch { return {}; }
}
export function saveIncomeRules(r: AutoRulesMap) {
  localStorage.setItem(LS_INCOME_RULES, JSON.stringify(r));
}
export function loadAutoMode(): boolean {
  return localStorage.getItem(LS_AUTO_MODE) === "true";
}
export function saveAutoMode(v: boolean) {
  localStorage.setItem(LS_AUTO_MODE, String(v));
}
function loadCustomModalRows(lsKey: string): CostRowDef[] {
  try { return JSON.parse(localStorage.getItem(lsKey) || "[]"); } catch { return []; }
}
function saveCustomModalRows(lsKey: string, rows: CostRowDef[]) {
  localStorage.setItem(lsKey, JSON.stringify(rows));
}

// ── Дефолтные строки ──────────────────────────────────────────────────────
const DEFAULT_COST_ROWS: CostRowDef[] = [
  { key: "material_cost", label: "Материалы" },
  { key: "measure_cost",  label: "Замер" },
  { key: "install_cost",  label: "Монтаж" },
];
const DEFAULT_INCOME_ROWS: CostRowDef[] = [
  { key: "contract_sum", label: "Сумма договора" },
];

// ── Компоненты ────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange, color = "#ef4444" }: {
  enabled: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <button onClick={() => onChange(!enabled)}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: enabled ? color : "rgba(255,255,255,0.12)" }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: enabled ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

// ── Основной модал ────────────────────────────────────────────────────────
export function AutoRulesModal({ onClose, costRows, defaultTab = "costs" }: { onClose: () => void; costRows: CostRowDef[]; defaultTab?: "costs" | "income" }) {
  const t = useTheme();
  const [tab,       setTab]       = useState<"costs" | "income">(defaultTab);
  const [costRules, setCostRules] = useState<AutoRulesMap>(loadAutoRules);
  const [incRules,  setIncRules]  = useState<AutoRulesMap>(loadIncomeRules);
  const [autoMode,  setAutoMode]  = useState<boolean>(loadAutoMode);

  const [customCostRows,   setCustomCostRows]   = useState<CostRowDef[]>(() => loadCustomModalRows(LS_CUSTOM_COST_ROWS_MODAL));
  const [customIncomeRows, setCustomIncomeRows] = useState<CostRowDef[]>(() => loadCustomModalRows(LS_CUSTOM_INCOME_ROWS_MODAL));
  const [addingRow,  setAddingRow]  = useState(false);
  const [newLabel,   setNewLabel]   = useState("");

  const isCosts    = tab === "costs";
  const rules      = isCosts ? costRules    : incRules;
  const setRules   = isCosts ? setCostRules : setIncRules;
  const customRows = isCosts ? customCostRows : customIncomeRows;
  const setCustomRows = isCosts
    ? (rows: CostRowDef[]) => { setCustomCostRows(rows);   saveCustomModalRows(LS_CUSTOM_COST_ROWS_MODAL,   rows); }
    : (rows: CostRowDef[]) => { setCustomIncomeRows(rows); saveCustomModalRows(LS_CUSTOM_INCOME_ROWS_MODAL, rows); };

  // Для затрат — строки из карточки (costRows prop) + кастомные из модала
  // Для доходов — дефолт + кастомные
  const baseRows   = isCosts ? costRows : DEFAULT_INCOME_ROWS;
  const allRows    = [...baseRows, ...customRows.filter(cr => !baseRows.some(br => br.key === cr.key))];

  const accentColor = isCosts ? "#ef4444" : "#10b981";

  const getEntry = (key: string): RuleEntry =>
    rules[key] ?? { pct: null, enabled: true, visible: true };

  const setEntry = (key: string, patch: Partial<RuleEntry>) =>
    setRules(r => ({ ...r, [key]: { ...getEntry(key), ...patch } }));

  const save = () => {
    saveAutoRules(costRules);
    saveIncomeRules(incRules);
    saveAutoMode(autoMode);
    window.dispatchEvent(new StorageEvent("storage", { key: LS_AUTO_RULES }));
    window.dispatchEvent(new StorageEvent("storage", { key: LS_INCOME_RULES }));
    onClose();
  };

  const addCustomRow = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = `custom_${tab}_modal_${Date.now()}`;
    setCustomRows([...customRows, { key, label }]);
    setNewLabel("");
    setAddingRow(false);
  };

  const removeCustomRow = (key: string) => {
    setCustomRows(customRows.filter(r => r.key !== key));
    setRules(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const exampleSum = 100_000;
  const hasAny = allRows.some(row => {
    const e = getEntry(row.key);
    return e.enabled && e.pct != null && e.pct > 0;
  });

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${accentColor}20` }}>
              <Icon name="Percent" size={14} style={{ color: accentColor }} />
            </div>
            <span className="text-sm font-bold" style={{ color: t.text }}>Правила авто-расчёта</span>
          </div>
          <div className="flex items-center gap-2">
            <Toggle enabled={autoMode} onChange={setAutoMode} color={accentColor} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition"
              style={{ color: t.textMute }}>
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        {/* Таб Расходы / Доходы */}
        <div className="px-5 pt-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            {([
              { key: "costs",  label: "Расходы", icon: "TrendingDown", color: "#ef4444" },
              { key: "income", label: "Доходы",  icon: "TrendingUp",   color: "#10b981" },
            ] as const).map(tb => (
              <button key={tb.key} onClick={() => { setTab(tb.key); setAddingRow(false); setNewLabel(""); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition"
                style={{
                  background: tab === tb.key ? "rgba(255,255,255,0.08)" : "transparent",
                  color: tab === tb.key ? tb.color : t.textMute,
                }}>
                <Icon name={tb.icon} size={12} />
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        {/* Подсказка авто-режима */}
        <div className="px-5 pt-2">
          <div className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: autoMode ? `${accentColor}15` : "rgba(255,255,255,0.04)", border: `1px solid ${autoMode ? `${accentColor}30` : t.border}` }}>
            <Icon name="Zap" size={13} style={{ color: autoMode ? accentColor : t.textMute, flexShrink: 0 }} />
            <span className="text-xs leading-relaxed" style={{ color: autoMode ? (isCosts ? "#fca5a5" : "#6ee7b7") : t.textMute }}>
              {autoMode
                ? "Авто-режим включён — правила применяются при изменении суммы договора"
                : "Авто-режим выключен — нажмите «Авто» вручную в блоке затрат"}
            </span>
          </div>
        </div>

        {/* Тело */}
        <div className="px-5 py-3 space-y-2 overflow-y-auto flex-1">
          <p className="text-xs leading-relaxed mb-2" style={{ color: t.textMute }}>
            {isCosts
              ? "Укажите % от суммы договора для каждой статьи затрат."
              : "Укажите дополнительные статьи доходов в % от суммы договора."}
          </p>

          {allRows.map(row => {
            const entry    = getEntry(row.key);
            const isCustom = customRows.some(cr => cr.key === row.key);
            return (
              <div key={row.key} className="rounded-xl p-3 space-y-2.5"
                style={{ background: t.surface2, border: `1px solid ${entry.enabled ? `${accentColor}40` : t.border}`, opacity: entry.enabled ? 1 : 0.55 }}>

                {/* Шапка строки с двумя переключателями */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate" style={{ color: accentColor }}>{row.label}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Переключатель 1: Применять */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px] uppercase tracking-wide font-semibold" style={{ color: t.textMute }}>применять</span>
                      <Toggle enabled={entry.enabled} onChange={v => setEntry(row.key, { enabled: v })} color={accentColor} />
                    </div>
                    {/* Переключатель 2: Показывать в карточке */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px] uppercase tracking-wide font-semibold" style={{ color: t.textMute }}>в карточке</span>
                      <Toggle enabled={entry.visible} onChange={v => setEntry(row.key, { visible: v })} color="#8b5cf6" />
                    </div>
                    {/* Удалить кастомную строку */}
                    {isCustom && (
                      <button onClick={() => removeCustomRow(row.key)}
                        className="p-1 rounded-lg hover:bg-white/10 transition">
                        <Icon name="Trash2" size={12} style={{ color: "#ef4444" }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Поле % */}
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={100}
                    value={entry.pct ?? ""}
                    onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                    disabled={!entry.enabled}
                    className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                    placeholder="0" />
                  <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                  <span className="text-xs whitespace-nowrap" style={{ color: t.textMute }}>от договора</span>
                </div>
              </div>
            );
          })}

          {/* Добавить своё правило */}
          <div className="pt-1">
            {addingRow ? (
              <div className="flex items-center gap-2">
                <input autoFocus type="text" value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCustomRow(); if (e.key === "Escape") { setAddingRow(false); setNewLabel(""); } }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ background: t.surface2, border: `1px solid ${accentColor}50`, color: t.text }}
                  placeholder="Название правила..." />
                <button onClick={addCustomRow}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition"
                  style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  Добавить
                </button>
                <button onClick={() => { setAddingRow(false); setNewLabel(""); }}
                  className="p-2 rounded-xl hover:bg-white/10 transition">
                  <Icon name="X" size={12} style={{ color: t.textMute }} />
                </button>
              </div>
            ) : (
              <button onClick={() => setAddingRow(true)}
                className="flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
                style={{ color: t.textMute }}>
                <Icon name="Plus" size={13} />
                Добавить своё правило
              </button>
            )}
          </div>

          {/* Пример */}
          {hasAny && (
            <div className="rounded-xl px-3 py-2.5 text-xs space-y-1"
              style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}30` }}>
              <div className="font-medium mb-1" style={{ color: accentColor }}>Пример при договоре 100 000 ₽:</div>
              {allRows.map(row => {
                const e = getEntry(row.key);
                if (!e.enabled || !e.pct) return null;
                return (
                  <div key={row.key} className="flex items-center gap-2" style={{ color: t.textMute }}>
                    <span>{row.label} = {(exampleSum * e.pct / 100).toLocaleString("ru-RU")} ₽</span>
                    {!e.visible && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}>скрыто</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 pb-5 pt-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={save}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: accentColor }}>
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
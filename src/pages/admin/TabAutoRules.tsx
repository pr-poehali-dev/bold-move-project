import { useState } from "react";
import Icon from "@/components/ui/icon";

const LS_AUTO_RULES   = "crm_costs_auto_rules_v2";
const LS_INCOME_RULES = "crm_income_auto_rules_v1";
const LS_AUTO_MODE    = "crm_costs_auto_mode";

interface RuleEntry {
  pct: number | null;
  enabled: boolean;   // применять в расчёте
  visible: boolean;   // показывать в карточке / P&L
}
type AutoRulesMap = Record<string, RuleEntry>;

interface CustomRow { key: string; label: string; }

const LS_CUSTOM_COST_ROWS   = "crm_auto_custom_cost_rows";
const LS_CUSTOM_INCOME_ROWS = "crm_auto_custom_income_rows";

function loadRules(lsKey: string): AutoRulesMap {
  try {
    const v = JSON.parse(localStorage.getItem(lsKey) || "{}");
    return typeof v === "object" && v !== null ? v : {};
  } catch { return {}; }
}
function saveRules(lsKey: string, r: AutoRulesMap) {
  localStorage.setItem(lsKey, JSON.stringify(r));
}
function loadAutoMode(): boolean {
  return localStorage.getItem(LS_AUTO_MODE) === "true";
}
function saveAutoMode(v: boolean) {
  localStorage.setItem(LS_AUTO_MODE, String(v));
}
function loadCustomRows(lsKey: string): CustomRow[] {
  try { return JSON.parse(localStorage.getItem(lsKey) || "[]"); } catch { return []; }
}
function saveCustomRows(lsKey: string, rows: CustomRow[]) {
  localStorage.setItem(lsKey, JSON.stringify(rows));
}

const DEFAULT_COST_ROWS: CustomRow[] = [
  { key: "material_cost", label: "Материалы" },
  { key: "measure_cost",  label: "Замер" },
  { key: "install_cost",  label: "Монтаж" },
];

const DEFAULT_INCOME_ROWS: CustomRow[] = [
  { key: "contract_sum", label: "Сумма договора" },
];

interface Props { isDark?: boolean; readOnly?: boolean; }

function Toggle({ enabled, onChange, color = "#ef4444" }: { enabled: boolean; onChange: () => void; color?: string }) {
  return (
    <button onClick={onChange}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: enabled ? color : "rgba(255,255,255,0.12)" }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: enabled ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

export default function TabAutoRules({ isDark = true, readOnly = false }: Props) {
  const [tab,       setTab]       = useState<"costs" | "income">("costs");
  const [costRules, setCostRules] = useState<AutoRulesMap>(() => loadRules(LS_AUTO_RULES));
  const [incRules,  setIncRules]  = useState<AutoRulesMap>(() => loadRules(LS_INCOME_RULES));
  const [autoMode,  setAutoMode]  = useState<boolean>(loadAutoMode);
  const [saved,     setSaved]     = useState(false);

  const [customCostRows,   setCustomCostRows]   = useState<CustomRow[]>(() => loadCustomRows(LS_CUSTOM_COST_ROWS));
  const [customIncomeRows, setCustomIncomeRows] = useState<CustomRow[]>(() => loadCustomRows(LS_CUSTOM_INCOME_ROWS));

  const [addingRow,  setAddingRow]  = useState(false);
  const [newLabel,   setNewLabel]   = useState("");

  const text   = isDark ? "#fff"                    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.45)"  : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)"  : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.04)"  : "#f9fafb";
  const bg2    = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  const isCosts = tab === "costs";
  const rules    = isCosts ? costRules    : incRules;
  const setRules = isCosts ? setCostRules : setIncRules;
  const lsKey    = isCosts ? LS_AUTO_RULES : LS_INCOME_RULES;

  const defaultRows  = isCosts ? DEFAULT_COST_ROWS   : DEFAULT_INCOME_ROWS;
  const customRows   = isCosts ? customCostRows       : customIncomeRows;
  const setCustomRows = isCosts
    ? (rows: CustomRow[]) => { setCustomCostRows(rows);   saveCustomRows(LS_CUSTOM_COST_ROWS,   rows); }
    : (rows: CustomRow[]) => { setCustomIncomeRows(rows); saveCustomRows(LS_CUSTOM_INCOME_ROWS, rows); };

  const allRows = [...defaultRows, ...customRows];

  const getEntry = (key: string): RuleEntry =>
    rules[key] ?? { pct: null, enabled: true, visible: true };

  const setEntry = (key: string, patch: Partial<RuleEntry>) =>
    setRules(r => ({ ...r, [key]: { ...getEntry(key), ...patch } }));

  const save = () => {
    saveRules(lsKey, rules);
    saveAutoMode(autoMode);
    // Уведомляем другие компоненты
    window.dispatchEvent(new StorageEvent("storage", { key: lsKey }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCustomRow = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = `custom_${tab}_${Date.now()}`;
    const newRow: CustomRow = { key, label };
    setCustomRows([...customRows, newRow]);
    setNewLabel("");
    setAddingRow(false);
  };

  const removeCustomRow = (key: string) => {
    setCustomRows(customRows.filter(r => r.key !== key));
    setRules(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const exampleSum = 100_000;
  const hasAny = allRows.some(row => {
    const e = getEntry(row.key);
    return e.enabled && e.pct != null && e.pct > 0;
  });

  const accentColor = isCosts ? "#ef4444" : "#10b981";
  const accentBg    = isCosts ? "#ef444412" : "#10b98112";
  const accentBd    = isCosts ? "#ef444435" : "#10b98130";

  return (
    <div className="max-w-xl space-y-4">

      {/* Авто-режим */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{ background: autoMode ? accentBg : bg2, border: `1px solid ${autoMode ? accentBd : border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: autoMode ? accentBg : bg }}>
            <Icon name="Percent" size={14} style={{ color: autoMode ? accentColor : muted }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: autoMode ? accentColor : text }}>Авто-режим</div>
            <div className="text-xs mt-0.5 leading-relaxed" style={{ color: autoMode ? (isCosts ? "#fca5a5" : "#6ee7b7") : muted }}>
              {autoMode
                ? "Включён — правила применяются сразу при изменении суммы договора"
                : "Выключен — нажмите «Авто» вручную в карточке клиента"}
            </div>
          </div>
        </div>
        <button onClick={() => !readOnly && setAutoMode(v => !v)}
          className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ml-3"
          style={{ background: autoMode ? accentColor : "rgba(255,255,255,0.12)" }}>
          <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: autoMode ? "translateX(16px)" : "translateX(0)" }} />
        </button>
      </div>

      {/* Таб Доходы / Расходы */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: bg }}>
        {([
          { key: "costs",  label: "Расходы",  icon: "TrendingDown", color: "#ef4444" },
          { key: "income", label: "Доходы",   icon: "TrendingUp",   color: "#10b981" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setAddingRow(false); setNewLabel(""); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition"
            style={{
              background: tab === t.key ? (isDark ? "rgba(255,255,255,0.08)" : "#fff") : "transparent",
              color: tab === t.key ? t.color : muted,
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
            }}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Описание */}
      <p className="text-sm px-1" style={{ color: muted }}>
        {isCosts
          ? "Укажите % от суммы договора для каждой статьи затрат. Бот будет автоматически заполнять их в карточке клиента."
          : "Укажите дополнительные статьи доходов в % от суммы договора. Они будут отображаться в P&L клиента."}
      </p>

      {/* Список правил */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}`, background: bg2 }}>
        {allRows.map((row, idx) => {
          const entry   = getEntry(row.key);
          const isCustom = customRows.some(r => r.key === row.key);
          return (
            <div key={row.key} className={idx > 0 ? "border-t" : ""} style={{ borderColor: border }}>
              <div className="px-4 py-3">

                {/* Шапка строки */}
                <div className="flex items-center justify-between mb-2.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate"
                      style={{ color: entry.enabled ? accentColor : muted }}>
                      {row.label}
                    </span>
                    {entry.pct != null && entry.pct > 0 && entry.enabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0"
                        style={{ background: `${accentColor}15`, color: accentColor }}>
                        {(exampleSum * entry.pct / 100).toLocaleString("ru-RU")} ₽ при 100к
                      </span>
                    )}
                  </div>

                  {/* Два переключателя */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Переключатель 1: Применять */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: muted }}>
                        применять
                      </span>
                      <Toggle
                        enabled={entry.enabled}
                        onChange={() => !readOnly && setEntry(row.key, { enabled: !entry.enabled })}
                        color={accentColor}
                      />
                    </div>
                    {/* Переключатель 2: Показывать в P&L */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: muted }}>
                        в карточке
                      </span>
                      <Toggle
                        enabled={entry.visible}
                        onChange={() => !readOnly && setEntry(row.key, { visible: !entry.visible })}
                        color="#8b5cf6"
                      />
                    </div>
                    {/* Удалить кастомную строку */}
                    {isCustom && !readOnly && (
                      <button onClick={() => removeCustomRow(row.key)}
                        className="p-1 rounded-lg hover:bg-white/10 transition flex-shrink-0"
                        title="Удалить правило">
                        <Icon name="Trash2" size={13} style={{ color: "#ef4444" }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Поле ввода % */}
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100}
                    value={entry.pct ?? ""}
                    onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                    disabled={!entry.enabled || readOnly}
                    className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none transition"
                    style={{
                      background: bg,
                      border: `1px solid ${entry.enabled ? `${accentColor}40` : border}`,
                      color: text,
                      opacity: entry.enabled ? 1 : 0.4,
                    }}
                    placeholder="0"
                  />
                  <span className="text-sm font-bold whitespace-nowrap" style={{ color: muted }}>%</span>
                  <span className="text-xs whitespace-nowrap" style={{ color: muted }}>от договора</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Добавить новое правило */}
        {!readOnly && (
          <div className="border-t px-4 py-3" style={{ borderColor: border }}>
            {addingRow ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCustomRow(); if (e.key === "Escape") { setAddingRow(false); setNewLabel(""); } }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none transition"
                  style={{ background: bg, border: `1px solid ${accentColor}50`, color: text }}
                  placeholder="Название правила..."
                />
                <button onClick={addCustomRow}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition"
                  style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  Добавить
                </button>
                <button onClick={() => { setAddingRow(false); setNewLabel(""); }}
                  className="p-2 rounded-xl hover:bg-white/10 transition">
                  <Icon name="X" size={13} style={{ color: muted }} />
                </button>
              </div>
            ) : (
              <button onClick={() => setAddingRow(true)}
                className="flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
                style={{ color: muted }}>
                <Icon name="Plus" size={13} />
                Добавить своё правило
              </button>
            )}
          </div>
        )}
      </div>

      {/* Пример */}
      {hasAny && (
        <div className="rounded-xl px-4 py-3 text-xs space-y-1.5"
          style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}30` }}>
          <div className="font-bold mb-1" style={{ color: accentColor }}>
            Пример при договоре 100 000 ₽:
          </div>
          {allRows.map(row => {
            const e = getEntry(row.key);
            if (!e.enabled || !e.pct) return null;
            return (
              <div key={row.key} className="flex items-center gap-2" style={{ color: muted }}>
                <span>{row.label} = {(exampleSum * e.pct / 100).toLocaleString("ru-RU")} ₽</span>
                {!e.visible && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                    скрыто в карточке
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Кнопка сохранить */}
      {!readOnly && (
        <button onClick={save}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2"
          style={{ background: saved ? "#10b981" : accentColor }}>
          {saved
            ? <><Icon name="CheckCircle2" size={14} /> Сохранено</>
            : <><Icon name="Save" size={14} /> Сохранить правила</>}
        </button>
      )}
    </div>
  );
}

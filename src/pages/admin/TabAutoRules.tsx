import { useState } from "react";
import Icon from "@/components/ui/icon";

// Те же ключи что в DrawerFinBlocks — единое хранилище
const LS_AUTO_RULES = "crm_costs_auto_rules_v2";
const LS_AUTO_MODE  = "crm_costs_auto_mode";

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

// Предустановленные строки затрат (всегда доступны)
const DEFAULT_COST_ROWS = [
  { key: "material_cost", label: "Материалы" },
  { key: "measure_cost",  label: "Замер" },
  { key: "install_cost",  label: "Монтаж" },
];

interface Props { isDark?: boolean; readOnly?: boolean; }

export default function TabAutoRules({ isDark = true, readOnly = false }: Props) {
  const [rules,    setRules]    = useState<AutoRulesMap>(loadAutoRules);
  const [autoMode, setAutoMode] = useState<boolean>(loadAutoMode);
  const [saved,    setSaved]    = useState(false);

  const text   = isDark ? "#fff"                    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.45)"  : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)"  : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.04)"  : "#f9fafb";
  const bg2    = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  const getEntry = (key: string): RuleEntry =>
    rules[key] ?? { pct: null, enabled: true };

  const setEntry = (key: string, patch: Partial<RuleEntry>) =>
    setRules(r => ({ ...r, [key]: { ...getEntry(key), ...patch } }));

  const save = () => {
    saveAutoRules(rules);
    saveAutoMode(autoMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exampleSum = 100_000;
  const hasAny = DEFAULT_COST_ROWS.some(row => {
    const e = getEntry(row.key);
    return e.enabled && e.pct != null && e.pct > 0;
  });

  return (
    <div className="max-w-xl space-y-4">

      {/* Авто-режим — переключатель */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{ background: autoMode ? "#ef444412" : bg2, border: `1px solid ${autoMode ? "#ef444435" : border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: autoMode ? "#ef444420" : bg }}>
            <Icon name="Percent" size={14} style={{ color: autoMode ? "#ef4444" : muted }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: autoMode ? "#ef4444" : text }}>Авто-режим</div>
            <div className="text-xs mt-0.5 leading-relaxed" style={{ color: autoMode ? "#fca5a5" : muted }}>
              {autoMode
                ? "Включён — правила применяются сразу при изменении суммы договора"
                : "Выключен — нажмите «Авто» вручную в карточке клиента"}
            </div>
          </div>
        </div>
        <button
          onClick={() => setAutoMode(v => !v)}
          className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ml-3"
          style={{ background: autoMode ? "#ef4444" : "rgba(255,255,255,0.12)" }}>
          <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: autoMode ? "translateX(16px)" : "translateX(0)" }} />
        </button>
      </div>

      {/* Описание */}
      <p className="text-sm px-1" style={{ color: muted }}>
        Укажите % от суммы договора для каждой статьи затрат. Бот будет автоматически заполнять их в карточке клиента при изменении суммы договора.
      </p>

      {/* Строки правил */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${border}`, background: bg2 }}>
        {DEFAULT_COST_ROWS.map((row, idx) => {
          const entry = getEntry(row.key);
          return (
            <div key={row.key}
              className={idx > 0 ? "border-t" : ""}
              style={{ borderColor: border }}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold"
                      style={{ color: entry.enabled ? "#ef4444" : muted }}>
                      {row.label}
                    </span>
                    {entry.pct != null && entry.pct > 0 && entry.enabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: "#ef444415", color: "#ef4444" }}>
                        {(exampleSum * entry.pct / 100).toLocaleString("ru-RU")} ₽ при 100к
                      </span>
                    )}
                  </div>
                  {/* Тогл вкл/выкл */}
                  <button
                    onClick={() => setEntry(row.key, { enabled: !entry.enabled })}
                    className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200"
                    style={{ background: entry.enabled ? "#ef4444" : "rgba(255,255,255,0.12)" }}>
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ transform: entry.enabled ? "translateX(16px)" : "translateX(0)" }} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100}
                    value={entry.pct ?? ""}
                    onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                    disabled={!entry.enabled}
                    className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none transition"
                    style={{
                      background: bg,
                      border: `1px solid ${entry.enabled ? "#ef444440" : border}`,
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
      </div>

      {/* Пример */}
      {hasAny && (
        <div className="rounded-xl px-4 py-3 text-xs space-y-1.5"
          style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
          <div className="font-bold mb-1" style={{ color: "#ef4444" }}>
            Пример при договоре 100 000 ₽:
          </div>
          {DEFAULT_COST_ROWS.map(row => {
            const e = getEntry(row.key);
            if (!e.enabled || !e.pct) return null;
            return (
              <div key={row.key} style={{ color: muted }}>
                {row.label} = {(exampleSum * e.pct / 100).toLocaleString("ru-RU")} ₽
              </div>
            );
          })}
        </div>
      )}

      {/* Кнопка сохранить — только если не readOnly */}
      {!readOnly && (
        <button onClick={save}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2"
          style={{ background: saved ? "#10b981" : "#ef4444" }}>
          {saved
            ? <><Icon name="CheckCircle2" size={14} /> Сохранено</>
            : <><Icon name="Save" size={14} /> Сохранить правила</>}
        </button>
      )}
    </div>
  );
}
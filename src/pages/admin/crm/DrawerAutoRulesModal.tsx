import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

export const LS_AUTO_RULES = "crm_costs_auto_rules_v2";
export const LS_AUTO_MODE  = "crm_costs_auto_mode";

export interface RuleEntry { pct: number | null; enabled: boolean; }
export type AutoRulesMap = Record<string, RuleEntry>;

export function loadAutoRules(): AutoRulesMap {
  try {
    const v = JSON.parse(localStorage.getItem(LS_AUTO_RULES) || "{}");
    return typeof v === "object" && v !== null ? v : {};
  } catch { return {}; }
}
export function saveAutoRules(r: AutoRulesMap) {
  localStorage.setItem(LS_AUTO_RULES, JSON.stringify(r));
}
export function loadAutoMode(): boolean {
  return localStorage.getItem(LS_AUTO_MODE) === "true";
}
export function saveAutoMode(v: boolean) {
  localStorage.setItem(LS_AUTO_MODE, String(v));
}

export interface CostRowDef { key: string; label: string; }

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: enabled ? "#ef4444" : "rgba(255,255,255,0.12)" }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: enabled ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

export function AutoRulesModal({ onClose, costRows }: { onClose: () => void; costRows: CostRowDef[] }) {
  const t = useTheme();
  const [rules,    setRules]    = useState<AutoRulesMap>(loadAutoRules);
  const [autoMode, setAutoMode] = useState<boolean>(loadAutoMode);

  const save = () => { saveAutoRules(rules); saveAutoMode(autoMode); onClose(); };

  const getEntry = (key: string): RuleEntry => rules[key] ?? { pct: null, enabled: true };
  const setEntry = (key: string, patch: Partial<RuleEntry>) =>
    setRules(r => ({ ...r, [key]: { ...getEntry(key), ...patch } }));

  const exampleSum = 100_000;
  const hasAny = costRows.some(row => {
    const e = getEntry(row.key);
    return e.enabled && e.pct != null && e.pct > 0;
  });

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "#ef444420" }}>
              <Icon name="Percent" size={14} style={{ color: "#ef4444" }} />
            </div>
            <span className="text-sm font-bold" style={{ color: t.text }}>Правила авто-расчёта</span>
          </div>
          <div className="flex items-center gap-2">
            <Toggle enabled={autoMode} onChange={setAutoMode} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition"
              style={{ color: t.textMute }}>
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        {/* Подсказка авто-режима */}
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
                    <Toggle enabled={entry.enabled} onChange={v => setEntry(row.key, { enabled: v })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100}
                      value={entry.pct ?? ""}
                      onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                      disabled={!entry.enabled}
                      className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
                      placeholder="0" />
                    <span className="text-sm font-bold" style={{ color: t.textMute }}>%</span>
                    <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
                  </div>
                </div>
              );
            })}
          </div>
          {hasAny && (
            <div className="rounded-xl px-3 py-2.5 text-xs space-y-1"
              style={{ background: "#ef444410", border: "1px solid #ef444430" }}>
              <div className="font-medium mb-1" style={{ color: "#ef4444" }}>Пример при договоре 100 000 ₽:</div>
              {costRows.map(row => {
                const e = getEntry(row.key);
                if (!e.enabled || !e.pct) return null;
                return <div key={row.key} style={{ color: t.textMute }}>
                  {row.label} = {(exampleSum * e.pct / 100).toLocaleString("ru-RU")} ₽
                </div>;
              })}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 pb-5 pt-2 flex-shrink-0"
          style={{ borderTop: `1px solid ${t.border}` }}>
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

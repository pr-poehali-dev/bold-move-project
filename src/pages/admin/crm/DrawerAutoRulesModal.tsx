import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { useAutoRules, RuleEntry } from "@/hooks/useAutoRules";

// Экспортируем типы для обратной совместимости
export type { RuleEntry };
export type AutoRulesMap = Record<string, Pick<RuleEntry, "pct" | "enabled" | "visible">>;
export interface CostRowDef { key: string; label: string; }

// ── Toggle ─────────────────────────────────────────────────────────────────
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
export function AutoRulesModal({ onClose, defaultTab = "costs" }: {
  onClose: () => void;
  costRows?: CostRowDef[]; // оставлен для совместимости, больше не используется
  defaultTab?: "costs" | "income";
}) {
  const t = useTheme();
  const { rules, auto_mode, loading, saving, save } = useAutoRules();

  const [tab,         setTab]         = useState<"costs" | "income">(defaultTab);
  const [localRules,  setLocalRules]  = useState<RuleEntry[] | null>(null);
  const [localAutoMode, setLocalAutoMode] = useState<boolean | null>(null);
  const [addingRow,   setAddingRow]   = useState(false);
  const [newLabel,    setNewLabel]    = useState("");

  const currentRules    = localRules    ?? rules;
  const currentAutoMode = localAutoMode ?? auto_mode;

  const isCosts     = tab === "costs";
  const rowType     = isCosts ? "cost" : "income";
  const accentColor = isCosts ? "#ef4444" : "#10b981";
  const tabRules    = currentRules.filter(r => r.row_type === rowType);

  const setEntry = (key: string, patch: Partial<RuleEntry>) => {
    setLocalRules(prev => (prev ?? rules).map(r => r.key === key ? { ...r, ...patch } : r));
  };

  const handleSave = async () => {
    await save(currentRules, currentAutoMode);
    onClose();
  };

  const addCustomRow = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = `custom_${rowType}_${Date.now()}`;
    const newRow: RuleEntry = {
      key, label,
      pct: null,
      enabled: true,
      visible: true,
      row_type: rowType,
      sort_order: tabRules.length + 1,
      is_default: false,
    };
    setLocalRules(prev => [...(prev ?? rules), newRow]);
    setNewLabel("");
    setAddingRow(false);
  };

  const removeCustomRow = (key: string) => {
    setLocalRules(prev => (prev ?? rules).filter(r => r.key !== key));
  };

  const exampleSum = 100_000;
  const hasAny = tabRules.some(r => r.enabled && r.pct != null && r.pct > 0);

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
            <Toggle enabled={currentAutoMode} onChange={v => setLocalAutoMode(v)} color={accentColor} />
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
            style={{ background: currentAutoMode ? `${accentColor}15` : "rgba(255,255,255,0.04)", border: `1px solid ${currentAutoMode ? `${accentColor}30` : t.border}` }}>
            <Icon name="Zap" size={13} style={{ color: currentAutoMode ? accentColor : t.textMute, flexShrink: 0 }} />
            <span className="text-xs leading-relaxed" style={{ color: currentAutoMode ? (isCosts ? "#fca5a5" : "#6ee7b7") : t.textMute }}>
              {currentAutoMode
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

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: t.textMute }}>
              <Icon name="Loader" size={16} className="animate-spin" />
              <span className="text-xs">Загрузка…</span>
            </div>
          ) : tabRules.map(row => (
            <div key={row.key} className="rounded-xl p-3 space-y-2.5"
              style={{ background: t.surface2, border: `1px solid ${row.enabled ? `${accentColor}40` : t.border}`, opacity: row.enabled ? 1 : 0.55 }}>

              {/* Шапка строки с двумя переключателями */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate" style={{ color: accentColor }}>{row.label}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] uppercase tracking-wide font-semibold" style={{ color: t.textMute }}>применять</span>
                    <Toggle enabled={row.enabled} onChange={v => setEntry(row.key, { enabled: v })} color={accentColor} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] uppercase tracking-wide font-semibold" style={{ color: t.textMute }}>в карточке</span>
                    <Toggle enabled={row.visible} onChange={v => setEntry(row.key, { visible: v })} color="#8b5cf6" />
                  </div>
                  {!row.is_default && (
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
                  value={row.pct ?? ""}
                  onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                  disabled={!row.enabled}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${row.enabled ? `${accentColor}30` : t.border}`, color: t.text }}
                  placeholder="0"
                />
                <span className="text-xs font-bold" style={{ color: t.textMute }}>%</span>
                <span className="text-xs" style={{ color: t.textMute }}>от договора</span>
              </div>
            </div>
          ))}

          {/* Добавить своё правило */}
          <div className="pt-1">
            {addingRow ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCustomRow(); if (e.key === "Escape") { setAddingRow(false); setNewLabel(""); } }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${accentColor}50`, color: t.text }}
                  placeholder="Название правила..."
                />
                <button onClick={addCustomRow}
                  className="px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: accentColor, color: "#fff" }}>
                  Добавить
                </button>
                <button onClick={() => { setAddingRow(false); setNewLabel(""); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", color: t.textMute }}>
                  Отмена
                </button>
              </div>
            ) : (
              <button onClick={() => setAddingRow(true)}
                className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition"
                style={{ color: accentColor }}>
                <Icon name="Plus" size={13} />
                Добавить своё правило
              </button>
            )}
          </div>

          {/* Пример */}
          {hasAny && (
            <div className="rounded-xl px-3 py-2.5 mt-1"
              style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}>
              <div className="text-xs font-bold mb-1.5" style={{ color: accentColor }}>
                Пример при договоре {exampleSum.toLocaleString("ru-RU")} ₽:
              </div>
              {tabRules.filter(r => r.enabled && r.pct != null && r.pct > 0).map(r => (
                <div key={r.key} className="flex items-center justify-between text-xs">
                  <span style={{ color: t.textMute }}>{r.label}</span>
                  <span className="font-bold" style={{ color: accentColor }}>
                    = {(exampleSum * (r.pct ?? 0) / 100).toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
            style={{ background: accentColor, color: "#fff", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.07)", color: t.textMute }}>
            Отмена
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}

import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAutoRules, RuleEntry } from "@/hooks/useAutoRules";

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
  const { rules, auto_mode, loading, saving, save } = useAutoRules();

  const [tab,       setTab]       = useState<"costs" | "income">("costs");
  const [localRules, setLocalRules] = useState<RuleEntry[] | null>(null);
  const [localAutoMode, setLocalAutoMode] = useState<boolean | null>(null);
  const [saved,     setSaved]     = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [newLabel,  setNewLabel]  = useState("");

  const currentRules    = localRules    ?? rules;
  const currentAutoMode = localAutoMode ?? auto_mode;

  const text   = isDark ? "#fff"                    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.45)"  : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)"  : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.04)"  : "#f9fafb";
  const bg2    = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  const isCosts     = tab === "costs";
  const rowType     = isCosts ? "cost" : "income";
  const accentColor = isCosts ? "#ef4444" : "#10b981";
  const accentBg    = isCosts ? "#ef444412" : "#10b98112";
  const accentBd    = isCosts ? "#ef444435" : "#10b98130";

  const tabRules    = currentRules.filter(r => r.row_type === rowType);
  const exampleSum  = 100_000;

  const setEntry = (key: string, patch: Partial<RuleEntry>) => {
    setLocalRules(prev => {
      const base = prev ?? rules;
      return base.map(r => r.key === key ? { ...r, ...patch } : r);
    });
  };

  const handleSave = async () => {
    await save(currentRules, currentAutoMode);
    setLocalRules(null);
    setLocalAutoMode(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  const hasAny = tabRules.some(r => r.enabled && r.pct != null && r.pct > 0);

  if (loading) return (
    <div className="flex items-center justify-center py-12" style={{ color: muted }}>
      <Icon name="Loader" size={20} className="animate-spin mr-2" />
      <span className="text-sm">Загрузка правил…</span>
    </div>
  );

  return (
    <div className="max-w-xl space-y-4">

      {/* Авто-режим */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{ background: currentAutoMode ? accentBg : bg2, border: `1px solid ${currentAutoMode ? accentBd : border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: currentAutoMode ? accentBg : bg }}>
            <Icon name="Percent" size={14} style={{ color: currentAutoMode ? accentColor : muted }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: currentAutoMode ? accentColor : text }}>Авто-режим</div>
            <div className="text-xs mt-0.5 leading-relaxed" style={{ color: currentAutoMode ? (isCosts ? "#fca5a5" : "#6ee7b7") : muted }}>
              {currentAutoMode
                ? "Включён — правила применяются сразу при изменении суммы договора"
                : "Выключен — нажмите «Авто» вручную в карточке клиента"}
            </div>
          </div>
        </div>
        <button onClick={() => !readOnly && setLocalAutoMode(v => !(v ?? auto_mode))}
          className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ml-3"
          style={{ background: currentAutoMode ? accentColor : "rgba(255,255,255,0.12)" }}>
          <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: currentAutoMode ? "translateX(16px)" : "translateX(0)" }} />
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
        {tabRules.map((row, idx) => (
          <div key={row.key} className={idx > 0 ? "border-t" : ""} style={{ borderColor: border }}>
            <div className="px-4 py-3">

              {/* Шапка строки */}
              <div className="flex items-center justify-between mb-2.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold truncate"
                    style={{ color: row.enabled ? accentColor : muted }}>
                    {row.label}
                  </span>
                  {row.pct != null && row.pct > 0 && row.enabled && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0"
                      style={{ background: `${accentColor}15`, color: accentColor }}>
                      {(exampleSum * row.pct / 100).toLocaleString("ru-RU")} ₽ при 100к
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: muted }}>применять</span>
                    <Toggle enabled={row.enabled} onChange={() => !readOnly && setEntry(row.key, { enabled: !row.enabled })} color={accentColor} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: muted }}>в карточке</span>
                    <Toggle enabled={row.visible} onChange={() => !readOnly && setEntry(row.key, { visible: !row.visible })} color="#8b5cf6" />
                  </div>
                  {!row.is_default && !readOnly && (
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
                  value={row.pct ?? ""}
                  onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                  disabled={!row.enabled || readOnly}
                  className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none transition"
                  style={{
                    background: bg,
                    border: `1px solid ${row.enabled ? `${accentColor}40` : border}`,
                    color: text,
                    opacity: row.enabled ? 1 : 0.4,
                  }}
                  placeholder="0"
                />
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: muted }}>%</span>
                <span className="text-xs whitespace-nowrap" style={{ color: muted }}>от договора</span>
              </div>
            </div>
          </div>
        ))}

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
                  style={{ background: accentColor, color: "#fff" }}>
                  Добавить
                </button>
                <button onClick={() => { setAddingRow(false); setNewLabel(""); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition"
                  style={{ background: bg, color: muted }}>
                  Отмена
                </button>
              </div>
            ) : (
              <button onClick={() => setAddingRow(true)}
                className="flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                style={{ color: accentColor }}>
                <Icon name="Plus" size={14} />
                Добавить своё правило
              </button>
            )}
          </div>
        )}
      </div>

      {/* Пример расчёта */}
      {hasAny && (
        <div className="rounded-2xl px-4 py-3 space-y-1"
          style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}>
          <div className="text-xs font-bold mb-2" style={{ color: accentColor }}>
            Пример при договоре {exampleSum.toLocaleString("ru-RU")} ₽:
          </div>
          {tabRules.filter(r => r.enabled && r.pct != null && r.pct > 0).map(r => (
            <div key={r.key} className="flex items-center justify-between text-xs">
              <span style={{ color: muted }}>{r.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: accentColor }}>
                  = {(exampleSum * (r.pct ?? 0) / 100).toLocaleString("ru-RU")} ₽
                </span>
                {!r.visible && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                    style={{ background: "rgba(255,255,255,0.07)", color: muted }}>скрыто</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Кнопка сохранить */}
      {!readOnly && (
        <div className="flex gap-3 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition"
            style={{ background: accentColor, color: "#fff", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Сохранение…" : saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>
      )}
    </div>
  );
}

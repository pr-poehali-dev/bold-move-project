import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useDefaultAutoRules } from "@/hooks/useDefaultAutoRules";
import { RuleEntry } from "@/hooks/useAutoRules";

const ROLES = [
  { key: "installer", label: "Монтажник", icon: "Wrench",       color: "#f97316" },
  { key: "company",   label: "Компания",  icon: "Building2",    color: "#6366f1" },
];

interface Props { isDark?: boolean; }

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

export default function TabDefaultAutoRules({ isDark = true }: Props) {
  const { defaults, loading, saving, saveRole } = useDefaultAutoRules();
  const [activeRole, setActiveRole] = useState("installer");
  const [activeTab, setActiveTab]   = useState<"cost" | "income">("cost");
  const [localRules, setLocalRules] = useState<Record<string, RuleEntry[]>>({});
  const [saved, setSaved]           = useState(false);
  const [addingRow, setAddingRow]   = useState(false);
  const [newLabel, setNewLabel]     = useState("");

  const text   = isDark ? "#fff"                    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.45)"  : "#6b7280";
  const border = isDark ? "rgba(255,255,255,0.08)"  : "#e5e7eb";
  const bg     = isDark ? "rgba(255,255,255,0.04)"  : "#f9fafb";
  const bg2    = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  const getRules = (role: string): RuleEntry[] =>
    localRules[role] ?? defaults[role] ?? [];

  const setRules = (role: string, rules: RuleEntry[]) =>
    setLocalRules(prev => ({ ...prev, [role]: rules }));

  const currentRules = getRules(activeRole);
  const tabRules     = currentRules.filter(r => r.row_type === activeTab);

  const accentColor = activeTab === "cost" ? "#ef4444" : "#10b981";

  const setEntry = (key: string, patch: Partial<RuleEntry>) => {
    setRules(activeRole, currentRules.map(r => r.key === key ? { ...r, ...patch } : r));
  };

  const removeRow = (key: string) => {
    setRules(activeRole, currentRules.filter(r => r.key !== key));
  };

  const addRow = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = `custom_${activeTab}_${Date.now()}`;
    const newRow: RuleEntry = {
      key, label, pct: null,
      enabled: false, visible: true,
      row_type: activeTab, sort_order: tabRules.length + 1,
      is_default: true,
    };
    setRules(activeRole, [...currentRules, newRow]);
    setNewLabel(""); setAddingRow(false);
  };

  const handleSave = async () => {
    await saveRole(activeRole, currentRules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exampleSum = 100_000;
  const hasAny = tabRules.some(r => r.enabled && r.pct != null && r.pct > 0);

  const activeRoleMeta = ROLES.find(r => r.key === activeRole)!;

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2" style={{ color: muted }}>
      <Icon name="Loader" size={20} className="animate-spin" />
      <span className="text-sm">Загрузка…</span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">

      {/* Заголовок */}
      <div className="rounded-2xl px-5 py-4"
        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="ShieldCheck" size={16} style={{ color: "#818cf8" }} />
          <span className="text-sm font-bold" style={{ color: "#818cf8" }}>Дефолтные правила по ролям</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: muted }}>
          Настройки которые получит новый пользователь при первом входе.
          Уже существующие компании <b>не затрагиваются</b> — только новые регистрации.
        </p>
      </div>

      {/* Выбор роли */}
      <div className="flex gap-2">
        {ROLES.map(r => (
          <button key={r.key} onClick={() => { setActiveRole(r.key); setAddingRow(false); setNewLabel(""); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            style={activeRole === r.key
              ? { background: r.color + "20", color: r.color, border: `1px solid ${r.color}40` }
              : { background: bg, color: muted, border: `1px solid ${border}` }}>
            <Icon name={r.icon} size={14} />
            {r.label}
          </button>
        ))}
      </div>

      {/* Шапка роли */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: activeRoleMeta.color + "10", border: `1px solid ${activeRoleMeta.color}25` }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: activeRoleMeta.color + "20" }}>
          <Icon name={activeRoleMeta.icon} size={16} style={{ color: activeRoleMeta.color }} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: activeRoleMeta.color }}>{activeRoleMeta.label}</div>
          <div className="text-xs" style={{ color: muted }}>
            {currentRules.filter(r => r.enabled).length} правил включено из {currentRules.length}
          </div>
        </div>
      </div>

      {/* Таб Расходы / Доходы */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: bg }}>
        {([
          { key: "cost",   label: "Расходы", icon: "TrendingDown", color: "#ef4444" },
          { key: "income", label: "Доходы",  icon: "TrendingUp",   color: "#10b981" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setAddingRow(false); setNewLabel(""); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition"
            style={{
              background: activeTab === t.key ? (isDark ? "rgba(255,255,255,0.08)" : "#fff") : "transparent",
              color: activeTab === t.key ? t.color : muted,
              boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
            }}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Список правил */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}`, background: bg2 }}>
        {tabRules.map((row, idx) => (
          <div key={row.key} className={idx > 0 ? "border-t" : ""} style={{ borderColor: border }}>
            <div className="px-4 py-3">
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
                    <Toggle enabled={row.enabled} onChange={() => setEntry(row.key, { enabled: !row.enabled })} color={accentColor} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: muted }}>в карточке</span>
                    <Toggle enabled={row.visible} onChange={() => setEntry(row.key, { visible: !row.visible })} color="#8b5cf6" />
                  </div>
                  <button onClick={() => removeRow(row.key)}
                    className="p-1 rounded-lg hover:bg-white/10 transition flex-shrink-0"
                    title="Удалить правило">
                    <Icon name="Trash2" size={13} style={{ color: "#ef4444" }} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100}
                  value={row.pct ?? ""}
                  onChange={e => setEntry(row.key, { pct: e.target.value === "" ? null : +e.target.value })}
                  disabled={!row.enabled}
                  className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none transition"
                  style={{
                    background: bg,
                    border: `1px solid ${row.enabled ? `${accentColor}40` : border}`,
                    color: text, opacity: row.enabled ? 1 : 0.4,
                  }}
                  placeholder="0"
                />
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: muted }}>%</span>
                <span className="text-xs whitespace-nowrap" style={{ color: muted }}>от договора</span>
              </div>
            </div>
          </div>
        ))}

        {/* Добавить правило */}
        <div className="border-t px-4 py-3" style={{ borderColor: border }}>
          {addingRow ? (
            <div className="flex items-center gap-2">
              <input autoFocus type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addRow(); if (e.key === "Escape") { setAddingRow(false); setNewLabel(""); } }}
                className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none transition"
                style={{ background: bg, border: `1px solid ${accentColor}50`, color: text }}
                placeholder="Название правила..." />
              <button onClick={addRow}
                className="px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: accentColor, color: "#fff" }}>
                Добавить
              </button>
              <button onClick={() => { setAddingRow(false); setNewLabel(""); }}
                className="px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: bg, color: muted }}>
                Отмена
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingRow(true)}
              className="flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
              style={{ color: accentColor }}>
              <Icon name="Plus" size={14} />
              Добавить правило
            </button>
          )}
        </div>
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
              <span className="font-bold" style={{ color: accentColor }}>
                = {(exampleSum * (r.pct ?? 0) / 100).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Кнопка сохранить */}
      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 rounded-2xl text-sm font-bold transition"
          style={{ background: activeRoleMeta.color, color: "#fff", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Сохранение…" : saved ? `Сохранено ✓` : `Сохранить для роли «${activeRoleMeta.label}»`}
        </button>
      </div>
    </div>
  );
}

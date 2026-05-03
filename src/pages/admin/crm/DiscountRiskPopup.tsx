import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { loadRiskSettings } from "./discountBlockTypes";
import { LS_KEY, getTheme } from "../discountRiskTypes";
import type { RiskSettings } from "../discountRiskTypes";

function RiskField({ label, desc, value, min, max, color, onChange }: {
  label: string; desc: string; value: number;
  min: number; max: number; color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input type="number" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full rounded-lg px-3 py-2 text-sm font-bold focus:outline-none transition"
          style={{ background: color + "12", border: `1px solid ${color}35`, color: "#fff" }} />
        <span className="text-sm font-bold text-white/40">%</span>
      </div>
      <p className="text-[9px] mt-1 text-white/30">{desc}</p>
    </div>
  );
}

export function DiscountRiskPopup({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [s, setS] = useState<RiskSettings>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : loadRiskSettings() as unknown as RiskSettings;
    } catch { return loadRiskSettings() as unknown as RiskSettings; }
  });
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<RiskSettings>) => setS(prev => ({ ...prev, ...patch }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY, newValue: JSON.stringify(s) }));
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: t.surface, border: "1px solid rgba(139,92,246,0.3)", maxHeight: "90dvh" }}>

        {/* Шапка */}
        <div className="flex items-center gap-2.5 px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}`, background: "rgba(139,92,246,0.08)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.2)" }}>
            <Icon name="Settings2" size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Правила скидок</div>
            <div className="text-[10px] text-white/40">Синхронизировано с Админкой</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">

          {/* Зоны скидки */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Gauge" size={13} style={{ color: "#8b5cf6" }} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Зоны скидки</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <RiskField label="Безопасно до" desc="Зелёная зона" value={s.low_risk_threshold} min={1} max={s.mid_risk_threshold - 1} color="#10b981"
                onChange={v => update({ low_risk_threshold: v })} />
              <RiskField label="Умеренно до" desc="Жёлтая зона" value={s.mid_risk_threshold} min={s.low_risk_threshold + 1} max={s.max_discount - 1} color="#f59e0b"
                onChange={v => update({ mid_risk_threshold: v })} />
              <RiskField label="Максимум" desc="Красный стоп" value={s.max_discount} min={s.mid_risk_threshold + 1} max={99} color="#ef4444"
                onChange={v => update({ max_discount: v })} />
            </div>
          </div>

          {/* Защита маржи */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="ShieldAlert" size={13} style={{ color: "#8b5cf6" }} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Защита маржи</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <RiskField label="Минимум (стоп)" desc="Красный, нельзя применить" value={s.min_margin} min={0} max={s.warn_margin - 1} color="#ef4444"
                onChange={v => update({ min_margin: v })} />
              <RiskField label="Предупреждение" desc="Жёлтый, рискованно" value={s.warn_margin} min={s.min_margin + 1} max={80} color="#f59e0b"
                onChange={v => update({ warn_margin: v })} />
            </div>

            {/* Переключатель */}
            <button onClick={() => update({ allow_zero_margin: !s.allow_zero_margin })}
              className="flex items-center gap-3 w-full text-left">
              <div className="relative flex-shrink-0 w-9 h-5 rounded-full transition"
                style={{ background: s.allow_zero_margin ? "#8b5cf6" : "rgba(255,255,255,0.1)" }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: s.allow_zero_margin ? "17px" : "2px" }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-white/70">Разрешить нулевую маржу</div>
                <div className="text-[9px] text-white/30">Если выключено — скидки до нуля заблокированы</div>
              </div>
            </button>
          </div>

          {/* Подсказка */}
          <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <Icon name="Info" size={12} style={{ color: "#818cf8", flexShrink: 0, marginTop: 1 }} />
            <p className="text-[10px] text-indigo-300/70">
              Эти правила синхронизированы с разделом «Правила расчёта» в Админке. Изменения применятся сразу.
            </p>
          </div>
        </div>

        {/* Футер */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", color: t.textMute }}>
            Отмена
          </button>
          <button onClick={save}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
            style={{ background: saved ? "#10b981" : "#8b5cf6", color: "#fff", flex: 2 }}>
            {saved
              ? <><Icon name="CheckCircle2" size={14} /> Сохранено!</>
              : <><Icon name="Save" size={14} /> Сохранить правила</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

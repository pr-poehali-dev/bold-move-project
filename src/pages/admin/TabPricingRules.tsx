import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface PricingRules {
  econom_mult:    number;
  premium_mult:   number;
  econom_label:   string;
  standard_label: string;
  premium_label:  string;
}

interface Props { token: string; }

const DEFAULT: PricingRules = {
  econom_mult: 0.85, premium_mult: 1.27,
  econom_label: "Econom", standard_label: "Standard", premium_label: "Premium",
};

export default function TabPricingRules({ token }: Props) {
  const [rules,   setRules]   = useState<PricingRules>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=get-pricing-rules`, {
        headers: { "X-Authorization": `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.econom_mult !== undefined) setRules(d);
    } catch {
      // fallback to defaults
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(""); setSaved(false); setSaving(true);
    try {
      const r = await fetch(`${AUTH_URL}?action=save-pricing-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify(rules),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Ошибка сохранения");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof PricingRules>(k: K, v: PricingRules[K]) =>
    setRules(r => ({ ...r, [k]: v }));

  // Пример расчёта для превью
  const EXAMPLE = 34000;
  const econom   = Math.round(EXAMPLE * rules.econom_mult);
  const premium  = Math.round(EXAMPLE * rules.premium_mult);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">

      {/* Описание */}
      <div className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
        style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
        <Icon name="Info" size={15} className="text-violet-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-white/70 leading-relaxed">
          AI рассчитывает <span className="text-white font-semibold">Standard</span> как базовую стоимость по прайсу.{" "}
          <span className="text-white font-semibold">{rules.econom_label}</span> и{" "}
          <span className="text-white font-semibold">{rules.premium_label}</span> получаются умножением на коэффициент.
          Изменения применяются автоматически для всех новых расчётов.
        </div>
      </div>

      {/* Коэффициенты */}
      <div className="rounded-2xl p-5 space-y-5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
          <Icon name="SlidersHorizontal" size={13} />
          Коэффициенты
        </div>

        {/* Econom */}
        <div className="grid grid-cols-[1fr_auto_180px] items-center gap-4">
          <div>
            <input
              value={rules.econom_label}
              onChange={e => set("econom_label", e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-white/80 border-b border-white/10 pb-0.5 focus:outline-none focus:border-violet-400"
              placeholder="Econom"
            />
            <div className="text-[11px] text-white/35 mt-1">Название уровня</div>
          </div>
          <div className="text-white/20 text-lg">×</div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0.1} max={0.99} step={0.01}
                value={rules.econom_mult}
                onChange={e => set("econom_mult", parseFloat(e.target.value) || 0.85)}
                className="w-full px-3 py-2 rounded-xl text-sm font-mono text-center focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              />
            </div>
            <div className="text-[11px] text-white/35 mt-1 text-center">
              Standard × {rules.econom_mult} = скидка {Math.round((1 - rules.econom_mult) * 100)}%
            </div>
          </div>
        </div>

        {/* Standard */}
        <div className="grid grid-cols-[1fr_auto_180px] items-center gap-4">
          <div>
            <input
              value={rules.standard_label}
              onChange={e => set("standard_label", e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-violet-300 border-b border-violet-500/30 pb-0.5 focus:outline-none focus:border-violet-400"
              placeholder="Standard"
            />
            <div className="text-[11px] text-white/35 mt-1">Базовый уровень (×1.0)</div>
          </div>
          <div className="text-white/20 text-lg">×</div>
          <div>
            <div className="px-3 py-2 rounded-xl text-sm font-mono text-center"
              style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}>
              1.00
            </div>
            <div className="text-[11px] text-white/35 mt-1 text-center">Базовая цена, не меняется</div>
          </div>
        </div>

        {/* Premium */}
        <div className="grid grid-cols-[1fr_auto_180px] items-center gap-4">
          <div>
            <input
              value={rules.premium_label}
              onChange={e => set("premium_label", e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-white/80 border-b border-white/10 pb-0.5 focus:outline-none focus:border-violet-400"
              placeholder="Premium"
            />
            <div className="text-[11px] text-white/35 mt-1">Название уровня</div>
          </div>
          <div className="text-white/20 text-lg">×</div>
          <div>
            <input
              type="number" min={1.01} max={3.0} step={0.01}
              value={rules.premium_mult}
              onChange={e => set("premium_mult", parseFloat(e.target.value) || 1.27)}
              className="w-full px-3 py-2 rounded-xl text-sm font-mono text-center focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
            />
            <div className="text-[11px] text-white/35 mt-1 text-center">
              Standard × {rules.premium_mult} = наценка +{Math.round((rules.premium_mult - 1) * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Превью */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2 mb-4">
          <Icon name="Eye" size={13} />
          Так увидит клиент (пример: потолок 20 м²)
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="px-4 py-2.5 text-xs font-bold text-white/40 uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            Итоговая стоимость
          </div>
          {[
            { label: rules.econom_label,   val: econom,   isMain: false },
            { label: rules.standard_label, val: EXAMPLE,  isMain: true },
            { label: rules.premium_label,  val: premium,  isMain: false },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className={`text-sm ${row.isMain ? "text-violet-300 font-black" : "text-white/55"}`}>
                {row.label}:
              </span>
              <span className={`font-black tabular-nums ${row.isMain ? "text-violet-300 text-lg" : "text-white/55 text-sm"}`}>
                {row.val.toLocaleString("ru")} ₽
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ошибка */}
      {err && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
          {err}
        </div>
      )}

      {/* Сохранить */}
      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: saved ? "#10b981" : "#7c3aed" }}>
        {saving
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
          : saved
          ? <><Icon name="CheckCircle2" size={14} /> Сохранено — применится к новым расчётам</>
          : <><Icon name="Save" size={14} /> Сохранить правила</>}
      </button>
    </div>
  );
}

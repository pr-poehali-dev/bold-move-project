import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const LS_KEY = "discount_risk_settings";

interface RiskSettings {
  max_discount: number;        // Максимально допустимая скидка (абсолютный потолок)
  low_risk_threshold: number;  // До этого % — низкий риск (зелёная зона)
  mid_risk_threshold: number;  // До этого % — средний риск (жёлтая), выше — высокий (красный)
  min_margin: number;          // Минимальная маржа которую нельзя пробивать
  warn_margin: number;         // При марже ниже этого — предупреждение
  allow_zero_margin: boolean;  // Разрешить скидки до нулевой маржи
  require_approval: boolean;   // Скидки выше mid_risk требуют одобрения
  approval_note: string;       // Комментарий для менеджера при запросе одобрения
}

const DEFAULT: RiskSettings = {
  max_discount: 30,
  low_risk_threshold: 10,
  mid_risk_threshold: 20,
  min_margin: 5,
  warn_margin: 15,
  allow_zero_margin: false,
  require_approval: false,
  approval_note: "Для скидки выше среднего порога требуется одобрение руководителя",
};

function load(): RiskSettings {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? { ...DEFAULT, ...JSON.parse(s) } : DEFAULT;
  } catch { return DEFAULT; }
}

interface Props { isDark?: boolean; readOnly?: boolean; }

export default function TabDiscountRisk({ isDark = true, readOnly = false }: Props) {
  const [s, setS] = useState<RiskSettings>(load);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSaved(false); }, [s]);

  const update = (patch: Partial<RiskSettings>) => setS(prev => ({ ...prev, ...patch }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const border   = isDark ? "border-white/10"   : "border-gray-200";
  const bg       = isDark ? "bg-white/[0.03]"   : "bg-white";
  const text     = isDark ? "text-white/80"      : "text-gray-800";
  const sub      = isDark ? "text-white/40"      : "text-gray-500";
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`;

  // Визуализация зон риска
  const total = s.max_discount || 1;
  const greenPct  = Math.min(100, (s.low_risk_threshold / total) * 100);
  const yellowPct = Math.min(100 - greenPct, ((s.mid_risk_threshold - s.low_risk_threshold) / total) * 100);
  const redPct    = 100 - greenPct - yellowPct;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Визуальная шкала */}
      <div className={`rounded-2xl p-4 ${bg} border ${border}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="BarChart3" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Шкала риска скидки
          </span>
        </div>
        <div className="relative h-8 rounded-xl overflow-hidden flex mb-2">
          <div style={{ width: `${greenPct}%`, background: "linear-gradient(90deg,#10b981,#84cc16)" }}
            className="flex items-center justify-center">
            {greenPct > 12 && <span className="text-[10px] font-bold text-white/90">Низкий</span>}
          </div>
          <div style={{ width: `${yellowPct}%`, background: "linear-gradient(90deg,#f59e0b,#f97316)" }}
            className="flex items-center justify-center">
            {yellowPct > 12 && <span className="text-[10px] font-bold text-white/90">Средний</span>}
          </div>
          <div style={{ width: `${redPct}%`, background: "linear-gradient(90deg,#ef4444,#dc2626)" }}
            className="flex items-center justify-center">
            {redPct > 12 && <span className="text-[10px] font-bold text-white/90">Высокий</span>}
          </div>
        </div>
        <div className="flex justify-between text-[10px]" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
          <span>0%</span>
          <span style={{ color: "#10b981" }}>↑ {s.low_risk_threshold}%</span>
          <span style={{ color: "#f59e0b" }}>↑ {s.mid_risk_threshold}%</span>
          <span style={{ color: "#ef4444" }}>max {s.max_discount}%</span>
        </div>
        {/* Легенда */}
        <div className="flex gap-4 mt-3">
          {[
            { color: "#10b981", label: "Низкий риск",    range: `0–${s.low_risk_threshold}%` },
            { color: "#f59e0b", label: "Средний риск",   range: `${s.low_risk_threshold}–${s.mid_risk_threshold}%` },
            { color: "#ef4444", label: "Высокий риск",   range: `${s.mid_risk_threshold}–${s.max_discount}%` },
          ].map(z => (
            <div key={z.color} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
              <div>
                <div className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</div>
                <div className="text-[9px]" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>{z.range}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Настройки порогов */}
      <div className={`rounded-2xl p-4 ${bg} border ${border} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Sliders" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Пороги скидки
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Максимальная скидка */}
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#ef4444" }}>
              Максимум (абсолютный запрет)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={99} disabled={readOnly}
                value={s.max_discount} onChange={e => update({ max_discount: Number(e.target.value) })}
                className={inputCls} style={{ borderColor: "#ef444440" }} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Выше этой скидки система заблокирует применение</p>
          </div>

          {/* Порог среднего риска */}
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#f59e0b" }}>
              Порог среднего риска
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={s.max_discount - 1} disabled={readOnly}
                value={s.mid_risk_threshold} onChange={e => update({ mid_risk_threshold: Number(e.target.value) })}
                className={inputCls} style={{ borderColor: "#f59e0b40" }} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Выше — высокий риск (красная зона)</p>
          </div>

          {/* Порог низкого риска */}
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#10b981" }}>
              Порог низкого риска
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={s.mid_risk_threshold - 1} disabled={readOnly}
                value={s.low_risk_threshold} onChange={e => update({ low_risk_threshold: Number(e.target.value) })}
                className={inputCls} style={{ borderColor: "#10b98140" }} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>До этого значения — безопасная зона</p>
          </div>
        </div>
      </div>

      {/* Настройки маржи */}
      <div className={`rounded-2xl p-4 ${bg} border ${border} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="TrendingDown" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Защита маржи
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block ${text}`}>
              Минимальная маржа (стоп)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} disabled={readOnly}
                value={s.min_margin} onChange={e => update({ min_margin: Number(e.target.value) })}
                className={inputCls} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Скидка не применится если маржа упадёт ниже</p>
          </div>
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block ${text}`}>
              Маржа — порог предупреждения
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} disabled={readOnly}
                value={s.warn_margin} onChange={e => update({ warn_margin: Number(e.target.value) })}
                className={inputCls} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Ниже этого значения — жёлтое предупреждение в блоке</p>
          </div>
        </div>

        {/* Переключатели */}
        <div className="space-y-3 pt-1">
          {[
            { key: "allow_zero_margin" as const, label: "Разрешить скидки вплоть до нулевой маржи", desc: "Если выключено — скидки до нуля заблокированы", color: "#f59e0b" },
            { key: "require_approval" as const,  label: "Требовать одобрение для высокого риска",   desc: "Скидки в красной зоне потребуют подтверждения", color: "#ef4444" },
          ].map(row => (
            <div key={row.key} className="flex items-start gap-3">
              <button disabled={readOnly} onClick={() => update({ [row.key]: !s[row.key] })}
                className={`flex-shrink-0 w-9 h-5 rounded-full transition relative ${s[row.key] ? "bg-violet-600" : isDark ? "bg-white/10" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s[row.key] ? "left-4" : "left-0.5"}`} />
              </button>
              <div>
                <div className={`text-xs font-semibold ${text}`}>{row.label}</div>
                <div className={`text-[10px] mt-0.5 ${sub}`}>{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Комментарий для одобрения */}
      {s.require_approval && (
        <div className={`rounded-2xl p-4 ${bg} border ${border}`}>
          <label className={`text-[10px] font-semibold uppercase tracking-wider mb-2 block ${text}`}>
            Сообщение при запросе одобрения
          </label>
          <textarea disabled={readOnly} rows={2}
            value={s.approval_note} onChange={e => update({ approval_note: e.target.value })}
            className={`${inputCls} resize-none`}
            placeholder="Текст который увидит менеджер при запросе одобрения скидки..." />
        </div>
      )}

      {/* Кнопка сохранения */}
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button onClick={save}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-80"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Icon name={saved ? "Check" : "Save"} size={14} />
            {saved ? "Сохранено" : "Сохранить настройки"}
          </button>
          <span className={`text-[10px] ${sub}`}>Настройки сохраняются локально</span>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client, crmFetch } from "./crmApi";
import { CustomFinRow } from "./drawerTypes";
import { AUTH_URL, EstimateBlock, parseValue, fmt as fmtEst, pricingRules } from "./estimateTypes";

const RISK_LS_KEY = "discount_risk_settings";

interface RiskSettings {
  max_discount: number;
  low_risk_threshold: number;
  mid_risk_threshold: number;
  min_margin: number;
  warn_margin: number;
  allow_zero_margin: boolean;
}

const RISK_DEFAULTS: RiskSettings = {
  max_discount: 30,
  low_risk_threshold: 10,
  mid_risk_threshold: 20,
  min_margin: 5,
  warn_margin: 15,
  allow_zero_margin: false,
};

function loadRiskSettings(): RiskSettings {
  try {
    const s = localStorage.getItem(RISK_LS_KEY);
    return s ? { ...RISK_DEFAULTS, ...JSON.parse(s) } : RISK_DEFAULTS;
  } catch { return RISK_DEFAULTS; }
}

interface Props {
  data: Client;
  customFinRows: CustomFinRow[];
  onContractSumUpdated?: (newSum: number) => void;
}

export function DrawerDiscountBlock({ data, customFinRows, onContractSumUpdated }: Props) {
  const t = useTheme();
  const [discount, setDiscount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applied,  setApplied]  = useState(false);
  const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

  // Настройки управления риском из вкладки "Правила расчёта"
  const risk = useMemo(() => loadRiskSettings(), []);

  const customCostRows = customFinRows
    .filter(r => r.block === "costs")
    .map(r => ({ value: Number(localStorage.getItem(`fin_row_${data.id}_${r.key}`)) || 0 }));
  const customIncomeRows = customFinRows
    .filter(r => r.block === "income")
    .map(r => ({ value: Number(localStorage.getItem(`fin_row_${data.id}_${r.key}`)) || 0 }));

  const plCosts = (Number(data.material_cost) || 0)
    + (Number(data.measure_cost) || 0)
    + (Number(data.install_cost) || 0)
    + customCostRows.reduce((s, r) => s + r.value, 0);

  const baseIncome = (Number(data.contract_sum) || 0)
    + customIncomeRows.reduce((s, r) => s + r.value, 0);

  // Точка безубыточности — реальный максимум из данных заказа
  const breakEvenDiscount = useMemo(() => {
    if (baseIncome <= 0) return 0;
    const d = (1 - plCosts / baseIncome) * 100;
    return Math.max(0, Math.floor(d * 10) / 10);
  }, [baseIncome, plCosts]);

  // Пороги берём напрямую из настроек — не адаптируем автоматически
  // Только sliderMax ограничиваем безубыточностью чтобы не уйти в минус
  const zoneLow   = risk.low_risk_threshold;
  const zoneMid   = risk.mid_risk_threshold;
  const zoneMax   = Math.min(risk.max_discount, breakEvenDiscount > 0 ? breakEvenDiscount : risk.max_discount);
  const sliderMax = Math.round(zoneMax * 10) / 10;

  const discountedIncome = baseIncome * (1 - discount / 100);
  const discountedProfit = discountedIncome - plCosts;
  const discountedMargin = discountedIncome > 0
    ? Math.round((discountedProfit / discountedIncome) * 100)
    : 0;

  const isNegative = discountedProfit < 0 || (!risk.allow_zero_margin && discountedMargin < risk.min_margin);
  const isWarning  = !isNegative && discountedMargin < risk.warn_margin;
  // Зона текущей скидки
  const currentZone = discount === 0 ? "none"
    : discount <= zoneLow ? "low"
    : discount <= zoneMid ? "mid"
    : "high";

  const accentColor = isNegative ? "#ef4444"
    : currentZone === "low" ? "#10b981"
    : currentZone === "mid" ? "#f59e0b"
    : "#ef4444";
  const bgColor     = isNegative ? "#ef444412" : "#f59e0b10";
  const borderColor = isNegative ? "#ef444430" : "#f59e0b25";

  // Применить скидку к позициям сметы
  const applyDiscount = async () => {
    if (discount === 0 || isNegative) return;
    setApplying(true);
    setApplied(false);
    try {
      // 1. Загружаем текущую смету
      const d = await fetch(`${AUTH_URL}?action=estimate-by-chat&chat_id=${data.id}`).then(r => r.json());
      if (!d.estimate) return;

      const mult = 1 - discount / 100;

      // 2. Пересчитываем цены всех позиций
      const newBlocks: EstimateBlock[] = d.estimate.blocks.map((block: EstimateBlock) => ({
        ...block,
        items: block.items.map(item => {
          const p = parseValue(item.value);
          if (!p) return item;
          const newPrice = Math.round(p.price * mult);
          const newTotal = Math.round(p.qty * newPrice);
          return {
            ...item,
            value: `${p.qty} ${p.unit} × ${newPrice} ₽ = ${fmtEst(newTotal)} ₽`,
          };
        }),
      }));

      // 3. Пересчитываем итоги
      let standard = 0;
      for (const block of newBlocks) {
        for (const item of block.items) {
          const p = parseValue(item.value);
          if (p) standard += p.total;
        }
      }
      const econom  = Math.round(standard * pricingRules.econom_mult);
      const premium = Math.round(standard * pricingRules.premium_mult);
      const newTotals = [
        `${pricingRules.econom_label}: ${fmtEst(econom)} ₽`,
        `${pricingRules.standard_label}: ${fmtEst(standard)} ₽`,
        `${pricingRules.premium_label}: ${fmtEst(premium)} ₽`,
      ];

      // 4. Сохраняем смету
      await fetch(`${AUTH_URL}?action=update-estimate&id=${d.estimate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: newBlocks, totals: newTotals }),
      });

      // 5. Обновляем contract_sum
      await crmFetch("clients", {
        method: "PUT",
        body: JSON.stringify({ contract_sum: standard }),
      }, { id: String(data.id) });

      onContractSumUpdated?.(standard);
      setApplied(true);
      setDiscount(0);
    } finally {
      setApplying(false);
    }
  };

  if (baseIncome <= 0 && plCosts <= 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
      {/* Шапка */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <Icon name="Tag" size={13} style={{ color: accentColor }} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color: accentColor }}>
          Оценка риска скидки
        </span>
        {zoneMax > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#f59e0b20", color: "#f59e0b" }}>
            можно до {zoneMax}%
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* 4 плитки */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ffffff08", border: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1 text-white/40">Скидка</div>
            <div className="text-base font-black" style={{ color: accentColor }}>{discount}%</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: "#ffffff08", border: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1 text-white/40">Сумма скидки</div>
            <div className="text-sm font-black text-white/70">−{fmt(baseIncome * discount / 100)} ₽</div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: isNegative ? "#ef444412" : "#10b98112", border: `1px solid ${isNegative ? "#ef444430" : "#10b98125"}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "Убыток" : "Прибыль"}
            </div>
            <div className="text-sm font-black" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "" : "+"}{fmt(discountedProfit)} ₽
            </div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: isNegative ? "#ef444412" : "#10b98112", border: `1px solid ${isNegative ? "#ef444430" : "#10b98125"}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: isNegative ? "#ef4444" : "#10b981" }}>Маржа</div>
            <div className="text-sm font-black" style={{ color: isNegative ? "#ef4444" : "#10b981" }}>
              {isNegative ? "—" : `${discountedMargin}%`}
            </div>
          </div>
        </div>

        {/* Предупреждения */}
        {isNegative && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-pulse"
            style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
            <Icon name="AlertTriangle" size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-red-400">Нельзя давать такую скидку</div>
              <div className="text-[10px] text-red-300/70">Объект становится убыточным</div>
            </div>
          </div>
        )}
        {isWarning && !isNegative && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <Icon name="AlertCircle" size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <div className="text-[10px] text-yellow-300/80">
              Маржа ниже {risk.warn_margin}% — скидка рискованная
              {currentZone === "high" && " (высокий риск по правилам)"}
            </div>
          </div>
        )}
        {applied && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#10b98115", border: "1px solid #10b98130" }}>
            <Icon name="CheckCircle2" size={14} style={{ color: "#10b981", flexShrink: 0 }} />
            <div className="text-[10px] text-emerald-300">Скидка применена — смета и P&L обновлены</div>
          </div>
        )}

        {/* Шкала + слайдер */}
        <div className="space-y-1">
          {/* Цветная шкала — единый плавный градиент */}
          {(() => {
            const max    = sliderMax || 1;
            const lowPct = Math.min(100, (zoneLow / max) * 100);
            const midPct = Math.min(100, (zoneMid / max) * 100);
            return (
              <div className="relative h-7 rounded-lg overflow-hidden"
                style={{ background: `linear-gradient(90deg, #16a34a 0%, #84cc16 ${lowPct * 0.6}%, #f59e0b ${lowPct}%, #f97316 ${midPct * 0.7}%, #ef4444 ${midPct}%, #dc2626 100%)` }}>
                {/* Подписи зон */}
                <div className="absolute inset-0 flex">
                  <div style={{ width: `${lowPct}%` }} className="flex items-center justify-center">
                    {lowPct > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Низкий</span>}
                  </div>
                  <div style={{ width: `${midPct - lowPct}%` }} className="flex items-center justify-center">
                    {(midPct - lowPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Средний</span>}
                  </div>
                  <div style={{ width: `${100 - midPct}%` }} className="flex items-center justify-center">
                    {(100 - midPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Высокий</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Метки границ зон */}
          <div className="relative h-4">
            <span className="absolute left-0 text-[9px] text-white/30">0%</span>
            {sliderMax > 0 && (() => {
              const lowPct = Math.min(96, (zoneLow / sliderMax) * 100);
              const midPct = Math.min(96, (zoneMid / sliderMax) * 100);
              return (
                <>
                  <span className="absolute text-[9px] font-bold"
                    style={{ left: `${lowPct}%`, color: "#f59e0b", transform: "translateX(-50%)" }}>
                    ↑ {Math.round(zoneLow * 10) / 10}%
                  </span>
                  <span className="absolute text-[9px] font-bold"
                    style={{ left: `${midPct}%`, color: "#ef4444", transform: "translateX(-50%)" }}>
                    ↑ {Math.round(zoneMid * 10) / 10}%
                  </span>
                </>
              );
            })()}
            <span className="absolute right-0 text-[9px] text-white/30">max {sliderMax}%</span>
          </div>

          {/* Слайдер */}
          <div className="relative" style={{ marginTop: -4 }}>
            <input
              type="range" min={0} max={sliderMax || 1} step={0.5} value={discount}
              onChange={e => { setDiscount(Number(e.target.value)); setApplied(false); }}
              className="w-full cursor-pointer relative z-10"
              style={{
                accentColor: isNegative ? "#ef4444"
                  : currentZone === "low"  ? "#10b981"
                  : currentZone === "mid"  ? "#f59e0b"
                  : currentZone === "high" ? "#ef4444"
                  : "#10b981",
                height: 4, background: "transparent",
              }}
            />
          </div>

          {/* Легенда с реальными значениями из настроек */}
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { color: "#10b981", label: "Низкий риск",  range: `0–${Math.round(zoneLow * 10) / 10}%` },
              { color: "#f59e0b", label: "Средний риск", range: `${Math.round(zoneLow * 10) / 10}–${Math.round(zoneMid * 10) / 10}%` },
              { color: "#ef4444", label: "Высокий риск", range: `${Math.round(zoneMid * 10) / 10}–${sliderMax}%` },
            ].map(z => (
              <div key={z.color} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color }} />
                <span className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</span>
                <span className="text-[9px] text-white/25">{z.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Футер: итог + кнопка */}
        <div className="flex items-center gap-3">
          {discount > 0 && (
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "#ffffff06", border: `1px solid ${t.border}` }}>
              <span className="text-[11px] text-white/50">Сумма со скидкой {discount}%</span>
              <span className="text-[12px] font-bold text-white/80">{fmt(discountedIncome)} ₽</span>
            </div>
          )}
          <button
            onClick={applyDiscount}
            disabled={discount === 0 || isNegative || applying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 flex-shrink-0"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
            {applying
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Применяем...</>
              : <><Icon name="Percent" size={12} /> Применить скидку</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}